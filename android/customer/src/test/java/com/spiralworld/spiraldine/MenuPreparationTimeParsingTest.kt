package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.repository.FirestoreFieldParser
import com.spiralworld.spiraldine.data.repository.MenuRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies resilient Firestore parsing for menu items, specifically:
 * 1. Numeric preparationTime (Int, Long, Double, Float)
 * 2. String preparationTime (numeric strings, ranges, formatted text)
 * 3. Missing preparationTime (fallback to prepTime, or sensible default)
 * 4. Null preparationTime
 * 5. Invalid preparationTime (negative, out of bounds, wrong types like Boolean/Map)
 * 6. A mixture of valid and malformed menu documents
 * 7. Valid menu items still loading when another document is malformed
 */
class MenuPreparationTimeParsingTest {

    // =========================================================================
    // 1. NUMERIC PREPARATION TIME (The root cause of the confirmed crash)
    // =========================================================================

    @Test
    fun parsePreparationTime_handlesIntegerNumber() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(15)
        assertEquals("15 min", str)
        assertEquals(15, mins)
    }

    @Test
    fun parsePreparationTime_handlesLongNumber() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(20L)
        assertEquals("20 min", str)
        assertEquals(20, mins)
    }

    @Test
    fun parsePreparationTime_handlesDoubleNumber() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(25.0)
        assertEquals("25 min", str)
        assertEquals(25, mins)
    }

    @Test
    fun parsePreparationTime_handlesFloatNumber() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(30.0f)
        assertEquals("30 min", str)
        assertEquals(30, mins)
    }

    // =========================================================================
    // 2. STRING PREPARATION TIME (Legacy website & mobile formats)
    // =========================================================================

    @Test
    fun parsePreparationTime_handlesNumericString() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue("15")
        assertEquals("15 min", str)
        assertEquals(15, mins)
    }

    @Test
    fun parsePreparationTime_handlesDecimalString() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue("20.0")
        assertEquals("20 min", str)
        assertEquals(20, mins)
    }

    @Test
    fun parsePreparationTime_handlesRangeString() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue("15-20 min")
        assertEquals("15-20 min", str)
        assertEquals(15, mins)
    }

    @Test
    fun parsePreparationTime_handlesFormattedMinutesString() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue("25 mins")
        assertEquals("25 mins", str)
        assertEquals(25, mins)
    }

    // =========================================================================
    // 3. MISSING PREPARATION TIME & FALLBACK TO PREPTIME
    // =========================================================================

    @Test
    fun parsePreparationTime_missingFieldFallsBackToDefault() {
        val data = mapOf<String, Any?>(
            "name" to "Paneer Butter Masala",
            "price" to 280.0
        )
        val (str, mins) = FirestoreFieldParser.parsePreparationTime(data)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, str)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mins)
    }

    @Test
    fun parsePreparationTime_fallsBackToPrepTimeFieldIfPresent() {
        val data = mapOf<String, Any?>(
            "name" to "Dal Makhani",
            "price" to 220.0,
            "prepTime" to 12
        )
        val (str, mins) = FirestoreFieldParser.parsePreparationTime(data)
        assertEquals("12 min", str)
        assertEquals(12, mins)
    }

    // =========================================================================
    // 4. NULL PREPARATION TIME
    // =========================================================================

    @Test
    fun parsePreparationTime_nullValueFallsBackToDefaultSafely() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(null)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, str)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mins)

        val mapWithNull = mapOf<String, Any?>("preparationTime" to null)
        val (mapStr, mapMins) = FirestoreFieldParser.parsePreparationTime(mapWithNull)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, mapStr)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mapMins)
    }

    // =========================================================================
    // 5. INVALID PREPARATION TIME
    // =========================================================================

    @Test
    fun parsePreparationTime_negativeNumberFallsBackToDefault() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(-10)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, str)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mins)
    }

    @Test
    fun parsePreparationTime_outOfBoundsNumberFallsBackToDefault() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue(99999)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, str)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mins)
    }

    @Test
    fun parsePreparationTime_emptyOrWhitespaceStringFallsBackToDefault() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue("   ")
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, str)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mins)
    }

    @Test
    fun parsePreparationTime_nonNumericStringFallsBackToDefault() {
        val (str, mins) = FirestoreFieldParser.parsePreparationTimeValue("asap")
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, str)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mins)
    }

    @Test
    fun parsePreparationTime_unsupportedDataTypesFallBackToDefault() {
        val (boolStr, boolMins) = FirestoreFieldParser.parsePreparationTimeValue(true)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, boolStr)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, boolMins)

        val (listStr, listMins) = FirestoreFieldParser.parsePreparationTimeValue(listOf("15", "20"))
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, listStr)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, listMins)

        val (mapStr, mapMins) = FirestoreFieldParser.parsePreparationTimeValue(mapOf("time" to 15))
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, mapStr)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, mapMins)
    }

    // =========================================================================
    // 6. COMPLETE MENU ITEM PARSING WITH VARIOUS PREPARATION TIME FORMATS
    // =========================================================================

    @Test
    fun parseMenuItemData_parsesDocumentWithNumericPreparationTimeWithoutCrashing() {
        // This is the EXACT scenario from the user's real device logcat crash:
        // Firestore field preparationTime stored as numeric 15 (Long/Int/Double)
        val firestoreData = mapOf<String, Any?>(
            "name" to "Chicken Biryani",
            "description" to "Aromatic basmati rice cooked with tender chicken and spices",
            "price" to 320.0,
            "preparationTime" to 20, // NUMERIC, not String!
            "isVeg" to false,
            "category" to "Biryani",
            "isPublished" to true,
            "isAvailable" to true
        )

        val item = MenuRepository.parseMenuItemData("item_biryani_01", firestoreData)
        assertNotNull(item)
        assertEquals("item_biryani_01", item!!.id)
        assertEquals("Chicken Biryani", item.name)
        assertEquals(320.0, item.price, 0.001)
        assertEquals("20 min", item.preparationTime)
        assertEquals(20, item.preparationTimeMinutes)
        assertEquals(false, item.isVeg)
    }

    @Test
    fun parseMenuItemData_parsesDocumentWithStringPreparationTime() {
        val firestoreData = mapOf<String, Any?>(
            "name" to "Masala Dosa",
            "price" to 120.0,
            "preparationTime" to "10-15 min",
            "isVeg" to true,
            "category" to "South Indian",
            "isPublished" to true
        )

        val item = MenuRepository.parseMenuItemData("item_dosa_01", firestoreData)
        assertNotNull(item)
        assertEquals("10-15 min", item!!.preparationTime)
        assertEquals(10, item.preparationTimeMinutes)
        assertTrue(item.isVeg)
    }

    // =========================================================================
    // 7. MIXTURE OF VALID AND MALFORMED MENU DOCUMENTS ISOLATION
    // =========================================================================

    @Test
    fun parseMenuItemList_isolatesMalformedDocumentsAndLoadsAllValidItems() {
        val doc1 = "doc_valid_numeric" to mapOf<String, Any?>(
            "name" to "Tandoori Roti",
            "price" to 35.0,
            "preparationTime" to 8, // Numeric
            "isPublished" to true
        )

        val doc2Malformed = "doc_malformed_unusable" to mapOf<String, Any?>(
            // Missing name, unpublished, or invalid types
            "isPublished" to false
        )

        val doc3 = "doc_valid_string" to mapOf<String, Any?>(
            "name" to "Butter Naan",
            "price" to 55.0,
            "preparationTime" to "12 mins", // String
            "isPublished" to true
        )

        val doc4NullPrep = "doc_valid_null_prep" to mapOf<String, Any?>(
            "name" to "Garlic Naan",
            "price" to 65.0,
            "preparationTime" to null, // Null prep time
            "isPublished" to true
        )

        val documents = listOf(doc1, doc2Malformed, doc3, doc4NullPrep)

        // Simulate safe repository parsing pipeline
        val parsedItems = documents.mapNotNull { (id, data) ->
            try {
                MenuRepository.parseMenuItemData(id, data)
            } catch (e: Exception) {
                null
            }
        }

        // doc2 was unpublished (filtered out), the other 3 must be successfully parsed
        assertEquals(3, parsedItems.size)
        assertEquals("Tandoori Roti", parsedItems[0].name)
        assertEquals("8 min", parsedItems[0].preparationTime)
        assertEquals(8, parsedItems[0].preparationTimeMinutes)

        assertEquals("Butter Naan", parsedItems[1].name)
        assertEquals("12 mins", parsedItems[1].preparationTime)
        assertEquals(12, parsedItems[1].preparationTimeMinutes)

        assertEquals("Garlic Naan", parsedItems[2].name)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, parsedItems[2].preparationTime)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, parsedItems[2].preparationTimeMinutes)
    }

    @Test
    fun parseMenuItemData_survivesCompleteTypeGarbageInEveryField() {
        // Document where every single field has an unexpected data type
        val corruptData = mapOf<String, Any?>(
            "name" to 12345, // Number instead of String
            "description" to listOf("a", "b"), // List instead of String
            "price" to "free", // Non-numeric string instead of Number
            "discountPrice" to "invalid",
            "preparationTime" to listOf(1, 2, 3), // List instead of Number/String
            "isVeg" to "not_a_boolean",
            "isAvailable" to mapOf("key" to "value"),
            "isPublished" to "yes"
        )

        // Must not throw any ClassCastException, RuntimeException, or NullPointerException
        val item = MenuRepository.parseMenuItemData("corrupt_doc_99", corruptData)
        assertNotNull(item)
        assertEquals("12345", item!!.name) // Converted to string
        assertEquals(0.0, item.price, 0.001) // Safe fallback
        assertNull(item.discountPrice)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_STRING, item.preparationTime)
        assertEquals(FirestoreFieldParser.DEFAULT_PREPARATION_TIME_MINUTES, item.preparationTimeMinutes)
    }
}
