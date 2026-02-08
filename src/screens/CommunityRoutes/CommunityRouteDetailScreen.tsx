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
  TextInput,
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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
    });
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
              <View style={styles.existingFeedbackCard}>
                <View style={styles.feedbackRow}>
                  <Text style={[styles.feedbackLabel, { color: theme.textSecondary }]}>
                    {t.community.yourRating}
                  </Text>
                  <View style={styles.starsDisplay}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Text
                        key={star}
                        style={[
                          styles.starDisplayText,
                          star <= userFeedback.starRating && styles.starFilled,
                        ]}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                </View>
                <View style={styles.feedbackRow}>
                  <Text style={[styles.feedbackLabel, { color: theme.textSecondary }]}>
                    {t.community.yourGrade}
                  </Text>
                  <Text style={[styles.feedbackGrade, { color: theme.primary }]}>
                    {userFeedback.suggestedGrade}
                  </Text>
                </View>
                {userFeedback.comment && (
                  <Text style={[styles.feedbackCommentText, { color: theme.text }]}>
                    {userFeedback.comment}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.editFeedbackButton}
                  onPress={() => setShowFeedbackForm(true)}
                >
                  <Text style={[styles.editFeedbackText, { color: theme.primary }]}>
                    {t.community.editFeedback}
                  </Text>
                </TouchableOpacity>
              </View>
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
              <View style={styles.feedbackForm}>
                {/* Star Rating */}
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>
                    {t.community.starRating}
                  </Text>
                  <View style={styles.starsInput}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setStarRating(star)}
                        style={styles.starButton}
                      >
                        <Text
                          style={[
                            styles.starInputText,
                            star <= starRating && styles.starFilled,
                          ]}
                        >
                          ★
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Grade Selector */}
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>
                    {t.community.suggestedGrade}
                  </Text>
                  <Text style={[styles.gradeHint, { color: theme.textSecondary }]}>
                    ({t.community.allowedRange}: {allowedGrades[0]} - {allowedGrades[allowedGrades.length - 1]})
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.gradesScroll}
                    contentContainerStyle={styles.gradesContent}
                  >
                    {allowedGrades.map((grade) => (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          styles.gradeButton,
                          suggestedGrade === grade && styles.gradeButtonSelected,
                        ]}
                        onPress={() => setSuggestedGrade(grade)}
                      >
                        <Text
                          style={[
                            styles.gradeButtonText,
                            suggestedGrade === grade && styles.gradeButtonTextSelected,
                          ]}
                        >
                          {grade}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Comment */}
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>
                    {t.community.feedbackComment}
                  </Text>
                  <TextInput
                    style={[
                      styles.feedbackInput,
                      { backgroundColor: theme.background, color: theme.text },
                    ]}
                    value={feedbackComment}
                    onChangeText={setFeedbackComment}
                    placeholder={t.community.feedbackPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    textAlign="right"
                  />
                </View>

                {/* Buttons */}
                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
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
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                      {t.common.cancel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { backgroundColor: theme.primary },
                      feedbackSubmitting && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmitFeedback}
                    disabled={feedbackSubmitting}
                  >
                    {feedbackSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {userFeedback ? (t.community.updateFeedback) : (t.community.submitFeedback)}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Other users' feedbacks */}
            {feedbacks.filter(f => f.userId !== user?.uid).length > 0 && (
              <View style={styles.otherFeedbacksSection}>
                <Text style={[styles.otherFeedbacksTitle, { color: theme.textSecondary }]}>
                  {t.routes.communityFeedbacks} ({feedbacks.filter(f => f.userId !== user?.uid).length})
                </Text>
                {feedbacks
                  .filter(f => f.userId !== user?.uid)
                  .map((feedback) => (
                    <View key={feedback.id} style={styles.feedbackCard}>
                      <View style={styles.feedbackCardHeader}>
                        <Text style={[styles.feedbackUserName, { color: theme.text }]}>
                          {feedback.userName}
                        </Text>
                        <View style={styles.feedbackStarsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Text
                              key={star}
                              style={[
                                styles.feedbackStarSmall,
                                star <= feedback.starRating && styles.starFilled,
                              ]}
                            >
                              ★
                            </Text>
                          ))}
                        </View>
                      </View>
                      <View style={styles.feedbackCardContent}>
                        <Text style={[styles.feedbackGradeSmall, { color: theme.primary }]}>
                          {feedback.suggestedGrade}
                        </Text>
                        {feedback.comment && (
                          <Text style={[styles.feedbackCommentSmall, { color: theme.text }]}>
                            {feedback.comment}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
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
    marginLeft: 16,
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
    textAlign: 'right',
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
    textAlign: 'right',
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
    textAlign: 'right',
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
    marginLeft: 4,
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
    textAlign: 'right',
    marginBottom: 12,
    color: theme.text,
  },
  feedbackSection: {
    margin: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.surface,
  },
  existingFeedbackCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  feedbackGrade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  feedbackCommentText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
    lineHeight: 18,
    color: theme.text,
  },
  editFeedbackButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  editFeedbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
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
  feedbackForm: {
    marginTop: 8,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
    color: theme.text,
  },
  gradeHint: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
    color: theme.textSecondary,
  },
  starsInput: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  starInputText: {
    fontSize: 32,
    color: theme.textSecondary,
  },
  gradesScroll: {
    marginTop: 4,
  },
  gradesContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  gradeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 50,
    alignItems: 'center',
  },
  gradeButtonSelected: {
    backgroundColor: theme.secondary,
    borderColor: theme.secondary,
  },
  gradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  gradeButtonTextSelected: {
    color: '#fff',
  },
  feedbackInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlign: 'right',
    backgroundColor: theme.inputBackground,
    color: theme.text,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  submitButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    backgroundColor: theme.buttonPrimary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  otherFeedbacksSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  otherFeedbacksTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'right',
    color: theme.text,
  },
  feedbackCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedbackUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  feedbackStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  feedbackStarSmall: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  feedbackCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  feedbackGradeSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  feedbackCommentSmall: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    color: theme.textSecondary,
  },
});
};

export default CommunityRouteDetailScreen;

