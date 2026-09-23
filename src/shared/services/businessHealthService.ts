/**
 * Canonical Business Health Engine for SpiralDine.
 * Evaluates real, observable operational and business signals from Firestore.
 * 
 * Strict Weight Distribution (Total = 100%):
 * 1. Revenue Health    = 25%
 * 2. Operations Health = 25%
 * 3. Customer Health   = 20%
 * 4. Inventory Health  = 15%
 * 5. Kitchen Health    = 15%
 */

export const HEALTH_WEIGHTS = {
  revenue: 25,
  operations: 25,
  customers: 20,
  inventory: 15,
  kitchen: 15,
} as const;

export type THealthDimensionId = keyof typeof HEALTH_WEIGHTS;

export interface IDimensionResult {
  id: THealthDimensionId;
  title: string;
  score: number | null;
  weight: number;
  status: 'available' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  metrics: Record<string, any>;
}

export interface IBusinessHealthReport {
  overallScore: number | null;
  label: 'Excellent' | 'Healthy' | 'Needs Attention' | 'At Risk' | 'Critical' | 'Limited Data';
  color: string;
  badgeBg: string;
  dataCoveragePercentage: number;
  dimensions: IDimensionResult[];
  trendDelta: number | null;
  trendText: string;
  trendExplanation: string;
  calculatedAt: string;
}

export interface IBusinessHealthInput {
  orders: any[];
  paidTransactions: any[];
  inventory: any[];
  satisfactionRatings: any[];
  managerReviews?: any[];
  tables?: any[];
  tenantId?: string;
  isPriorPeriod?: boolean;
}

/**
 * 1. REVENUE HEALTH (Weight: 25%)
 * Evaluates 7-day revenue flow, consistency of transactions, and average order value.
 */
export function calculateRevenueHealth(input: IBusinessHealthInput): IDimensionResult {
  const transactions = input.paidTransactions || [];
  const now = Date.now();
  const ms7Days = 7 * 24 * 60 * 60 * 1000;
  const ms14Days = 14 * 24 * 60 * 60 * 1000;

  // Recent 7 days transactions
  const recent7d = transactions.filter(t => {
    if (!t.createdAt) return false;
    const time = new Date(t.createdAt).getTime();
    return !isNaN(time) && now - time <= ms7Days;
  });

  // Prior 7 days (Day 8 to 14) transactions
  const prior7d = transactions.filter(t => {
    if (!t.createdAt) return false;
    const time = new Date(t.createdAt).getTime();
    return !isNaN(time) && now - time > ms7Days && now - time <= ms14Days;
  });

  if (transactions.length < 3) {
    return {
      id: 'revenue',
      title: 'Revenue Health',
      score: null,
      weight: HEALTH_WEIGHTS.revenue,
      status: 'insufficient_data',
      confidence: 'low',
      explanation: `Insufficient transaction history (${transactions.length} settled transactions recorded). At least 3 paid orders are required.`,
      metrics: { totalTransactions: transactions.length, recentCount: recent7d.length }
    };
  }

  const recentGross = recent7d.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const priorGross = prior7d.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const aov = recent7d.length > 0 ? recentGross / recent7d.length : 0;

  // Active days in the past 7 days
  const activeDaysSet = new Set(recent7d.map(t => new Date(t.createdAt).toDateString()));
  const activeDaysCount = activeDaysSet.size;

  let score = 50; // base score for having valid paid transactions

  // 1. Transaction consistency (up to 25 pts)
  if (activeDaysCount >= 5) score += 25;
  else if (activeDaysCount >= 3) score += 18;
  else if (activeDaysCount >= 1) score += 10;

  // 2. Trend vs previous period (up to 15 pts)
  if (priorGross > 0) {
    const growth = (recentGross - priorGross) / priorGross;
    if (growth >= 0.1) score += 15;
    else if (growth >= 0) score += 10;
    else if (growth >= -0.15) score += 5;
  } else if (recentGross > 0) {
    score += 10; // Positive baseline volume
  }

  // 3. Healthy AOV contribution (up to 10 pts)
  if (aov > 0) score += 10;

  score = Math.min(100, Math.max(10, Math.round(score)));
  const confidence: 'high' | 'medium' | 'low' = recent7d.length >= 10 ? 'high' : 'medium';

  const explanation = recent7d.length > 0
    ? `${recent7d.length} orders settled across ${activeDaysCount} active day(s) in the past week with an AOV of ₹${Math.round(aov).toLocaleString('en-IN')}.`
    : `Historical paid revenue recorded, but no transactions settled in the last 7 days.`;

  return {
    id: 'revenue',
    title: 'Revenue Health',
    score,
    weight: HEALTH_WEIGHTS.revenue,
    status: 'available',
    confidence,
    explanation,
    metrics: { recentOrders: recent7d.length, recentGross, aov: Math.round(aov), activeDays: activeDaysCount }
  };
}

