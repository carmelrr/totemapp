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
}

/**
 * Calculate route statistics from feedback array
 * IMPORTANT: Only feedbacks from users who completed the route (isCompleted=true) 
 * are counted towards averageStarRating and calculatedGrade
 * @param feedbacks - Array of feedback data
 * @param originalGrade - The original grade set by the route builder (optional)
 *                        When fewer than 6 feedbacks, this grade is included in the calculation
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

    // Filter only completed feedbacks for rating calculations
    const completedFeedbacks = feedbacks.filter((fb) => fb.isCompleted);
    const completionCount = completedFeedbacks.length;
    const feedbackCount = feedbacks.length;

    // Calculate average star rating ONLY from completed feedbacks
    let averageStarRating = 0;
    if (completedFeedbacks.length > 0) {
        const totalRating = completedFeedbacks.reduce((sum, fb) => sum + (fb.starRating || 0), 0);
        averageStarRating = totalRating / completedFeedbacks.length;
    }

    // Calculate grade distribution ONLY from completed feedbacks
    const gradeDistribution: Record<string, number> = {};
    completedFeedbacks.forEach((fb) => {
        if (fb.suggestedGrade) {
            gradeDistribution[fb.suggestedGrade] = (gradeDistribution[fb.suggestedGrade] || 0) + 1;
        }
    });

    // V-Scale grades for index calculation
    const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18'];
    
    // Calculate grade based on feedback count
    // If fewer than 6 feedbacks, include original grade and use most voted (mode)
    // Otherwise, use the average of community feedbacks only
    let calculatedGrade: string | null = null;
    
    if (completedFeedbacks.length < 6) {
        // פחות מ-6 תגובות - כולל את הדירוג המקורי בחישוב ומשתמש בדירוג עם הכי הרבה הצבעות
        // Include original grade in the distribution
        const distributionWithOriginal = { ...gradeDistribution };
        if (originalGrade && V_GRADES.includes(originalGrade)) {
            distributionWithOriginal[originalGrade] = (distributionWithOriginal[originalGrade] || 0) + 1;
        }
        
        const gradeEntries = Object.entries(distributionWithOriginal);
        if (gradeEntries.length > 0) {
            const [mostVotedGrade] = gradeEntries.reduce(
                (max, entry) => entry[1] > max[1] ? entry : max
            );
            calculatedGrade = mostVotedGrade;
        } else {
            // אין תגובות כלל - מחזיר את הדירוג המקורי
            calculatedGrade = originalGrade || null;
        }
    } else {
        // 6 או יותר תגובות - משתמשים בממוצע של תגובות הקהל בלבד
        const gradesWithIndex = completedFeedbacks
            .map(fb => fb.suggestedGrade)
            .filter((g): g is string => !!g)
            .map(g => V_GRADES.indexOf(g))
            .filter(idx => idx >= 0);
        
        if (gradesWithIndex.length > 0) {
            // Calculate average index (as float)
            const averageIndex = gradesWithIndex.reduce((sum, idx) => sum + idx, 0) / gradesWithIndex.length;
            // Round to nearest grade (0.5 rounds up)
            const roundedIndex = Math.round(averageIndex);
            // Clamp to valid range
            const clampedIndex = Math.max(0, Math.min(roundedIndex, V_GRADES.length - 1));
            calculatedGrade = V_GRADES[clampedIndex];
        }
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
