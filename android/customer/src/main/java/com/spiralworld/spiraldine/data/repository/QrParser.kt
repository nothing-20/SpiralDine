package com.spiralworld.spiraldine.data.repository

import android.util.Log
import org.json.JSONObject
import java.net.URI

data class ParsedQrResult(
    val tenantId: String,
    val tableNumber: String,
    val tableId: String = if (tableNumber.startsWith("TBL-", ignoreCase = true)) tableNumber else "TBL-$tableNumber",
    val rawPayload: String
)

object QrParser {

    private const val TAG = "QrParser"

    /**
     * Parses and authoritatively validates scanned QR payloads for SpiralDine tables.
     * Supports:
     * 1. Primary Website URL: https://spiral-dine.vercel.app/r/{tenantId}/table/{tableId}
     * 2. Web Customer Menu Route: https://spiral-dine.vercel.app/customer/restaurant/{tenantId}/menu?table={tableNumber}
     * 3. Legacy Web QR Route: https://spiral-dine.vercel.app/qr/{tenantId}/{tableNumber}
     * 4. Relative paths: /r/{tenantId}/table/{tableId}, /qr/{tenantId}/{tableNumber}
     * 5. JSON payloads: {"tenantId":"...","tableId":"..."} or {"r":"...","t":"..."}
     * 6. App scheme: spiraldine://table?tenant={tenantId}&table={tableNumber}
     * 7. Compact shorthand: {tenantId}:{tableNumber} or {tenantId}/table/{tableNumber}
     */
    fun parse(rawCode: String?): ParsedQrResult? {
        if (rawCode.isNullOrBlank()) return null
        val trimmed = rawCode.trim()

        // 1. JSON payload support: e.g. {"tenantId":"res-821720","tableId":"TBL-1"}
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            val (tenantId, tableRaw) = parseJsonPayload(trimmed)
            if (!tenantId.isNullOrBlank() && !tableRaw.isNullOrBlank()) {
                val result = sanitizeAndBuildResult(tenantId, tableRaw, trimmed)
                if (result != null) {
                    safeLog("Successfully parsed JSON QR payload: tenant=${result.tenantId}, table=${result.tableNumber}")
                    return result
                }
            }
        }

