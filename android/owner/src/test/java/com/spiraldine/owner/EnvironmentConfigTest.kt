package com.spiraldine.owner

import com.spiraldine.owner.data.repository.FirebaseConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EnvironmentConfigTest {

    @Test
    fun buildConfig_isolatesNonProdFlavorsAndPreservesProd() {
        if (FirebaseConfig.APP_ENV == "prod") {
            assertTrue(FirebaseConfig.IS_CONFIGURED)
            assertEquals("spiral-restaurant-saas-v1", FirebaseConfig.PROJECT_ID)
        } else {
            assertFalse(
                "Non-prod owner build must not default to production project",
                FirebaseConfig.PROJECT_ID == "spiral-restaurant-saas-v1"
            )
            val missingEx = try {
                FirebaseConfig.resolveValidatedConfig(
                    appEnv = FirebaseConfig.APP_ENV,
                    configured = false,
                    apiKey = "",
                    projectId = "",
                    applicationId = "",
                    storageBucket = "",
                    gcmSenderId = ""
                )
                null
            } catch (e: IllegalStateException) {
                e
            }
            assertNotNull(missingEx)
        }
    }

    @Test
    fun resolveValidatedConfig_blocksCrossEnvironmentConnectionToProduction() {
        for (env in listOf("dev", "staging")) {
            val ex = try {
                FirebaseConfig.resolveValidatedConfig(
                    appEnv = env,
                    configured = true,
                    apiKey = "test-api-key",
                    projectId = "spiral-restaurant-saas-v1",
                    applicationId = "com.spiraldine.owner.$env",
                    storageBucket = "spiral-restaurant-saas-v1.firebasestorage.app",
                    gcmSenderId = "12345"
                )
                null
            } catch (e: IllegalStateException) {
                e
            }
            assertNotNull("Flavor '$env' must throw if pointed at prod", ex)
        }
    }
}

