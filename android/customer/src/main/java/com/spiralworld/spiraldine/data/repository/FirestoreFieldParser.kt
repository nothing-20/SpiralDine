package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.DocumentSnapshot

/**
 * Resilient, type-safe Firestore field parser for SpiralDine Android customer client.
 * Strictly avoids fragile DocumentSnapshot.getString() / getDouble() / getBoolean() calls
 * on fields where Firestore documents may store numbers, strings, or legacy data types.
 */
object FirestoreFieldParser {

    const val DEFAULT_PREPARATION_TIME_MINUTES = 15
    const val DEFAULT_PREPARATION_TIME_STRING = "15-20 min"

    /**
     * Safely parses preparation time from Firestore.
     * Supports:
     * 1. Numeric values: e.g. 15, 20.0 -> Pair("15 min", 15)
     * 2. Numeric strings: e.g. "15", "15.0" -> Pair("15 min", 15)
     * 3. Formatted/range strings: e.g. "15-20 min", "20 mins" -> Pair("15-20 min", 15)
     * 4. Missing, null, negative, or invalid types (Boolean, Map, List) -> fallback Pair("15-20 min", 15)
     */
    fun parsePreparationTime(doc: DocumentSnapshot): Pair<String, Int> {
        val raw = try {
            doc.get("preparationTime") ?: doc.get("prepTime")
        } catch (_: Exception) {
            null
        }
        return parsePreparationTimeValue(raw)
    }

    /**
     * Core parsing engine for preparation time, directly testable with any primitive or object.
     */
    fun parsePreparationTimeValue(raw: Any?): Pair<String, Int> {
        if (raw == null) {
            return Pair(DEFAULT_PREPARATION_TIME_STRING, DEFAULT_PREPARATION_TIME_MINUTES)
        }

        when (raw) {
            is Number -> {
                val minutes = raw.toInt()
                return if (minutes in 1..480) {
                    Pair("$minutes min", minutes)
                } else {
                    Pair(DEFAULT_PREPARATION_TIME_STRING, DEFAULT_PREPARATION_TIME_MINUTES)
                }
            }

            is String -> {
                val trimmed = raw.trim()
                if (trimmed.isBlank()) {
                    return Pair(DEFAULT_PREPARATION_TIME_STRING, DEFAULT_PREPARATION_TIME_MINUTES)
                }

                // Check for purely numeric string like "15" or "15.0"
                val num = trimmed.toDoubleOrNull()?.toInt()
                if (num != null) {
                    return if (num in 1..480) {
                        Pair("$num min", num)
                    } else {
                        Pair(DEFAULT_PREPARATION_TIME_STRING, DEFAULT_PREPARATION_TIME_MINUTES)
                    }
                }

                // Check for range or formatted text containing digits (e.g. "15-20 min", "15 mins", "15min")
                val firstDigit = Regex("""\d+""").find(trimmed)?.value?.toIntOrNull()
                if (firstDigit != null && firstDigit in 1..480) {
                    return Pair(trimmed, firstDigit)
                }

                // Non-numeric or invalid string
                return Pair(DEFAULT_PREPARATION_TIME_STRING, DEFAULT_PREPARATION_TIME_MINUTES)
            }

            else -> {
                // Unsupported type (Boolean, Map, List, etc.)
                return Pair(DEFAULT_PREPARATION_TIME_STRING, DEFAULT_PREPARATION_TIME_MINUTES)
            }
        }
    }

    fun parsePreparationTime(data: Map<String, Any?>): Pair<String, Int> {
        val raw = data["preparationTime"] ?: data["prepTime"]
        return parsePreparationTimeValue(raw)
    }

    fun safeString(doc: DocumentSnapshot, vararg fieldNames: String, fallback: String = ""): String {
        for (field in fieldNames) {
            try {
                val raw = doc.get(field) ?: continue
                when (raw) {
                    is String -> if (raw.isNotBlank()) return raw
                    is Number -> return raw.toString()
                    is Boolean -> return raw.toString()
                }
            } catch (_: Exception) {}
        }
        return fallback
    }

    fun safeString(data: Map<String, Any?>, vararg fieldNames: String, fallback: String = ""): String {
        for (field in fieldNames) {
            val raw = data[field] ?: continue
            when (raw) {
                is String -> if (raw.isNotBlank()) return raw
                is Number -> return raw.toString()
                is Boolean -> return raw.toString()
            }
        }
        return fallback
    }

    fun safeDouble(doc: DocumentSnapshot, vararg fieldNames: String, fallback: Double = 0.0): Double {
        for (field in fieldNames) {
            try {
                val raw = doc.get(field) ?: continue
                when (raw) {
                    is Number -> return raw.toDouble()
                    is String -> {
                        val parsed = raw.trim().toDoubleOrNull()
                        if (parsed != null) return parsed
                    }
                }
            } catch (_: Exception) {}
        }
        return fallback
    }

    fun safeDouble(data: Map<String, Any?>, vararg fieldNames: String, fallback: Double = 0.0): Double {
        for (field in fieldNames) {
            val raw = data[field] ?: continue
            when (raw) {
                is Number -> return raw.toDouble()
                is String -> {
                    val parsed = raw.trim().toDoubleOrNull()
                    if (parsed != null) return parsed
                }
            }
        }
        return fallback
    }

    fun safeInt(doc: DocumentSnapshot, vararg fieldNames: String, fallback: Int = 0): Int {
        for (field in fieldNames) {
            try {
                val raw = doc.get(field) ?: continue
                when (raw) {
                    is Number -> return raw.toInt()
                    is String -> {
                        val parsed = raw.trim().toDoubleOrNull()?.toInt()
                        if (parsed != null) return parsed
                    }
                }
            } catch (_: Exception) {}
        }
        return fallback
    }

    fun safeInt(data: Map<String, Any?>, vararg fieldNames: String, fallback: Int = 0): Int {
        for (field in fieldNames) {
            val raw = data[field] ?: continue
            when (raw) {
                is Number -> return raw.toInt()
                is String -> {
                    val parsed = raw.trim().toDoubleOrNull()?.toInt()
                    if (parsed != null) return parsed
                }
            }
        }
        return fallback
    }

    fun safeBoolean(doc: DocumentSnapshot, vararg fieldNames: String, fallback: Boolean = false): Boolean {
        for (field in fieldNames) {
            try {
                val raw = doc.get(field) ?: continue
                when (raw) {
                    is Boolean -> return raw
                    is String -> {
                        val trimmed = raw.trim().lowercase()
                        if (trimmed == "true" || trimmed == "yes" || trimmed == "1") return true
                        if (trimmed == "false" || trimmed == "no" || trimmed == "0") return false
                    }
                    is Number -> return raw.toInt() != 0
                }
            } catch (_: Exception) {}
        }
        return fallback
    }

    fun safeBoolean(data: Map<String, Any?>, vararg fieldNames: String, fallback: Boolean = false): Boolean {
        for (field in fieldNames) {
            val raw = data[field] ?: continue
            when (raw) {
                is Boolean -> return raw
                is String -> {
                    val trimmed = raw.trim().lowercase()
                    if (trimmed == "true" || trimmed == "yes" || trimmed == "1") return true
                    if (trimmed == "false" || trimmed == "no" || trimmed == "0") return false
                }
                is Number -> return raw.toInt() != 0
            }
        }
        return fallback
    }
}
