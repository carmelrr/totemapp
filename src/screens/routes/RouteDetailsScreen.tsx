import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { THEME_COLORS } from '@/constants/colors';
import { Route } from '../../types/routes';
import { useAuth } from '@/context/AuthContext';
import { FeedbackService } from '@/features/routes-map/services/FeedbackService';

// V-Scale grades for selector
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

/**
 * Get the index of a V-grade in the V_GRADES array
 * VB = 0, V0 = 1, V1 = 2, etc.
 */
const getGradeIndex = (grade: string): number => {
  const index = V_GRADES.indexOf(grade);
  return index >= 0 ? index : -1;
};

/**
 * Get allowed grades for community rating (±2 from builder's original)
 * If builder set V5, community can rate V3-V7
 */
const getAllowedGrades = (originalGrade: string): string[] => {
  const originalIndex = getGradeIndex(originalGrade);
  if (originalIndex < 0) {
    // If original grade not found, return all grades
    return V_GRADES;
  }
  
  const minIndex = Math.max(0, originalIndex - 2);
  const maxIndex = Math.min(V_GRADES.length - 1, originalIndex + 2);
  
  return V_GRADES.slice(minIndex, maxIndex + 1);
};

// Feedback interface for displaying all route completions
interface RouteFeedback {
  id: string;
  userId?: string;
  userName?: string;
  userDisplayName?: string;
  starRating: number;
  suggestedGrade: string;
  comment?: string;
  createdAt?: any;
  isCompleted?: boolean;
}

type RootStackParamList = {
  RouteDetails: {
    route: Route;
  };
};

type RouteDetailsScreenRouteProp = RouteProp<RootStackParamList, 'RouteDetails'>;
type RouteDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Helper function to determine text color based on background brightness
const getContrastTextColor = (backgroundColor: string): string => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark for light backgrounds
  return luminance > 0.5 ? '#1F2937' : '#FFFFFF';
};

