// src/screens/CommunityRoutes/CommunityRouteDetailScreen.tsx
// Screen for viewing a single community route with holds, comments, and likes

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, lightTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { WallImageWithHolds } from '@/components/spray/WallImageWithHolds';
import {
  useCommunityRoute,
  useCommunityRouteLike,
  useCommunityRouteSent,
  useDeleteCommunityRoute,
  useExpirationInfo,
  useCommunityRouteFeedback,
} from '@/features/community-routes';
import { RouteStatsSection } from '@/components/feedback/RouteStatsSection';
import { SwipeableRouteContainer } from '@/components/routes/SwipeableRouteContainer';
import { RouteFeedbackForm } from '@/components/routes/RouteFeedbackForm';
import { ExistingFeedbackCard } from '@/components/routes/ExistingFeedbackCard';
import { FeedbacksList } from '@/components/routes/FeedbacksList';
import { formatDate } from '@/components/routes/routeDetailUtils';

type Theme = typeof lightTheme;

export const CommunityRouteDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, width, height } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  const initialRouteId = route.params?.routeId;
  
  // Active route ID — starts from nav params, updates on swipe (no remount)
  const [activeRouteId, setActiveRouteId] = useState(initialRouteId);
  const routeId = activeRouteId;
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);

  const { route: communityRoute, loading } = useCommunityRoute(routeId);
  const { liked, toggle: toggleLike } = useCommunityRouteLike(routeId);
  const { sent, toggle: toggleSent } = useCommunityRouteSent(routeId);
  const { deleteRoute, deleting } = useDeleteCommunityRoute();
  const { daysLeft, expiringSoon } = useExpirationInfo(communityRoute?.expiresAt);
  
  // Feedback hook for star rating and grade suggestion
  const {
    userFeedback,
    feedbacks,
    loading: feedbackLoading,
    submitting: feedbackSubmitting,
    allowedGrades,
    submit: submitFeedback,
  } = useCommunityRouteFeedback(routeId, communityRoute?.grade || 'V0');

  const [showHolds, setShowHolds] = useState(true);
  
  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [suggestedGrade, setSuggestedGrade] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');
  
  // Initialize feedback form with existing data
  React.useEffect(() => {
    if (userFeedback) {
      setStarRating(userFeedback.starRating || 0);
      setSuggestedGrade(userFeedback.suggestedGrade || '');
      setFeedbackComment(userFeedback.comment || '');
    }
  }, [userFeedback]);

  const isOwner = user?.uid === communityRoute?.createdBy;

  // Swipe navigation between routes — update local state instead of navigation.replace
  const handleSwipeNavigate = useCallback((nextRouteId: string) => {
    setActiveRouteId(nextRouteId);
    // Reset feedback form state
    setShowFeedbackForm(false);
    setStarRating(0);
    setSuggestedGrade('');
    setFeedbackComment('');
    setShowHolds(true);
  }, []);

  const handleLike = async () => {
    await toggleLike();
  };

  const handleSent = async () => {
    await toggleSent();
  };

  const handleDeleteRoute = () => {
    if (!isOwner) return;
    Alert.alert(
      t.community.deleteRoute,
      t.community.deleteRouteConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoute(routeId, communityRoute!.createdBy);
              navigation.goBack();
            } catch (error: any) {
              Alert.alert(t.common.error, error.message);
            }
          },
        },
      ]
    );
  };

  const handleSubmitFeedback = async () => {
    if (!user) {
      Alert.alert(t.common.error, t.community.loginToRate);
      return;
    }

    if (starRating === 0) {
      Alert.alert(t.common.error, t.community.mustSelectRating);
      return;
    }

    if (!suggestedGrade) {
      Alert.alert(t.common.error, t.community.mustSelectGrade);
      return;
    }

    try {
      await submitFeedback({
        starRating,
        suggestedGrade,
        comment: feedbackComment.trim(),
      });
      setShowFeedbackForm(false);
    } catch (error: any) {
      Alert.alert(t.common.error, error.message);
    }
  };



  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!communityRoute) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            {t.community.routeNotFound}
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.buttonPrimary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{t.community.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SwipeableRouteContainer
      currentRouteId={routeId}
      onNavigateToRoute={handleSwipeNavigate}
    >
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerGradient }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <BrandLogo variant="icon" color="white" size={24} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {communityRoute.name}
          </Text>
        </View>
        {isOwner ? (
          <TouchableOpacity style={styles.headerButton} onPress={handleDeleteRoute}>
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="trash-outline" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Image with holds */}
          <View style={styles.imageContainer}>
            <WallImageWithHolds
              imageUrl={communityRoute.imageUrl}
              holds={showHolds ? communityRoute.holds : []}
              editable={false}
            />
            
            {/* Toggle holds button */}
            <TouchableOpacity
              style={[styles.toggleHoldsButton, { backgroundColor: theme.surface }]}
              onPress={() => setShowHolds(!showHolds)}
            >
              <Ionicons
                name={showHolds ? 'eye' : 'eye-off'}
                size={20}
                color={theme.text}
              />
            </TouchableOpacity>

            {/* Expiration badge */}
            <View
              style={[
                styles.expirationBadge,
                expiringSoon && styles.expirationBadgeWarning,
              ]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={expiringSoon ? '#fff' : '#fff'}
              />
              <Text style={styles.expirationText}>
                {daysLeft > 0 ? `${daysLeft} ${t.community.daysRemaining}` : t.community.expiringToday}
              </Text>
            </View>
          </View>

          {/* Route info */}
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <View style={styles.infoRow}>
              <View style={styles.gradeContainer}>
                <Text style={styles.gradeLabel}>{t.community.grade}</Text>
                <Text style={[styles.gradeValue, { color: theme.primary }]}>
                  {communityRoute.grade}
                </Text>
              </View>
              <View style={styles.creatorInfo}>
                <Text style={[styles.creatorName, { color: theme.text }]}>
                  {communityRoute.creatorName}
                </Text>
                <Text style={[styles.createdAt, { color: theme.textSecondary }]}>
                  {formatDate(communityRoute.createdAt)}
                </Text>
              </View>
            </View>

            {communityRoute.gymName && (
              <View style={styles.gymRow}>
                <Ionicons name="location" size={16} color={theme.textSecondary} />
                <Text style={[styles.gymName, { color: theme.textSecondary }]}>
                  {communityRoute.gymName}
                </Text>
              </View>
            )}

            {communityRoute.description && (
              <Text style={[styles.description, { color: theme.text }]}>
                {communityRoute.description}
              </Text>
            )}

            {/* Community stats - average rating and calculated grade */}
            {(communityRoute.averageStarRating || communityRoute.calculatedGrade) && (
              <View style={styles.communityStatsRow}>
                {communityRoute.averageStarRating > 0 && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t.community.averageRating}</Text>
                    <View style={styles.starsDisplay}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                          key={star}
                          style={[
                            styles.starDisplayText,
                            star <= Math.round(communityRoute.averageStarRating || 0) && styles.starFilled,
                          ]}
                        >
                          ★
                        </Text>
                      ))}
                      <Text style={[styles.statValue, { color: theme.textSecondary }]}>
                        ({communityRoute.averageStarRating?.toFixed(1)})
                      </Text>
                    </View>
                  </View>
                )}
                {communityRoute.calculatedGrade && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t.community.communityGrade}</Text>
                    <Text style={[styles.calculatedGrade, { color: theme.primary }]}>
                      {communityRoute.calculatedGrade}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 📊 Route Statistics Section */}
            <View style={styles.ratingDivider} />
            <RouteStatsSection
              climbedCount={communityRoute.sentCount || feedbacks.length}
              feedbacks={feedbacks.map(fb => ({ starRating: fb.starRating, suggestedGrade: fb.suggestedGrade }))}
              averageStarRating={communityRoute.averageStarRating || 0}
              originalGrade={communityRoute.grade}
              calculatedGrade={communityRoute.calculatedGrade}
            />

            {/* Rating Section - merged into main card */}
            <View style={styles.ratingDivider} />
            <Text style={[styles.ratingTitle, { color: theme.text }]}>
              {t.community.rateRoute} ({feedbacks.length})
            </Text>

            {/* Existing user feedback */}
            {!showFeedbackForm && userFeedback && (
              <ExistingFeedbackCard
                starRating={userFeedback.starRating}
                suggestedGrade={userFeedback.suggestedGrade}
                comment={userFeedback.comment}
                onEdit={() => setShowFeedbackForm(true)}
                ratingLabel={t.community.yourRating}
                gradeLabel={t.community.yourGrade}
                editLabel={t.community.editFeedback}
              />
            )}

            {/* Feedback form */}
            {!showFeedbackForm && !userFeedback && (
              <TouchableOpacity
                style={[styles.addFeedbackButton, { backgroundColor: theme.buttonPrimary }]}
                onPress={() => setShowFeedbackForm(true)}
                disabled={!user}
              >
                <Ionicons name="star-outline" size={20} color="#fff" />
                <Text style={styles.addFeedbackText}>
                  {t.community.addRating}
                </Text>
              </TouchableOpacity>
            )}

            {showFeedbackForm && (
              <RouteFeedbackForm
                starRating={starRating}
                onStarRatingChange={setStarRating}
                suggestedGrade={suggestedGrade}
                onGradeChange={setSuggestedGrade}
                grades={allowedGrades}
                gradeRangeHint={`(${t.community.allowedRange}: ${allowedGrades[0]} - ${allowedGrades[allowedGrades.length - 1]})`}
                comment={feedbackComment}
                onCommentChange={setFeedbackComment}
                commentPlaceholder={t.community.feedbackPlaceholder}
                onSubmit={handleSubmitFeedback}
                onCancel={() => {
                  setShowFeedbackForm(false);
                  if (userFeedback) {
                    setStarRating(userFeedback.starRating || 0);
                    setSuggestedGrade(userFeedback.suggestedGrade || '');
                    setFeedbackComment(userFeedback.comment || '');
                  } else {
                    setStarRating(0);
                    setSuggestedGrade('');
                    setFeedbackComment('');
                  }
                }}
                isSubmitting={feedbackSubmitting}
                isUpdate={!!userFeedback}
                submitLabel={userFeedback ? t.community.updateFeedback : t.community.submitFeedback}
                starLabel={t.community.starRating}
                gradeLabel={t.community.suggestedGrade}
                commentLabel={t.community.feedbackComment}
              />
            )}

            {/* Other users' feedbacks */}
            {feedbacks.length > 0 && (
              <View style={styles.otherFeedbacksSection}>
                <FeedbacksList
                  feedbacks={feedbacks}
                  title={`${t.routes.communityFeedbacks}`}
                  excludeUserId={user?.uid}
                  showAvatar={false}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </SwipeableRouteContainer>
  );
};

