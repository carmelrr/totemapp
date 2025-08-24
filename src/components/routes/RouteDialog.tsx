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

const { width: screenWidth } = Dimensions.get("window");

const StarRating = ({ rating, onRatingChange, disabled = false }) => {
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
              { color: star <= rating ? "#FFD700" : "#ddd" },
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
      Alert.alert("שגיאה", "יש להתחבר כדי לשלוח פידבק");
      return;
    }

    if (starRating === 0) {
      Alert.alert("שגיאה", "יש לבחור דירוג כוכבים");
      return;
    }

    if (!suggestedGrade) {
      Alert.alert("שגיאה", "יש לבחור דירוג מוצע");
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
        Alert.alert("הצלחה", "הפידבק עודכן בהצלחה");
      } else {
        // Add new feedback
        await FeedbackService.addFeedbackToRoute(route.id, feedbackData);
        Alert.alert("הצלחה", "הפידבק נשלח בהצלחה");
      }

      resetForm();
    } catch (error) {
      Alert.alert("שגיאה", "נכשל בשליחת הפידבק");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    Alert.alert("מחיקת פידבק", "האם אתה בטוח שברצונך למחוק את הפידבק?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          try {
            await FeedbackService.deleteFeedback(feedbackId);
            Alert.alert("הצלחה", "הפידבק נמחק בהצלחה");
          } catch (error) {
            Alert.alert("שגיאה", "נכשל במחיקת הפידבק");
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
    return date.toLocaleDateString("he-IL");
  };

  if (!visible || !route) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>מסלול {route.grade}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Route Info */}
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>מידע על המסלול</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>דירוג:</Text>
              <Text style={styles.infoValue}>{route.grade}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>צבע:</Text>
              <View
                style={[styles.colorDot, { backgroundColor: route.color }]}
              />
              <Text style={styles.infoValue}>{route.color}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>מספר סגירות:</Text>
              <Text style={styles.infoValue}>{getCompletionCount()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>דירוג כוכבים ממוצע:</Text>
              <Text style={styles.infoValue}>⭐ {getAverageStarRating()}</Text>
            </View>
            {getSmartAverageGrade() && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>דירוג מוצע (משתמשים):</Text>
                <Text style={styles.infoValue}>{getSmartAverageGrade()}</Text>
              </View>
            )}
          </View>

          {/* Feedback Form */}
          {user && (
            <View style={styles.feedbackForm}>
              <Text style={styles.formTitle}>
                {userFeedback ? "עדכן את הפידבק שלך" : "הוסף פידבק"}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>דירוג כוכבים:</Text>
                <StarRating
                  rating={starRating}
                  onRatingChange={setStarRating}
                  disabled={isSubmitting}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>דירוג מוצע:</Text>
                <GradeSelector
                  selectedGrade={suggestedGrade}
                  onGradeChange={setSuggestedGrade}
                  disabled={isSubmitting}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>תגובה:</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  numberOfLines={3}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="איך היה המסלול?"
                  placeholderTextColor="#999"
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
                  <Text style={styles.checkboxLabel}>סגרתי את המסלול</Text>
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
                    ? "שולח..."
                    : userFeedback
                      ? "עדכן פידבק"
                      : "שלח פידבק"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Feedbacks List */}
          <View style={styles.feedbacksList}>
            <Text style={styles.feedbacksTitle}>
              פידבקים ({feedbacks.length})
            </Text>
            {feedbacks.length === 0 ? (
              <Text style={styles.noFeedbacks}>
                עדיין אין פידבקים למסלול זה
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
                          דירוג מוצע: {feedback.suggestedGrade}
                        </Text>
                        {feedback.closedRoute && (
                          <Text style={styles.closedBadge}>✓ סגר</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#3498db",
    borderBottomWidth: 1,
    borderBottomColor: "#2980b9",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  routeInfo: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#2c3e50",
    textAlign: "right",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#7f8c8d",
    width: 120,
    textAlign: "right",
  },
  infoValue: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "500",
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  feedbackForm: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#2c3e50",
    textAlign: "right",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: "#2c3e50",
    marginBottom: 8,
    fontWeight: "500",
    textAlign: "right",
  },
  starContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  star: {
    fontSize: 24,
    marginRight: 4,
  },
  gradeScroll: {
    maxHeight: 50,
  },
  gradeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#ecf0f1",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#bdc3c7",
  },
  gradeButtonSelected: {
    backgroundColor: "#3498db",
    borderColor: "#2980b9",
  },
  gradeButtonText: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "500",
  },
  gradeButtonTextSelected: {
    color: "white",
  },
  commentInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#bdc3c7",
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#27ae60",
    borderColor: "#27ae60",
  },
  checkmark: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#2c3e50",
  },
  submitButton: {
    backgroundColor: "#27ae60",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#bdc3c7",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  feedbacksList: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbacksTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#2c3e50",
  },
  noFeedbacks: {
    textAlign: "right",
    color: "#7f8c8d",
    fontStyle: "italic",
    padding: 20,
  },
  feedbackItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#ecf0f1",
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
    color: "#2c3e50",
  },
  feedbackDate: {
    fontSize: 12,
    color: "#7f8c8d",
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
    color: "#7f8c8d",
  },
  closedBadge: {
    fontSize: 12,
    color: "#27ae60",
    fontWeight: "bold",
  },
  feedbackComment: {
    fontSize: 14,
    color: "#2c3e50",
    lineHeight: 20,
  },
});
