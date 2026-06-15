// src/screens/SprayWall/SprayRouteDetailScreen.tsx
// Screen showing spray route details with rating and feedback

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/features/language";
import { useTheme } from "@/features/theme/ThemeContext";
import { SprayRoute, SprayRouteFeedback } from "@/features/spraywall/types";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import { RouteStatsSection } from '@/components/feedback/RouteStatsSection';
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { RouteFeedbackForm } from "@/components/routes/RouteFeedbackForm";
import { ExistingFeedbackCard } from "@/components/routes/ExistingFeedbackCard";
import { FeedbacksList } from "@/components/routes/FeedbacksList";
import { V_GRADES, V_GRADES_WITH_UNKNOWN, formatDate } from "@/components/routes/routeDetailUtils";
import {
  addFeedbackToRoute,
  listenToFeedbacksForRoute,
  updateRoute,
  deleteRoute,
} from "@/features/spraywall/routesService";
import { useWalls } from "@/features/walls/hooks";
import { useRoutesForWall } from "@/features/spraywall/hooks";
import { SwipeableRouteContainer } from '@/components/routes/SwipeableRouteContainer';

export const SprayRouteDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { routeId: initialRouteId, wallId } = route.params as { routeId: string; wallId: string };
  
  // Active route ID — starts from nav params, updates on swipe (no remount)
  const [activeRouteId, setActiveRouteId] = useState(initialRouteId);
  const routeId = activeRouteId;
  const { user } = useAuth();
  const { walls } = useWalls();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, width } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  
  // Dynamic styles based on theme
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);

  // Find wall for the image
  const wall = walls.find((w) => w.id === wallId);

  // Fetch routes for this wall via hook (real-time, shared cache)
  const { routes: allRoutes, loading: routesLoading } = useRoutesForWall(wallId);

  // Find the specific route by ID from the real-time routes list
  const currentRoute = useMemo(() => {
    return allRoutes.find((r) => r.id === routeId) || null;
  }, [allRoutes, routeId]);

  // Update header title when route is loaded
  useEffect(() => {
    if (currentRoute?.name) {
      navigation.setOptions({ title: currentRoute.name });
    }
  }, [currentRoute?.name, navigation]);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<SprayRouteFeedback[]>([]);
  const [userFeedback, setUserFeedback] = useState<SprayRouteFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [suggestedGrade, setSuggestedGrade] = useState("");
  const [comment, setComment] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isVideoLinkValid, setIsVideoLinkValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit route state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize edit fields when route loads or when route data changes
  useEffect(() => {
    if (currentRoute) {
      setEditName(currentRoute.name);
      setEditGrade(currentRoute.grade);
    }
  }, [currentRoute?.id, currentRoute?.grade, currentRoute?.name]);

  // Check if current user is the route creator
  const isRouteCreator = user?.uid && currentRoute?.createdBy === user.uid;

  // Swipe navigation between routes — update local state instead of navigation.replace
  const handleSwipeNavigate = useCallback((nextRouteId: string) => {
    setActiveRouteId(nextRouteId);
    // Reset feedback/form state
    setFeedbacks([]);
    setUserFeedback(null);
    setLoading(true);
    setShowFeedbackForm(false);
    setStarRating(0);
    setSuggestedGrade('');
    setComment('');
    setVideoUrl('');
    setShowEditModal(false);
  }, []);

  // Load feedbacks for current route
  useEffect(() => {
    if (!routeId) return;

    setLoading(true);
    const unsubscribe = listenToFeedbacksForRoute(routeId, (fetchedFeedbacks) => {
      setFeedbacks(fetchedFeedbacks);
      setLoading(false);
      
      // Find user's feedback
      if (user) {
        const myFeedback = fetchedFeedbacks.find((f) => f.userId === user.uid);
        if (myFeedback) {
          setUserFeedback(myFeedback);
          setStarRating(myFeedback.starRating);
          setSuggestedGrade(myFeedback.suggestedGrade);
          setComment(myFeedback.comment || "");
          setVideoUrl(myFeedback.videoUrl || "");
        } else {
          setUserFeedback(null);
        }
      }
    });

    return () => unsubscribe();
  }, [routeId, user?.uid]);

  const handleSubmitFeedback = async () => {
    if (!user) {
      Alert.alert(t.common.error, t.spray.loginToRate);
      return;
    }

    if (starRating === 0) {
      Alert.alert(t.common.error, t.spray.mustSelectRating);
      return;
    }

    if (!suggestedGrade) {
      Alert.alert(t.common.error, t.spray.mustSelectDifficulty);
      return;
    }

    if (!isVideoLinkValid) {
      Alert.alert(t.common.error, t.videoLink.errors.notAllowed);
      return;
    }

    setIsSubmitting(true);

    try {
      await addFeedbackToRoute(routeId, {
        userId: user.uid,
        userDisplayName: user.displayName || user.email || "Anonymous",
        userPhotoURL: user.photoURL || null,
        starRating,
        suggestedGrade,
        comment: comment.trim(),
        videoUrl: videoUrl.trim() || null,
      });

      Alert.alert(t.spray.congratulations, t.spray.ratingSubmitted);
      setShowFeedbackForm(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Alert.alert(t.common.error, t.spray.failedToSaveRating);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle route update (name and grade only - doesn't affect statistics)
  const handleUpdateRoute = async () => {
    if (!editName.trim()) {
      Alert.alert(t.common.error, t.spray.mustEnterName);
      return;
    }

    setIsUpdating(true);
    try {
      const updates: Record<string, any> = {
        name: editName.trim(),
        grade: editGrade,
      };

      // Also update calculatedGrade when there are no community feedbacks yet,
      // since calculatedGrade was initialized to the original grade at creation.
      if (!currentRoute?.feedbackCount || currentRoute.feedbackCount === 0) {
        updates.calculatedGrade = editGrade;
      }

      await updateRoute(routeId, updates);
      
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating route:", error);
      Alert.alert(t.common.error, t.spray.failedToUpdateRoute);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle route deletion
  const handleDeleteRoute = () => {
    Alert.alert(
      t.spray.deleteRoute,
      t.spray.deleteRouteConfirm,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.delete,
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteRoute(routeId);
              // Reset navigation stack to SprayHome after deletion
              navigation.reset({
                index: 0,
                routes: [{ name: "SprayHome" }],
              });
            } catch (error) {
              console.error("Error deleting route:", error);
              Alert.alert(t.common.error, t.spray.failedToDeleteRoute);
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Navigate to edit holds screen
  const handleEditHolds = () => {
    if (!currentRoute) return;
    setShowEditModal(false);
    navigation.navigate("AddRoute", {
      wallId,
      editMode: true,
      routeId: routeId,
      existingHolds: currentRoute.holds,
      existingHoldNumbering: currentRoute.holdNumbering,
      existingMaskPaths: currentRoute.maskPaths,
      routeName: currentRoute.name,
      routeGrade: currentRoute.grade,
    });
  };

  const displayGrade = currentRoute?.calculatedGrade || currentRoute?.grade || "";
  const averageRating = currentRoute?.averageStarRating || 0;
  const feedbackCount = currentRoute?.feedbackCount || 0;

  // Loading state
  if (routesLoading || !currentRoute) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>
            {t.spray.loading}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SwipeableRouteContainer
      currentRouteId={routeId}
      onNavigateToRoute={handleSwipeNavigate}
    >
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Wall Image - outside ScrollView in landscape for side-by-side layout */}
      {isLandscape && wall && (
        <View style={styles.imageContainer}>
          <WallImageWithHolds
            imageUrl={wall.imageUrl}
            holds={currentRoute.holds || []}
            routeColor={currentRoute.color || "#FF4444"}
            editable={false}
            holdNumbering={currentRoute.holdNumbering}
            maskPaths={currentRoute.maskPaths}
          />
        </View>
      )}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Wall Image with Holds - inside ScrollView in portrait */}
        {!isLandscape && wall && (
          <View style={styles.imageContainer}>
            <WallImageWithHolds
              imageUrl={wall.imageUrl}
              holds={currentRoute.holds || []}
              routeColor={currentRoute.color || "#FF4444"}
              editable={false}
              holdNumbering={currentRoute.holdNumbering}
              maskPaths={currentRoute.maskPaths}
            />
          </View>
        )}

        {/* Route Header - Name and Grade */}
        <View style={styles.routeHeaderSection}>
          <Text style={styles.routeName}>{currentRoute.name}</Text>
          <View style={styles.gradeContainer}>
            <Text style={styles.routeGrade}>{displayGrade}</Text>
            {currentRoute.calculatedGrade && (
              <Text style={styles.communityBadge}>👥 קהילה</Text>
            )}
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{t.spray.rating}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🏆</Text>
            <Text style={styles.statValue}>{feedbackCount}</Text>
            <Text style={styles.statLabel}>{t.spray.forms}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>💬</Text>
            <Text style={styles.statValue}>{feedbacks.length}</Text>
            <Text style={styles.statLabel}>{t.spray.comments}</Text>
          </View>
        </View>

        {/* Route Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>{t.spray.details}</Text>
          <View style={styles.detailsCard}>
            {currentRoute.creatorName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>👤</Text>
                <Text style={styles.detailLabel}>{t.spray.creator}</Text>
                <Text style={styles.detailValue}>{currentRoute.creatorName}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📊</Text>
              <Text style={styles.detailLabel}>{t.spray.originalGrade}</Text>
              <Text style={styles.detailValue}>{currentRoute.grade}</Text>
            </View>
            {currentRoute.createdAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailLabel}>{t.spray.created}</Text>
                <Text style={styles.detailValue}>{formatDate(currentRoute.createdAt)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 📊 Route Statistics Section */}
        <View style={styles.detailsSection}>
          <RouteStatsSection
            climbedCount={currentRoute.topsCount || feedbackCount}
            feedbacks={feedbacks.map(fb => ({ starRating: fb.starRating, suggestedGrade: fb.suggestedGrade }))}
            averageStarRating={averageRating}
            originalGrade={currentRoute.grade}
            calculatedGrade={currentRoute.calculatedGrade}
          />
        </View>

        {/* Owner Actions - Edit/Delete (only for route creator) */}
        {isRouteCreator && (
          <View style={styles.ownerActionsSection}>
            <Text style={styles.sectionTitle}>{t.spray.manageRoute}</Text>
            <View style={styles.ownerActionsRow}>
              <TouchableOpacity
                style={styles.editRouteButton}
                onPress={() => setShowEditModal(true)}
              >
                <Text style={styles.editRouteIcon}>✏️</Text>
                <Text style={styles.editRouteText}>{t.spray.editRoute}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteRouteButton}
                onPress={handleDeleteRoute}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color={theme.error} size="small" />
                ) : (
                  <>
                    <Text style={styles.deleteRouteIcon}>🗑️</Text>
                    <Text style={styles.deleteRouteText}>{t.common.delete}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Feedback Section */}
        <View style={styles.feedbackSection}>
          <Text style={styles.sectionTitle}>
            {userFeedback ? t.spray.yourRating : t.spray.completedRoute}
          </Text>

          {!showFeedbackForm && !userFeedback && (
            <TouchableOpacity
              style={styles.sentButton}
              onPress={() => setShowFeedbackForm(true)}
              activeOpacity={0.8}
              disabled={!user}
            >
              <Text style={styles.sentButtonEmoji}>🎯</Text>
              <Text style={styles.sentButtonText}>Sent!</Text>
            </TouchableOpacity>
          )}

          {!showFeedbackForm && userFeedback && (
            <ExistingFeedbackCard
              starRating={userFeedback.starRating}
              suggestedGrade={userFeedback.suggestedGrade}
              comment={userFeedback.comment}
              videoUrl={userFeedback.videoUrl}
              onEdit={() => setShowFeedbackForm(true)}
              ratingLabel={t.spray.ratingLabel}
              gradeLabel={t.spray.difficultyGradeLabel}
              commentLabel={t.spray.commentLabel}
              editLabel={t.spray.editRating}
            />
          )}

          {/* Feedback form rendered as a Modal popup */}
          <Modal
            visible={showFeedbackForm}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {
              setShowFeedbackForm(false);
              if (userFeedback) {
                setStarRating(userFeedback.starRating || 0);
                setSuggestedGrade(userFeedback.suggestedGrade || "");
                setComment(userFeedback.comment || "");
                setVideoUrl(userFeedback.videoUrl || "");
              } else {
                setStarRating(0);
                setSuggestedGrade("");
                setComment("");
                setVideoUrl("");
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
                  setShowFeedbackForm(false);
                  if (userFeedback) {
                    setStarRating(userFeedback.starRating || 0);
                    setSuggestedGrade(userFeedback.suggestedGrade || "");
                    setComment(userFeedback.comment || "");
                    setVideoUrl(userFeedback.videoUrl || "");
                  } else {
                    setStarRating(0);
                    setSuggestedGrade("");
                    setComment("");
                    setVideoUrl("");
                  }
                }}
              />
              <View style={styles.feedbackModalContent}>
                <View style={styles.feedbackModalHeader}>
                  <Text style={styles.feedbackModalTitle}>
                    {userFeedback ? t.spray.editRating : t.spray.completedRoute}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFeedbackForm(false);
                      if (userFeedback) {
                        setStarRating(userFeedback.starRating || 0);
                        setSuggestedGrade(userFeedback.suggestedGrade || "");
                        setComment(userFeedback.comment || "");
                        setVideoUrl(userFeedback.videoUrl || "");
                      } else {
                        setStarRating(0);
                        setSuggestedGrade("");
                        setComment("");
                        setVideoUrl("");
                      }
                    }}
                    style={styles.feedbackModalClose}
                  >
                    <Text style={styles.feedbackModalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  <RouteFeedbackForm
                  starRating={starRating}
                  onStarRatingChange={setStarRating}
                  suggestedGrade={suggestedGrade}
                  onGradeChange={setSuggestedGrade}
                  grades={V_GRADES}
                  comment={comment}
                  onCommentChange={setComment}
                  commentPlaceholder={t.spray.betaTipsExperience}
                  videoUrl={videoUrl}
                  onVideoUrlChange={setVideoUrl}
                  isVideoLinkValid={isVideoLinkValid}
                  onVideoLinkValidChange={setIsVideoLinkValid}
                  onSubmit={handleSubmitFeedback}
                  onCancel={() => {
                    setShowFeedbackForm(false);
                    if (userFeedback) {
                      setStarRating(userFeedback.starRating || 0);
                      setSuggestedGrade(userFeedback.suggestedGrade || "");
                      setComment(userFeedback.comment || "");
                      setVideoUrl(userFeedback.videoUrl || "");
                    } else {
                      setStarRating(0);
                      setSuggestedGrade("");
                      setComment("");
                      setVideoUrl("");
                    }
                  }}
                  isSubmitting={isSubmitting}
                  isUpdate={!!userFeedback}
                  submitLabel={t.spray.saveRating}
                  starLabel={t.spray.howMuchEnjoy}
                  gradeLabel={t.spray.whatGrade}
                  commentLabel={t.spray.wantToAddComment}
                />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>

        {/* Community Feedbacks */}
        {feedbacks.length > 0 && (
          <FeedbacksList
            feedbacks={feedbacks as any}
            title={`${t.spray.communityFeedbacks} (${feedbacks.length})`}
            showAvatar={false}
            showDate={true}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Route Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.spray.editModal}</Text>
            
            {/* Route Name */}
            <View style={styles.modalFormSection}>
              <Text style={styles.modalLabel}>{t.spray.routeNameLabel}</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t.spray.routeNamePlaceholder}
                placeholderTextColor="#888"
              />
            </View>

            {/* Route Grade */}
            <View style={styles.modalFormSection}>
              <Text style={styles.modalLabel}>{t.spray.difficultyGradeTitle}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.gradeScroller}
              >
                {V_GRADES_WITH_UNKNOWN.map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    onPress={() => setEditGrade(grade)}
                    style={[
                      styles.gradeOption,
                      editGrade === grade && styles.gradeOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradeOptionText,
                        editGrade === grade && styles.gradeOptionTextSelected,
                      ]}
                    >
                      {grade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Edit Holds Button */}
            <TouchableOpacity
              style={styles.editHoldsButton}
              onPress={handleEditHolds}
            >
              <Text style={styles.editHoldsIcon}>🎯</Text>
              <Text style={styles.editHoldsText}>{t.spray.editHoldsOnWall}</Text>
            </TouchableOpacity>

            {/* Note about statistics */}
            <Text style={styles.modalNote}>
              {t.spray.editNote}
            </Text>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  if (currentRoute) {
                    setEditName(currentRoute.name);
                    setEditGrade(currentRoute.grade);
                  }
                }}
              >
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isUpdating && styles.buttonDisabled]}
                onPress={handleUpdateRoute}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>{t.spray.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </SwipeableRouteContainer>
  );
};

