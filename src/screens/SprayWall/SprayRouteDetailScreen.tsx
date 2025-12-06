// src/screens/SprayWall/SprayRouteDetailScreen.tsx
// Screen showing spray route details with rating and feedback

import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { SprayRoute, SprayRouteFeedback } from "@/features/spraywall/types";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import {
  addFeedbackToRoute,
  getUserFeedbackForRoute,
  getFeedbacksForRoute,
  listenToFeedbacksForRoute,
  updateRoute,
  deleteRoute,
} from "@/features/spraywall/routesService";
import { useWalls } from "@/features/walls/hooks";

// V-Scale grades for selector
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

export const SprayRouteDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sprayRoute, wallId } = route.params;
  const { user } = useAuth();
  const { walls } = useWalls();

  // Find wall for the image
  const wall = walls.find((w) => w.id === wallId);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<SprayRouteFeedback[]>([]);
  const [userFeedback, setUserFeedback] = useState<SprayRouteFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [suggestedGrade, setSuggestedGrade] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current route data (may update with feedbacks)
  const [currentRoute, setCurrentRoute] = useState<SprayRoute>(sprayRoute);

  // Edit route state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(sprayRoute.name);
  const [editGrade, setEditGrade] = useState(sprayRoute.grade);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Check if current user is the route creator
  const isRouteCreator = user?.uid && sprayRoute.createdBy === user.uid;

  // Load feedbacks
  useEffect(() => {
    if (!sprayRoute?.id) return;

    const unsubscribe = listenToFeedbacksForRoute(sprayRoute.id, (fetchedFeedbacks) => {
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
        }
      }
    });

    return () => unsubscribe();
  }, [sprayRoute?.id, user?.uid]);

  const handleSubmitFeedback = async () => {
    if (!user) {
      Alert.alert("שגיאה", "יש להתחבר כדי לשלוח דירוג");
      return;
    }

    if (starRating === 0) {
      Alert.alert("שגיאה", "יש לבחור דירוג כוכבים");
      return;
    }

    if (!suggestedGrade) {
      Alert.alert("שגיאה", "יש לבחור דירוג קושי");
      return;
    }

    setIsSubmitting(true);

    try {
      await addFeedbackToRoute(sprayRoute.id, {
        userId: user.uid,
        userDisplayName: user.displayName || user.email || "Anonymous",
        starRating,
        suggestedGrade,
        comment: comment.trim(),
      });

      Alert.alert("כל הכבוד! 🏆", "הדירוג שלך נשמר בהצלחה!");
      setShowFeedbackForm(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Alert.alert("שגיאה", "לא הצלחנו לשמור את הדירוג");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle route update (name and grade only - doesn't affect statistics)
  const handleUpdateRoute = async () => {
    if (!editName.trim()) {
      Alert.alert("שגיאה", "יש להזין שם למסלול");
      return;
    }

    setIsUpdating(true);
    try {
      await updateRoute(sprayRoute.id, {
        name: editName.trim(),
        grade: editGrade,
      });
      
      // Update local state
      setCurrentRoute((prev) => ({
        ...prev,
        name: editName.trim(),
        grade: editGrade,
      }));
      
      setShowEditModal(false);
      Alert.alert("הצלחה", "המסלול עודכן בהצלחה");
    } catch (error) {
      console.error("Error updating route:", error);
      Alert.alert("שגיאה", "לא הצלחנו לעדכן את המסלול");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle route deletion
  const handleDeleteRoute = () => {
    Alert.alert(
      "מחיקת מסלול",
      `האם אתה בטוח שברצונך למחוק את המסלול "${sprayRoute.name}"?\n\nפעולה זו אינה ניתנת לביטול.`,
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteRoute(sprayRoute.id);
              Alert.alert("הצלחה", "המסלול נמחק בהצלחה", [
                {
                  text: "אישור",
                  onPress: () => {
                    // Reset navigation stack to SprayHome after deletion
                    navigation.reset({
                      index: 0,
                      routes: [{ name: "SprayHome" }],
                    });
                  },
                },
              ]);
            } catch (error) {
              console.error("Error deleting route:", error);
              Alert.alert("שגיאה", "לא הצלחנו למחוק את המסלול");
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Navigate to edit holds screen
  const handleEditHolds = () => {
    setShowEditModal(false);
    navigation.navigate("AddRoute", {
      wallId,
      editMode: true,
      routeId: sprayRoute.id,
      existingHolds: sprayRoute.holds,
      routeName: currentRoute.name,
      routeGrade: currentRoute.grade,
    });
  };

  const displayGrade = currentRoute.calculatedGrade || currentRoute.grade;
  const averageRating = currentRoute.averageStarRating || 0;
  const feedbackCount = currentRoute.feedbackCount || 0;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("he-IL");
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Wall Image with Holds */}
        {wall && (
          <View style={styles.imageContainer}>
            <WallImageWithHolds
              imageUrl={wall.imageUrl}
              holds={sprayRoute.holds || []}
              routeColor={sprayRoute.color || "#FF4444"}
              editable={false}
            />
          </View>
        )}

        {/* Route Header - Name and Grade */}
        <View style={styles.routeHeaderSection}>
          <Text style={styles.routeName}>{currentRoute.name}</Text>
          <View style={styles.gradeContainer}>
            <Text style={styles.routeGrade}>{displayGrade}</Text>
            {currentRoute.calculatedGrade && currentRoute.calculatedGrade !== currentRoute.grade && (
              <Text style={styles.communityBadge}>👥 קהילה</Text>
            )}
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>דירוג</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🏆</Text>
            <Text style={styles.statValue}>{feedbackCount}</Text>
            <Text style={styles.statLabel}>טופסים</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>💬</Text>
            <Text style={styles.statValue}>{feedbacks.length}</Text>
            <Text style={styles.statLabel}>תגובות</Text>
          </View>
        </View>

        {/* Route Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>פרטים</Text>
          <View style={styles.detailsCard}>
            {sprayRoute.creatorName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>👤</Text>
                <Text style={styles.detailLabel}>יוצר</Text>
                <Text style={styles.detailValue}>{sprayRoute.creatorName}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📊</Text>
              <Text style={styles.detailLabel}>דירוג מקורי</Text>
              <Text style={styles.detailValue}>{sprayRoute.grade}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>🧗</Text>
              <Text style={styles.detailLabel}>אחיזות</Text>
              <Text style={styles.detailValue}>{sprayRoute.holds?.length || 0}</Text>
            </View>
            {sprayRoute.createdAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailLabel}>נוצר</Text>
                <Text style={styles.detailValue}>{formatDate(sprayRoute.createdAt)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Owner Actions - Edit/Delete (only for route creator) */}
        {isRouteCreator && (
          <View style={styles.ownerActionsSection}>
            <Text style={styles.sectionTitle}>ניהול המסלול</Text>
            <View style={styles.ownerActionsRow}>
              <TouchableOpacity
                style={styles.editRouteButton}
                onPress={() => setShowEditModal(true)}
              >
                <Text style={styles.editRouteIcon}>✏️</Text>
                <Text style={styles.editRouteText}>ערוך מסלול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteRouteButton}
                onPress={handleDeleteRoute}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#ff6b6b" size="small" />
                ) : (
                  <>
                    <Text style={styles.deleteRouteIcon}>🗑️</Text>
                    <Text style={styles.deleteRouteText}>מחק</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Feedback Section */}
        <View style={styles.feedbackSection}>
          <Text style={styles.sectionTitle}>
            {userFeedback ? "הדירוג שלך" : "סגרת את המסלול? 🏆"}
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
            <View style={styles.existingFeedbackCard}>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackLabel}>דירוג:</Text>
                <View style={styles.feedbackStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Text
                      key={star}
                      style={[
                        styles.starText,
                        star <= userFeedback.starRating && styles.filledStar,
                      ]}
                    >
                      ★
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackLabel}>דרגת קושי:</Text>
                <Text style={styles.feedbackValue}>{userFeedback.suggestedGrade}</Text>
              </View>
              {userFeedback.comment && (
                <View style={styles.feedbackCommentRow}>
                  <Text style={styles.feedbackLabel}>הערה:</Text>
                  <Text style={styles.feedbackComment}>{userFeedback.comment}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.editFeedbackButton}
                onPress={() => setShowFeedbackForm(true)}
              >
                <Text style={styles.editFeedbackText}>✏️ ערוך דירוג</Text>
              </TouchableOpacity>
            </View>
          )}

          {showFeedbackForm && (
            <View style={styles.feedbackFormCard}>
              {/* Star Rating */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>כמה נהנית מהמסלול? ⭐</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setStarRating(star)}
                      style={styles.starButton}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.starTextLarge, star <= starRating && styles.filledStar]}
                      >
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Grade Selector */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>מה הדירוג לדעתך? 📊</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.gradeScroller}
                >
                  {V_GRADES.map((grade) => (
                    <TouchableOpacity
                      key={grade}
                      onPress={() => setSuggestedGrade(grade)}
                      style={[
                        styles.gradeOption,
                        suggestedGrade === grade && styles.gradeOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.gradeOptionText,
                          suggestedGrade === grade && styles.gradeOptionTextSelected,
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
                <Text style={styles.formLabel}>רוצה להוסיף הערה? 💬</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="בטא, טיפים, חוויה..."
                  placeholderTextColor="#888"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Buttons */}
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowFeedbackForm(false);
                    if (userFeedback) {
                      setStarRating(userFeedback.starRating || 0);
                      setSuggestedGrade(userFeedback.suggestedGrade || "");
                      setComment(userFeedback.comment || "");
                    } else {
                      setStarRating(0);
                      setSuggestedGrade("");
                      setComment("");
                    }
                  }}
                >
                  <Text style={styles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleSubmitFeedback}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>שמור דירוג</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Community Feedbacks */}
        {feedbacks.length > 0 && (
          <View style={styles.communitySection}>
            <Text style={styles.sectionTitle}>תגובות הקהילה ({feedbacks.length})</Text>
            {feedbacks.map((fb) => (
              <View key={fb.id} style={styles.feedbackItem}>
                <View style={styles.feedbackHeader}>
                  <Text style={styles.feedbackUser}>{fb.userDisplayName}</Text>
                  <View style={styles.feedbackMiniStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Text
                        key={s}
                        style={[styles.miniStar, s <= fb.starRating && styles.filledStar]}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                </View>
                <View style={styles.feedbackMeta}>
                  <Text style={styles.feedbackGrade}>דירג: {fb.suggestedGrade}</Text>
                  {fb.createdAt && (
                    <Text style={styles.feedbackDate}>{formatDate(fb.createdAt)}</Text>
                  )}
                </View>
                {fb.comment && <Text style={styles.feedbackText}>{fb.comment}</Text>}
              </View>
            ))}
          </View>
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
            <Text style={styles.modalTitle}>ערוך מסלול</Text>
            
            {/* Route Name */}
            <View style={styles.modalFormSection}>
              <Text style={styles.modalLabel}>שם המסלול</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="שם המסלול"
                placeholderTextColor="#888"
              />
            </View>

            {/* Route Grade */}
            <View style={styles.modalFormSection}>
              <Text style={styles.modalLabel}>דירוג קושי</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.gradeScroller}
              >
                {V_GRADES.map((grade) => (
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
              <Text style={styles.editHoldsText}>ערוך אחיזות על הקיר</Text>
            </TouchableOpacity>

            {/* Note about statistics */}
            <Text style={styles.modalNote}>
              💡 עריכה אינה משפיעה על הסטטיסטיקות והדירוגים מהקהילה
            </Text>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setEditName(currentRoute.name);
                  setEditGrade(currentRoute.grade);
                }}
              >
                <Text style={styles.modalCancelText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isUpdating && styles.buttonDisabled]}
                onPress={handleUpdateRoute}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>שמור</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    height: 350,
    position: "relative",
  },
  routeHeaderSection: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  routeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  routeName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  gradeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  routeGrade: {
    color: "#8E4EC6",
    fontSize: 20,
    fontWeight: "600",
  },
  communityBadge: {
    color: "#888",
    fontSize: 12,
    marginLeft: 8,
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: "#2a2a2a",
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
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  detailsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  detailIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
  },
  detailLabel: {
    color: "#888",
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  feedbackSection: {
    padding: 16,
  },
  sentButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  sentButtonEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  sentButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  existingFeedbackCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  feedbackLabel: {
    color: "#888",
    fontSize: 14,
    marginRight: 8,
  },
  feedbackValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  feedbackStars: {
    flexDirection: "row",
  },
  starText: {
    fontSize: 20,
    color: "#444",
  },
  filledStar: {
    color: "#FFD700",
  },
  feedbackCommentRow: {
    marginTop: 8,
  },
  feedbackComment: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 4,
  },
  editFeedbackButton: {
    marginTop: 16,
    alignItems: "center",
  },
  editFeedbackText: {
    color: "#8E4EC6",
    fontSize: 14,
  },
  feedbackFormCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  starButton: {
    padding: 8,
  },
  starTextLarge: {
    fontSize: 36,
    color: "#444",
  },
  gradeScroller: {
    marginTop: 4,
  },
  gradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#3a3a3a",
    marginRight: 8,
  },
  gradeOptionSelected: {
    backgroundColor: "#8E4EC6",
  },
  gradeOptionText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "500",
  },
  gradeOptionTextSelected: {
    color: "#fff",
  },
  commentInput: {
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    minHeight: 80,
    textAlign: "right",
  },
  formButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#3a3a3a",
    marginRight: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "500",
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  communitySection: {
    padding: 16,
  },
  feedbackItem: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedbackUser: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  feedbackMiniStars: {
    flexDirection: "row",
  },
  miniStar: {
    fontSize: 12,
    color: "#444",
  },
  feedbackMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  feedbackGrade: {
    color: "#8E4EC6",
    fontSize: 12,
  },
  feedbackDate: {
    color: "#666",
    fontSize: 12,
  },
  feedbackText: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
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
    backgroundColor: "#3a3a3a",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  editRouteIcon: {
    fontSize: 18,
  },
  editRouteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteRouteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  deleteRouteIcon: {
    fontSize: 18,
  },
  deleteRouteText: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "600",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalFormSection: {
    marginBottom: 16,
  },
  modalLabel: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#3a3a3a",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
  },
  modalNote: {
    color: "#888",
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
    backgroundColor: "#3a3a3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: "#8E4EC6",
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
    backgroundColor: "#3a3a3a",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  editHoldsIcon: {
    fontSize: 18,
  },
  editHoldsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SprayRouteDetailScreen;
