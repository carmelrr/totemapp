import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import { auth } from "@/features/data/firebase";
import { RoutesService } from "@/features/routes-map/services/RoutesService";
import { FeedbackService } from "@/features/routes-map/services/FeedbackService";
import { useUser } from "@/features/auth/UserContext";
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { getColorTranslationKey } from '@/features/routes-map/utils/colors';

const { width: screenWidth } = Dimensions.get("window");

const StarRating = ({ rating, onRatingChange, disabled = false }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.starContainer}>
      {stars.map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && onRatingChange(star)}
          disabled={disabled}
        >
          <Text
            style={[
              styles.star,
              { color: star <= rating ? theme.starColor : theme.border },
            ]}
          >
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const GradeSelector = ({ selectedGrade, onGradeChange, disabled = false }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const grades = ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.gradeScroll}
    >
      {grades.map((grade) => (
        <TouchableOpacity
          key={grade}
          onPress={() => !disabled && onGradeChange(grade)}
          style={[
            styles.gradeButton,
            selectedGrade === grade && styles.gradeButtonSelected,
          ]}
          disabled={disabled}
        >
          <Text
            style={[
              styles.gradeButtonText,
              selectedGrade === grade && styles.gradeButtonTextSelected,
            ]}
          >
            {grade}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

export default function RouteDialog({ visible, route, onClose }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [userFeedback, setUserFeedback] = useState(null);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);

  // Form state
  const [starRating, setStarRating] = useState(0);
  const [suggestedGrade, setSuggestedGrade] = useState("");
  const [comment, setComment] = useState("");
  const [closedRoute, setClosedRoute] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isAdmin } = useUser();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const styles = createStyles(theme);
  const user = auth.currentUser;

  useEffect(() => {
    if (!visible || !route) return;

    // Subscribe to feedbacks
    const unsubscribe = FeedbackService.subscribeFeedbacksForRoute(
      route.id,
      (feedbacksData) => {
        setFeedbacks(feedbacksData);
      },
    );

    // Get user's existing feedback
    if (user) {
      FeedbackService.getUserFeedbackForRoute(user.uid, route.id)
        .then((feedback) => {
          setUserFeedback(feedback);
          if (feedback) {
            setStarRating(feedback.starRating || 0);
            setSuggestedGrade(feedback.suggestedGrade || "");
            setComment(feedback.comment || "");
            setClosedRoute(feedback.closedRoute || false);
          }
        })
        .catch((error) => {
          // Error loading user feedback
        });
    }

    return () => unsubscribe && unsubscribe();
  }, [visible, route, user]);

  const resetForm = () => {
    setStarRating(0);
    setSuggestedGrade("");
    setComment("");
    setClosedRoute(false);
    setIsEditingFeedback(false);
  };

  const handleSubmitFeedback = async () => {
    if (!user) {
      Alert.alert(t.common.error, t.alerts.loginToFeedback);
      return;
    }

    if (starRating === 0) {
      Alert.alert(t.common.error, t.alerts.selectStarRating);
      return;
    }

    if (!suggestedGrade) {
      Alert.alert(t.common.error, t.alerts.selectSuggestedGrade);
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        userId: user.uid,
        userDisplayName: user.displayName || user.email,
        starRating,
        suggestedGrade,
        comment,
        isCompleted: closedRoute,
      };

      if (userFeedback) {
        // Update existing feedback
        await FeedbackService.updateFeedback(userFeedback.id, feedbackData);
      } else {
        // Add new feedback
        await FeedbackService.addFeedbackToRoute(route.id, feedbackData);
      }

      resetForm();
    } catch (error) {
      Alert.alert(t.common.error, t.alerts.feedbackSubmitFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    Alert.alert(t.alerts.deleteFeedbackTitle, t.alerts.deleteFeedbackConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await FeedbackService.deleteFeedback(feedbackId);
          } catch (error) {
            Alert.alert(t.common.error, t.alerts.feedbackDeleteFailed);
          }
        },
      },
    ]);
  };

  const getCompletionCount = () => {
    return feedbacks.filter((f) => f.closedRoute).length;
  };

  const getAverageStarRating = () => {
    if (feedbacks.length === 0) return 0;
    const total = feedbacks.reduce((sum, f) => sum + (f.starRating || 0), 0);
    return (total / feedbacks.length).toFixed(1);
  };

  const getSmartAverageGrade = () => {
    return FeedbackService.calculateSmartAverageGrade(route, feedbacks);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(language === "he" ? "he-IL" : "en-US");
  };

  if (!visible || !route) return null;

  // Get translated color name
  const colorKey = getColorTranslationKey(route.color);
  const colorName = t.colors[colorKey as keyof typeof t.colors] || route.color;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.routeDialog.routeGrade(route.grade)}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Route Info */}
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>{t.routeDialog.routeInfo}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.routeDialog.rating}</Text>
              <Text style={styles.infoValue}>{route.grade}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.routeDialog.color}</Text>
              <View
                style={[styles.colorDot, { backgroundColor: route.color }]}
              />
              <Text style={styles.infoValue}>{colorName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.routeDialog.completionCount}</Text>
              <Text style={styles.infoValue}>{getCompletionCount()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.routeDialog.avgStarRating}</Text>
              <Text style={styles.infoValue}>⭐ {getAverageStarRating()}</Text>
            </View>
            {getSmartAverageGrade() && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.routeDialog.suggestedGradeUsers}</Text>
                <Text style={styles.infoValue}>{getSmartAverageGrade()}</Text>
              </View>
            )}
          </View>

          {/* Feedback Form */}
          {user && (
            <View style={styles.feedbackForm}>
              <Text style={styles.formTitle}>
                {userFeedback ? t.routeDialog.updateFeedback : t.routeDialog.addFeedback}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t.routeDialog.starRating}</Text>
                <StarRating
                  rating={starRating}
                  onRatingChange={setStarRating}
                  disabled={isSubmitting}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t.routeDialog.suggestedGrade}</Text>
                <GradeSelector
                  selectedGrade={suggestedGrade}
                  onGradeChange={setSuggestedGrade}
                  disabled={isSubmitting}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t.routeDialog.comment}</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  numberOfLines={3}
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t.routes.routeFeedbackPlaceholder}
                placeholderTextColor={theme.textSecondary}
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={[
                    styles.checkboxContainer,
                    closedRoute && styles.checkboxSelected,
                  ]}
                  onPress={() => setClosedRoute(!closedRoute)}
                  disabled={isSubmitting}
                >
                  <View
                    style={[
                      styles.checkbox,
                      closedRoute && styles.checkboxChecked,
                    ]}
                  >
                    {closedRoute && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>{t.routeDialog.completedRoute}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitFeedback}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting
                    ? t.routeDialog.submitting
                    : userFeedback
                      ? t.routeDialog.updateFeedbackBtn
                      : t.routeDialog.submitFeedback}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Feedbacks List */}
          <View style={styles.feedbacksList}>
            <Text style={styles.feedbacksTitle}>
              {t.routeDialog.feedbacksCount(feedbacks.length)}
            </Text>
            {feedbacks.length === 0 ? (
              <Text style={styles.noFeedbacks}>
                {t.routeDialog.noFeedbacksYet}
              </Text>
            ) : (
              feedbacks.map((feedback) => {
                const displayName =
                  feedback.userDisplayName || feedback.userEmail || "Anonymous";
                return (
                  <View key={feedback.id} style={styles.feedbackItem}>
                    <View style={styles.feedbackHeader}>
                      <Text style={styles.feedbackUser}>{displayName}</Text>
                      <Text style={styles.feedbackDate}>
                        {formatDate(feedback.submittedAt)}
                      </Text>
                      {isAdmin && (
                        <TouchableOpacity
                          onPress={() => handleDeleteFeedback(feedback.id)}
                          style={styles.deleteFeedbackButton}
                        >
                          <Text style={styles.deleteFeedbackText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.feedbackContent}>
                      <View style={styles.feedbackRatings}>
                        <StarRating
                          rating={feedback.starRating || 0}
                          disabled={true}
                        />
                        <Text style={styles.feedbackGrade}>
                          {t.routeDialog.suggestedGradeValue(feedback.suggestedGrade)}
                        </Text>
                        {feedback.closedRoute && (
                          <Text style={styles.closedBadge}>{t.routeDialog.completed}</Text>
                        )}
                      </View>

                      {feedback.comment && (
                        <Text style={styles.feedbackComment}>
                          {feedback.comment}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: theme.secondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.secondary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  routeInfo: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: theme.text,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "500",
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginEnd: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  feedbackForm: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: theme.text,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 8,
    fontWeight: "500",
  },
  starContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  star: {
    fontSize: 24,
    marginEnd: 4,
  },
  gradeScroll: {
    maxHeight: 50,
  },
  gradeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.inputBackground,
    marginEnd: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  gradeButtonSelected: {
    backgroundColor: theme.secondary,
    borderColor: theme.secondary,
  },
  gradeButtonText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "500",
  },
  gradeButtonTextSelected: {
    color: "#FFFFFF",
  },
  commentInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    color: theme.text,
    backgroundColor: theme.inputBackground,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.border,
    borderRadius: 4,
    marginEnd: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.text,
  },
  submitButton: {
    backgroundColor: theme.success,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: theme.border,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  feedbacksList: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbacksTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: theme.text,
  },
  noFeedbacks: {
    color: theme.textSecondary,
    fontStyle: "italic",
    padding: 20,
  },
  feedbackItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingVertical: 12,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  feedbackUser: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.text,
  },
  feedbackDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  deleteFeedbackButton: {
    padding: 4,
  },
  deleteFeedbackText: {
    fontSize: 16,
  },
  feedbackContent: {
    gap: 8,
  },
  feedbackRatings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedbackGrade: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  closedBadge: {
    fontSize: 12,
    color: theme.success,
    fontWeight: "bold",
  },
  feedbackComment: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
});
