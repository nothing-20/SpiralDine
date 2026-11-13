// Top-level build file where you can add configuration options common to all sub-projects/modules.
import com.android.build.api.dsl.ApplicationExtension
import groovy.json.JsonSlurper
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import java.io.StringReader
import java.util.Properties

abstract class VerifyFirebaseConfigTask : DefaultTask() {
  @get:Input abstract val flavorName: Property<String>
  @get:Input abstract val modulePath: Property<String>
  @get:Input abstract val configured: Property<Boolean>
  @get:Input abstract val firebaseProjectId: Property<String>
  @get:Input abstract val storageBucket: Property<String>
  @get:Input abstract val sourceDescription: Property<String>
  @get:Input abstract val blockedProductionId: Property<String>

  @TaskAction
  fun verify() {
    val flavor = flavorName.get()
    val mod = modulePath.get()
    val pid = firebaseProjectId.get()
    val bucket = storageBucket.get()
    val prodId = blockedProductionId.get()

    if (!configured.get() || pid.isBlank()) {
      throw GradleException(
        "[ENVIRONMENT ISOLATION ERROR] Cannot package APK/AAB for $mod flavor '$flavor' because Firebase is not configured. " +
          "Copy android/config/firebase-$flavor.properties.example to android/config/firebase-$flavor.properties " +
          "(or place src/$flavor/google-services.json) with your isolated Firebase project settings. " +
          "See docs/governance/FREE_TIER_FIREBASE_SETUP_GUIDE.md."
      )
    }

    if (flavor != "prod" && (pid.equals(prodId, ignoreCase = true) || bucket.contains(prodId, ignoreCase = true))) {
      throw GradleException(
        "[ENVIRONMENT ISOLATION VIOLATION] Non-production flavor '$flavor' in $mod is forbidden from targeting production Firebase project '$prodId' (source: ${sourceDescription.get()})."
      )
    }
  }
}

plugins {
  alias(libs.plugins.android.application) apply false
  alias(libs.plugins.compose.compiler) apply false
  alias(libs.plugins.kotlin.serialization) apply false
}

data class ModuleEnvSpec(
  val defaultApplicationId: String,
  val baseAppName: String,
  val propSuffix: String,
)

data class ResolvedAndroidFirebaseConfig(
  val configured: Boolean,
  val apiKey: String,
  val projectId: String,
  val applicationId: String,
  val storageBucket: String,
  val gcmSenderId: String,
  val sourceDescription: String,
)

val moduleEnvSpecs = mapOf(
  ":app" to ModuleEnvSpec("com.spiraldine.printbridge", "SpiralDine Print Bridge", "APP"),
  ":customer" to ModuleEnvSpec("com.spiralworld.spiraldine", "Spiral Dine", "CUSTOMER"),
  ":owner" to ModuleEnvSpec("com.spiraldine.owner", "SpiralDine Owner", "OWNER"),
)

val productionProjectId = "spiral-restaurant-saas-v1"

fun isPlaceholderOrBlank(value: String?): Boolean {
  val trimmed = value?.trim().orEmpty()
  if (trimmed.isEmpty()) return true
  val lower = trimmed.lowercase()
  return lower.startsWith("your_") ||
    lower.startsWith("<") ||
    lower.startsWith("placeholder") ||
    lower.startsWith("changeme") ||
    lower.startsWith("replace") ||
    lower.contains("your_project_id")
}

fun escapeBuildConfigString(raw: String): String {
  val escaped = raw.replace("\\", "\\\\").replace("\"", "\\\"")
  return "\"$escaped\""
}

