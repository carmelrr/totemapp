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
 */
export const calculateRouteStats = (feedbacks: FeedbackData[]): RouteStats => {
    if (feedbacks.length === 0) {
        return {
            averageStarRating: 0,
            feedbackCount: 0,
            completionCount: 0,
            calculatedGrade: null,
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

    // Calculate most suggested grade from completed feedbacks
    let calculatedGrade = null;
    if (Object.keys(gradeDistribution).length > 0) {
        const entries = Object.entries(gradeDistribution);
        const [grade] = entries.reduce(([maxGrade, maxCount], [currentGrade, currentCount]) =>
            currentCount > maxCount ? [currentGrade, currentCount] : [maxGrade, maxCount]
        );
        calculatedGrade = grade;
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
