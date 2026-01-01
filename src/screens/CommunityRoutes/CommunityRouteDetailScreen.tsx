// src/screens/CommunityRoutes/CommunityRouteDetailScreen.tsx
// Screen for viewing a single community route with holds, comments, and likes

import React, { useState, useCallback } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/features/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { WallImageWithHolds } from '@/components/spray/WallImageWithHolds';
import {
  useCommunityRoute,
  useCommunityRouteLike,
  useCommunityRouteComments,
  useDeleteCommunityRoute,
  useExpirationInfo,
  CommunityRouteComment,
} from '@/features/community-routes';

export const CommunityRouteDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const routeId = route.params?.routeId;

  const { route: communityRoute, loading } = useCommunityRoute(routeId);
  const { liked, toggle: toggleLike } = useCommunityRouteLike(routeId);
  const { comments, posting, post: postComment, remove: removeComment } = useCommunityRouteComments(routeId);
  const { deleteRoute, deleting } = useDeleteCommunityRoute();
  const { daysLeft, expiringSoon } = useExpirationInfo(communityRoute?.expiresAt);

  const [commentText, setCommentText] = useState('');
  const [showHolds, setShowHolds] = useState(true);

  const isOwner = user?.uid === communityRoute?.createdBy;

  const handleLike = async () => {
    await toggleLike();
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      await postComment(commentText.trim());
      setCommentText('');
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לפרסם את התגובה');
    }
  };

  const handleDeleteComment = (comment: CommunityRouteComment) => {
    if (comment.userId !== user?.uid) return;
    Alert.alert('מחיקת תגובה', 'האם למחוק את התגובה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => removeComment(comment.id!),
      },
    ]);
  };

  const handleDeleteRoute = () => {
    if (!isOwner) return;
    Alert.alert(
      'מחיקת מסלול',
      'האם אתה בטוח שברצונך למחוק את המסלול? פעולה זו לא ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoute(routeId, communityRoute!.createdBy);
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('שגיאה', error.message);
            }
          },
        },
      ]
    );
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
            המסלול לא נמצא או שפג תוקפו
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>חזרה</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerGradient }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {communityRoute.name}
        </Text>
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
                {daysLeft > 0 ? `נותרו ${daysLeft} ימים` : 'פג תוקף היום'}
              </Text>
            </View>
          </View>

          {/* Route info */}
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <View style={styles.infoRow}>
              <View style={styles.gradeContainer}>
                <Text style={styles.gradeLabel}>דירוג</Text>
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

            {/* Stats and actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={liked ? '#FF6B6B' : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: liked ? '#FF6B6B' : theme.textSecondary },
                  ]}
                >
                  {communityRoute.likeCount || 0}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={22} color={theme.textSecondary} />
                <Text style={[styles.actionText, { color: theme.textSecondary }]}>
                  {communityRoute.commentCount || 0}
                </Text>
              </View>

              <View style={styles.actionButton}>
                <Ionicons name="eye-outline" size={22} color={theme.textSecondary} />
                <Text style={[styles.actionText, { color: theme.textSecondary }]}>
                  {communityRoute.viewCount || 0}
                </Text>
              </View>

              <View style={styles.actionButton}>
                <Ionicons name="hand-left-outline" size={22} color={theme.textSecondary} />
                <Text style={[styles.actionText, { color: theme.textSecondary }]}>
                  {communityRoute.holds?.length || 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Comments section */}
          <View style={[styles.commentsSection, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              תגובות ({comments.length})
            </Text>

            {comments.map((comment) => (
              <TouchableOpacity
                key={comment.id}
                style={styles.commentItem}
                onLongPress={() => handleDeleteComment(comment)}
                disabled={comment.userId !== user?.uid}
              >
                <View style={styles.commentHeader}>
                  <Text style={[styles.commentUser, { color: theme.text }]}>
                    {comment.userName}
                  </Text>
                  <Text style={[styles.commentDate, { color: theme.textSecondary }]}>
                    {formatDate(comment.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.commentText, { color: theme.text }]}>
                  {comment.text}
                </Text>
              </TouchableOpacity>
            ))}

            {comments.length === 0 && (
              <Text style={[styles.noComments, { color: theme.textSecondary }]}>
                אין תגובות עדיין. היה הראשון להגיב!
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Comment input */}
        <View style={[styles.commentInputContainer, { backgroundColor: theme.surface }]}>
          <TextInput
            style={[
              styles.commentInput,
              { backgroundColor: theme.background, color: theme.text },
            ]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="הוסף תגובה..."
            placeholderTextColor={theme.textSecondary}
            textAlign="right"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.primary },
              (!commentText.trim() || posting) && styles.sendButtonDisabled,
            ]}
            onPress={handlePostComment}
            disabled={!commentText.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
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
    backgroundColor: '#FF6B6B',
  },
  expirationText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  infoCard: {
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  gradeContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(142, 78, 198, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  gradeLabel: {
    fontSize: 11,
    color: '#8E4EC6',
    fontWeight: '500',
  },
  gradeValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  creatorInfo: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  createdAt: {
    fontSize: 12,
    marginTop: 2,
  },
  gymRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  gymName: {
    fontSize: 13,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  commentsSection: {
    margin: 12,
    padding: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 12,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  commentHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentDate: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
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
  },
  commentInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default CommunityRouteDetailScreen;
