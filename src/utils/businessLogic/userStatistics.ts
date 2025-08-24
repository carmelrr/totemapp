/**
 * @fileoverview פונקציות לחישובי סטטיסטיקות משתמשים - User statistics utilities
 * @description Business logic utilities for user statistics - pure functions without side effects
 */

export interface UserStatsData {
    totalFeedbacks: number;
    totalStarRating: number;
    averageRating: number;
    completedRoutes: number;
}

export interface FeedbackOperation {
    starRating: number;
    isCompleted: boolean;
}

/**
 * חישוב סטטיסטיקות משתמש חדשות לאחר הוספת משוב
 * Calculate new user stats after adding feedback
 */
export const addFeedbackToUserStats = (
    currentStats: UserStatsData,
    feedback: FeedbackOperation
): UserStatsData => {
    return {
        totalFeedbacks: currentStats.totalFeedbacks + 1,
        totalStarRating: currentStats.totalStarRating + feedback.starRating,
        averageRating: (currentStats.totalStarRating + feedback.starRating) / (currentStats.totalFeedbacks + 1),
        completedRoutes: feedback.isCompleted
            ? currentStats.completedRoutes + 1
            : currentStats.completedRoutes,
    };
};

/**
 * Calculate new user stats after removing feedback
 */
export const removeFeedbackFromUserStats = (
    currentStats: UserStatsData,
    feedback: FeedbackOperation
): UserStatsData => {
    const newTotalFeedbacks = Math.max(0, currentStats.totalFeedbacks - 1);
    const newTotalStarRating = Math.max(0, currentStats.totalStarRating - feedback.starRating);

    return {
        totalFeedbacks: newTotalFeedbacks,
        totalStarRating: newTotalStarRating,
        averageRating: newTotalFeedbacks > 0 ? newTotalStarRating / newTotalFeedbacks : 0,
        completedRoutes: feedback.isCompleted
            ? Math.max(0, currentStats.completedRoutes - 1)
            : currentStats.completedRoutes,
    };
};

/**
 * Get user level based on completed routes
 */
export const getUserLevel = (completedRoutes: number): string => {
    if (completedRoutes >= 100) return 'expert';
    if (completedRoutes >= 50) return 'advanced';
    if (completedRoutes >= 20) return 'intermediate';
    if (completedRoutes >= 5) return 'beginner';
    return 'newcomer';
};

/**
 * Calculate user engagement score
 */
export const calculateEngagementScore = (stats: UserStatsData): number => {
    const { totalFeedbacks, averageRating, completedRoutes } = stats;

    // Weighted formula: feedback volume (40%) + quality (30%) + completion (30%)
    const volumeScore = Math.min(totalFeedbacks / 50, 1) * 0.4; // Cap at 50 feedbacks
    const qualityScore = (averageRating / 5) * 0.3;
    const completionScore = Math.min(completedRoutes / 30, 1) * 0.3; // Cap at 30 routes

    return Math.round((volumeScore + qualityScore + completionScore) * 100);
};

/**
 * Get next milestone for user progression
 */
export const getNextMilestone = (completedRoutes: number): { target: number; title: string } => {
    const milestones = [
        { target: 5, title: 'First Steps' },
        { target: 10, title: 'Getting Started' },
        { target: 20, title: 'Intermediate Climber' },
        { target: 50, title: 'Advanced Climber' },
        { target: 100, title: 'Expert Climber' },
        { target: 200, title: 'Master Climber' },
    ];

    return milestones.find(milestone => milestone.target > completedRoutes) ||
        { target: completedRoutes + 50, title: 'Legendary Climber' };
};
