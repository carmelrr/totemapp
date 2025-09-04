import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import RatingStars from '@/components/routes/RatingStars';
import FeedbackItem from '@/components/routes/FeedbackItem';
import FeedbackComposer from '@/components/routes/FeedbackComposer';
import { THEME_COLORS } from '@/constants/colors';
import { Route, Feedback, Rating } from '../../types/routes';
import { useAuth } from '@/context/AuthContext';
import { 
  getRouteRatings, 
  getUserRating, 
  submitRating, 
  getRouteFeedback, 
  submitFeedback 
} from '@/services/routes';

type RootStackParamList = {
  RouteDetails: {
    route: Route;
  };
};

type RouteDetailsScreenRouteProp = RouteProp<RootStackParamList, 'RouteDetails'>;
type RouteDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RouteDetailsScreen() {
  const route = useRoute<RouteDetailsScreenRouteProp>();
  const navigation = useNavigation<RouteDetailsScreenNavigationProp>();
  const { user } = useAuth();
  
  const routeData = route.params?.route;
  
  // Guard clause - אם אין routeId
  if (!routeData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>מסלול לא נמצא</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    loadRouteData();
  }, [routeData.id]);

  const loadRouteData = async () => {
    try {
      setLoading(true);
      
      // Load ratings and feedback in parallel
      const [ratingsData, feedbackData, userRatingData] = await Promise.all([
        getRouteRatings(routeData.id),
        getRouteFeedback(routeData.id),
        user ? getUserRating(routeData.id, user.uid) : Promise.resolve(null)
      ]);
      
      setRatings(ratingsData);
      setFeedback(feedbackData);
      setUserRating(userRatingData?.rating || 0);
    } catch (error) {
      console.error('Error loading route data:', error);
      Alert.alert('שגיאה', 'נכשל בטעינת נתוני המסלול');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    if (!user) {
      Alert.alert('נדרשת התחברות', 'התחבר כדי לדרג מסלולים');
      return;
    }

    try {
      await submitRating(routeData.id, user.uid, newRating);
      setUserRating(newRating);
      
      // Reload ratings to get updated average
      const updatedRatings = await getRouteRatings(routeData.id);
      setRatings(updatedRatings);
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('שגיאה', 'נכשל בשליחת הדירוג');
    }
  };

  const handleSubmitFeedback = async (text: string, rating?: number) => {
    if (!user) {
      Alert.alert('נדרשת התחברות', 'התחבר כדי לכתוב פידבק');
      return;
    }

    try {
      await submitFeedback(routeData.id, user.uid, text, rating);
      
      // Reload feedback to show new entry
      const updatedFeedback = await getRouteFeedback(routeData.id);
      setFeedback(updatedFeedback);
      
      setShowComposer(false);
      
      // If rating was included, update user rating
      if (rating !== undefined) {
        setUserRating(rating);
        const updatedRatings = await getRouteRatings(routeData.id);
        setRatings(updatedRatings);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error; // Let FeedbackComposer handle the error display
    }
  };

  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
    : 0;

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      'קל': '#22C55E',
      'בינוני': '#F59E0B',
      'קשה': '#EF4444',
      'מאתגר': '#7C3AED',
    };
    return colors[difficulty] || THEME_COLORS.text;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={THEME_COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.routeName}>{routeData.name}</Text>
          <Text style={styles.routeNumber}>מסלול #{routeData.number}</Text>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Route Info Card */}
        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <View style={[styles.routeMarker, { backgroundColor: routeData.color }]}>
              <Text style={styles.routeMarkerText}>{routeData.number}</Text>
            </View>
            
            <View style={styles.routeInfo}>
              <Text style={styles.routeNameLarge}>{routeData.name}</Text>
              <View style={styles.routeDetails}>
                <Text style={[styles.difficulty, { color: getDifficultyColor(routeData.difficulty) }]}>
                  {routeData.difficulty}
                </Text>
                {routeData.grade && (
                  <Text style={styles.grade}>• {routeData.grade}</Text>
                )}
              </View>
            </View>
          </View>

          {routeData.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>תיאור</Text>
              <Text style={styles.description}>{routeData.description}</Text>
            </View>
          )}
        </View>

        {/* Ratings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>דירוגים</Text>
            <View style={styles.ratingsSummary}>
              <RatingStars rating={averageRating} size="small" readonly />
              <Text style={styles.ratingsCount}>
                ({ratings.length} {ratings.length === 1 ? 'דירוג' : 'דירוגים'})
              </Text>
            </View>
          </View>

          {user && (
            <View style={styles.userRatingSection}>
              <Text style={styles.userRatingLabel}>הדירוג שלי:</Text>
              <RatingStars
                rating={userRating}
                onRatingChange={handleRatingChange}
                size="medium"
              />
            </View>
          )}
        </View>

        {/* Feedback Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>פידבק</Text>
            {user && (
              <TouchableOpacity
                style={styles.addFeedbackButton}
                onPress={() => setShowComposer(!showComposer)}
              >
                <Ionicons name="add" size={16} color={THEME_COLORS.primary} />
                <Text style={styles.addFeedbackText}>הוסף פידבק</Text>
              </TouchableOpacity>
            )}
          </View>

          {feedback.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={32} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>אין פידבק עדיין</Text>
              <Text style={styles.emptyStateSubtext}>
                היה הראשון לכתוב פידבק על המסלול
              </Text>
            </View>
          ) : (
            <View style={styles.feedbackList}>
              {feedback.map((item) => (
                <FeedbackItem key={item.id} feedback={item} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Feedback Composer */}
      {showComposer && (
        <FeedbackComposer
          onSubmit={handleSubmitFeedback}
          currentUserRating={userRating}
          showRating={userRating === 0} // Only show rating if user hasn't rated yet
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 32,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  routeNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  routeMarkerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeNameLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  routeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  difficulty: {
    fontSize: 16,
    fontWeight: '600',
  },
  grade: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  descriptionSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  ratingsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingsCount: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  userRatingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  userRatingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginRight: 12,
  },
  addFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
  },
  addFeedbackText: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  feedbackList: {
    gap: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
});