@Suppress("UNCHECKED_CAST")
fun resolveFlavorFirebaseConfig(
  rootProj: Project,
  moduleProj: Project,
  spec: ModuleEnvSpec,
  flavorName: String,
): ResolvedAndroidFirebaseConfig {
  val propsFile = rootProj.layout.projectDirectory.file("config/firebase-$flavorName.properties")
  val propsText = moduleProj.providers.fileContents(propsFile).asText.orNull
  if (!propsText.isNullOrBlank()) {
    val props = Properties()
    props.load(StringReader(propsText))
    val apiKey = props.getProperty("FIREBASE_API_KEY")?.trim().orEmpty()
    val projectId = props.getProperty("FIREBASE_PROJECT_ID")?.trim().orEmpty()
    val storageBucket = props.getProperty("FIREBASE_STORAGE_BUCKET")?.trim().orEmpty()
    val gcmSenderId = props.getProperty("FIREBASE_GCM_SENDER_ID")?.trim().orEmpty()
    val appId = (
      props.getProperty("FIREBASE_APPLICATION_ID_${spec.propSuffix}")
        ?: props.getProperty("FIREBASE_APPLICATION_ID")
      )?.trim().orEmpty()

    val valid = !isPlaceholderOrBlank(apiKey) &&
      !isPlaceholderOrBlank(projectId) &&
      !isPlaceholderOrBlank(appId) &&
      !isPlaceholderOrBlank(storageBucket)

    return ResolvedAndroidFirebaseConfig(
      configured = valid,
      apiKey = if (valid) apiKey else "",
      projectId = if (valid) projectId else "",
      applicationId = if (valid) appId else "",
      storageBucket = if (valid) storageBucket else "",
      gcmSenderId = gcmSenderId,
      sourceDescription = "android/config/firebase-$flavorName.properties",
    )
  }

  val googleServicesFile = moduleProj.layout.projectDirectory.file("src/$flavorName/google-services.json")
  val googleServicesText = moduleProj.providers.fileContents(googleServicesFile).asText.orNull
  if (!googleServicesText.isNullOrBlank()) {
    val parsed = JsonSlurper().parseText(googleServicesText) as? Map<String, Any?> ?: emptyMap()
    val projectInfo = parsed["project_info"] as? Map<String, Any?> ?: emptyMap()
    val projectId = projectInfo["project_id"]?.toString()?.trim().orEmpty()
    val storageBucket = projectInfo["storage_bucket"]?.toString()?.trim().orEmpty()
    val projectNumber = projectInfo["project_number"]?.toString()?.trim().orEmpty()
    val expectedPackage = if (flavorName == "prod") spec.defaultApplicationId else "${spec.defaultApplicationId}.$flavorName"

    val clients = parsed["client"] as? List<Map<String, Any?>> ?: emptyList()
    val matchingClient = clients.firstOrNull { client ->
      val clientInfo = client["client_info"] as? Map<String, Any?>
      val androidInfo = clientInfo?.get("android_client_info") as? Map<String, Any?>
      androidInfo?.get("package_name")?.toString()?.trim() == expectedPackage
    } ?: clients.firstOrNull()

    val clientInfo = matchingClient?.get("client_info") as? Map<String, Any?> ?: emptyMap()
    val appId = clientInfo["mobilesdk_app_id"]?.toString()?.trim().orEmpty()
    val apiKeys = matchingClient?.get("api_key") as? List<Map<String, Any?>> ?: emptyList()
    val apiKey = apiKeys.firstOrNull()?.get("current_key")?.toString()?.trim().orEmpty()

    val valid = !isPlaceholderOrBlank(apiKey) &&
      !isPlaceholderOrBlank(projectId) &&
      !isPlaceholderOrBlank(appId) &&
      !isPlaceholderOrBlank(storageBucket)

    return ResolvedAndroidFirebaseConfig(
      configured = valid,
      apiKey = if (valid) apiKey else "",
      projectId = if (valid) projectId else "",
      applicationId = if (valid) appId else "",
      storageBucket = if (valid) storageBucket else "",
      gcmSenderId = projectNumber,
      sourceDescription = "src/$flavorName/google-services.json",
    )
  }

  // Confirmed production Firebase project configuration (ONLY applied to the `prod` flavor;
  // `dev` and `staging` NEVER silently fall back to production).
  if (flavorName == "prod") {
    return ResolvedAndroidFirebaseConfig(
      configured = true,
      apiKey = "AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg",
      projectId = productionProjectId,
      applicationId = spec.defaultApplicationId,
      storageBucket = "$productionProjectId.firebasestorage.app",
      gcmSenderId = "917630391162",
      sourceDescription = "confirmed-production-defaults ($productionProjectId)",
    )
  }

  return ResolvedAndroidFirebaseConfig(
    configured = false,
    apiKey = "",
    projectId = "",
    applicationId = "",
    storageBucket = "",
    gcmSenderId = "",
    sourceDescription = "unconfigured",
  )
}

