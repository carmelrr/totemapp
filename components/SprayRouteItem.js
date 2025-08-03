import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../firebase-config';
import defaultAvatar from '../assets/default-avatar.png';

export default function SprayRouteItem({ route, onPress }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const currentUserId = auth.currentUser?.uid;

  const userAttempt = route.attempts?.find(attempt => attempt.userId === currentUserId);
  const isCompleted = userAttempt?.completed || false;
  const userRating = userAttempt?.rating;

  const totalAttempts = route.attempts?.length || 0;
  const completions = route.attempts?.filter(attempt => attempt.completed).length || 0;
  const successRate = totalAttempts > 0 ? Math.round((completions / totalAttempts) * 100) : 0;

  const getGradeColor = (grade) => {
    if (grade.startsWith('V')) {
      const level = parseInt(grade.slice(1));
      if (level <= 2) return '#4CAF50'; // Green - Easy
      if (level <= 4) return '#FF9800'; // Orange - Intermediate
      if (level <= 7) return '#F44336'; // Red - Hard
      return '#9C27B0'; // Purple - Very Hard
    } else {
      // French grades for endurance
      return '#2196F3'; // Blue for endurance routes
    }
  };

  const getStyleIcon = (style) => {
    switch (style) {
      case 'power': return '💪';
      case 'technical': return '🧠';
      case 'endurance': return '🏃‍♂️';
      case 'balance': return '⚖️';
      case 'crimpy': return '✋';
      case 'slopey': return '🤲';
      case 'overhang': return '🏔️';
      case 'vertical': return '📏';
      default: return '🧗‍♂️';
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeName} numberOfLines={1}>
            {route.name}
          </Text>
          <View style={styles.gradeContainer}>
            <Text style={[styles.grade, { color: getGradeColor(route.grade) }]}>
              {route.grade}
            </Text>
            {route.isEndurance && (
              <Text style={styles.enduranceLabel}>סיבולת</Text>
            )}
          </View>
        </View>

        <View style={styles.creatorInfo}>
          <Image
            source={route.creatorAvatar ? { uri: route.creatorAvatar } : defaultAvatar}
            style={styles.creatorAvatar}
          />
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.styleContainer}>
          <Text style={styles.styleIcon}>{getStyleIcon(route.style)}</Text>
          <Text style={styles.styleText}>{route.styleHe || route.style}</Text>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.statText}>
            {totalAttempts} ניסיונות • {successRate}% הצלחה
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.userStatus}>
          {isCompleted ? (
            <View style={styles.completedContainer}>
              <Text style={styles.completedText}>✅ הושלם</Text>
              {userRating && (
                <View style={styles.ratingContainer}>
                  <Text style={styles.ratingText}>
                    {'⭐'.repeat(userRating)}
                  </Text>
                </View>
              )}
            </View>
          ) : userAttempt ? (
            <Text style={styles.attemptedText}>🔄 ניסית</Text>
          ) : (
            <Text style={styles.notAttemptedText}>💭 לא נוסה</Text>
          )}
        </View>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>
            {isCompleted ? '📊 דרג' : '🎯 נסה'}
          </Text>
        </TouchableOpacity>
      </View>

      {route.holds && (
        <View style={styles.holdsPreview}>
          <Text style={styles.holdsText}>
            {route.holds.start?.length || 0} התחלה • 
            {route.holds.finish?.length || 0} סיום • 
            {route.holds.hands?.length || 0} ידיים • 
            {route.holds.feet?.length || 0} רגליים
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
    marginRight: 12,
  },
  routeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  grade: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  enduranceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    backgroundColor: theme.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  creatorInfo: {
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.border,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  styleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  styleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  styleText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userStatus: {
    flex: 1,
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedText: {
    fontSize: 14,
    color: theme.success,
    fontWeight: 'bold',
    marginRight: 8,
  },
  ratingContainer: {
    marginLeft: 8,
  },
  ratingText: {
    fontSize: 12,
  },
  attemptedText: {
    fontSize: 14,
    color: theme.warning,
    fontWeight: '600',
  },
  notAttemptedText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  actionButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  holdsPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  holdsText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'right',
  },
});
