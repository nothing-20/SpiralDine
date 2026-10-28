import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  deleteDoc,
  writeBatch,
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { customerService } from './customerService';

export type OverallExperienceType = 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Very Poor';
export type RevisitIntentionType = 'Yes' | 'Maybe' | 'No';

export interface IReviewCategoryScores {
  foodQuality: number;
  service: number;
  cleanliness: number;
  ambience: number;
}

export interface IReviewSubmissionPayload {
  tenantId: string;
  orderId: string;
  overallExperience: OverallExperienceType;
  starRating?: number;
  categoryScores: IReviewCategoryScores;
  comments?: string;
  isAnonymous: boolean;
  revisitIntention: RevisitIntentionType;
  customerName?: string;
  customerId?: string;
  tableNumber?: string;
  restaurantName?: string;
}

export interface ISatisfactionRatingRecord {
  id?: string;
  orderId: string;
  tenantId: string;
  tableNumber: string;
  restaurantName?: string;
  rating: string;
  starRating: number;
  foodQuality: number;
  service: number;
  serviceSpeed: number; // backward compatibility
  cleanliness: number;
  ambience: number;
  notes: string;
  comments: string; // backward compatibility
  feedback: string; // backward compatibility
  isAnonymous: boolean;
  submittedByName: string;
  publicCustomerName: string;
  customerId?: string;
  revisitIntention: RevisitIntentionType;
  repeatCustomer: boolean;
  isPositive: boolean;
  isComplaint: boolean;
  status: 'Published' | 'New' | 'Resolved';
  submittedAt: string;
  createdAt: string;
}

export interface IStarDistribution {
  count: number;
  percentage: number;
}

export interface IRestaurantRatingSummary {
  averageRating: number;
  totalReviews: number;
  starDistribution: Record<1 | 2 | 3 | 4 | 5, IStarDistribution>;
  categoryAverages: {
    foodQuality: number;
    service: number;
    cleanliness: number;
    ambience: number;
  };
  revisitRate: number; // Percentage answering 'Yes'
  hasReviews: boolean;
}

/**
 * Mask customer name for anonymous review display.
 * E.g., "Rajiv Basnet" -> "R*****"
 * "Geetha Krishna" -> "G*****"
 * "" or "Guest" -> "Anonymous Diner"
 */
export function maskCustomerName(name?: string): string {
  if (!name || !name.trim()) return 'Anonymous Diner';
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (lower === 'guest' || lower === 'table guest' || lower === 'anonymous' || lower === 'guest diner') {
    return 'Anonymous Diner';
  }
  const firstChar = clean.charAt(0).toUpperCase();
  return `${firstChar}*****`;
}

/**
 * Map overall experience text to numeric star rating (1-5).
 */
export function mapOverallToScore(rating: string): number {
  switch (rating) {
    case 'Excellent':
      return 5;
    case 'Good':
      return 4;
    case 'Average':
    case 'Neutral':
      return 3;
    case 'Poor':
    case 'Needs Attention':
      return 2;
    case 'Very Poor':
    case 'Complaint':
      return 1;
    default:
      return 5;
  }
}

/**
 * Map numeric score (1-5) to canonical overall experience text.
 */
export function mapScoreToOverall(score: number): OverallExperienceType {
  if (score >= 5) return 'Excellent';
  if (score === 4) return 'Good';
  if (score === 3) return 'Average';
  if (score === 2) return 'Poor';
  return 'Very Poor';
}

/**
 * Validate review payload before submission.
 */
export function validateReviewPayload(payload: IReviewSubmissionPayload): { isValid: boolean; error?: string } {
  if (!payload.tenantId || !payload.tenantId.trim()) {
    return { isValid: false, error: 'Restaurant identifier is required.' };
  }
  if (!payload.orderId || !payload.orderId.trim()) {
    return { isValid: false, error: 'Order reference is required.' };
  }
  if (!payload.overallExperience) {
    return { isValid: false, error: 'Please select your overall dining experience.' };
  }

  const { foodQuality, service, cleanliness, ambience } = payload.categoryScores || {};
  if (!foodQuality || foodQuality < 1 || foodQuality > 5) {
    return { isValid: false, error: 'Please provide a valid Food Quality rating (1-5).' };
  }
  if (!service || service < 1 || service > 5) {
    return { isValid: false, error: 'Please provide a valid Service rating (1-5).' };
  }
  if (!cleanliness || cleanliness < 1 || cleanliness > 5) {
    return { isValid: false, error: 'Please provide a valid Cleanliness rating (1-5).' };
  }
  if (!ambience || ambience < 1 || ambience > 5) {
    return { isValid: false, error: 'Please provide a valid Ambience rating (1-5).' };
  }

  if (payload.comments && payload.comments.length > 500) {
    return { isValid: false, error: 'Written comments must be 500 characters or fewer.' };
  }

  return { isValid: true };
}