subprojects {
  val spec = moduleEnvSpecs[path] ?: return@subprojects

  plugins.withId("com.android.application") {
    val flavorConfigs = listOf("dev", "staging", "prod").associateWith { flavorName ->
      resolveFlavorFirebaseConfig(rootProject, this@subprojects, spec, flavorName)
    }

    extensions.configure<ApplicationExtension>("android") {
      buildFeatures {
        resValues = true
        buildConfig = true
      }

      flavorDimensions += "env"

      productFlavors {
        create("dev") {
          dimension = "env"
          applicationIdSuffix = ".dev"
          versionNameSuffix = "-dev"
          resValue("string", "app_name", "${spec.baseAppName} (Dev)")
        }
        create("staging") {
          dimension = "env"
          applicationIdSuffix = ".staging"
          versionNameSuffix = "-staging"
          resValue("string", "app_name", "${spec.baseAppName} (Staging)")
        }
        create("prod") {
          dimension = "env"
          resValue("string", "app_name", spec.baseAppName)
        }

        forEach { flavor ->
          val cfg = flavorConfigs.getValue(flavor.name)
          flavor.buildConfigField("String", "APP_ENV", escapeBuildConfigString(flavor.name))
          flavor.buildConfigField("boolean", "FIREBASE_CONFIGURED", cfg.configured.toString())
          flavor.buildConfigField("String", "FIREBASE_API_KEY", escapeBuildConfigString(cfg.apiKey))
          flavor.buildConfigField("String", "FIREBASE_PROJECT_ID", escapeBuildConfigString(cfg.projectId))
          flavor.buildConfigField("String", "FIREBASE_APPLICATION_ID", escapeBuildConfigString(cfg.applicationId))
          flavor.buildConfigField("String", "FIREBASE_STORAGE_BUCKET", escapeBuildConfigString(cfg.storageBucket))
          flavor.buildConfigField("String", "FIREBASE_GCM_SENDER_ID", escapeBuildConfigString(cfg.gcmSenderId))
        }
      }
    }

    for ((flavorName, cfg) in flavorConfigs) {
      val capFlavor = flavorName.replaceFirstChar { it.uppercaseChar() }
      val moduleName = this@subprojects.path

      val verifyTask = tasks.register<VerifyFirebaseConfigTask>("verify${capFlavor}FirebaseConfig") {
        group = "verification"
        description = "Verifies environment isolation and Firebase configuration for $moduleName ($flavorName)."
        this.flavorName.set(flavorName)
        this.modulePath.set(moduleName)
        this.configured.set(cfg.configured)
        this.firebaseProjectId.set(cfg.projectId)
        this.storageBucket.set(cfg.storageBucket)
        this.sourceDescription.set(cfg.sourceDescription)
        this.blockedProductionId.set(productionProjectId)
      }

      val exactApkOrBundleTasks = setOf(
        "assemble$capFlavor",
        "assemble${capFlavor}Debug",
        "assemble${capFlavor}Release",
        "package${capFlavor}Debug",
        "package${capFlavor}Release",
        "bundle$capFlavor",
        "bundle${capFlavor}Debug",
        "bundle${capFlavor}Release",
        "install${capFlavor}Debug",
        "install${capFlavor}Release",
      )

      tasks.matching { task ->
        task.name in exactApkOrBundleTasks
      }.configureEach {
        dependsOn(verifyTask)
      }
    }

    tasks.register("testDebugUnitTest") {
      group = "verification"
      description = "Runs Debug unit tests across all environment flavors (dev, staging, prod) for ${this@subprojects.path}."
      dependsOn("testDevDebugUnitTest", "testStagingDebugUnitTest", "testProdDebugUnitTest")
    }
  }
}
