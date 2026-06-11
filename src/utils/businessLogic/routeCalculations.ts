/**
 * @fileoverview פונקציות לחישובי מסלולים - Route calculation utilities
 * @description Business logic utilities for route calculations - pure functions without side effects
 */

export interface RouteStats {
    averageStarRating: number;
    feedbackCount: number;
    completionCount: number;
    calculatedGrade: string | null;
    gradeDistribution: Record<string, number>;
}

export interface FeedbackData {
    starRating: number;
    suggestedGrade?: string;
    isCompleted: boolean;
    /**
     * Quick sends close the route for the user (counting toward their personal
     * stats) but intentionally do NOT contribute to the route's community
     * star-rating average or grade consensus.
     */
    isQuickSend?: boolean;
}

/**
 * Calculate route statistics from feedback array
 * IMPORTANT: Only feedbacks from users who completed the route (isCompleted=true) 
 * are counted towards averageStarRating and calculatedGrade
 * @param feedbacks - Array of feedback data
 * @param originalGrade - The original grade set by the route builder
 *                        Used as fallback when no community feedback exists
 * 
 * Grade calculation:
 * - The original grade counts as 1 vote in the average alongside community feedback grades
 * - If no community grades exist, the original grade is the sole vote
 * - Uses standard rounding (0.5 threshold)
 */
export const calculateRouteStats = (feedbacks: FeedbackData[], originalGrade?: string): RouteStats => {
    if (feedbacks.length === 0) {
        return {
            averageStarRating: 0,
            feedbackCount: 0,
            completionCount: 0,
            calculatedGrade: originalGrade || null,
            gradeDistribution: {},
        };
    }

    // All completions (including quick sends) count toward the route's
    // completion/"tops" total.
    const completedFeedbacks = feedbacks.filter((fb) => fb.isCompleted);
    const completionCount = completedFeedbacks.length;

    // Quick sends close the route for the user but intentionally do NOT
    // contribute to the community rating or grade consensus. A regular send
    // that omitted the rating and/or grade likewise only contributes the
    // value(s) it actually provided.
    const ratingFeedbacks = completedFeedbacks.filter(
        (fb) => !fb.isQuickSend && (fb.starRating || 0) >= 1
    );
    const gradeFeedbacks = completedFeedbacks.filter(
        (fb) => !fb.isQuickSend && !!fb.suggestedGrade
    );

    // feedbackCount reflects the number of community star ratings backing the
    // average, so quick sends / rating-less sends never inflate the count
    // shown next to it.
    const feedbackCount = ratingFeedbacks.length;

    // Calculate average star rating ONLY from rating-bearing feedbacks
    let averageStarRating = 0;
    if (ratingFeedbacks.length > 0) {
        const totalRating = ratingFeedbacks.reduce((sum, fb) => sum + (fb.starRating || 0), 0);
        averageStarRating = totalRating / ratingFeedbacks.length;
    }

    // Calculate grade distribution ONLY from grade-bearing feedbacks
    const gradeDistribution: Record<string, number> = {};
    gradeFeedbacks.forEach((fb) => {
        if (fb.suggestedGrade) {
            gradeDistribution[fb.suggestedGrade] = (gradeDistribution[fb.suggestedGrade] || 0) + 1;
        }
    });

    // V-Scale grades for index calculation
    const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18'];
    
    // חישוב דירוג ממוצע - דירוג הבונה נספר כקול אחד בממוצע יחד עם דירוגי הקהילה
    // Calculate average grade - builder's grade counts as 1 vote alongside community feedback grades
    let calculatedGrade: string | null = null;
    
    // Collect grade indices: builder's original grade + community feedback grades
    const allGradeIndices: number[] = [];
    
    // Include original grade as one vote in the average
    if (originalGrade && V_GRADES.includes(originalGrade)) {
        allGradeIndices.push(V_GRADES.indexOf(originalGrade));
    }
    
    gradeFeedbacks.forEach(fb => {
        if (fb.suggestedGrade && V_GRADES.includes(fb.suggestedGrade)) {
            allGradeIndices.push(V_GRADES.indexOf(fb.suggestedGrade));
        }
    });
    
    if (allGradeIndices.length > 0) {
        // Calculate average index
        const averageIndex = allGradeIndices.reduce((sum, idx) => sum + idx, 0) / allGradeIndices.length;
        
        // Standard rounding (0.5 threshold)
        const roundedIndex = Math.round(averageIndex);
        
        // Clamp to valid range
        const clampedIndex = Math.max(0, Math.min(roundedIndex, V_GRADES.length - 1));
        calculatedGrade = V_GRADES[clampedIndex];
    } else {
        // No community grades - fall back to original grade
        calculatedGrade = originalGrade || null;
    }

    return {
        averageStarRating: Math.round(averageStarRating * 10) / 10,
        feedbackCount,
        completionCount,
        calculatedGrade,
        gradeDistribution,
    };
};

/**
 * Calculate difficulty consensus percentage
 */
export const calculateDifficultyConsensus = (gradeDistribution: Record<string, number>): number => {
    const totalFeedbacks = Object.values(gradeDistribution).reduce((sum, count) => sum + count, 0);

    if (totalFeedbacks === 0) return 0;

    const maxCount = Math.max(...Object.values(gradeDistribution));
    return Math.round((maxCount / totalFeedbacks) * 100);
};

/**
 * Get route difficulty level (beginner, intermediate, advanced, expert)
 */
export const getRouteDifficultyLevel = (grade: string): string => {
    const gradeMap: Record<string, string> = {
        'V0': 'beginner',
        'V1': 'beginner',
        'V2': 'beginner',
        'V3': 'intermediate',
        'V4': 'intermediate',
        'V5': 'intermediate',
        'V6': 'advanced',
        'V7': 'advanced',
        'V8': 'expert',
        'V9': 'expert',
        'V10': 'expert',
    };

    return gradeMap[grade] || 'unknown';
};

/**
 * Calculate route popularity score based on multiple factors
 */
export const calculatePopularityScore = (stats: RouteStats): number => {
    const { averageStarRating, feedbackCount, completionCount } = stats;

    // Weighted formula: rating (40%) + feedback volume (30%) + completion rate (30%)
    const ratingScore = (averageStarRating / 5) * 0.4;
    const volumeScore = Math.min(feedbackCount / 20, 1) * 0.3; // Cap at 20 feedbacks for max score
    const completionScore = feedbackCount > 0 ? (completionCount / feedbackCount) * 0.3 : 0;

    return Math.round((ratingScore + volumeScore + completionScore) * 100);
};