/**
 * 2. OPERATIONS HEALTH (Weight: 25%)
 * Evaluates completion rate, cancellation rate, and bottlenecks in the order lifecycle.
 */
export function calculateOperationsHealth(input: IBusinessHealthInput): IDimensionResult {
  const orders = input.orders || [];

  if (orders.length === 0) {
    return {
      id: 'operations',
      title: 'Operations Health',
      score: null,
      weight: HEALTH_WEIGHTS.operations,
      status: 'insufficient_data',
      confidence: 'low',
      explanation: 'No operational order records available in the workspace.',
      metrics: { totalOrders: 0 }
    };
  }

  const completedCount = orders.filter(o => 
    o.status === 'COMPLETED' || o.status === 'DELIVERED' || o.status === 'PAID'
  ).length;

  const cancelledCount = orders.filter(o => 
    o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'REFUNDED'
  ).length;

  const activeStatuses = ['NEW', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PAYMENT_PENDING'];
  const now = Date.now();
  const delayedActiveOrders = orders.filter(o => {
    if (!activeStatuses.includes(o.status) || !o.createdAt) return false;
    const orderTime = new Date(o.createdAt).getTime();
    return !isNaN(orderTime) && now - orderTime > 45 * 60 * 1000; // > 45 min uncompleted
  }).length;

  const completionRate = completedCount / orders.length;
  const cancellationRate = cancelledCount / orders.length;

  // Scoring: 60 pts completion rate + 40 pts cancellation avoidance - delayed penalty
  let score = (completionRate * 60) + ((1 - cancellationRate) * 40);
  score -= (delayedActiveOrders * 10);
  score = Math.min(100, Math.max(10, Math.round(score)));

  const confidence: 'high' | 'medium' | 'low' = orders.length >= 10 ? 'high' : 'medium';
  const explanation = `${Math.round(completionRate * 100)}% order completion rate (${completedCount}/${orders.length}) with ${Math.round(cancellationRate * 100)}% cancellations.`;

  return {
    id: 'operations',
    title: 'Operations Health',
    score,
    weight: HEALTH_WEIGHTS.operations,
    status: 'available',
    confidence,
    explanation,
    metrics: { totalOrders: orders.length, completedCount, cancelledCount, delayedActiveOrders }
  };
}

/**
 * 3. CUSTOMER HEALTH (Weight: 20%)
 * Evaluates verified satisfaction ratings and review feedback volume.
 * Avoids fabricating scores when zero reviews are present.
 */
export function calculateCustomerHealth(input: IBusinessHealthInput): IDimensionResult {
  const ratings = input.satisfactionRatings || [];
  const reviews = input.managerReviews || [];

  if (ratings.length < 3) {
    return {
      id: 'customers',
      title: 'Customer Health',
      score: null,
      weight: HEALTH_WEIGHTS.customers,
      status: 'insufficient_data',
      confidence: 'low',
      explanation: ratings.length === 0
        ? 'No customer reviews logged yet. At least 3 verified ratings are needed for a reliable score.'
        : `Only ${ratings.length} review logged. A minimum of 3 ratings is required for customer health analysis.`,
      metrics: { reviewCount: ratings.length }
    };
  }

  // Convert ratings to 1-5 scale
  const numericRatings = ratings.map(r => {
    if (typeof r.rating === 'number') return r.rating;
    const str = String(r.rating || '').toLowerCase();
    if (str.includes('excellent') || str.includes('5')) return 5;
    if (str.includes('good') || str.includes('4')) return 4;
    if (str.includes('neutral') || str.includes('3')) return 3;
    if (str.includes('needs attention') || str.includes('2')) return 2;
    if (str.includes('complaint') || str.includes('1')) return 1;
    return 4;
  });

  const avgRating = numericRatings.reduce((sum, val) => sum + val, 0) / numericRatings.length;
  
  // Unresolved complaints penalty
  const pendingComplaints = reviews.filter(r => 
    r.resolutionStatus === 'Pending' || r.status === 'pending'
  ).length;

  // Base score from average rating (up to 80 pts)
  let score = (avgRating / 5) * 80;

  // Sample size confidence bonus (up to 20 pts)
  if (ratings.length >= 25) score += 20;
  else if (ratings.length >= 10) score += 15;
  else score += 10;

  score -= (pendingComplaints * 8);
  score = Math.min(100, Math.max(10, Math.round(score)));

  const confidence: 'high' | 'medium' | 'low' = ratings.length >= 15 ? 'high' : ratings.length >= 5 ? 'medium' : 'low';
  const explanation = `Average rating is ${avgRating.toFixed(1)}/5.0 across ${ratings.length} customer review(s) with ${pendingComplaints} pending complaint(s).`;

  return {
    id: 'customers',
    title: 'Customer Health',
    score,
    weight: HEALTH_WEIGHTS.customers,
    status: 'available',
    confidence,
    explanation,
    metrics: { avgRating: Number(avgRating.toFixed(2)), reviewCount: ratings.length, pendingComplaints }
  };
}

/**
 * 4. INVENTORY HEALTH (Weight: 15%)
 * Evaluates stock availability and ratio of items above minimum safety thresholds.
 */
export function calculateInventoryHealth(input: IBusinessHealthInput): IDimensionResult {
  const inventory = input.inventory || [];

  if (inventory.length === 0) {
    return {
      id: 'inventory',
      title: 'Inventory Health',
      score: null,
      weight: HEALTH_WEIGHTS.inventory,
      status: 'insufficient_data',
      confidence: 'low',
      explanation: 'No inventory items tracked yet in this restaurant workspace.',
      metrics: { totalItems: 0 }
    };
  }

  let healthyCount = 0;
  let lowCount = 0;
  let outOfStockCount = 0;

  inventory.forEach(item => {
    const stock = Number(item.currentStock ?? item.stockLevel ?? item.quantity ?? 0);
    const minThreshold = Number(item.minStock ?? item.reorderThreshold ?? 10);

    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= minThreshold) {
      lowCount++;
    } else {
      healthyCount++;
    }
  });

  const healthyRatio = healthyCount / inventory.length;
  const inStockRatio = (inventory.length - outOfStockCount) / inventory.length;

  // 70% based on healthy stock, 30% based on in-stock availability
  let score = (healthyRatio * 70) + (inStockRatio * 30);
  score = Math.min(100, Math.max(10, Math.round(score)));

  const confidence: 'high' | 'medium' | 'low' = inventory.length >= 10 ? 'high' : 'medium';
  const explanation = `${healthyCount} of ${inventory.length} items optimal (${lowCount} low, ${outOfStockCount} out of stock).`;

  return {
    id: 'inventory',
    title: 'Inventory Health',
    score,
    weight: HEALTH_WEIGHTS.inventory,
    status: 'available',
    confidence,
    explanation,
    metrics: { totalItems: inventory.length, healthyCount, lowCount, outOfStockCount }
  };
}