/**
 * Calculate ratings summary and distribution from a list of satisfaction ratings.
 */
export function calculateRatingSummary(reviews: any[]): IRestaurantRatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, { count: number; percentage: number }> = {
    5: { count: 0, percentage: 0 },
    4: { count: 0, percentage: 0 },
    3: { count: 0, percentage: 0 },
    2: { count: 0, percentage: 0 },
    1: { count: 0, percentage: 0 },
  };

  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      starDistribution: distribution,
      categoryAverages: {
        foodQuality: 0,
        service: 0,
        cleanliness: 0,
        ambience: 0
      },
      revisitRate: 0,
      hasReviews: false
    };
  }

  let totalOverallScore = 0;
  let totalFood = 0;
  let totalService = 0;
  let totalCleanliness = 0;
  let totalAmbience = 0;
  let foodCount = 0;
  let serviceCount = 0;
  let cleanCount = 0;
  let ambienceCount = 0;
  let revisitYesCount = 0;

  reviews.forEach(r => {
    // Determine overall score
    let score = 5;
    if (typeof r.starRating === 'number' && r.starRating >= 1 && r.starRating <= 5) {
      score = Math.round(r.starRating);
    } else if (typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5) {
      score = Math.round(r.rating);
    } else if (typeof r.rating === 'string') {
      score = mapOverallToScore(r.rating);
    }

    if (score >= 1 && score <= 5) {
      distribution[score as 1 | 2 | 3 | 4 | 5].count += 1;
      totalOverallScore += score;
    }

    // Category scores
    if (typeof r.foodQuality === 'number' && r.foodQuality >= 1) {
      totalFood += r.foodQuality;
      foodCount++;
    }
    const servVal = typeof r.service === 'number' ? r.service : r.serviceSpeed;
    if (typeof servVal === 'number' && servVal >= 1) {
      totalService += servVal;
      serviceCount++;
    }
    if (typeof r.cleanliness === 'number' && r.cleanliness >= 1) {
      totalCleanliness += r.cleanliness;
      cleanCount++;
    }
    if (typeof r.ambience === 'number' && r.ambience >= 1) {
      totalAmbience += r.ambience;
      ambienceCount++;
    }

    // Revisit intention
    if (r.revisitIntention === 'Yes' || r.repeatCustomer === true) {
      revisitYesCount++;
    }
  });

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? Number((totalOverallScore / totalReviews).toFixed(1)) : 0;

  // Compute percentages for distribution
  ([1, 2, 3, 4, 5] as const).forEach(star => {
    distribution[star].percentage = totalReviews > 0
      ? Math.round((distribution[star].count / totalReviews) * 100)
      : 0;
  });

  return {
    averageRating,
    totalReviews,
    starDistribution: distribution,
    categoryAverages: {
      foodQuality: foodCount > 0 ? Number((totalFood / foodCount).toFixed(1)) : averageRating,
      service: serviceCount > 0 ? Number((totalService / serviceCount).toFixed(1)) : averageRating,
      cleanliness: cleanCount > 0 ? Number((totalCleanliness / cleanCount).toFixed(1)) : averageRating,
      ambience: ambienceCount > 0 ? Number((totalAmbience / ambienceCount).toFixed(1)) : averageRating
    },
    revisitRate: totalReviews > 0 ? Math.round((revisitYesCount / totalReviews) * 100) : 0,
    hasReviews: totalReviews > 0
  };
}