const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = layout?.isLandscape ?? screenWidth > screenHeight;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 16;
  const contentMaxWidth = isLandscape ? Math.min((layout?.width ?? screenWidth) * 0.6, 600) : undefined;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    flexDirection: isLandscape ? 'row' : 'column',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    height: isLandscape ? undefined : 350,
    width: isLandscape ? '45%' : '100%',
    flex: isLandscape ? 1 : undefined,
    position: "relative",
  },
  routeHeaderSection: {
    backgroundColor: theme.surface,
    paddingHorizontal: horizontalPadding,
    paddingTop: isLandscape ? 12 : 16,
    paddingBottom: isLandscape ? 8 : 12,
  },
  routeName: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "bold",
  },
  gradeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  routeGrade: {
    color: theme.primary,
    fontSize: 20,
    fontWeight: "600",
  },
  communityBadge: {
    color: theme.textSecondary,
    fontSize: 12,
    marginStart: 8,
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: theme.surface,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  detailsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  detailIcon: {
    fontSize: 18,
    marginEnd: 12,
    width: 24,
  },
  detailLabel: {
    color: theme.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "500",
  },
  feedbackSection: {
    padding: 16,
  },
  sentButton: {
    backgroundColor: theme.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  sentButtonEmoji: {
    fontSize: 24,
    marginEnd: 8,
  },
  sentButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  gradeScroller: {
    marginTop: 4,
  },
  gradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.surface,
    marginEnd: 8,
  },
  gradeOptionSelected: {
    backgroundColor: theme.buttonPrimary,
  },
  gradeOptionText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  gradeOptionTextSelected: {
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 20,
  },
  // Owner Actions Styles
  ownerActionsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  ownerActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  editRouteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  editRouteIcon: {
    fontSize: 18,
  },
  editRouteText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  deleteRouteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.isDark ? "rgba(255, 107, 107, 0.15)" : "rgba(231, 76, 60, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  deleteRouteIcon: {
    fontSize: 18,
  },
  deleteRouteText: {
    color: theme.error,
    fontSize: 14,
    fontWeight: "600",
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
    backgroundColor: theme.modalBackground || theme.surface,
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
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackModalCloseText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  // Edit Route Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.modalBackground,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalFormSection: {
    marginBottom: 16,
  },
  modalLabel: {
    color: theme.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
    padding: 12,
    color: theme.text,
    fontSize: 16,
  },
  modalNote: {
    color: theme.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: theme.surface,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Edit Holds Button
  editHoldsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    paddingVertical: isLandscape ? 10 : 14,
    borderRadius: 10,
    marginBottom: isLandscape ? 12 : 16,
    gap: 8,
  },
  editHoldsIcon: {
    fontSize: 18,
  },
  editHoldsText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
});
};

export default SprayRouteDetailScreen;
