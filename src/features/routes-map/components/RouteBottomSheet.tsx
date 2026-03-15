import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteDoc } from '../types/route';
import { getContrastTextColor, getRouteDisplayName } from '../utils/colors';
import { useTheme } from '@/features/theme/ThemeContext';
import { FeedbackService } from '../services/FeedbackService';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/features/language';
import { VideoLinkInput, VideoLinkButton } from '@/components/feedback';
import { RouteFeedbackForm } from '@/components/routes/RouteFeedbackForm';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// V-Scale grades for selector
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

/**
 * Get the index of a V-grade in the V_GRADES array
 */
const getGradeIndex = (grade: string): number => {
  const index = V_GRADES.indexOf(grade);
  return index >= 0 ? index : -1;
};

/**
 * Get allowed grades for community rating (±2 from builder's original)
 */
const getAllowedGrades = (originalGrade: string): string[] => {
  const originalIndex = getGradeIndex(originalGrade);
  if (originalIndex < 0) {
    return V_GRADES;
  }
  
  const minIndex = Math.max(0, originalIndex - 2);
  const maxIndex = Math.min(V_GRADES.length - 1, originalIndex + 2);
  
  return V_GRADES.slice(minIndex, maxIndex + 1);
};

interface RouteBottomSheetProps {
  visible: boolean;
  route: RouteDoc | null;
  onClose: () => void;
  onMarkTop?: (route: RouteDoc) => void;
  onRate?: (route: RouteDoc, rating: number) => void;
  onShare?: (route: RouteDoc) => void;
  onReport?: (route: RouteDoc) => void;
}

