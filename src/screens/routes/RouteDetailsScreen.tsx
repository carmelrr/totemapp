import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  KeyboardAvoidingView,
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
import { RouteStatsSection } from '@/components/feedback/RouteStatsSection';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { usePublishedRooms } from '@/features/wall-editor';
import { getRouteDisplayName } from '@/features/routes-map/utils/colors';
import { V_GRADES, getGradeIndex, getAllowedGrades, getContrastTextColor, formatDate } from '@/components/routes/routeDetailUtils';
import { RouteFeedbackForm } from '@/components/routes/RouteFeedbackForm';
import { ExistingFeedbackCard } from '@/components/routes/ExistingFeedbackCard';
import { FeedbacksList } from '@/components/routes/FeedbacksList';



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
    origin?: string;
  };
};

type RouteDetailsScreenRouteProp = RouteProp<RootStackParamList, 'RouteDetails'>;
type RouteDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
  
  // Origin tab — used to navigate back to the correct tab
  const origin = route.params?.origin;
  
  // Active route data — starts from nav params, updates on swipe
  const initialRouteData = route.params?.route;
  const [activeRouteData, setActiveRouteData] = useState(initialRouteData);
  const routeData = activeRouteData;
  
  // Sync activeRouteData when navigation params change (e.g., navigating from feed to a different route)
  useEffect(() => {
    if (initialRouteData && initialRouteData.id !== activeRouteData?.id) {
      setActiveRouteData(initialRouteData);
      // Reset all dependent state
      setLiveRouteStats({
        averageStarRating: (initialRouteData as any).averageStarRating || 0,
        calculatedGrade: (initialRouteData as any).calculatedGrade || null,
        feedbackCount: (initialRouteData as any).feedbackCount || 0,
        completionCount: (initialRouteData as any).completionCount || 0,
      });
      setAllFeedbacks([]);
      setLoadingFeedbacks(true);
      setUserSentFeedback(null);
      setShowSentForm(false);
      setSentStarRating(0);
      setSentSuggestedGrade('');
      setSentComment('');
      setSentVideoUrl('');
    }
  }, [initialRouteData?.id]);
  
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
      if (feedback && feedback.isCompleted) {
        setUserSentFeedback(feedback as RouteFeedback);
        setSentStarRating(feedback.starRating || 0);
        setSentSuggestedGrade(feedback.suggestedGrade || '');
        setSentComment(feedback.comment || '');
        setSentVideoUrl(feedback.videoUrl || '');
      } else if (feedback && !feedback.isCompleted) {
        // Feedback exists but completion was undone — pre-fill form but don't show as sent
        setUserSentFeedback(null);
        setSentStarRating(feedback.starRating || 0);
        setSentSuggestedGrade(feedback.suggestedGrade || '');
        setSentComment(feedback.comment || '');
        setSentVideoUrl(feedback.videoUrl || '');
      } else {
        setUserSentFeedback(null);
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
        userPhotoURL: user.photoURL || null,
        starRating: sentStarRating,
        suggestedGrade: sentSuggestedGrade,
        comment: sentComment.trim(),
        videoUrl: sentVideoUrl.trim() || null,
        isCompleted: true,
      };
      
      if (userSentFeedback) {
        await FeedbackService.updateFeedback(userSentFeedback.id, feedbackData);
      } else {
        // Check if there's an existing non-completed feedback (e.g. after undo)
        const existingFeedback = await FeedbackService.getUserFeedbackForRoute(user.uid, routeData.id);
        if (existingFeedback) {
          await FeedbackService.updateFeedback(existingFeedback.id, feedbackData);
        } else {
          await FeedbackService.addFeedbackToRoute(routeData.id, feedbackData);
        }
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
          onPress={() => {
            if (origin) {
              // Navigate back to the origin tab (e.g., HomeTab)
              navigation.getParent()?.navigate(origin);
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="chevron-back" size={28} color={textColor} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.routeName, { color: textColor }]}>
            {getRouteDisplayName(routeData, language, t)}
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
              gesturesEnabled={false}
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
          ) : !userSentFeedback ? (
            // Show Sent! button
            <TouchableOpacity 
              style={styles.sentButton} 
              onPress={() => setShowSentForm(true)}
              disabled={!user}
            >
              <Text style={styles.sentButtonEmoji}>🎯</Text>
              <Text style={styles.sentButtonText}>Sent!</Text>
            </TouchableOpacity>
          ) : userSentFeedback ? (
            // Show existing feedback
            <ExistingFeedbackCard
              starRating={userSentFeedback.starRating}
              suggestedGrade={userSentFeedback.suggestedGrade}
              comment={userSentFeedback.comment}
              videoUrl={userSentFeedback.videoUrl}
              onEdit={() => setShowSentForm(true)}
              onUndoSend={() => {
                Alert.alert(
                  t.routes?.undoSend || 'Undo Send',
                  t.routes?.undoSendConfirm || 'Are you sure you want to undo the send?',
                  [
                    { text: t.common?.cancel || 'Cancel', style: 'cancel' },
                    {
                      text: t.routes?.undoSend || 'Undo Send',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await FeedbackService.undoCompletion(userSentFeedback.id);
                          setUserSentFeedback(null);
                          setSentStarRating(0);
                          setSentSuggestedGrade('');
                          setSentComment('');
                          setSentVideoUrl('');
                          await loadUserSentFeedback();
                          Alert.alert(t.common?.success || 'Success', t.routes?.undoSendSuccess || 'Send undone successfully');
                        } catch (error) {
                          console.error('Error undoing send:', error);
                          Alert.alert(t.common?.error || 'Error', t.routes?.undoSendError || 'Error undoing send');
                        }
                      },
                    },
                  ]
                );
              }}
            />
          ) : null}
          
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
          <FeedbacksList
            feedbacks={allFeedbacks}
            loading={loadingFeedbacks}
            title={`${t.routes.communityFeedbacks} 🧗`}
            emptyText={t.routes.noFeedbacksYet}
            emptySubtext="תהיה הראשון! 💪"
            showAvatar={true}
          />
        </View>
        
        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Feedback form Modal popup */}
      <Modal
        visible={showSentForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.feedbackModalOverlay}
        >
          <TouchableOpacity
            style={styles.feedbackModalBackdrop}
            activeOpacity={1}
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
          />
          <View style={styles.feedbackModalContent}>
            <View style={styles.feedbackModalHeader}>
              <Text style={styles.feedbackModalTitle}>
                {userSentFeedback ? t.routes.alreadySent : `${t.routes.sendRoute}? 🏆`}
              </Text>
              <TouchableOpacity
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
                style={styles.feedbackModalClose}
              >
                <Text style={styles.feedbackModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <RouteFeedbackForm
                starRating={sentStarRating}
                onStarRatingChange={setSentStarRating}
                suggestedGrade={sentSuggestedGrade}
                onGradeChange={setSentSuggestedGrade}
                grades={getAllowedGrades(originalGrade)}
                gradeRangeHint={`(טווח מותר: ${getAllowedGrades(originalGrade)[0]} - ${getAllowedGrades(originalGrade).slice(-1)[0]})`}
                comment={sentComment}
                onCommentChange={setSentComment}
                videoUrl={sentVideoUrl}
                onVideoUrlChange={setSentVideoUrl}
                isVideoLinkValid={isVideoLinkValid}
                onVideoLinkValidChange={setIsVideoLinkValid}
                onSubmit={handleSubmitSent}
                onCancel={() => {
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
                isSubmitting={isSubmittingSent}
                isUpdate={!!userSentFeedback}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  loginHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    fontStyle: 'italic',
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
  // Feedback Modal Styles
  feedbackModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  feedbackModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  feedbackModalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Math.max(34, (insets?.bottom ?? 0) + 24),
    maxHeight: Dimensions.get('window').height * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginBottom: 8,
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  feedbackModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.card || theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackModalCloseText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
  },
});
};