export const reviewService = {
  maskCustomerName,
  mapOverallToScore,
  mapScoreToOverall,
  validateReviewPayload,
  calculateRatingSummary,

  /**
   * Check if a review already exists for a specific order.
   * Prevents accidental duplicate review submissions.
   */
  async getExistingReviewForOrder(tenantId: string, orderId: string): Promise<ISatisfactionRatingRecord | null> {
    if (!tenantId || !orderId) return null;
    try {
      const q = query(
        collection(db, 'restaurants', tenantId, 'satisfactionRatings'),
        where('orderId', '==', orderId),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as ISatisfactionRatingRecord;
      }
      return null;
    } catch (err) {
      console.warn('[reviewService] Existing review check error:', err);
      return null;
    }
  },

  /**
   * Fetch published reviews for a restaurant tenant with sorting and query limiting.
   */
  async getRestaurantReviews(
    tenantId: string, 
    options?: { sortBy?: 'recent' | 'highest' | 'lowest'; limitCount?: number }
  ): Promise<ISatisfactionRatingRecord[]> {
    if (!tenantId) return [];
    const limitCount = options?.limitCount || 30;
    const sortBy = options?.sortBy || 'recent';

    try {
      const colRef = collection(db, 'restaurants', tenantId, 'satisfactionRatings');
      let snap;
      try {
        let q;
        if (sortBy === 'highest') {
          q = query(colRef, orderBy('starRating', 'desc'), limit(limitCount));
        } else if (sortBy === 'lowest') {
          q = query(colRef, orderBy('starRating', 'asc'), limit(limitCount));
        } else {
          q = query(colRef, orderBy('submittedAt', 'desc'), limit(limitCount));
        }
        snap = await getDocs(q);
      } catch (orderErr) {
        // Fallback without index orderBy if composite index is pending
        console.warn('[reviewService] OrderBy query fallback:', orderErr);
        snap = await getDocs(query(colRef, limit(limitCount)));
      }

      const list: ISatisfactionRatingRecord[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as ISatisfactionRatingRecord);
      });

      // Local sort fallback
      if (sortBy === 'highest') {
        list.sort((a, b) => (b.starRating || 5) - (a.starRating || 5));
      } else if (sortBy === 'lowest') {
        list.sort((a, b) => (a.starRating || 5) - (b.starRating || 5));
      } else {
        list.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime());
      }

      return list;
    } catch (err) {
      console.error('[reviewService] Fetch reviews error:', err);
      return [];
    }
  },

  /**
   * Submit dining feedback review to Firestore.
   */
  async submitReview(payload: IReviewSubmissionPayload): Promise<{ success: boolean; reviewId?: string; error?: string }> {
    const validation = validateReviewPayload(payload);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // 1. Prevent duplicate reviews for the same order
    const existing = await this.getExistingReviewForOrder(payload.tenantId, payload.orderId);
    if (existing) {
      return { 
        success: false, 
        error: 'A review has already been submitted for this order. Thank you for your feedback!' 
      };
    }

    try {
      const starRating = payload.starRating || mapOverallToScore(payload.overallExperience);
      const isPositive = starRating >= 4;
      const isComplaint = starRating <= 2;
      const nowIso = new Date().toISOString();

      const rawCustomerName = payload.customerName?.trim() || 'Table Guest';
      const publicName = payload.isAnonymous ? maskCustomerName(rawCustomerName) : rawCustomerName;
      const trimmedNotes = (payload.comments || '').trim();

      const record: Omit<ISatisfactionRatingRecord, 'id'> = {
        orderId: payload.orderId,
        tenantId: payload.tenantId,
        tableNumber: payload.tableNumber || 'Walk-in',
        restaurantName: payload.restaurantName,
        rating: payload.overallExperience,
        starRating,
        foodQuality: payload.categoryScores.foodQuality,
        service: payload.categoryScores.service,
        serviceSpeed: payload.categoryScores.service, // backward compat
        cleanliness: payload.categoryScores.cleanliness,
        ambience: payload.categoryScores.ambience,
        notes: trimmedNotes || 'No additional comments provided.',
        comments: trimmedNotes || 'No additional comments provided.', // backward compat
        feedback: trimmedNotes || 'No additional comments provided.', // backward compat
        isAnonymous: Boolean(payload.isAnonymous),
        submittedByName: rawCustomerName, // internal validation
        publicCustomerName: publicName, // public listing
        customerId: payload.customerId || '',
        revisitIntention: payload.revisitIntention,
        repeatCustomer: payload.revisitIntention === 'Yes', // backward compat
        isPositive,
        isComplaint,
        status: 'Published',
        submittedAt: nowIso,
        createdAt: nowIso
      };

      const reviewsCol = collection(db, 'restaurants', payload.tenantId, 'satisfactionRatings');
      const docRef = await addDoc(reviewsCol, record);

      // 2. Service Recovery: If critical/poor rating, trigger manager review task
      if (isComplaint) {
        try {
          const taskCol = collection(db, 'restaurants', payload.tenantId, 'tasks');
          await addDoc(taskCol, {
            tenantId: payload.tenantId,
            customerIssue: `Diner rating: ${payload.overallExperience} (${starRating}/5★). Note: ${trimmedNotes || 'None'}`,
            priority: payload.overallExperience === 'Very Poor' ? 'Critical' : 'High',
            assignedManager: 'Pending',
            resolutionStatus: 'Pending',
            resolutionNotes: '',
            submittedAt: nowIso,
            submittedByName: rawCustomerName,
            submittedBy: 'customer',
            tableNumber: payload.tableNumber || 'Walk-in',
            rating: payload.overallExperience,
            satisfactionRatingId: docRef.id,
            orderId: payload.orderId
          });
        } catch (taskErr) {
          console.warn('[reviewService] Manager recovery task warning:', taskErr);
        }
      }

      // 3. Log event into Customer event history
      try {
        await customerService.logCustomerEvent(
          payload.tenantId, 
          'Feedback Submitted', 
          `Customer submitted satisfaction review: ${payload.overallExperience} (${starRating}/5★)`,
          {
            rating: payload.overallExperience,
            starRating,
            orderId: payload.orderId,
            isAnonymous: payload.isAnonymous
          }
        );
      } catch (logErr) {
        console.warn('[reviewService] Customer event logging warning:', logErr);
      }

      return { success: true, reviewId: docRef.id };
    } catch (err: any) {
      console.error('[reviewService] Submission error:', err);
      return { 
        success: false, 
        error: err?.message || 'Failed to submit review. Please check your connection and try again.' 
      };
    }
  },

  /**
   * Delete a review document directly from Firestore.
   */
  async deleteReview(tenantId: string, reviewId: string): Promise<{ success: boolean; error?: string }> {
    if (!tenantId || !reviewId) {
      return { success: false, error: 'Restaurant ID and Review ID are required.' };
    }
    try {
      const docRef = doc(db, 'restaurants', tenantId, 'satisfactionRatings', reviewId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (err: any) {
      console.error('[reviewService] Delete review error:', err);
      return { 
        success: false, 
        error: err?.message || 'Failed to delete review from Firestore.' 
      };
    }
  },

  /**
   * Purge test / fake reviews directly from Firestore.
   * Matches test comments like 'super', sample order numbers, demo IDs, or target IDs.
   */
  async purgeTestReviews(
    tenantId: string, 
    specificIds?: string[]
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!tenantId) {
      return { success: false, count: 0, error: 'Restaurant ID is required.' };
    }
    try {
      const colRef = collection(db, 'restaurants', tenantId, 'satisfactionRatings');
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      let count = 0;

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const notesStr = String(data.notes || data.comments || data.feedback || '').toLowerCase().trim();
        const orderIdStr = String(data.orderId || '').toUpperCase().trim();

        const isTestMatch = specificIds
          ? specificIds.includes(id)
          : (
            notesStr === 'super' ||
            notesStr === 'test' ||
            notesStr === 'testing' ||
            orderIdStr === 'ORD-OAPZGOG' ||
            orderIdStr === 'OAPZGOG' ||
            id.startsWith('REV-') ||
            data.isTest === true ||
            (data.customerName && String(data.customerName).startsWith('Customer ')) ||
            notesStr.includes('stunning hospitality and gorgeous fresh flavors')
          );

        if (isTestMatch) {
          batch.delete(docSnap.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
      }

      return { success: true, count };
    } catch (err: any) {
      console.error('[reviewService] Purge test reviews error:', err);
      return { 
        success: false, 
        count: 0, 
        error: err?.message || 'Failed to purge test reviews from Firestore.' 
      };
    }
  }
};

export default reviewService;
