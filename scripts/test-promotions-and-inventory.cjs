// Verification test script for Promotions Date/Time Validity Engine and Cart Coupon Logic
const { resolvePromotionTimestamp, isPromotionActive } = (() => {
  function resolvePromotionTimestamp(dateStr, timeStr, defaultTime = '00:00') {
    if (!dateStr) return null;
    try {
      if (dateStr.includes('T') && !timeStr) {
        const ms = new Date(dateStr).getTime();
        return isNaN(ms) ? null : ms;
      }
      const ymd = dateStr.slice(0, 10);
      const time = (timeStr || (dateStr.includes('T') ? dateStr.slice(11, 16) : defaultTime)).trim();
      const [hh = '00', mm = '00'] = time.split(':');
      const d = new Date(`${ymd}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`);
      const ms = d.getTime();
      return isNaN(ms) ? new Date(dateStr).getTime() : ms;
    } catch (_) {
      const fallback = new Date(dateStr).getTime();
      return isNaN(fallback) ? null : fallback;
    }
  }

  function isPromotionActive(promotion, atDate = new Date()) {
    if (!promotion) return false;
    if (promotion.status !== 'active') return false;

    const now = atDate.getTime();
    if (promotion.startDate) {
      const start = resolvePromotionTimestamp(promotion.startDate, promotion.startTime, '00:00');
      if (start !== null && !isNaN(start) && now < start) return false;
    }
    if (promotion.endDate) {
      const end = resolvePromotionTimestamp(promotion.endDate, promotion.endTime, '23:59');
      if (end !== null && !isNaN(end) && now > end) return false;
    }

    if (typeof promotion.globalUsageLimit === 'number' && promotion.globalUsageLimit > 0) {
      if ((promotion.redemptionCount || 0) >= promotion.globalUsageLimit) {
        return false;
      }
    }

    return true;
  }

  return { resolvePromotionTimestamp, isPromotionActive };
})();

console.log('--- Testing Promotion Start/End Time Validity ---');

// Test 1: Promotion active from 10:00 to 14:00 today
const today = new Date().toISOString().slice(0, 10);
const promoLunch = {
  id: 'promo_lunch',
  status: 'active',
  startDate: today,
  startTime: '10:00',
  endDate: today,
  endTime: '14:00',
  value: 20
};

// Test at 09:30 (before start time)
const testDateBefore = new Date(`${today}T09:30:00`);
const isBeforeActive = isPromotionActive(promoLunch, testDateBefore);
console.log(`Test 1 (09:30 before 10:00 start): active = ${isBeforeActive} (expected false)`);
if (isBeforeActive !== false) throw new Error('Test 1 failed');

// Test at 12:30 (during lunch window)
const testDateDuring = new Date(`${today}T12:30:00`);
const isDuringActive = isPromotionActive(promoLunch, testDateDuring);
console.log(`Test 2 (12:30 during lunch window): active = ${isDuringActive} (expected true)`);
if (isDuringActive !== true) throw new Error('Test 2 failed');

// Test at 14:30 (after lunch window)
const testDateAfter = new Date(`${today}T14:30:00`);
const isAfterActive = isPromotionActive(promoLunch, testDateAfter);
console.log(`Test 3 (14:30 after 14:00 end): active = ${isAfterActive} (expected false)`);
if (isAfterActive !== false) throw new Error('Test 3 failed');

// Test 4: Global usage limit enforcement
const promoLimited = {
  id: 'promo_limited',
  status: 'active',
  startDate: today,
  startTime: '00:00',
  endDate: today,
  endTime: '23:59',
  globalUsageLimit: 5,
  redemptionCount: 5
};
const isLimitedActive = isPromotionActive(promoLimited, testDateDuring);
console.log(`Test 4 (Redemptions 5/5 reached): active = ${isLimitedActive} (expected false)`);
if (isLimitedActive !== false) throw new Error('Test 4 failed');

console.log('✅ ALL PROMOTION VALIDITY TESTS PASSED SUCCESSFULLY!');