/**
 * 5. KITCHEN HEALTH (Weight: 15%)
 * Evaluates ticket preparation velocity and cooking timeliness from real order timestamps.
 */
export function calculateKitchenHealth(input: IBusinessHealthInput): IDimensionResult {
  const orders = input.orders || [];

  // Extract prep times in minutes for completed orders
  const prepTimes: number[] = [];
  orders.forEach(o => {
    // 1. Direct cookingStartedAt -> readyAt
    if (o.cookingStartedAt && o.readyAt) {
      const diffMin = (new Date(o.readyAt).getTime() - new Date(o.cookingStartedAt).getTime()) / 60000;
      if (diffMin > 0.5 && diffMin < 120) {
        prepTimes.push(diffMin);
        return;
      }
    }
    // 2. Fallback: createdAt -> readyAt/deliveredAt
    const finishTime = o.readyAt || o.deliveredAt;
    if (o.createdAt && finishTime) {
      const diffMin = (new Date(finishTime).getTime() - new Date(o.createdAt).getTime()) / 60000;
      if (diffMin > 1 && diffMin < 120) {
        prepTimes.push(diffMin);
        return;
      }
    }
  });

  if (prepTimes.length < 3) {
    return {
      id: 'kitchen',
      title: 'Kitchen Health',
      score: null,
      weight: HEALTH_WEIGHTS.kitchen,
      status: 'insufficient_data',
      confidence: 'low',
      explanation: `Only ${prepTimes.length} order(s) have verified kitchen timestamps. At least 3 orders are required.`,
      metrics: { timedOrdersCount: prepTimes.length }
    };
  }

  const avgPrepMins = prepTimes.reduce((sum, val) => sum + val, 0) / prepTimes.length;

  let score = 90;
  if (avgPrepMins <= 15) score = 95;
  else if (avgPrepMins <= 20) score = 85;
  else if (avgPrepMins <= 25) score = 75;
  else if (avgPrepMins <= 35) score = 60;
  else score = 40;

  const confidence: 'high' | 'medium' | 'low' = prepTimes.length >= 10 ? 'high' : 'medium';
  const explanation = `Average kitchen preparation turnaround is ${avgPrepMins.toFixed(1)} mins across ${prepTimes.length} timed tickets.`;

  return {
    id: 'kitchen',
    title: 'Kitchen Health',
    score,
    weight: HEALTH_WEIGHTS.kitchen,
    status: 'available',
    confidence,
    explanation,
    metrics: { avgPrepMins: Number(avgPrepMins.toFixed(1)), timedOrdersCount: prepTimes.length }
  };
}