export default function RouteDetailsScreen() {
  const route = useRoute<RouteDetailsScreenRouteProp>();
  const navigation = useNavigation<RouteDetailsScreenNavigationProp>();
  const { user } = useAuth();
  
  const routeData = route.params?.route;
  
  // Guard clause - אם אין routeId
  if (!routeData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>מסלול לא נמצא</Text>
          <TouchableOpacity
            style={styles.backButtonError}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonErrorText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // State for all route feedbacks (completions)
  const [allFeedbacks, setAllFeedbacks] = useState<RouteFeedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true);
  
  // Sent! form state
  const [showSentForm, setShowSentForm] = useState(false);
  const [sentStarRating, setSentStarRating] = useState(0);
  const [sentSuggestedGrade, setSentSuggestedGrade] = useState('');
  const [sentComment, setSentComment] = useState('');
  const [isSubmittingSent, setIsSubmittingSent] = useState(false);
  const [userSentFeedback, setUserSentFeedback] = useState<RouteFeedback | null>(null);
  const [loadingUserFeedback, setLoadingUserFeedback] = useState(false);

  useEffect(() => {
    loadAllFeedbacks();
    loadUserSentFeedback();
  }, [routeData.id]);

  // Load all feedbacks for this route (people who completed it)
  const loadAllFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      // Subscribe to feedbacks for this route
      const unsubscribe = FeedbackService.subscribeFeedbacksForRoute(
        routeData.id,
        (feedbacks) => {
          // Filter only completed feedbacks
          const completedFeedbacks = feedbacks.filter(f => f.isCompleted);
          setAllFeedbacks(completedFeedbacks);
          setLoadingFeedbacks(false);
        }
      );
      
      // Return cleanup function
      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      setLoadingFeedbacks(false);
    }
  };

  const loadUserSentFeedback = async () => {
    if (!user || !routeData) return;
    
    setLoadingUserFeedback(true);
    try {
      const feedback = await FeedbackService.getUserFeedbackForRoute(user.uid, routeData.id);
      if (feedback) {
        setUserSentFeedback(feedback as RouteFeedback);
        setSentStarRating(feedback.starRating || 0);
        setSentSuggestedGrade(feedback.suggestedGrade || '');
        setSentComment(feedback.comment || '');
      }
    } catch (error) {
      console.error('Error loading user sent feedback:', error);
    } finally {
      setLoadingUserFeedback(false);
    }
  };

  // Handle Sent! submission
  const handleSubmitSent = async () => {
    if (!user) {
      Alert.alert('שגיאה', 'יש להתחבר כדי לדווח על סגירת מסלול');
      return;
    }
    
    if (sentStarRating === 0) {
      Alert.alert('שגיאה', 'יש לבחור דירוג כוכבים');
      return;
    }
    
    if (!sentSuggestedGrade) {
      Alert.alert('שגיאה', 'יש לבחור דירוג קושי');
      return;
    }
    
    setIsSubmittingSent(true);
    
    try {
      const feedbackData = {
        userId: user.uid,
        userDisplayName: user.displayName || user.email || 'Anonymous',
        starRating: sentStarRating,
        suggestedGrade: sentSuggestedGrade,
        comment: sentComment.trim(),
        isCompleted: true,
      };
      
      if (userSentFeedback) {
        await FeedbackService.updateFeedback(userSentFeedback.id, feedbackData);
        Alert.alert('הצלחה! 🎉', 'הפידבק שלך עודכן בהצלחה');
      } else {
        await FeedbackService.addFeedbackToRoute(routeData.id, feedbackData);
        Alert.alert('כל הכבוד! 🏆', 'סגרת את המסלול בהצלחה!\nהדירוג שלך נוסף.');
      }
      
      setShowSentForm(false);
      await loadUserSentFeedback();
    } catch (error) {
      console.error('Error submitting sent feedback:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את הפידבק');
    } finally {
      setIsSubmittingSent(false);
    }
  };

  // Get route color or default
  const routeColor = routeData.color || '#3B82F6';
  const textColor = getContrastTextColor(routeColor);
  
  // Get original grade from builder
  const originalGrade = routeData.grade || '';
  
  // Get community stats
  const communityGrade = (routeData as any).calculatedGrade || null;
  const averageStarRating = (routeData as any).averageStarRating || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={textColor === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      
      {/* Colored Header with Route Name */}
      <View style={[styles.coloredHeader, { backgroundColor: routeColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={textColor} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.routeName, { color: textColor }]}>{routeData.name}</Text>
          {/* שורה שנייה: ממוצע קהל (או דירוג מקורי) + ממוצע כוכבים */}
          <View style={styles.headerSubtitle}>
            {/* ממוצע קהל - אם אין calculatedGrade מציג את הדירוג המקורי */}
            <Text style={[styles.headerStatText, { color: textColor }]}>
              ממוצע קהל: {communityGrade || originalGrade}
            </Text>
            <Text style={[styles.headerDivider, { color: textColor }]}> · </Text>
            {/* ממוצע כוכבים */}
            <Text style={[styles.headerStatText, { color: textColor }]}>
              ממוצע כוכבים: ★ {averageStarRating > 0 ? averageStarRating.toFixed(1) : '-'}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 🏆 SENT! Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {userSentFeedback ? '✓ סגרת את המסלול!' : 'סגרת את המסלול? 🏆'}
            </Text>
          </View>

          {loadingUserFeedback ? (
            <ActivityIndicator color={THEME_COLORS.primary} />
          ) : !showSentForm && !userSentFeedback ? (
            // Show Sent! button
            <TouchableOpacity 
              style={styles.sentButton} 
              onPress={() => setShowSentForm(true)}
              disabled={!user}
            >
              <Text style={styles.sentButtonEmoji}>🎯</Text>
              <Text style={styles.sentButtonText}>Sent!</Text>
            </TouchableOpacity>
          ) : !showSentForm && userSentFeedback ? (
            // Show existing feedback
            <View style={styles.existingSentCard}>
              <View style={styles.sentFeedbackRow}>
                <Text style={styles.sentFeedbackLabel}>דירוג:</Text>
                <View style={styles.sentStarsDisplay}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Text
                      key={star}
                      style={[
                        styles.sentStarDisplay,
                        star <= userSentFeedback.starRating && styles.sentStarFilled
                      ]}
                    >
                      ★
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.sentFeedbackRow}>
                <Text style={styles.sentFeedbackLabel}>דרגת קושי:</Text>
                <Text style={styles.sentFeedbackValue}>{userSentFeedback.suggestedGrade}</Text>
              </View>
              {userSentFeedback.comment && (
                <View style={styles.sentCommentRow}>
                  <Text style={styles.sentFeedbackLabel}>הערה:</Text>
                  <Text style={styles.sentCommentText}>{userSentFeedback.comment}</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.editSentButton} 
                onPress={() => setShowSentForm(true)}
              >
                <Text style={styles.editSentButtonText}>✏️ ערוך</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Show Sent! form
            <View style={styles.sentFormCard}>
              {/* Star Rating */}
              <View style={styles.sentFormSection}>
                <Text style={styles.sentFormLabel}>כמה נהנית מהמסלול? ⭐</Text>
                <View style={styles.sentStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setSentStarRating(star)}
                      style={styles.sentStarButton}
                    >
                      <Text style={[
                        styles.sentStarText,
                        star <= sentStarRating && styles.sentStarFilled
                      ]}>
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Grade Selector - Limited to ±2 from original grade */}
              <View style={styles.sentFormSection}>
                <Text style={styles.sentFormLabel}>מה הדירוג לדעתך? 📊</Text>
                <Text style={styles.gradeHint}>
                  (טווח מותר: {getAllowedGrades(originalGrade)[0]} - {getAllowedGrades(originalGrade).slice(-1)[0]})
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.gradeScrollView}
                >
                  {getAllowedGrades(originalGrade).map((grade) => (
                    <TouchableOpacity
                      key={grade}
                      onPress={() => setSentSuggestedGrade(grade)}
                      style={[
                        styles.gradeOption,
                        sentSuggestedGrade === grade && styles.gradeOptionSelected
                      ]}
                    >
                      <Text style={[
                        styles.gradeOptionText,
                        sentSuggestedGrade === grade && styles.gradeOptionTextSelected
                      ]}>
                        {grade}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              {/* Comment */}
              <View style={styles.sentFormSection}>
                <Text style={styles.sentFormLabel}>רוצה להוסיף הערה? 💬</Text>
                <TextInput
                  style={styles.sentCommentInput}
                  placeholder="בטא, טיפים, חוויה..."
                  placeholderTextColor="#9CA3AF"
                  value={sentComment}
                  onChangeText={setSentComment}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              
              {/* Buttons */}
              <View style={styles.sentFormButtons}>
                <TouchableOpacity 
                  style={styles.sentCancelButton} 
                  onPress={() => {
                    setShowSentForm(false);
                    if (userSentFeedback) {
                      setSentStarRating(userSentFeedback.starRating || 0);
                      setSentSuggestedGrade(userSentFeedback.suggestedGrade || '');
                      setSentComment(userSentFeedback.comment || '');
                    } else {
                      setSentStarRating(0);
                      setSentSuggestedGrade('');
                      setSentComment('');
                    }
                  }}
                >
                  <Text style={styles.sentCancelButtonText}>ביטול</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sentSubmitButton, isSubmittingSent && styles.sentSubmitButtonDisabled]} 
                  onPress={handleSubmitSent}
                  disabled={isSubmittingSent}
                >
                  {isSubmittingSent ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.sentSubmitButtonText}>
                      {userSentFeedback ? 'עדכן' : 'שלח!'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {!user && (
            <Text style={styles.loginHint}>יש להתחבר כדי לדווח על סגירת מסלול</Text>
          )}
        </View>

        {/* All Feedbacks Section - People who completed the route */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>מי סגר את המסלול? 🧗</Text>
            <Text style={styles.completionCount}>
              {allFeedbacks.length} {allFeedbacks.length === 1 ? 'מטפס' : 'מטפסים'}
            </Text>
          </View>

          {loadingFeedbacks ? (
            <ActivityIndicator color={THEME_COLORS.primary} style={{ paddingVertical: 20 }} />
          ) : allFeedbacks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🏔️</Text>
              <Text style={styles.emptyStateText}>אף אחד עוד לא סגר את המסלול</Text>
              <Text style={styles.emptyStateSubtext}>
                תהיה הראשון! 💪
              </Text>
            </View>
          ) : (
            <View style={styles.feedbacksList}>
              {allFeedbacks.map((feedback) => (
                <View key={feedback.id} style={styles.feedbackCard}>
                  {/* User info row */}
                  <View style={styles.feedbackUserRow}>
                    <View style={styles.feedbackAvatar}>
                      <Text style={styles.feedbackAvatarText}>
                        {(feedback.userDisplayName || feedback.userName || 'A').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.feedbackUserName}>
                      {feedback.userDisplayName || feedback.userName || 'Anonymous'}
                    </Text>
                  </View>
                  
                  {/* Stars and Grade row */}
                  <View style={styles.feedbackRatingRow}>
                    <View style={styles.feedbackStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                          key={star}
                          style={[
                            styles.feedbackStar,
                            star <= feedback.starRating && styles.feedbackStarFilled
                          ]}
                        >
                          ★
                        </Text>
                      ))}
                    </View>
                    <View style={styles.feedbackGradeBadge}>
                      <Text style={styles.feedbackGradeText}>{feedback.suggestedGrade}</Text>
                    </View>
                  </View>
                  
                  {/* Comment if exists */}
                  {feedback.comment && (
                    <Text style={styles.feedbackComment}>{feedback.comment}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        
        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Colored Header
  coloredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerRight: {
    width: 44,
  },
  routeName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  headerStatText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerDivider: {
    fontSize: 16,
    fontWeight: '400',
  },
  routeGrade: {
    fontSize: 18,
    fontWeight: '600',
  },
  routeNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  headerStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerStar: {
    fontSize: 18,
  },
  headerStarRating: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCommunityGrade: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCommunityGradeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  // Sections
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  completionCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Sent! Button
  sentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sentButtonEmoji: {
    fontSize: 28,
  },
  sentButtonText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  // Existing Sent Card
  existingSentCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  sentFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  sentCommentRow: {
    paddingVertical: 12,
  },
  sentFeedbackLabel: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
    marginRight: 12,
    minWidth: 80,
  },
  sentFeedbackValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803D',
  },
  sentStarsDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  sentStarDisplay: {
    fontSize: 20,
    color: '#D1D5DB',
  },
  sentStarFilled: {
    color: '#FFD700',
  },
  sentCommentText: {
    fontSize: 14,
    color: '#166534',
    marginTop: 4,
    lineHeight: 20,
  },
  editSentButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
  },
  editSentButtonText: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: '700',
  },
  // Sent! Form
  sentFormCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sentFormSection: {
    marginBottom: 22,
  },
  sentFormLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  sentStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  sentStarButton: {
    padding: 6,
  },
  sentStarText: {
    fontSize: 40,
    color: '#D1D5DB',
  },
  gradeScrollView: {
    flexGrow: 0,
  },
  gradeHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'right',
  },
  gradeOption: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  gradeOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: THEME_COLORS.primary,
  },
  gradeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  gradeOptionTextSelected: {
    color: THEME_COLORS.primary,
  },
  sentCommentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: THEME_COLORS.text,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sentFormButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  sentCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  sentCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  sentSubmitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  sentSubmitButtonDisabled: {
    opacity: 0.6,
  },
  sentSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  loginHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 14,
    fontStyle: 'italic',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 6,
  },
  // Feedbacks List
  feedbacksList: {
    gap: 14,
  },
  feedbackCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feedbackUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  feedbackAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  feedbackRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackStars: {
    flexDirection: 'row',
    gap: 3,
  },
  feedbackStar: {
    fontSize: 18,
    color: '#D1D5DB',
  },
  feedbackStarFilled: {
    color: '#FFD700',
  },
  feedbackGradeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  feedbackGradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME_COLORS.primary,
  },
  feedbackComment: {
    marginTop: 12,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  // Error State
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButtonError: {
    padding: 12,
  },
  backButtonErrorText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
});
