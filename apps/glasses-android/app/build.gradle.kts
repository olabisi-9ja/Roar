import java.util.Properties

plugins {
  id("com.android.application")
}

// Machine-local values (gitignored). The DAT client token is a credential; "0" is Meta's Developer Mode placeholder.
val local = Properties().apply {
  rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

android {
  namespace = "com.roar.glasses"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.roar.glasses"
    minSdk = 31
    targetSdk = 36
    versionCode = 1
    versionName = "0.1"
    manifestPlaceholders["mwdat_application_id"] = local.getProperty("mwdat_application_id", "0")
    manifestPlaceholders["mwdat_client_token"] = local.getProperty("mwdat_client_token", "0")
    buildConfigField(
      "String",
      "ROAR_API_URL",
      "\"${local.getProperty("roar_api_url", "https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io")}\"",
    )
  }

  buildFeatures { buildConfig = true }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
}

dependencies {
  implementation("com.meta.wearable:mwdat-core:1.0.1")
  implementation("com.meta.wearable:mwdat-camera:1.0.1")
  implementation("androidx.activity:activity-ktx:1.10.1")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
}
