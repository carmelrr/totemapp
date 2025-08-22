import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { auth } from '../firebase-config';
import { 
  addFeedbackToRoute, 
  subscribeFeedbacksForRoute, 
  deleteFeedback,
  updateFeedback,
  getUserFeedbackForRoute,
  calculateSmartAverageGrade,
  getDisplayGrade,
  getDisplayStarRating,
  getCompletionCount,
  migrateFeedbacksWithDisplayName
} from '../routesService';
import { searchUsers, tagUsersInFeedback } from '../services/socialService';
import { useUser } from '../context/UserContext';

const { width: screenWidth } = Dimensions.get('window');

// Define the height where the tab should start - adjust this to match your map height
const INITIAL_TAB_HEIGHT = 500; // Start even higher

// Function to detect if text is Hebrew
const isHebrewText = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  // Remove common characters that are language-neutral
  const cleanText = text.replace(/[\s\d\-.,!?@#$%^&*()_+=\[\]{}|\\:";'<>?/~`]/g, '');
  
  if (cleanText.length === 0) return true; // Default to Hebrew for empty/neutral text
  
  // Hebrew Unicode range: 0x0590-0x05FF
  const hebrewChars = cleanText.match(/[\u0590-\u05FF]/g);
  const hebrewCount = hebrewChars ? hebrewChars.length : 0;
  
  // English characters: a-z, A-Z
  const englishChars = cleanText.match(/[a-zA-Z]/g);
  const englishCount = englishChars ? englishChars.length : 0;
  
  // If we have both Hebrew and English, prefer Hebrew (since it's the app's main language)
  if (hebrewCount > 0 && englishCount > 0) {
    return hebrewCount >= englishCount;
  }
  
  // If only one type exists, return accordingly
  if (hebrewCount > 0) return true;
  if (englishCount > 0) return false;
  
  // Default to Hebrew for edge cases
  return true;
};

const StarRating = ({ rating, onRatingChange, disabled = false }) => {
  const stars = [1, 2, 3, 4, 5];
  
  return (
    <View style={styles.starContainer}>
      {stars.map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && onRatingChange(star)}
          disabled={disabled}
        >
          <Text style={[
            styles.star,
            { color: star <= rating ? '#FFD700' : '#ddd' }
          ]}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const GradeSelector = ({ selectedGrade, onGradeChange, disabled = false }) => {
  const grades = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];
  
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
      {grades.map(grade => (
        <TouchableOpacity
          key={grade}
          onPress={() => !disabled && onGradeChange(grade)}
          style={[
            styles.gradeButton,
            selectedGrade === grade && styles.gradeButtonSelected
          ]}
          disabled={disabled}
        >
          <Text style={[
            styles.gradeButtonText,
            selectedGrade === grade && styles.gradeButtonTextSelected
          ]}>
            {grade}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

export default function RouteFeedbackView({ route, onClose, isAdmin }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [userFeedback, setUserFeedback] = useState(null);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Form state
  const [starRating, setStarRating] = useState(0);
  const [suggestedGrade, setSuggestedGrade] = useState('');
  const [comment, setComment] = useState('');
  const [closedRoute, setClosedRoute] = useState(true); // תמיד נגדיר כ-true כי רק אם סגר את המסלול הוא יכול לשלוח פידבק
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Friends tagging state
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [currentMentionStart, setCurrentMentionStart] = useState(-1);
  const [currentMentionQuery, setCurrentMentionQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Drag state
  const translateY = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(INITIAL_TAB_HEIGHT); // Start with height that positions tab below map
  const startingHeight = useRef(INITIAL_TAB_HEIGHT); // Track the height when drag starts
  const actualHeight = useRef(INITIAL_TAB_HEIGHT); // Track the actual current height for immediate access
  
  const { isAdmin: userIsAdmin } = useUser();
  const user = auth.currentUser;

  // Create pan responder for drag functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Allow vertical drags
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        // Store the actual current height when drag begins
        startingHeight.current = actualHeight.current; // Use the actual height, not the state
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate new height based on drag from starting position
        // Negative dy means dragging up (increase height)
        // Positive dy means dragging down (decrease height)
        const newHeight = Math.max(80, Math.min(Dimensions.get('window').height - 100, startingHeight.current - gestureState.dy));
        
        // Update both the state and the ref immediately
        actualHeight.current = newHeight;
        setCurrentHeight(newHeight);
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        
        // If dragged below height of 150, close the modal
        if (actualHeight.current < 150) {
          onClose();
        }
        // Height is already set by onPanResponderMove, no need to change it
      },
    })
  ).current;

  useEffect(() => {
    if (!route) return;
    
    // Reset height to initial position when route changes
    setCurrentHeight(INITIAL_TAB_HEIGHT);
    startingHeight.current = INITIAL_TAB_HEIGHT;
    actualHeight.current = INITIAL_TAB_HEIGHT; // Also reset the actual height ref
    
    // Subscribe to feedbacks
    const unsubscribe = subscribeFeedbacksForRoute(route.id, (feedbacksData) => {
      setFeedbacks(feedbacksData);
    });
    
    // Get user's existing feedback
    if (user) {
      getUserFeedbackForRoute(route.id, user.uid).then(feedback => {
        if (feedback) {
          setUserFeedback(feedback);
          setStarRating(feedback.starRating || 0);
          setSuggestedGrade(feedback.suggestedGrade || '');
          setComment(feedback.comment || '');
          setClosedRoute(true); // תמיד נגדיר כ-true כי רק אם סגר את המסלול הוא יכול לשלוח פידבק
        }
      });
      
      // Auto-migrate feedbacks for current user to ensure displayName is up to date
      migrateFeedbacksWithDisplayName(user.uid).catch(error => {
        console.error('Failed to migrate feedbacks:', error);
      });
    }
    
    return () => unsubscribe();
  }, [route, user]);

  const resetForm = () => {
    setStarRating(0);
    setSuggestedGrade('');
    setComment('');
    setClosedRoute(true); // תמיד נגדיר כ-true כי רק אם סגר את המסלול הוא יכול לשלוח פידבק
    setIsEditingFeedback(false);
    setShowUserSuggestions(false);
    setUserSuggestions([]);
    setCurrentMentionStart(-1);
    setCurrentMentionQuery('');
  };

  // Handle @ mentions in comment
  const handleCommentChange = async (text) => {
    setComment(text);
    
    // Find @ mentions
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Check if there's text after @
      const textAfterAt = text.slice(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');
      const newlineIndex = textAfterAt.indexOf('\n');
      
      // If there's no space or newline after @, it's an active mention
      if (spaceIndex === -1 && newlineIndex === -1) {
        setCurrentMentionStart(lastAtIndex);
        setCurrentMentionQuery(textAfterAt);
        
        if (textAfterAt.length > 0) {
          // Search for users with the query
          setIsSearching(true);
          try {
            const results = await searchUsers(textAfterAt);
            const filteredResults = results.filter(user => user.id !== auth.currentUser?.uid);
            setUserSuggestions(filteredResults);
            setShowUserSuggestions(true);
          } catch (error) {
            console.error('Error searching users:', error);
            setUserSuggestions([]);
          } finally {
            setIsSearching(false);
          }
        } else {
          // Show popular users when @ is typed without text
          setIsSearching(true);
          try {
            const results = await searchUsers(''); // Empty search returns popular users
            const filteredResults = results.filter(user => user.id !== auth.currentUser?.uid);
            setUserSuggestions(filteredResults);
            setShowUserSuggestions(true);
          } catch (error) {
            console.error('Error getting popular users:', error);
            setUserSuggestions([]);
          } finally {
            setIsSearching(false);
          }
        }
      } else {
        setShowUserSuggestions(false);
        setCurrentMentionStart(-1);
        setCurrentMentionQuery('');
      }
    } else {
      setShowUserSuggestions(false);
      setCurrentMentionStart(-1);
      setCurrentMentionQuery('');
    }
  };

  const selectMentionUser = (user) => {
    if (currentMentionStart !== -1) {
      const beforeMention = comment.slice(0, currentMentionStart);
      const afterMention = comment.slice(currentMentionStart + 1 + currentMentionQuery.length);
      const newComment = `${beforeMention}@${user.displayName} ${afterMention}`;
      
      setComment(newComment);
    }
    
    setShowUserSuggestions(false);
    setCurrentMentionStart(-1);
    setCurrentMentionQuery('');
  };

  // Extract tagged users from comment text using @ mentions
  const extractTaggedUsersFromComment = async (commentText) => {
    const mentionRegex = /@([^\s]+)/g;
    const mentionedUsers = [];
    let match;
    
    while ((match = mentionRegex.exec(commentText)) !== null) {
      const mentionedName = match[1];
      // Search for user by display name
      try {
        const users = await searchUsers(mentionedName);
        const user = users.find(u => u.displayName.toLowerCase() === mentionedName.toLowerCase());
        if (user && !mentionedUsers.find(mu => mu.id === user.id)) {
          mentionedUsers.push(user);
        }
      } catch (error) {
        console.log('Error finding mentioned user:', error);
      }
    }
    
    return mentionedUsers;
  };

  const handleSubmitFeedback = async () => {
    if (!user) {
      Alert.alert('שגיאה', 'יש להתחבר כדי לשלוח פידבק');
      return;
    }

    if (starRating === 0) {
      Alert.alert('שגיאה', 'יש לבחור דירוג כוכבים');
      return;
    }

    setIsSubmitting(true);
    try {
      // Extract tagged users from comment text using @ mentions
      const taggedUsersFromComment = await extractTaggedUsersFromComment(comment);

      const feedbackData = {
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName || user.email,
        starRating,
        suggestedGrade,
        comment,
        closedRoute: true, // תמיד נגדיר כ-true כי רק אם סגר את המסלול הוא יכול לשלוח פידבק
        taggedUsers: taggedUsersFromComment.map(user => ({
          id: user.id,
          displayName: user.displayName,
          email: user.email
        }))
      };

      let feedbackId;
      if (userFeedback) {
        await updateFeedback(route.id, userFeedback.id, feedbackData);
        feedbackId = userFeedback.id;
      } else {
        const result = await addFeedbackToRoute(route.id, feedbackData);
        feedbackId = result.id;
      }

      // Tag users mentioned in feedback if any
      if (taggedUsersFromComment.length > 0) {
        const message = `פידבק על מסלול ${getDisplayGrade(route)}`;
        await tagUsersInFeedback(
          feedbackId,
          route.id,
          taggedUsersFromComment.map(u => u.id),
          message
        );
      }

      resetForm();
      Alert.alert('הצלחה', 'הפידבק נשלח בהצלחה');
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בשליחת הפידבק');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    Alert.alert(
      'מחיקת פידבק',
      'האם אתה בטוח שברצונך למחוק את הפידבק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeedback(route.id, feedbackId);
              if (userFeedback && userFeedback.id === feedbackId) {
                setUserFeedback(null);
                resetForm();
              }
            } catch (error) {
              Alert.alert('שגיאה', 'נכשל במחיקת הפידבק');
            }
          }
        }
      ]
    );
  };

  const renderFeedbackItem = (feedback, index) => {
    const canDelete = userIsAdmin || (user && feedback.userId === user.uid);
    const canEdit = user && feedback.userId === user.uid;
    const isCurrentUser = user && feedback.userId === user.uid;

    // Use displayName if available, otherwise fall back to email
    const displayName = feedback.userDisplayName || feedback.userEmail || 'Anonymous';

    return (
      <View key={index} style={[
        styles.feedbackItem,
        isCurrentUser && styles.currentUserFeedback
      ]}>
        <View style={styles.feedbackHeader}>
          <Text style={styles.feedbackUser}>
            {displayName}
          </Text>
          <Text style={styles.feedbackDate}>
            {new Date(feedback.submittedAt?.seconds * 1000).toLocaleDateString('he-IL')}
          </Text>
        </View>
        
        <View style={styles.feedbackContent}>
          <StarRating rating={feedback.starRating} disabled={true} />
          
          {feedback.suggestedGrade && (
            <Text style={styles.suggestedGrade}>
              דירוג: {feedback.suggestedGrade}
            </Text>
          )}
          
          {feedback.comment && (
            <Text style={[
              styles.comment,
              { textAlign: isHebrewText(feedback.comment) ? 'right' : 'left' }
            ]}>
              {feedback.comment}
            </Text>
          )}
          
          {feedback.closedRoute && (
            <Text style={styles.closedRoute}>✓ sent</Text>
          )}

          {/* Tagged Friends Display */}
          {feedback.taggedUsers && feedback.taggedUsers.length > 0 && (
            <View style={styles.taggedUsersContainer}>
              <Text style={styles.taggedUsersLabel}>תויג: </Text>
              <View style={styles.taggedUsersList}>
                {feedback.taggedUsers.map((taggedUser, idx) => (
                  <Text key={idx} style={styles.taggedUserName}>
                    {taggedUser.displayName}{idx < feedback.taggedUsers.length - 1 ? ', ' : ''}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>

        {(canDelete || canEdit) && (
          <View style={styles.feedbackActions}>
            {canEdit && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setUserFeedback(feedback);
                  setStarRating(feedback.starRating || 0);
                  setSuggestedGrade(feedback.suggestedGrade || '');
                  setComment(feedback.comment || '');
                  setClosedRoute(true); // תמיד נגדיר כ-true
                  setIsEditingFeedback(true);
                }}
              >
                <Text style={styles.editButtonText}>ערוך</Text>
              </TouchableOpacity>
            )}
            
            {canDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteFeedback(feedback.id)}
              >
                <Text style={styles.deleteButtonText}>מחק</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (!route) return null;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View 
        style={[
          styles.container,
          {
            height: currentHeight,
          }
        ]}
      >
      {/* Drag handle */}
      <View 
        style={styles.dragHandle} 
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandleBar} />
      </View>
      
      {/* Header with close button and edit button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>← חזור</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
        {userIsAdmin && (
          <TouchableOpacity
            style={[styles.editButton, isEditMode && styles.editButtonActive]}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={[styles.editButtonText, isEditMode && styles.editButtonTextActive]}>
              {isEditMode ? '✓' : '✎'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route details */}
        <View style={styles.routeInfo}>
          <View style={[styles.colorIndicator, { backgroundColor: route.color || '#f0f0f0' }]} />
          <Text style={styles.routeGrade}>{String(getDisplayGrade(route) || 'V?')}</Text>
          <View style={styles.routeStats}>
            <Text style={styles.starRating}>
              ★ {String(getDisplayStarRating(route).toFixed(1))}
            </Text>
            <Text style={styles.completionCount}>
              ✓ {String(getCompletionCount(route))}
            </Text>
          </View>
          {route.description && (
            <Text style={styles.routeDescription}>{route.description}</Text>
          )}
        </View>

        {/* Add/Edit Feedback Form - מוצג רק אם המשתמש עדיין לא נתן פידבק או אם הוא עורך */}
        {user && (!userFeedback || isEditingFeedback) && (
          <View style={styles.feedbackForm}>
            <Text style={styles.formTitle}>
              {userFeedback && isEditingFeedback ? 'ערוך פידבק' : 'הוסף פידבק'}
            </Text>
            
            <View style={styles.formRow}>
              <Text style={styles.formLabel}>דירוג:</Text>
              <StarRating 
                rating={starRating} 
                onRatingChange={setStarRating}
              />
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>דירוג:</Text>
              <GradeSelector 
                selectedGrade={suggestedGrade} 
                onGradeChange={setSuggestedGrade}
              />
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>הערה:</Text>
              <View style={styles.commentContainer}>
                <TextInput
                  style={[
                    styles.commentInput,
                    { textAlign: isHebrewText(comment) ? 'right' : 'left' }
                  ]}
                  multiline
                  placeholder="הערה על המסלול... (השתמש ב@ לתיוג חברים)"
                  value={comment}
                  onChangeText={handleCommentChange}
                />
                {/* User suggestions for @ mentions */}
                {showUserSuggestions && (
                  <View style={styles.suggestionsContainer}>
                    {isSearching ? (
                      <Text style={styles.loadingText}>חיפוש...</Text>
                    ) : userSuggestions.length > 0 ? (
                      userSuggestions.slice(0, 5).map(user => (
                        <TouchableOpacity
                          key={user.id}
                          style={styles.suggestionItem}
                          onPress={() => selectMentionUser(user)}
                        >
                          <Text style={styles.suggestionText}>{user.displayName}</Text>
                        </TouchableOpacity>
                      ))
                    ) : currentMentionQuery.length > 0 ? (
                      <Text style={styles.noResultsText}>לא נמצאו משתמשים</Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                onPress={handleSubmitFeedback}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'שולח...' : 'sent!'}
                </Text>
              </TouchableOpacity>
              
              {isEditingFeedback && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditingFeedback(false);
                    // Reset form to original feedback values
                    if (userFeedback) {
                      setStarRating(userFeedback.starRating || 0);
                      setSuggestedGrade(userFeedback.suggestedGrade || '');
                      setComment(userFeedback.comment || '');
                      setClosedRoute(true); // תמיד נגדיר כ-true
                    }
                  }}
                >
                  <Text style={styles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Feedbacks List */}
        <View style={styles.feedbacksList}>
          <Text style={styles.feedbacksTitle}>
            פידבקים ({String(feedbacks.length)})
          </Text>
          
          {feedbacks.length === 0 ? (
            <Text style={styles.noFeedbacks}>אין פידבקים עדיין</Text>
          ) : (
            (() => {
              // Sort feedbacks to show user's feedback first
              const sortedFeedbacks = [...feedbacks].sort((a, b) => {
                const aIsUser = user && a.userId === user.uid;
                const bIsUser = user && b.userId === user.uid;
                
                if (aIsUser && !bIsUser) return -1;
                if (!aIsUser && bIsUser) return 1;
                
                // If both are user or both are not user, sort by date (newest first)
                return (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0);
              });
              
              return sortedFeedbacks.map((feedback, index) => renderFeedbackItem(feedback, index));
            })()
          )}
        </View>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dragHandle: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  dragHandleBar: {
    width: 50,
    height: 5,
    backgroundColor: '#999',
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
    marginHorizontal: 16,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  editButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  editButtonText: {
    fontSize: 14,
    color: '#34495e',
    fontWeight: 'bold',
  },
  editButtonTextActive: {
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: '100%',
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  routeGrade: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  starRating: {
    fontSize: 14,
    color: '#FFD700',
    marginRight: 8,
    fontWeight: '600',
  },
  completionCount: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '600',
  },
  routeDescription: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  feedbackForm: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: '100%',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'right',
  },
  formRow: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  star: {
    fontSize: 24,
    marginRight: 4,
  },
  gradeScroll: {
    maxHeight: 50,
  },
  gradeButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  gradeButtonSelected: {
    backgroundColor: '#007AFF',
  },
  gradeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  gradeButtonTextSelected: {
    color: '#fff',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    width: '100%',
    textAlign: 'right',
  },
  commentContainer: {
    position: 'relative',
    width: '100%',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 150,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  loadingText: {
    padding: 12,
    textAlign: 'right',
    color: '#666',
    fontSize: 14,
  },
  noResultsText: {
    padding: 12,
    textAlign: 'right',
    color: '#999',
    fontSize: 14,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitButton: {
    backgroundColor: '#DC143C', // אדום בהיר יותר (Crimson)
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    textAlign: 'right',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#fff',
    textAlign: 'right',
    fontWeight: '600',
  },
  editMyFeedbackButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editMyFeedbackButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  feedbacksList: {
    padding: 16,
    width: '100%',
  },
  feedbacksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'right',
  },
  noFeedbacks: {
    textAlign: 'right',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  feedbackItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  currentUserFeedback: {
    backgroundColor: '#e8f4f8',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#666',
  },
  feedbackContent: {
    marginBottom: 8,
  },
  suggestedGrade: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  comment: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    lineHeight: 20,
  },
  closedRoute: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginTop: 8,
  },
  feedbackActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagButton: {
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 5,
  },
  tagButtonText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  searchingText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  userItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userDisplayName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  noResultsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  selectedFriendsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  selectedFriendsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectedFriend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedFriendText: {
    fontSize: 14,
    color: '#333',
  },
  removeSelectedText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  taggedUsersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  taggedUsersLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  taggedUsersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  taggedUserName: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});
