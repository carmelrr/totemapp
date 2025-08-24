import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useUserRouteStatus } from '@/hooks/useUserRouteStatus';
import { useFirebaseRoutes } from '@/features/routes-map/hooks/useFirebaseRoutes';
import { getGradeDifficulty } from '@/constants/colors';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  color: string;
}

/**
 * מסך הישגים בסגנון TopLogger
 * מציג הישגים שונים על בסיס פעילות המטפס
 */
export default function Achievements() {
  const { getStatistics, getRouteStatus } = useUserRouteStatus();
  const { routes } = useFirebaseRoutes();
  
  const stats = getStatistics();

  // חישוב הישגים
  const achievements = useMemo((): Achievement[] => {
    const myRoutes = routes.filter(route => {
      const status = getRouteStatus(route.id);
      return status === 'sent' || status === 'flashed';
    });

    const flashedRoutes = routes.filter(route => getRouteStatus(route.id) === 'flashed');
    
    // הישגים בסיסיים
    const baseAchievements: Achievement[] = [
      {
        id: 'first_send',
        title: 'ההתחלה 🎉',
        description: 'שלח את המסלול הראשון שלך',
        icon: '🎯',
        unlocked: myRoutes.length >= 1,
        color: '#10b981',
      },
      {
        id: 'ten_sends',
        title: 'מתחיל להבין 💪',
        description: 'שלח 10 מסלולים',
        icon: '🔥',
        unlocked: myRoutes.length >= 10,
        progress: Math.min(myRoutes.length, 10),
        maxProgress: 10,
        color: '#f59e0b',
      },
      {
        id: 'fifty_sends',
        title: 'מטפס מנוסה 🏔️',
        description: 'שלח 50 מסלולים',
        icon: '⛰️',
        unlocked: myRoutes.length >= 50,
        progress: Math.min(myRoutes.length, 50),
        maxProgress: 50,
        color: '#3b82f6',
      },
      {
        id: 'hundred_sends',
        title: 'אגדה חיה 👑',
        description: 'שלח 100 מסלולים',
        icon: '👑',
        unlocked: myRoutes.length >= 100,
        progress: Math.min(myRoutes.length, 100),
        maxProgress: 100,
        color: '#8b5cf6',
      },
      {
        id: 'first_flash',
        title: 'פלאש ראשון ⚡',
        description: 'פלאש מסלול ראשון',
        icon: '⚡',
        unlocked: flashedRoutes.length >= 1,
        color: '#ec4899',
      },
      {
        id: 'flash_master',
        title: 'מלך הפלאש 💫',
        description: 'פלאש 10 מסלולים',
        icon: '💫',
        unlocked: flashedRoutes.length >= 10,
        progress: Math.min(flashedRoutes.length, 10),
        maxProgress: 10,
        color: '#8b5cf6',
      },
    ];

    // הישגי דרגות
    const gradeAchievements: Achievement[] = [];
    const gradesSent = myRoutes.map(route => route.grade).filter(Boolean);
    const uniqueGrades = [...new Set(gradesSent)];
    
    // בדוק עבור דרגות ספציפיות
    const checkGrades = ['5a', '5b', '5c', '6a', '6b', '6c', '7a', '7b', '7c', '8a'];
    checkGrades.forEach(grade => {
      const hasGrade = gradesSent.includes(grade);
      if (hasGrade) {
        gradeAchievements.push({
          id: `grade_${grade}`,
          title: `דרגה ${grade} 🎖️`,
          description: `שלח מסלול בדרגה ${grade}`,
          icon: '🎖️',
          unlocked: true,
          color: '#6366f1',
        });
      }
    });

    // הישגי התמחות
    const specialAchievements: Achievement[] = [];
    
    // אחוז פלאש גבוה
    const flashRate = myRoutes.length > 0 ? (flashedRoutes.length / myRoutes.length) * 100 : 0;
    if (flashRate >= 50 && myRoutes.length >= 10) {
      specialAchievements.push({
        id: 'flash_specialist',
        title: 'מומחה פלאש 🌟',
        description: 'יותר מ-50% פלאש',
        icon: '🌟',
        unlocked: true,
        color: '#f97316',
      });
    }

    // מגוון דרגות
    if (uniqueGrades.length >= 5) {
      specialAchievements.push({
        id: 'grade_diversity',
        title: 'רב גוניות 🌈',
        description: 'שלח ב-5 דרגות שונות או יותר',
        icon: '🌈',
        unlocked: true,
        color: '#06b6d4',
      });
    }

    return [...baseAchievements, ...gradeAchievements, ...specialAchievements];
  }, [routes, getRouteStatus]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const AchievementCard = ({ achievement }: { achievement: Achievement }) => (
    <View style={[
      styles.achievementCard,
      achievement.unlocked ? styles.unlockedCard : styles.lockedCard
    ]}>
      <View style={styles.achievementHeader}>
        <Text style={styles.achievementIcon}>{achievement.icon}</Text>
        <View style={styles.achievementInfo}>
          <Text style={[
            styles.achievementTitle,
            { color: achievement.unlocked ? achievement.color : '#9ca3af' }
          ]}>
            {achievement.title}
          </Text>
          <Text style={[
            styles.achievementDescription,
            { color: achievement.unlocked ? '#374151' : '#9ca3af' }
          ]}>
            {achievement.description}
          </Text>
        </View>
        {achievement.unlocked && (
          <View style={[styles.checkmark, { backgroundColor: achievement.color }]}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </View>
      
      {achievement.maxProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              {
                width: `${((achievement.progress || 0) / achievement.maxProgress) * 100}%`,
                backgroundColor: achievement.unlocked ? achievement.color : '#d1d5db',
              }
            ]} />
          </View>
          <Text style={styles.progressText}>
            {achievement.progress || 0}/{achievement.maxProgress}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* סיכום הישגים */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>ההישגים שלך</Text>
        <Text style={styles.summaryCount}>
          {unlockedCount} מתוך {achievements.length} הישגים
        </Text>
        <View style={styles.summaryProgress}>
          <View style={styles.summaryProgressBar}>
            <View style={[
              styles.summaryProgressFill,
              { width: `${(unlockedCount / achievements.length) * 100}%` }
            ]} />
          </View>
        </View>
      </View>

      {/* רשימת הישגים */}
      <View style={styles.achievementsList}>
        {achievements.map(achievement => (
          <AchievementCard 
            key={achievement.id} 
            achievement={achievement} 
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 16,
  },
  summaryProgress: {
    width: '100%',
  },
  summaryProgressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  achievementsList: {
    padding: 16,
    gap: 12,
  },
  achievementCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unlockedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  lockedCard: {
    opacity: 0.6,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementIcon: {
    fontSize: 32,
    width: 40,
    textAlign: 'center',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
});
