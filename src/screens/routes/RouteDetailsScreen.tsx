import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import WallMap from '@/components/WallMap/WallMap';
import { RouteDoc } from '@/features/routes-map/types/route';
import { SwipeableRouteContainer } from '@/components/routes/SwipeableRouteContainer';
import { useRouteNavigationStore } from '@/store/useRouteNavigationStore';
import { Route } from '../../types/routes';
import { useAuth } from '@/context/AuthContext';
import { FeedbackService } from '@/features/routes-map/services/FeedbackService';
import { RoutesService } from '@/features/routes-map/services/RoutesService';
import { useLanguage } from '@/features/language';
import { VideoLinkInput, VideoLinkButton } from '@/components/feedback';
import { RouteStatsSection } from '@/components/feedback/RouteStatsSection';
import { CachedAvatar } from '@/components/ui/CachedAvatar';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { usePublishedRooms } from '@/features/wall-editor';

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
  userPhotoURL?: string;
  starRating: number;
  suggestedGrade: string;
  comment?: string;
  videoUrl?: string;
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
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { isLandscape, isTablet, width, height } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  
  // Published rooms (dynamic wall maps)
  const { rooms: publishedRooms } = usePublishedRooms();
  const selectedRoom = useMemo(() => {
    if (publishedRooms.length > 0) return publishedRooms[0];
    return null;
  }, [publishedRooms]);
  
  // Wall dimensions from selected room
  const wallWidth = selectedRoom?.width || 2560;
  const wallHeight = selectedRoom?.height || 1600;
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  
  // Active route data — starts from nav params, updates on swipe
  const initialRouteData = route.params?.route;
  const [activeRouteData, setActiveRouteData] = useState(initialRouteData);
  const routeData = activeRouteData;
  
  // Guard clause - אם אין routeId
  if (!routeData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t.errors.routeNotFound}</Text>
          <TouchableOpacity
            style={styles.backButtonError}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonErrorText}>{t.common.back}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // State for all route feedbacks (completions)
  const [allFeedbacks, setAllFeedbacks] = useState<RouteFeedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true);
  
  // State for real-time route stats
  const [liveRouteStats, setLiveRouteStats] = useState<{
    averageStarRating: number;
    calculatedGrade: string | null;
    feedbackCount: number;
    completionCount: number;
  }>({
    averageStarRating: (routeData as any).averageStarRating || 0,
    calculatedGrade: (routeData as any).calculatedGrade || null,
    feedbackCount: (routeData as any).feedbackCount || 0,
    completionCount: (routeData as any).completionCount || 0,
  });
  
  // Sent! form state
  const [showSentForm, setShowSentForm] = useState(false);
  const [sentStarRating, setSentStarRating] = useState(0);
  const [sentSuggestedGrade, setSentSuggestedGrade] = useState('');
  const [sentComment, setSentComment] = useState('');
  const [sentVideoUrl, setSentVideoUrl] = useState('');
  const [isVideoLinkValid, setIsVideoLinkValid] = useState(true);
  const [isSubmittingSent, setIsSubmittingSent] = useState(false);
  const [userSentFeedback, setUserSentFeedback] = useState<RouteFeedback | null>(null);
  const [loadingUserFeedback, setLoadingUserFeedback] = useState(false);

  useEffect(() => {
    loadAllFeedbacks();
    loadUserSentFeedback();
    
    // Subscribe to real-time route updates for stats
    const unsubscribeRoute = RoutesService.subscribeToRoute(
      routeData.id,
      (updatedRoute) => {
        if (updatedRoute) {
          setLiveRouteStats({
            averageStarRating: updatedRoute.averageStarRating || 0,
            calculatedGrade: updatedRoute.calculatedGrade || null,
            feedbackCount: updatedRoute.feedbackCount || 0,
            completionCount: updatedRoute.completionCount || 0,
          });
        }
      }
    );
    
    return () => {
      unsubscribeRoute();
    };
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
        setSentVideoUrl(feedback.videoUrl || '');
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
      Alert.alert(t.common.error, t.errors.unauthorized);
      return;
    }
    
    if (sentStarRating === 0) {
      Alert.alert(t.common.error, t.routes.starRating);
      return;
    }
    
    if (!sentSuggestedGrade) {
      Alert.alert(t.common.error, t.routes.suggestedGrade);
      return;
    }

    if (!isVideoLinkValid) {
      Alert.alert(t.common.error, t.videoLink.errors.notAllowed);
      return;
    }
    
    setIsSubmittingSent(true);
    
    try {
      const feedbackData = {
        userId: user.uid,
        userDisplayName: user.displayName || user.email || 'Anonymous',
        userPhotoURL: user.photoURL || undefined,
        starRating: sentStarRating,
        suggestedGrade: sentSuggestedGrade,
        comment: sentComment.trim(),
        videoUrl: sentVideoUrl.trim() || null,
        isCompleted: true,
      };
      
      if (userSentFeedback) {
        await FeedbackService.updateFeedback(userSentFeedback.id, feedbackData);
      } else {
        await FeedbackService.addFeedbackToRoute(routeData.id, feedbackData);
      }
      
      setShowSentForm(false);
      await loadUserSentFeedback();
    } catch (error) {
      console.error('Error submitting sent feedback:', error);
      Alert.alert(t.common.error, t.errors.saveFailed);
    } finally {
      setIsSubmittingSent(false);
    }
  };

  // Get route color or default
  const routeColor = routeData.color || '#3B82F6';
  const textColor = getContrastTextColor(routeColor);
  
  // Get original grade from builder
  const originalGrade = routeData.grade || '';
  
  // Get community stats from live state (real-time updates)
  const communityGrade = liveRouteStats.calculatedGrade;
  const averageStarRating = liveRouteStats.averageStarRating;

  // Swipe navigation between routes — update local state instead of navigation.replace
  const routeDataMap = useRouteNavigationStore((s) => s.routeDataMap);
  const handleSwipeNavigate = useCallback((nextRouteId: string) => {
    const nextRouteData = routeDataMap[nextRouteId];
    if (nextRouteData) {
      // Update route data in-place (no remount)
      setActiveRouteData(nextRouteData);
      // Reset live stats to next route's initial values
      setLiveRouteStats({
        averageStarRating: nextRouteData.averageStarRating || 0,
        calculatedGrade: nextRouteData.calculatedGrade || null,
        feedbackCount: nextRouteData.feedbackCount || 0,
        completionCount: nextRouteData.completionCount || 0,
      });
      // Reset feedback/form state
      setAllFeedbacks([]);
      setLoadingFeedbacks(true);
      setUserSentFeedback(null);
      setShowSentForm(false);
      setSentStarRating(0);
      setSentSuggestedGrade('');
      setSentComment('');
      setSentVideoUrl('');
    }
  }, [routeDataMap]);

  return (
    <SwipeableRouteContainer
      currentRouteId={routeData.id}
      onNavigateToRoute={handleSwipeNavigate}
    >
    <View style={styles.container}>
      <StatusBar barStyle={textColor === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      
      {/* Colored Header with Route Name - extends to top */}
      <View style={[styles.coloredHeader, { backgroundColor: routeColor, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={textColor} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.routeName, { color: textColor }]}>
            {language === 'he' && routeData.nameHe ? routeData.nameHe : 
             language === 'en' && routeData.nameEn ? routeData.nameEn : 
             routeData.name}
          </Text>
          {/* שורה שנייה: ממוצע קהל (או דירוג מקורי) + ממוצע כוכבים */}
          <View style={styles.headerSubtitle}>
            {/* ממוצע קהל - אם אין calculatedGrade מציג את הדירוג המקורי */}
            <Text style={[styles.headerStatText, { color: textColor }]}>
              {t.routes.communityGrade}: {communityGrade || originalGrade}
            </Text>
            <Text style={[styles.headerDivider, { color: textColor }]}> · </Text>
            {/* ממוצע כוכבים */}
            <Text style={[styles.headerStatText, { color: textColor }]}>
              {t.routes.avgStars}: ★ {averageStarRating > 0 ? averageStarRating.toFixed(1) : '-'}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 🗺️ Wall Map Section - Show route location on map */}
        <View style={styles.wallMapSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📍 {t.routes?.locationOnWall || 'מיקום על הקיר'}</Text>
          </View>
          <View style={[styles.wallMapContainer, { aspectRatio: wallWidth / wallHeight }]}>
            <WallMap
              routes={[{
                id: routeData.id,
                name: routeData.name,
                grade: routeData.grade,
                color: routeData.color || '#3B82F6',
                xNorm: routeData.coordinates?.x ?? 0.5,
                yNorm: routeData.coordinates?.y ?? 0.5,
                status: 'active' as const,
                rating: 0,
                tops: 0,
                comments: 0,
                createdAt: routeData.createdAt,
              } as RouteDoc]}
              wallWidth={wallWidth}
              wallHeight={wallHeight}
              selectedRouteId={routeData.id}
              gesturesEnabled={true}
              room={selectedRoom || undefined}
            />
          </View>
        </View>

        {/* 🏆 SENT! Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {userSentFeedback ? `✓ ${t.routes.alreadySent}` : `${t.routes.sendRoute}? 🏆`}
            </Text>
          </View>

          {loadingUserFeedback ? (
            <ActivityIndicator color={theme.primary} />
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
                <Text style={styles.sentFeedbackLabel}>{t.routes.starRating}:</Text>
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
                <Text style={styles.sentFeedbackLabel}>{t.routes.suggestedGrade}:</Text>
                <Text style={styles.sentFeedbackValue}>{userSentFeedback.suggestedGrade}</Text>
              </View>
              {userSentFeedback.comment && (
                <View style={styles.sentCommentRow}>
                  <Text style={styles.sentFeedbackLabel}>{t.routes.comment}:</Text>
                  <Text style={styles.sentCommentText}>{userSentFeedback.comment}</Text>
                </View>
              )}
              {userSentFeedback.videoUrl && (
                <VideoLinkButton url={userSentFeedback.videoUrl} />
              )}
              <TouchableOpacity 
                style={styles.editSentButton} 
                onPress={() => setShowSentForm(true)}
              >
                <Text style={styles.editSentButtonText}>✏️ {t.common.edit}</Text>
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

              {/* Video Link */}
              <VideoLinkInput
                value={sentVideoUrl}
                onChange={setSentVideoUrl}
                onValidationChange={setIsVideoLinkValid}
                disabled={isSubmittingSent}
              />
              
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
                      setSentVideoUrl(userSentFeedback.videoUrl || '');
                    } else {
                      setSentStarRating(0);
                      setSentSuggestedGrade('');
                      setSentComment('');
                      setSentVideoUrl('');
                    }
                  }}
                >
                  <Text style={styles.sentCancelButtonText}>{t.common.cancel}</Text>
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
                      {userSentFeedback ? t.common.update : t.common.submit}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {!user && (
            <Text style={styles.loginHint}>{t.errors.unauthorized}</Text>
          )}
        </View>

        {/* 📊 Route Statistics Section */}
        <View style={styles.section}>
          <RouteStatsSection
            climbedCount={liveRouteStats.completionCount}
            feedbacks={allFeedbacks.map(fb => ({ starRating: fb.starRating, suggestedGrade: fb.suggestedGrade }))}
            averageStarRating={averageStarRating}
            originalGrade={originalGrade}
            calculatedGrade={communityGrade}
          />
        </View>

        {/* All Feedbacks Section - People who completed the route */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t.routes.communityFeedbacks} 🧗</Text>
            <Text style={styles.completionCount}>
              {allFeedbacks.length}
            </Text>
          </View>

          {loadingFeedbacks ? (
            <ActivityIndicator color={theme.primary} style={{ paddingVertical: 20 }} />
          ) : allFeedbacks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🏔️</Text>
              <Text style={styles.emptyStateText}>{t.routes.noFeedbacksYet}</Text>
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
                    <CachedAvatar
                      photoURL={feedback.userPhotoURL}
                      displayName={feedback.userDisplayName || feedback.userName}
                      size={36}
                      showBorder={true}
                    />
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
                  
                  {/* Video Link Button if exists */}
                  {feedback.videoUrl && (
                    <VideoLinkButton url={feedback.videoUrl} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        
        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
    </SwipeableRouteContainer>
  );
}

// Dynamic styles factory - uses theme for dark/light mode support
const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = layout?.isLandscape ?? screenWidth > screenHeight;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 12;
  const contentMaxWidth = isLandscape ? Math.min((layout?.width ?? screenWidth) * 0.6, 600) : undefined;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    flexDirection: isLandscape ? 'row' : 'column',
  },
  // Colored Header
  coloredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: horizontalPadding,
    paddingVertical: isPhoneLandscape ? 10 : 16,
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
    fontSize: isPhoneLandscape ? 18 : 22,
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
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: theme.shadow,
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
    color: theme.text,
  },
  completionCount: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  // Sent! Button
  sentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.success,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: theme.success,
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
    backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
  },
  sentFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
  },
  sentCommentRow: {
    paddingVertical: 12,
  },
  sentFeedbackLabel: {
    fontSize: 14,
    color: theme.isDark ? '#4ade80' : '#166534',
    fontWeight: '600',
    marginRight: 12,
    minWidth: 80,
  },
  sentFeedbackValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.isDark ? '#4ade80' : '#15803D',
  },
  sentStarsDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  sentStarDisplay: {
    fontSize: 20,
    color: theme.border,
  },
  sentStarFilled: {
    color: theme.starColor,
  },
  sentCommentText: {
    fontSize: 14,
    color: theme.isDark ? '#4ade80' : '#166534',
    marginTop: 4,
    lineHeight: 20,
  },
  editSentButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
  },
  editSentButtonText: {
    fontSize: 14,
    color: theme.isDark ? '#4ade80' : '#15803D',
    fontWeight: '700',
  },
  // Sent! Form
  sentFormCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sentFormSection: {
    marginBottom: 22,
  },
  sentFormLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
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
    color: theme.border,
  },
  gradeScrollView: {
    flexGrow: 0,
  },
  gradeHint: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 8,
    textAlign: 'right',
  },
  gradeOption: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
    marginRight: 10,
    borderWidth: 2,
    borderColor: theme.border,
  },
  gradeOptionSelected: {
    backgroundColor: theme.isDark ? 'rgba(102, 126, 234, 0.2)' : '#EFF6FF',
    borderColor: theme.primary,
  },
  gradeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  gradeOptionTextSelected: {
    color: theme.primary,
  },
  sentCommentInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.border,
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
    backgroundColor: theme.surface,
    alignItems: 'center',
  },
  sentCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  sentSubmitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.success,
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
    color: theme.textSecondary,
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
    color: theme.textSecondary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 6,
  },
  // Feedbacks List
  feedbacksList: {
    gap: 14,
  },
  feedbackCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
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
    backgroundColor: theme.primary,
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
    color: theme.text,
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
    color: theme.border,
  },
  feedbackStarFilled: {
    color: theme.starColor,
  },
  feedbackGradeBadge: {
    backgroundColor: theme.isDark ? 'rgba(102, 126, 234, 0.2)' : '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  feedbackGradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
  },
  feedbackComment: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  // Wall Map Section
  wallMapSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  wallMapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.mapBackground,
    borderWidth: 2,
    borderColor: theme.border,
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
    color: theme.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  backButtonError: {
    padding: 12,
  },
  backButtonErrorText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
};