const RouteBottomSheet = React.memo(function RouteBottomSheet({
  visible,
  route,
  onClose,
  onMarkTop,
  onRate,
  onShare,
  onReport,
}: RouteBottomSheetProps) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const styles = createStyles(theme);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [suggestedGrade, setSuggestedGrade] = useState('');
  const [comment, setComment] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLinkValid, setIsVideoLinkValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userFeedback, setUserFeedback] = useState<any>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  
  // Load user's existing feedback when modal opens
  useEffect(() => {
    if (visible && route && user) {
      loadUserFeedback();
    } else {
      resetForm();
    }
  }, [visible, route?.id, user?.uid]);
  
  const loadUserFeedback = async () => {
    if (!user || !route) return;
    
    setIsLoadingFeedback(true);
    try {
      const feedback = await FeedbackService.getUserFeedbackForRoute(user.uid, route.id);
      if (feedback && feedback.isCompleted) {
        setUserFeedback(feedback);
        setStarRating(feedback.starRating || 0);
        setSuggestedGrade(feedback.suggestedGrade || '');
        setComment(feedback.comment || '');
        setVideoUrl(feedback.videoUrl || '');
      } else if (feedback && !feedback.isCompleted) {
        // Feedback exists but completion was undone — pre-fill form but don't show as sent
        setUserFeedback(null);
        setStarRating(feedback.starRating || 0);
        setSuggestedGrade(feedback.suggestedGrade || '');
        setComment(feedback.comment || '');
        setVideoUrl(feedback.videoUrl || '');
      } else {
        setUserFeedback(null);
      }
    } catch (error) {
      console.error('Error loading user feedback:', error);
    } finally {
      setIsLoadingFeedback(false);
    }
  };
  
  const resetForm = () => {
    setShowFeedbackForm(false);
    setStarRating(0);
    setSuggestedGrade('');
    setComment('');
    setVideoUrl('');
    setUserFeedback(null);
  };
  
  if (!route) return null;

  const textColor = getContrastTextColor(route.color);

  const handleSubmitFeedback = useCallback(async () => {
    if (!user) {
      Alert.alert(t.common.error, t.feedback.mustLogin);
      return;
    }
    
    if (starRating === 0) {
      Alert.alert(t.common.error, t.feedback.mustSelectStars);
      return;
    }
    
    if (!suggestedGrade) {
      Alert.alert(t.common.error, t.feedback.mustSelectGrade);
      return;
    }

    if (!isVideoLinkValid) {
      Alert.alert(t.common.error, t.videoLink.errors.notAllowed);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const feedbackData = {
        userId: user.uid,
        userDisplayName: user.displayName || user.email || 'Anonymous',
        starRating,
        suggestedGrade,
        comment: comment.trim(),
        videoUrl: videoUrl.trim() || null,
        isCompleted: true, // Only completed routes can submit feedback
      };
      
      if (userFeedback) {
        // Update existing feedback
        await FeedbackService.updateFeedback(userFeedback.id, feedbackData);
      } else {
        // Check if there's an existing non-completed feedback (e.g. after undo)
        const existingFeedback = await FeedbackService.getUserFeedbackForRoute(user.uid, route.id);
        if (existingFeedback) {
          await FeedbackService.updateFeedback(existingFeedback.id, feedbackData);
        } else {
          // Add new feedback
          await FeedbackService.addFeedbackToRoute(route.id, feedbackData);
        }
      }
      
      setShowFeedbackForm(false);
      await loadUserFeedback(); // Reload to show updated data
      onMarkTop?.(route); // Notify parent
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(t.common.error, t.feedback.failedToSave);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, starRating, suggestedGrade, comment, videoUrl, isVideoLinkValid, userFeedback, route, onMarkTop]);

  const handleShare = useCallback(() => {
    onShare?.(route);
  }, [onShare, route]);

  const handleReport = useCallback(() => {
    onReport?.(route);
  }, [onReport, route]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return t.routeSheet.unknown;
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
    } catch {
      return t.routeSheet.unknown;
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { label: t.routeSheet.active, color: '#10b981', bg: '#d1fae5' };
      case 'archived':
        return { label: t.routeSheet.archived, color: '#f59e0b', bg: '#fef3c7' };
      case 'draft':
        return { label: t.routeSheet.draft, color: '#6b7280', bg: '#f3f4f6' };
      default:
        return { label: status, color: '#6b7280', bg: '#f3f4f6' };
    }
  };
  
  // Get display grade (community or original)
  const displayGrade = route.calculatedGrade || route.grade;
  // Always show community indicator if calculatedGrade exists (even if same as original)
  const isGradeFromCommunity = !!route.calculatedGrade;

  const statusInfo = getStatusInfo(route.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header with gradient-like effect */}
        <View style={styles.headerWrapper}>
          <View style={[styles.headerGradient, { backgroundColor: route.color }]} />
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              {/* Large color indicator */}
              <View style={[styles.colorBubble, { backgroundColor: route.color }]}>
                <Text style={[styles.gradeInBubble, { color: textColor }]}>
                  {displayGrade}
                </Text>
                {isGradeFromCommunity && (
                  <Text style={styles.communityIndicator}>👥</Text>
                )}
              </View>
              
              <Text style={styles.routeName} numberOfLines={2}>
                {getRouteDisplayName(route, language, t)}
              </Text>
              
              {/* User completed badge */}
              {userFeedback && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>{t.routeSheet.sentRoute}</Text>
                </View>
              )}
              
              <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats Cards */}
          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statValue}>{route.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLabel}>{t.routes.grade}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statValue}>{route.tops || 0}</Text>
              <Text style={styles.statLabel}>{t.routeSheet.tops}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>💬</Text>
              <Text style={styles.statValue}>{route.comments || 0}</Text>
              <Text style={styles.statLabel}>{t.routeSheet.comments}</Text>
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>{t.routeSheet.details}</Text>
            
            <View style={styles.detailsCard}>
              {route.setter && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>👤</Text>
                  <Text style={styles.detailLabel}>{t.routeSheet.setter}</Text>
                  <Text style={styles.detailValue}>{route.setter}</Text>
                </View>
              )}
              
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailLabel}>{t.routeSheet.created}</Text>
                <Text style={styles.detailValue}>{formatDate(route.createdAt)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>🎨</Text>
                <Text style={styles.detailLabel}>{t.routeSheet.color}</Text>
                <View style={[styles.colorSwatch, { backgroundColor: route.color }]} />
              </View>
            </View>

            {route.tags && route.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsLabel}>{t.routeSheet.tags}</Text>
                <View style={styles.tagsContainer}>
                  {route.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Community Rating Display */}
          {route.averageStarRating !== undefined && route.averageStarRating > 0 && (
            <View style={styles.communityRatingSection}>
              <Text style={styles.sectionTitle}>{t.routeSheet.communityRating}</Text>
              <View style={styles.communityRatingCard}>
                <View style={styles.communityStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Text
                      key={star}
                      style={[
                        styles.communityStarText,
                        star <= (route.averageStarRating || 0) && styles.filledStar
                      ]}
                    >
                      ★
                    </Text>
                  ))}
                </View>
                <Text style={styles.communityRatingText}>
                  {route.averageStarRating?.toFixed(1)} ({route.feedbackCount || 0} {t.routeSheet.ratings})
                </Text>
              </View>
            </View>
          )}

          {/* Sent! / Feedback Section */}
          <View style={styles.sentSection}>
            <Text style={styles.sectionTitle}>
              {userFeedback ? t.feedback.yourFeedback : t.feedback.completedRouteQuestion}
            </Text>
            
            {!showFeedbackForm && !userFeedback && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.sentButton]} 
                onPress={() => setShowFeedbackForm(true)}
                activeOpacity={0.8}
                disabled={!user}
              >
                <Text style={styles.actionEmoji}>🎯</Text>
                <Text style={styles.sentButtonText}>{t.routes.sent}</Text>
              </TouchableOpacity>
            )}
            
            {!showFeedbackForm && userFeedback && (
              <View style={styles.existingFeedbackCard}>
                <View style={styles.feedbackRow}>
                  <Text style={styles.feedbackLabel}>{t.feedback.rating}</Text>
                  <View style={styles.feedbackStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Text
                        key={star}
                        style={[
                          styles.feedbackStarText,
                          star <= userFeedback.starRating && styles.filledStar
                        ]}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                </View>
                <View style={styles.feedbackRow}>
                  <Text style={styles.feedbackLabel}>{t.feedback.difficultyGrade}</Text>
                  <Text style={styles.feedbackValue}>{userFeedback.suggestedGrade}</Text>
                </View>
                {userFeedback.comment && (
                  <View style={styles.feedbackCommentRow}>
                    <Text style={styles.feedbackLabel}>{t.feedback.yourComment}</Text>
                    <Text style={styles.feedbackComment}>{userFeedback.comment}</Text>
                  </View>
                )}
                {userFeedback.videoUrl && (
                  <VideoLinkButton url={userFeedback.videoUrl} />
                )}
                <View style={styles.feedbackActionsRow}>
                  <TouchableOpacity 
                    style={styles.editFeedbackButton} 
                    onPress={() => setShowFeedbackForm(true)}
                  >
                    <Text style={styles.editFeedbackText}>{t.feedback.editFeedback}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.undoFeedbackButton} 
                    onPress={() => {
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
                                await FeedbackService.undoCompletion(userFeedback.id);
                                setUserFeedback(null);
                                resetForm();
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
                  >
                    <Text style={styles.undoFeedbackText}>{t.routes?.undoSend || '↩️ ביטול סגירה'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Feedback form Modal popup */}
            <Modal
              visible={showFeedbackForm}
              animationType="slide"
              transparent={true}
              onRequestClose={() => {
                setShowFeedbackForm(false);
                if (userFeedback) {
                  setStarRating(userFeedback.starRating || 0);
                  setSuggestedGrade(userFeedback.suggestedGrade || '');
                  setComment(userFeedback.comment || '');
                  setVideoUrl(userFeedback.videoUrl || '');
                } else {
                  setStarRating(0);
                  setSuggestedGrade('');
                  setComment('');
                  setVideoUrl('');
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
                      setSuggestedGrade(userFeedback.suggestedGrade || '');
                      setComment(userFeedback.comment || '');
                      setVideoUrl(userFeedback.videoUrl || '');
                    } else {
                      setStarRating(0);
                      setSuggestedGrade('');
                      setComment('');
                      setVideoUrl('');
                    }
                  }}
                />
                <View style={[styles.feedbackModalContent, { paddingBottom: Math.max(34, insets.bottom + 24) }]}>
                  {/* Modal Header */}
                  <View style={styles.feedbackModalHeader}>
                    <Text style={styles.feedbackModalTitle}>
                      {userFeedback ? t.feedback.editFeedback : t.feedback.completedRouteQuestion}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowFeedbackForm(false);
                        if (userFeedback) {
                          setStarRating(userFeedback.starRating || 0);
                          setSuggestedGrade(userFeedback.suggestedGrade || '');
                          setComment(userFeedback.comment || '');
                          setVideoUrl(userFeedback.videoUrl || '');
                        } else {
                          setStarRating(0);
                          setSuggestedGrade('');
                          setComment('');
                          setVideoUrl('');
                        }
                      }}
                      style={styles.feedbackModalClose}
                    >
                      <Text style={styles.feedbackModalCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={styles.feedbackModalScroll}>
                    <RouteFeedbackForm
                      starRating={starRating}
                      onStarRatingChange={setStarRating}
                      suggestedGrade={suggestedGrade}
                      onGradeChange={setSuggestedGrade}
                      grades={getAllowedGrades(route.grade)}
                      gradeRangeHint={`(${t.feedback.allowedRange} ${getAllowedGrades(route.grade)[0]} - ${getAllowedGrades(route.grade).slice(-1)[0]})`}
                      comment={comment}
                      onCommentChange={setComment}
                      commentPlaceholder={t.feedback.betaTipsExperience}
                      videoUrl={videoUrl}
                      onVideoUrlChange={setVideoUrl}
                      isVideoLinkValid={isVideoLinkValid}
                      onVideoLinkValidChange={setIsVideoLinkValid}
                      onSubmit={handleSubmitFeedback}
                      onCancel={() => {
                        setShowFeedbackForm(false);
                        if (userFeedback) {
                          setStarRating(userFeedback.starRating || 0);
                          setSuggestedGrade(userFeedback.suggestedGrade || '');
                          setComment(userFeedback.comment || '');
                          setVideoUrl(userFeedback.videoUrl || '');
                        } else {
                          setStarRating(0);
                          setSuggestedGrade('');
                          setComment('');
                          setVideoUrl('');
                        }
                      }}
                      isSubmitting={isSubmitting}
                      isUpdate={!!userFeedback}
                      submitLabel={userFeedback ? t.routeSheet.update : t.routeSheet.send}
                      starLabel={t.feedback.howMuchEnjoy}
                      gradeLabel={t.feedback.whatGradeThink}
                      commentLabel={t.feedback.wantToAddComment}
                    />
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>
            
            {!user && (
              <Text style={styles.loginHint}>{t.feedback.mustLogin}</Text>
            )}
          </View>

          {/* Secondary Actions Section */}
          <View style={styles.actionsSection}>
            <View style={styles.secondaryActions}>
              <TouchableOpacity 
                style={styles.secondaryAction} 
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Text style={styles.actionEmoji}>📤</Text>
                <Text style={styles.secondaryActionText}>{t.routeSheet.share}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.secondaryAction, styles.reportAction]} 
                onPress={handleReport}
                activeOpacity={0.7}
              >
                <Text style={styles.actionEmoji}>🚩</Text>
                <Text style={styles.reportActionText}>{t.routeSheet.report}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </Modal>
  );
});

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerWrapper: {
    position: 'relative',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 18,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  colorBubble: {
    width: 85,
    height: 85,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
    marginBottom: 16,
  },
  gradeInBubble: {
    fontSize: 26,
    fontWeight: '800',
  },
  routeName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  statEmoji: {
    fontSize: 26,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  detailsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
    marginStart: 4,
  },
  detailsCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 18,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  detailIcon: {
    fontSize: 18,
    marginEnd: 14,
    width: 26,
    textAlign: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.border,
  },
  tagsSection: {
    marginTop: 18,
  },
  tagsLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '500',
  },
  ratingSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  ratingCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 14,
  },
  starButton: {
    padding: 6,
  },
  starText: {
    fontSize: 36,
    color: theme.border,
  },
  filledStar: {
    color: theme.starColor,
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 18,
    gap: 10,
  },
  primaryAction: {
    backgroundColor: theme.success,
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionEmoji: {
    fontSize: 22,
  },
  primaryActionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  reportAction: {
    backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
  },
  reportActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.error,
  },
  bottomSpacer: {
    height: 40,
  },
  // New styles for community indicator and completed badge
  communityIndicator: {
    fontSize: 12,
    position: 'absolute',
    bottom: -5,
    right: -5,
  },
  completedBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  completedBadgeText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
  },
  // Community rating styles
  communityRatingSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  communityRatingCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  communityStars: {
    flexDirection: 'row',
    gap: 4,
  },
  communityStarText: {
    fontSize: 20,
    color: theme.border,
  },
  communityRatingText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  // Sent section styles
  sentSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sentButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  sentButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  // Existing feedback card
  existingFeedbackCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 18,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  feedbackCommentRow: {
    paddingVertical: 12,
  },
  feedbackLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginEnd: 12,
    minWidth: 80,
  },
  feedbackValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  feedbackStars: {
    flexDirection: 'row',
    gap: 4,
  },
  feedbackStarText: {
    fontSize: 18,
    color: theme.border,
  },
  feedbackComment: {
    fontSize: 14,
    color: theme.text,
    marginTop: 4,
    lineHeight: 20,
  },
  feedbackActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  editFeedbackButton: {
    alignSelf: 'flex-end',
  },
  editFeedbackText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
  },
  undoFeedbackButton: {
    alignSelf: 'flex-end',
  },
  undoFeedbackText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  // Feedback form Modal styles
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
    paddingBottom: 24,
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
    marginBottom: 16,
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
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackModalCloseText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  feedbackModalScroll: {
    flexGrow: 0,
  },
  feedbackModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  feedbackFormCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  gradeScroller: {
    flexGrow: 0,
  },
  gradeHint: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  gradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.card,
    marginEnd: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradeOptionSelected: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  gradeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  gradeOptionTextSelected: {
    color: theme.primary,
  },
  commentInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.card,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  loginHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default RouteBottomSheet;
