# Roar on Meta AI glasses

Two paths, both on the existing API. Neither adds new endpoints.

## 1. Ray-Ban Display web app (heads-up live match)

`apps/web/public/glasses.html` — one static page, served by the fan web app at `/glasses.html`.
It polls `/api/matches`, `/api/matches/:id` and `/api/matches/:id/moments` every 15 s and shows the
score, the clock, and the latest goals, cards and published crowd Moments. "Next match" cycles fixtures;
"Goal alerts" reads new goals aloud with `speechSynthesis` when the runtime supports it.

Built to Meta's web-app guidance: `<meta name="mrbd-web-app-capable" content="yes">`, a black (unlit,
see-through) canvas with bounded surfaces, layout derived from the viewport (600×600 is the validation
target), and focusable list items and buttons for directional navigation. Moment titles are inserted as
text only, never HTML.

- Live URL once the web image is rebuilt: `https://ca-web.wittyocean-f89cf633.eastus2.azurecontainerapps.io/glasses.html`
- Preview: Chrome with the Meta Ray-Ban Display Simulator extension, or the `web-live-api` launch config
  (dev server on :3003 against the live API).
- On device: Meta AI app → Developer Mode (tap the app version five times), then open the URL.
- Not done: an app icon (Meta Wearables manifest), and submission through the Wearables Developer Center.

## 2. Glasses camera capture (Android, Device Access Toolkit)

`apps/glasses-android` — a one-screen Kotlin app on DAT `mwdat-core`/`mwdat-camera` 1.0.1.

Flow: Bluetooth permission → `Wearables.initialize` → **Connect glasses** (`startRegistration` in the
Meta AI app) → **Capture and share**: camera permission via Meta AI, open a session and a low-rate stream,
`stream.capturePhoto()`, re-encode to JPEG, then `POST /media` with `audience=community` for the live
match.

Privacy rules carry over unchanged. Uploads are `community`, so they pass the server's signature check, AI
analysis and moderator approval before anything is public. Re-encoding to JPEG also drops EXIF/GPS before
the photo leaves the phone. The guest identity is the API's `roar_actor` cookie, kept in memory for the
app process.

Build (needs JDK 17+, e.g. Android Studio's bundled JBR, and the Android SDK):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd apps/glasses-android
.\gradlew.bat assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
```

If Gradle fails with `Unable to establish loopback connection`, the JDK cannot create its internal pipe
under the user temp path. Point it at a plain folder first:
`$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=C:\gradle-tmp -Djava.io.tmpdir=C:\gradle-tmp"`.

Optional `apps/glasses-android/local.properties` (gitignored): `roar_api_url=...` (defaults to the Azure
API), plus `mwdat_application_id` / `mwdat_client_token` from the Wearables Developer Center. Both default
to `0`, which works in Developer Mode only.

Not done: no on-glasses testing yet (needs paired glasses with Developer Mode on); no MockDeviceKit test
harness; video clips (photos only); iOS (same SDK shape, `MWDATCore`/`MWDATCamera`).
