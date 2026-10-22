package com.roar.glasses

import android.Manifest
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.PhotoData
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.StreamState
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import java.io.ByteArrayOutputStream
import java.net.CookieHandler
import java.net.CookieManager
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

/**
 * Roar's glasses camera: link Meta AI glasses, take a photo through them, and share it with the live match.
 * Uploads go to the same POST /media the web capture screen uses, as `community` media, so they pass the
 * same signature checks, AI analysis and moderator approval before anything is public.
 */
class MainActivity : ComponentActivity() {
  private lateinit var status: TextView
  private var session: DeviceSession? = null
  private var camera: Camera? = null
  private var permissionResult: CompletableDeferred<PermissionStatus>? = null

  private val wearablesPermission =
      registerForActivityResult(Wearables.RequestPermissionContract()) { result ->
        permissionResult?.complete(result.getOrDefault(PermissionStatus.Denied))
      }

  // DAT needs Bluetooth CONNECT before it boots.
  private val bluetoothPermission =
      registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) initializeWearables() else say("Bluetooth permission is needed to reach the glasses.")
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // The API identifies a guest by its roar_actor cookie; keep it for this process.
    CookieHandler.setDefault(CookieManager())

    status = TextView(this).apply { textSize = 18f; text = "Starting…" }
    val connect = Button(this).apply { text = "Connect glasses"; setOnClickListener { Wearables.startRegistration(this@MainActivity) } }
    val capture = Button(this).apply { text = "Capture and share"; setOnClickListener { captureAndShare() } }
    setContentView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(48, 96, 48, 48)
      addView(status)
      addView(connect)
      addView(capture)
    })

    bluetoothPermission.launch(Manifest.permission.BLUETOOTH_CONNECT)
  }

  private fun initializeWearables() {
    Wearables.initialize(applicationContext).onFailure { error, _ -> say("Glasses toolkit failed: ${error.description}") }
    lifecycleScope.launch { Wearables.registrationState.collect { say("Glasses: $it") } }
  }

  private fun captureAndShare() = lifecycleScope.launch {
    try {
      if (!cameraPermitted()) return@launch say("Allow camera access for Roar in the Meta AI app.")
      say("Opening the glasses camera…")
      val stream = (camera ?: openCamera()).stream
      say("Capturing…")
      val photo = stream.capturePhoto().fold(onSuccess = { it }, onFailure = { error, _ -> throw IllegalStateException(error.description) })
      val jpeg = withContext(Dispatchers.Default) { toJpeg(photo) }
      say("Sharing with the match…")
      val id = withContext(Dispatchers.IO) { upload(jpeg) }
      say("Shared. A moderator reviews it before it goes live. (ref ${id.take(8)})")
    } catch (e: Exception) {
      say("Couldn't share: ${e.message}")
    }
  }

  private suspend fun cameraPermitted(): Boolean {
    val current = Wearables.checkPermissionStatus(Permission.CAMERA).getOrNull()
    if (current == PermissionStatus.Granted) return true
    val asked = CompletableDeferred<PermissionStatus>().also { permissionResult = it }
    wearablesPermission.launch(Permission.CAMERA)
    return asked.await() == PermissionStatus.Granted
  }

  /** One session and one low-rate stream, kept open so each capture is quick. */
  private suspend fun openCamera(): Camera {
    val s = session ?: Wearables.createSession(AutoDeviceSelector()).getOrNull()?.also { session = it }
        ?: throw IllegalStateException("No glasses connected.")
    s.start()
    withTimeout(20_000) { s.state.first { it == DeviceSessionState.STARTED } }
    val cam = s.addCamera(StreamConfiguration(videoQuality = VideoQuality.LOW, frameRate = 7))
        .fold(onSuccess = { it }, onFailure = { error, _ -> throw IllegalStateException(error.description) })
    cam.stream.start()
    withTimeout(20_000) { cam.stream.state.first { it == StreamState.STREAMING } }
    camera = cam
    return cam
  }

  override fun onDestroy() {
    camera?.stop()
    session?.stop()
    super.onDestroy()
  }

  /**
   * The API accepts JPEG, not HEIC. Re-encoding also drops EXIF (including any location) before upload,
   * which the server does not yet strip itself.
   */
  private fun toJpeg(photo: PhotoData): ByteArray {
    val bitmap = when (photo) {
      is PhotoData.Bitmap -> photo.bitmap
      is PhotoData.HEIC -> {
        val buffer = photo.data.asReadOnlyBuffer().apply { rewind() }
        val bytes = ByteArray(buffer.remaining()).also { buffer.get(it) }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw IllegalStateException("Unreadable photo.")
      }
    }
    return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }.toByteArray()
  }

  /** The live match first, then the next one up: the same default the fan app uses. */
  private fun currentMatchId(): String {
    val list = JSONObject(URL("${BuildConfig.ROAR_API_URL}/matches").readText())
    for (group in listOf("live", "upcoming", "recent")) {
      val fixtures = list.optJSONArray(group) ?: continue
      if (fixtures.length() > 0) return fixtures.getJSONObject(0).getString("id")
    }
    throw IllegalStateException("No match to share with right now.")
  }

  private fun upload(jpeg: ByteArray): String {
    val boundary = "roar-${UUID.randomUUID()}"
    val conn = URL("${BuildConfig.ROAR_API_URL}/media").openConnection() as HttpURLConnection
    conn.requestMethod = "POST"
    conn.doOutput = true
    conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
    conn.outputStream.use { out ->
      fun field(name: String, value: String) =
          out.write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray())
      field("matchId", currentMatchId())
      field("audience", "community")
      out.write("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"glasses.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".toByteArray())
      out.write(jpeg)
      out.write("\r\n--$boundary--\r\n".toByteArray())
    }
    val code = conn.responseCode
    val body = (if (code < 400) conn.inputStream else conn.errorStream).bufferedReader().readText()
    if (code !in 200..299) throw IllegalStateException(JSONObject(body).optString("error", "HTTP $code"))
    return JSONObject(body).getString("id")
  }

  private fun say(text: String) = runOnUiThread { status.text = text }
}