/**
 * COMPOSITE BUSINESS HEALTH CALCULATOR
 * Aggregates all 5 dimensions, renormalizes available weights, and produces explainable telemetry.
 */
export function calculateBusinessHealth(input: IBusinessHealthInput): IBusinessHealthReport {
  const dRevenue = calculateRevenueHealth(input);
  const dOperations = calculateOperationsHealth(input);
  const dCustomer = calculateCustomerHealth(input);
  const dInventory = calculateInventoryHealth(input);
  const dKitchen = calculateKitchenHealth(input);

  const dimensions = [dRevenue, dOperations, dCustomer, dInventory, dKitchen];
  const availableDims = dimensions.filter(d => d.status === 'available' && d.score !== null);
  const totalAvailableWeight = availableDims.reduce((sum, d) => sum + d.weight, 0);

  let overallScore: number | null = null;
  const dataCoveragePercentage = totalAvailableWeight; // Sum of available weights (max 100%)

  if (availableDims.length > 0 && totalAvailableWeight > 0) {
    const weightedSum = availableDims.reduce((sum, d) => sum + (d.score! * d.weight), 0);
    overallScore = Math.round(weightedSum / totalAvailableWeight);
  }

  // Determine status label & color tokens
  let label: IBusinessHealthReport['label'] = 'Limited Data';
  let color = 'text-[#7B8794]';
  let badgeBg = 'bg-[#F0F4F8] text-[#52606D] border-[#CBD2D9]';

  if (dataCoveragePercentage < 40 || overallScore === null) {
    label = 'Limited Data';
    color = 'text-[#D98B00]';
    badgeBg = 'bg-[#FFF4DC] text-[#D98B00] border-[#FDE6B0]';
  } else if (overallScore >= 90) {
    label = 'Excellent';
    color = 'text-[#16845B]';
    badgeBg = 'bg-[#E8F5EF] text-[#16845B] border-[#C6E7D8]';
  } else if (overallScore >= 75) {
    label = 'Healthy';
    color = 'text-[#16845B]';
    badgeBg = 'bg-[#E8F5EF] text-[#16845B] border-[#C6E7D8]';
  } else if (overallScore >= 60) {
    label = 'Needs Attention';
    color = 'text-[#D98B00]';
    badgeBg = 'bg-[#FFF4DC] text-[#D98B00] border-[#FDE6B0]';
  } else if (overallScore >= 40) {
    label = 'At Risk';
    color = 'text-[#D64545]';
    badgeBg = 'bg-[#FDECEC] text-[#D64545] border-[#F8B4B4]';
  } else {
    label = 'Critical';
    color = 'text-[#D64545]';
    badgeBg = 'bg-[#FDECEC] text-[#D64545] border-[#F8B4B4]';
  }

  // Trend vs previous 7-day period
  const now = Date.now();
  const ms7Days = 7 * 24 * 60 * 60 * 1000;
  const ms14Days = 14 * 24 * 60 * 60 * 1000;

  const priorOrders = (input.orders || []).filter(o => {
    if (!o.createdAt) return false;
    const time = new Date(o.createdAt).getTime();
    return !isNaN(time) && now - time > ms7Days && now - time <= ms14Days;
  });

  const priorTransactions = (input.paidTransactions || []).filter(t => {
    if (!t.createdAt) return false;
    const time = new Date(t.createdAt).getTime();
    return !isNaN(time) && now - time > ms7Days && now - time <= ms14Days;
  });

  let trendDelta: number | null = null;
  let trendText = 'No prior trend';
  let trendExplanation = 'Historical comparison unavailable (insufficient prior 7-day operational baseline).';

  if (!input.isPriorPeriod && priorOrders.length >= 3 && priorTransactions.length >= 3 && overallScore !== null) {
    const priorReport = calculateBusinessHealth({
      ...input,
      orders: priorOrders,
      paidTransactions: priorTransactions,
      isPriorPeriod: true
    });

    if (priorReport.overallScore !== null) {
      trendDelta = overallScore - priorReport.overallScore;
      if (trendDelta > 0) {
        trendText = `+${trendDelta} vs last week`;
        trendExplanation = `Health improved by ${trendDelta} pts compared to the previous 7-day window.`;
      } else if (trendDelta < 0) {
        trendText = `${trendDelta} vs last week`;
        trendExplanation = `Health adjusted by ${trendDelta} pts compared to the previous 7-day window.`;
      } else {
        trendText = '0 vs last week';
        trendExplanation = 'Health score is consistent with the previous 7-day operational period.';
      }
    }
  }

  return {
    overallScore,
    label,
    color,
    badgeBg,
    dataCoveragePercentage,
    dimensions,
    trendDelta,
    trendText,
    trendExplanation,
    calculatedAt: new Date().toISOString()
  };
}