const createStyles = (theme: Theme, layout: ReturnType<typeof useResponsiveLayout>, insets: { left: number; right: number; top: number; bottom: number }) => {
  const { isLandscape, isTablet, width } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets.left, insets.right, 16) : 12;
  const contentMaxWidth = isLandscape ? Math.min(width * 0.7, 600) : '100%';
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    color: theme.textSecondary,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: theme.buttonPrimary,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(horizontalPadding, 16),
    paddingVertical: isPhoneLandscape ? 8 : 14,
    backgroundColor: theme.headerGradient,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: isPhoneLandscape ? 18 : 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 100,
    alignItems: isLandscape ? 'center' : undefined,
  },
  imageContainer: {
    width: isLandscape ? contentMaxWidth : '100%',
    aspectRatio: isLandscape ? 1.5 : 1,
    position: 'relative',
    alignSelf: isLandscape ? 'center' : undefined,
  },
  toggleHoldsButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    backgroundColor: theme.surface,
  },
  expirationBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  expirationBadgeWarning: {
    backgroundColor: theme.error,
  },
  expirationText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  infoCard: {
    padding: isPhoneLandscape ? 12 : 16,
    marginHorizontal: horizontalPadding,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: theme.surface,
    maxWidth: isLandscape ? 600 : undefined,
    width: isLandscape ? contentMaxWidth : undefined,
    alignSelf: isLandscape ? 'center' : undefined,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  gradeContainer: {
    alignItems: 'center',
    backgroundColor: theme.isDark ? 'rgba(142, 78, 198, 0.2)' : 'rgba(142, 78, 198, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  gradeLabel: {
    fontSize: 11,
    color: theme.secondary,
    fontWeight: '500',
  },
  gradeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  creatorInfo: {
    flex: 1,
    marginStart: 16,
    alignItems: 'flex-end',
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  createdAt: {
    fontSize: 12,
    marginTop: 2,
    color: theme.textSecondary,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  gymName: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    color: theme.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  commentsSection: {
    margin: horizontalPadding,
    padding: isPhoneLandscape ? 12 : 16,
    borderRadius: 16,
    backgroundColor: theme.surface,
    maxWidth: isLandscape ? 600 : undefined,
    width: isLandscape ? contentMaxWidth : undefined,
    alignSelf: isLandscape ? 'center' : undefined,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: theme.text,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  commentDate: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.text,
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
    color: theme.textSecondary,
  },
  commentInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 24,
    gap: 10,
    backgroundColor: theme.surface,
  },
  commentInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: theme.inputBackground,
    color: theme.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.buttonPrimary,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Feedback styles
  communityStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 12,
    marginStart: 4,
    color: theme.text,
  },
  starsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starDisplayText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  starFilled: {
    color: theme.starColor,
  },
  calculatedGrade: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  ratingDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginTop: 16,
    marginBottom: 12,
  },
  ratingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.text,
  },
  feedbackSection: {
    margin: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.surface,
  },
  addFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    backgroundColor: theme.buttonPrimary,
  },
  addFeedbackText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  otherFeedbacksSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },

});
};

export default CommunityRouteDetailScreen;