        // 2. URLs (Absolute http/https or Relative /...)
        if (trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true) ||
            trimmed.startsWith("/")
        ) {
            val uri = try {
                if (trimmed.startsWith("/")) {
                    URI("https://spiral-dine.vercel.app$trimmed")
                } else {
                    URI(trimmed)
                }
            } catch (_: Exception) {
                return null
            }

            val path = uri.path ?: ""
            val pathSegments = path.split("/").filter { it.isNotBlank() }

            // Pattern A: Primary website exported QR: /r/{tenantId}/table/{tableId}
            val rIdx = pathSegments.indexOf("r")
            if (rIdx != -1 && rIdx + 1 < pathSegments.size) {
                val candidateTenant = pathSegments[rIdx + 1]
                if (!candidateTenant.equals("table", ignoreCase = true)) {
                    val queryParams = parseQueryParams(uri.rawQuery)
                    val tableIdx = pathSegments.indexOf("table")
                    val tableRaw = if (tableIdx != -1 && tableIdx + 1 < pathSegments.size) {
                        pathSegments[tableIdx + 1]
                    } else if (rIdx + 2 < pathSegments.size && !pathSegments[rIdx + 2].equals("table", ignoreCase = true)) {
                        pathSegments[rIdx + 2]
                    } else {
                        queryParams["table"] ?: queryParams["tableId"] ?: queryParams["t"] ?: "1"
                    }
                    val result = sanitizeAndBuildResult(candidateTenant, tableRaw, trimmed)
                    if (result != null) {
                        safeLog("Successfully parsed /r/ table URL: tenant=${result.tenantId}, table=${result.tableNumber}")
                        return result
                    }
                }
            }

            // Pattern B: Menu route: /customer/restaurant/{tenantId}/menu?table={tableNumber}
            val restaurantIdx = pathSegments.indexOf("restaurant")
            if (restaurantIdx != -1 && restaurantIdx + 1 < pathSegments.size) {
                val tenantId = pathSegments[restaurantIdx + 1]
                val queryParams = parseQueryParams(uri.rawQuery)
                val tableRaw = queryParams["table"] ?: queryParams["tableId"] ?: queryParams["t"] ?: "1"
                val result = sanitizeAndBuildResult(tenantId, tableRaw, trimmed)
                if (result != null) {
                    safeLog("Successfully parsed menu query URL: tenant=${result.tenantId}, table=${result.tableNumber}")
                    return result
                }
            }

            // Pattern C: Short QR route: /qr/{tenantId}/{tableNumber}
            val qrIdx = pathSegments.indexOf("qr")
            if (qrIdx != -1 && qrIdx + 1 < pathSegments.size) {
                val tenantId = pathSegments[qrIdx + 1]
                val tableRaw = if (qrIdx + 2 < pathSegments.size) pathSegments[qrIdx + 2] else "1"
                val result = sanitizeAndBuildResult(tenantId, tableRaw, trimmed)
                if (result != null) {
                    safeLog("Successfully parsed /qr/ URL: tenant=${result.tenantId}, table=${result.tableNumber}")
                    return result
                }
            }

            // If it had a valid URL structure but did not match recognized SpiralDine paths, reject
            if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
                return null
            }
        }

        // 3. Custom app scheme: spiraldine://table?tenant={tenantId}&table={tableNumber}
        if (trimmed.startsWith("spiraldine://", ignoreCase = true)) {
            val queryStart = trimmed.indexOf("?")
            if (queryStart != -1 && queryStart + 1 < trimmed.length) {
                val queryParams = parseQueryParams(trimmed.substring(queryStart + 1))
                val tenant = queryParams["tenant"] ?: queryParams["tenantId"] ?: queryParams["r"]
                val table = queryParams["table"] ?: queryParams["tableNumber"] ?: queryParams["tableId"] ?: queryParams["t"] ?: "1"
                if (!tenant.isNullOrBlank()) {
                    return sanitizeAndBuildResult(tenant, table, trimmed)
                }
            } else {
                // Scheme with path: spiraldine://r/{tenantId}/table/{tableNumber}
                val pathPart = trimmed.removePrefix("spiraldine://").removePrefix("/")
                val segments = pathPart.split("/").filter { it.isNotBlank() }
                val rIdx = segments.indexOf("r")
                if (rIdx != -1 && rIdx + 1 < segments.size) {
                    val tenant = segments[rIdx + 1]
                    val tableIdx = segments.indexOf("table")
                    val table = if (tableIdx != -1 && tableIdx + 1 < segments.size) segments[tableIdx + 1] else "1"
                    return sanitizeAndBuildResult(tenant, table, trimmed)
                }
            }
        }

        // 4. Compact colon shorthand: {tenantId}:{tableNumber}
        if (trimmed.contains(":") && !trimmed.contains(" ") && !trimmed.contains("{")) {
            val parts = trimmed.split(":")
            if (parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank()) {
                val cleanTenant = parts[0].trim()
                val cleanTable = parts[1].trim()
                return sanitizeAndBuildResult(cleanTenant, cleanTable, trimmed)
            }
        }

        // 5. Slash shorthand: {tenantId}/table/{tableNumber} or {tenantId}/{tableNumber}
        if (trimmed.contains("/") && !trimmed.contains(" ") && !trimmed.contains("{")) {
            val parts = trimmed.split("/").filter { it.isNotBlank() }
            if (parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank()) {
                return sanitizeAndBuildResult(parts[0], parts[1], trimmed)
            } else if (parts.size == 3 && parts[1].equals("table", ignoreCase = true)) {
                return sanitizeAndBuildResult(parts[0], parts[2], trimmed)
            }
        }

        return null
    }

    private fun sanitizeAndBuildResult(tenantId: String, tableNumberOrId: String, rawPayload: String): ParsedQrResult? {
        val cleanTenant = tenantId.trim().lowercase()
        val rawTable = tableNumberOrId.trim()
        val cleanTableNum = rawTable.replace("(?i)^(table|tbl)[-_\\s]*".toRegex(), "").ifBlank { rawTable }

        // Security check: tenant must be alphanumeric with dashes/underscores
        if (cleanTenant.matches("^[a-zA-Z0-9_-]{2,64}$".toRegex()) &&
            rawTable.matches("^[a-zA-Z0-9_-]{1,32}$".toRegex())
        ) {
            val resolvedTableId = if (rawTable.startsWith("TBL-", ignoreCase = true)) {
                rawTable.uppercase()
            } else {
                "TBL-${cleanTableNum.uppercase()}"
            }
            return ParsedQrResult(
                tenantId = cleanTenant,
                tableNumber = cleanTableNum,
                tableId = resolvedTableId,
                rawPayload = rawPayload
            )
        }
        return null
    }

    private fun parseQueryParams(queryString: String?): Map<String, String> {
        if (queryString.isNullOrBlank()) return emptyMap()
        val result = mutableMapOf<String, String>()
        val pairs = queryString.split("&")
        for (pair in pairs) {
            val idx = pair.indexOf("=")
            if (idx > 0 && idx < pair.length - 1) {
                val key = pair.substring(0, idx).trim()
                val value = pair.substring(idx + 1).trim()
                result[key] = value
            }
        }
        return result
    }

    private fun parseJsonPayload(trimmed: String): Pair<String?, String?> {
        var tenantId: String? = null
        var tableRaw: String? = null
        try {
            val json = JSONObject(trimmed)
            tenantId = json.optString("tenantId").takeIf { it.isNotBlank() }
                ?: json.optString("restaurantId").takeIf { it.isNotBlank() }
                ?: json.optString("r").takeIf { it.isNotBlank() }
            tableRaw = json.optString("tableId").takeIf { it.isNotBlank() }
                ?: json.optString("tableNumber").takeIf { it.isNotBlank() }
                ?: json.optString("table").takeIf { it.isNotBlank() }
                ?: json.optString("t").takeIf { it.isNotBlank() }
        } catch (_: Throwable) {}

        // Resilient regex fallback for JVM tests where org.json is not mocked
        if (tenantId.isNullOrBlank()) {
            val tenantPattern = "\"(?:tenantId|restaurantId|r)\"\\s*:\\s*\"([^\"]+)\"".toRegex(RegexOption.IGNORE_CASE)
            tenantId = tenantPattern.find(trimmed)?.groupValues?.get(1)
        }
        if (tableRaw.isNullOrBlank()) {
            val tablePattern = "\"(?:tableId|tableNumber|table|t)\"\\s*:\\s*\"?([a-zA-Z0-9_-]+)\"?".toRegex(RegexOption.IGNORE_CASE)
            tableRaw = tablePattern.find(trimmed)?.groupValues?.get(1)
        }
        return Pair(tenantId, tableRaw)
    }

    private fun safeLog(msg: String) {
        try {
            Log.d(TAG, msg)
        } catch (_: Throwable) {}
    }
}
