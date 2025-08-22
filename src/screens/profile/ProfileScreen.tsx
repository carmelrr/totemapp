import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Button, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  Switch, 
  ScrollView, 
  RefreshControl, 
  Dimensions, 
  Modal, 
  FlatList, 
  Animated 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { signOut, updateProfile } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { auth, db, storage } from '@/features/data/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { 
  subscribeToRoutes, 
  updateUserProfile, 
  getUserProfile, 
  migrateFeedbacksWithDisplayName 
} from '@/features/routes/routesService';
import { 
  searchUsers, 
  followUser, 
  unfollowUser, 
  getUserFollowers, 
  getUserFollowing
} from '@/features/social/socialService';
import { useUser } from '@/features/auth/UserContext';
import { useTheme } from '@/features/theme/ThemeContext';
import defaultAvatar from '@/assets/'default-avatar.png';

const { width: screenWidth } = Dimensions.get('window');

export default function ProfileScreen() {
  const navigation = useNavigation();
  const user = auth.currentUser;
  const { circleSize, setCircleSize } = useUser();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState({
    totalRoutesSent: 0,
    highestGrade: 'N/A',
    totalFeedbacks: 0,
    averageStarRating: 0,
    joinDate: null
  });
  const [gradeStats, setGradeStats] = useState({});
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [allRoutes, setAllRoutes] = useState([]);
  const [privacySettings, setPrivacySettings] = useState({
    showTotalRoutes: true,
    showHighestGrade: true,
    showFeedbackCount: true,
    showAverageRating: true,
    showGradeStats: true,
    showJoinDate: true
  });
  const [privacyEditText] = useState(false);
  const adminModeRef = useRef(false);
  
  // Sliding panel animation
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  
  // Social features state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [socialActiveTab, setSocialActiveTab] = useState('search'); // 'search', 'followers', 'following'
  const [isEditingPrivacy, setIsEditingPrivacy] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);

  // Refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
      await fetchUserStats();
      await calculateGradeStats();
      setRefreshing(false);
    } catch (error) {
      setRefreshing(false);
      Alert.alert('שגיאה', 'נכשל ברענון הנתונים');
    }
  };

  // Load extra profile info from Firestore
  const fetchProfile = async () => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.displayName) setDisplayName(data.displayName);
      if (data.photoURL) setPhotoURL(data.photoURL);
      if (typeof data.isAdmin === 'boolean') setIsAdmin(data.isAdmin);
      // Load privacy settings
      if (data.privacySettings) {
        setPrivacySettings({ ...privacySettings, ...data.privacySettings });
      }
    }
  };

  // Fetch user statistics from user profile (persistent stats)
  const fetchUserStats = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Use persistent stats if available, otherwise use defaults
        const persistentStats = userData.stats || {};
        
        setUserStats({
          totalRoutesSent: persistentStats.totalRoutesSent || 0,
          highestGrade: persistentStats.highestGrade || 'N/A',
          totalFeedbacks: persistentStats.totalFeedbacks || 0,
          averageStarRating: persistentStats.averageStarRating || 0,
          joinDate: userData.createdAt 
            ? new Date(userData.createdAt.seconds * 1000)
            : new Date(user.metadata.creationTime)
        });
      } else {
        // Initialize user stats if document doesn't exist
        await initializeUserStats();
      }
      
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Calculate grade statistics (percentage completion by grade)
  const calculateGradeStats = async () => {
    if (!user) return;
    
    try {
      // Get all routes
      const routesSnapshot = await getDocs(collection(db, 'routes'));
      const routes = [];
      routesSnapshot.forEach(doc => {
        routes.push({ id: doc.id, ...doc.data() });
      });
      
      setAllRoutes(routes);
      
      // Count routes by grade
      const routesByGrade = {};
      routes.forEach(route => {
        const grade = route.grade || 'לא מוגדר';
        routesByGrade[grade] = (routesByGrade[grade] || 0) + 1;
      });
      
      // Count completed routes by grade
      const completedByGrade = {};
      
      for (const route of routes) {
        const feedbacksRef = collection(db, 'routes', route.id, 'feedbacks');
        const userFeedbackQuery = query(feedbacksRef, where('userId', '==', user.uid), where('closedRoute', '==', true));
        const userFeedbackSnapshot = await getDocs(userFeedbackQuery);
        
        if (!userFeedbackSnapshot.empty) {
          const grade = route.grade || 'לא מוגדר';
          completedByGrade[grade] = (completedByGrade[grade] || 0) + 1;
        }
      }
      
      // Calculate percentages
      const stats = {};
      Object.keys(routesByGrade).forEach(grade => {
        const total = routesByGrade[grade];
        const completed = completedByGrade[grade] || 0;
        const percentage = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
        
        stats[grade] = {
          total,
          completed,
          percentage: parseFloat(percentage)
        };
      });
      
      setGradeStats(stats);
      
    } catch (error) {
      console.error('Error calculating grade stats:', error);
    }
  };

  // Initialize user stats by calculating from existing feedbacks (one-time)
  const initializeUserStats = async () => {
    if (!user) return;
    
    try {
      // Get all user feedbacks to calculate initial stats
      const feedbacksQuery = query(
        collection(db, 'routes'),
      );
      const routesSnapshot = await getDocs(feedbacksQuery);
      
      let totalRoutesSent = 0;
      let totalFeedbacks = 0;
      let starRatings = [];
      let grades = [];
      
      // Process each route
      for (const routeDoc of routesSnapshot.docs) {
        // Get feedbacks for this route
        const feedbacksRef = collection(db, 'routes', routeDoc.id, 'feedbacks');
        const userFeedbackQuery = query(feedbacksRef, where('userId', '==', user.uid));
        const userFeedbackSnapshot = await getDocs(userFeedbackQuery);
        
        userFeedbackSnapshot.forEach(feedbackDoc => {
          const feedback = feedbackDoc.data();
          totalFeedbacks++;
          
          if (feedback.closedRoute) {
            totalRoutesSent++;
          }
          
          if (feedback.starRating) {
            starRatings.push(feedback.starRating);
          }
          
          if (feedback.suggestedGrade) {
            grades.push(feedback.suggestedGrade);
          }
        });
      }
      
      // Calculate highest grade
      const gradeValues = {
        'V1': 1, 'V2': 2, 'V3': 3, 'V4': 4, 'V5': 5,
        'V6': 6, 'V7': 7, 'V8': 8, 'V9': 9, 'V10': 10
      };
      
      let highestGrade = 'N/A';
      if (grades.length > 0) {
        const sentGrades = grades.filter(grade => grade);
        if (sentGrades.length > 0) {
          highestGrade = sentGrades.reduce((highest, current) => {
            return (gradeValues[current] || 0) > (gradeValues[highest] || 0) ? current : highest;
          });
        }
      }
      
      // Calculate average star rating
      const averageStarRating = starRatings.length > 0 
        ? starRatings.reduce((sum, rating) => sum + rating, 0) / starRatings.length
        : 0;
      
      const joinDate = new Date(user.metadata.creationTime);
      
      const initialStats = {
        totalRoutesSent,
        highestGrade,
        totalFeedbacks,
        averageStarRating,
        joinDate
      };
      
      // Save initial stats to user document
      await setDoc(doc(db, 'users', user.uid), {
        stats: {
          totalRoutesSent,
          highestGrade,
          totalFeedbacks,
          averageStarRating
        },
        createdAt: user.metadata.creationTime
      }, { merge: true });
      
      setUserStats(initialStats);
      
    } catch (error) {
      console.error('Error initializing user stats:', error);
    }
  };

  // Load extra profile info from Firestore
  useEffect(() => {
    fetchProfile();
    fetchUserStats();
    calculateGradeStats();
    loadSocialData();
  }, [user]);

  // Social functions
  const loadSocialData = async () => {
    if (!user) return;
    
    try {
      const [followersData, followingData] = await Promise.all([
        getUserFollowers(user.uid),
        getUserFollowing(user.uid)
      ]);
      
      setFollowers(followersData);
      setFollowing(followingData);
    } catch (error) {
      console.error('Error loading social data:', error);
    }
  };

  const handleSearch = async (text) => {
    setSearchTerm(text);
    if (text.length > 1) {
      try {
        const results = await searchUsers(text);
        // Filter out current user
        const filteredResults = results.filter(u => u.id !== user.uid);
        setSearchResults(filteredResults);
      } catch (error) {
        console.error('Error searching users:', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleFollowToggle = async (userId, isFollowing) => {
    try {
      if (isFollowing) {
        await unfollowUser(user.uid, userId);
        setFollowing(prev => prev.filter(u => u.id !== userId));
      } else {
        await followUser(user.uid, userId);
        const userToAdd = searchResults.find(u => u.id === userId);
        if (userToAdd) {
          setFollowing(prev => [...prev, userToAdd]);
        }
      }
      
      // Refresh search results
      if (searchTerm.length > 1) {
        handleSearch(searchTerm);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בעדכון מעקב');
    }
  };

  const isUserFollowed = (userId) => {
    return following.some(u => u.id === userId);
  };

  const showUserProfile = (userToShow) => {
    navigation.navigate('UserProfile', { userId: userToShow.id });
  };

  // Side panel functions
  const toggleSidePanel = () => {
    if (showSidePanel) {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setShowSidePanel(false));
    } else {
      setShowSidePanel(true);
      Animated.timing(slideAnim, {
        toValue: screenWidth * 0.2,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // שמור את מצב האדמין ב-ref כדי לשמר אותו בין רינדורים ויציאות מהמסך
  useEffect(() => {
    // נסה לשחזר מה-storage המקומי
    const saved = global.__adminMode;
    if (saved !== undefined) {
      setAdminMode(!!saved);
      adminModeRef.current = !!saved;
    }
  }, []);

  useEffect(() => {
    // שמור את הערך הגלובלי בכל שינוי
    global.__adminMode = adminMode;
    adminModeRef.current = adminMode;
  }, [adminMode]);

  const pickImage = async () => {
    // אל תאפשר פתיחה כפולה
    if (loading) return;

    // בקש הרשאות גישה לגלריה לפני פתיחת בורר התמונות
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אין הרשאה', 'יש לאשר גישה לגלריה כדי לבחור תמונה');
        return;
      }
    }

    // נסה לפתוח את הבורר
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        // פתרון אוניברסלי: אל תעביר mediaTypes בכלל (ברירת מחדל היא תמונות בלבד)
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        uploadImage(uri);
      }
    } catch (e) {
      Alert.alert('שגיאה', 'אירעה שגיאה בפתיחת בורר התמונות');
    }
  };
  const uploadImage = async (uri) => {
    try {
      setLoading(true);
      
      // שמור את התמונה הישנה לפני ההעלאה החדשה
      const currentPhotoURL = photoURL;
      
      // יצירת שם קובץ ייחודי
      const fileName = `profile_${user.uid}_${Date.now()}.jpg`;
      const imageRef = ref(storage, `users/${user.uid}/profile/${fileName}`);
      
      // המרת URI לקובץ blob עבור Firebase Storage
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // העלאה לFirebase Storage
      console.log('Uploading image to Firebase Storage...');
      const snapshot = await uploadBytes(imageRef, blob);
      
      // קבלת URL להורדה
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Image uploaded successfully:', downloadURL);
      
      // עדכון המצב החדש
      setPhotoURL(downloadURL);
      await setDoc(doc(db, 'users', user.uid), { photoURL: downloadURL }, { merge: true });
      
      // מחיקת התמונה הישנה אם קיימת (רק אם זה Firebase Storage URL)
      if (currentPhotoURL && currentPhotoURL.includes('firebasestorage.googleapis.com')) {
        try {
          await deleteOldFirebaseImage(currentPhotoURL);
        } catch (deleteError) {
          console.warn('Failed to delete old profile image:', deleteError);
          // לא מעצירים את התהליך אם המחיקה נכשלה
        }
      }
      
      Alert.alert('הצלחה', 'תמונת הפרופיל עודכנה בהצלחה!');
    } catch (e) {
      console.error('Error uploading image:', e);
      Alert.alert('שגיאה', 'לא ניתן להעלות תמונה: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  // פונקציה למחיקת תמונה ישנה מFirebase Storage
  const deleteOldFirebaseImage = async (imageUrl) => {
    try {
      console.log('Deleting old image from Firebase Storage:', imageUrl);
      
      // חילוץ הנתיב מה-URL של Firebase Storage
      // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?alt=media&token=...
      const urlParts = imageUrl.split('/o/')[1].split('?')[0];
      const filePath = decodeURIComponent(urlParts);
      
      console.log('Extracted file path for deletion:', filePath);
      
      const imageRef = ref(storage, filePath);
      await deleteObject(imageRef);
      
      console.log('Old image deleted successfully from Firebase Storage');
    } catch (error) {
      console.error('Error deleting old image from Firebase Storage:', error);
      throw error;
    }
  };

  // פונקציה להסרת תמונת פרופיל
  const removeProfileImage = async () => {
    Alert.alert(
      'הסרת תמונת פרופיל',
      'האם אתה בטוח שברצונך להסיר את תמונת הפרופיל שלך?',
      [
        {
          text: 'ביטול',
          style: 'cancel'
        },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              const currentPhotoURL = photoURL;
              
              // עדכן לתמונת ברירת מחדל
              setPhotoURL(null);
              await setDoc(doc(db, 'users', user.uid), { photoURL: null }, { merge: true });
              
              // עדכן גם ב-Firebase Authentication
              await updateProfile(user, { photoURL: null });
              
              // מחק את התמונה מFirebase Storage
              if (currentPhotoURL && currentPhotoURL.includes('firebasestorage.googleapis.com')) {
                try {
                  await deleteOldFirebaseImage(currentPhotoURL);
                } catch (deleteError) {
                  console.warn('Failed to delete image from Firebase Storage:', deleteError);
                }
              }
              
              Alert.alert('הצלחה', 'תמונת הפרופיל הוסרה בהצלחה');
            } catch (error) {
              console.error('Error removing profile image:', error);
              Alert.alert('שגיאה', 'לא ניתן להסיר את תמונת הפרופיל');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Update Firebase Authentication profile
      await updateProfile(user, {
        displayName: displayName,
        photoURL: photoURL
      });
      
      // Update Firestore user document
      await setDoc(doc(db, 'users', user.uid), { displayName, photoURL }, { merge: true });
      
      // Auto-migrate existing feedbacks with new displayName
      try {
        await migrateFeedbacksWithDisplayName(user.uid);
      } catch (migrationError) {
        console.error('Migration failed but profile was saved:', migrationError);
      }
      
      setEditing(false);
      Alert.alert('הצלחה', 'הפרופיל עודכן');
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן פרופיל: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Save privacy settings to Firestore
  const savePrivacySettings = async (newSettings) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        privacySettings: newSettings
      }, { merge: true });
      setPrivacySettings(newSettings);
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור הגדרות פרטיות');
    }
  };

  // דוגמה ללחיצה על כפתור אדמין (כעת כ-switch)
  const handleAdminSwitch = (value) => {
    setAdminMode(value);
    if (value) {
      Alert.alert('מצב אדמין', 'מצב אדמין הופעל!');
      // כאן תוכל להפעיל לוגיקה/ניווט נוסף
    } else {
      Alert.alert('מצב אדמין', 'מצב אדמין בוטל!');
    }
  };

  // קבע מקור תמונה: אם יש photoURL השתמש בו, אחרת השתמש ב-defaultAvatar
  const avatarSource = photoURL && photoURL.trim() !== '' ? { uri: photoURL } : defaultAvatar;

  // Grade Statistics Modal Component
  const GradeStatsModal = () => {
    const sortedGrades = Object.keys(gradeStats).sort((a, b) => {
      const gradeOrder = { 'V1': 1, 'V2': 2, 'V3': 3, 'V4': 4, 'V5': 5, 'V6': 6, 'V7': 7, 'V8': 8, 'V9': 9, 'V10': 10 };
      return (gradeOrder[a] || 999) - (gradeOrder[b] || 999);
    });

    const totalRoutes = allRoutes.length;
    const totalCompleted = Object.values(gradeStats).reduce((sum, stat) => sum + stat.completed, 0);
    const overallPercentage = totalRoutes > 0 ? ((totalCompleted / totalRoutes) * 100).toFixed(1) : '0.0';

    return (
      <Modal
        visible={showStatsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📈 אחוזי סגירה לפי דירוג</Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.overallStatsContainer}>
            <Text style={styles.overallStatsText}>
              סיכום כללי: {totalCompleted} מתוך {totalRoutes} מסלולים ({overallPercentage}%)
            </Text>
          </View>

          <ScrollView style={styles.modalContent}>
            {sortedGrades.map(grade => {
              const stat = gradeStats[grade];
              const progressWidth = stat.percentage;
              
              return (
                <View key={grade} style={styles.gradeStatRow}>
                  <View style={styles.gradeStatHeader}>
                    <Text style={styles.gradeLabel}>{grade}</Text>
                    <Text style={styles.gradePercentage}>{stat.percentage}%</Text>
                  </View>
                  
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          width: `${progressWidth}%`,
                          backgroundColor: progressWidth === 100 ? '#28a745' : 
                                         progressWidth >= 75 ? '#ffc107' : 
                                         progressWidth >= 50 ? '#fd7e14' : 
                                         progressWidth >= 25 ? '#17a2b8' : '#dc3545'
                        }
                      ]} 
                    />
                  </View>
                  
                  <Text style={styles.gradeStatDetails}>
                    {stat.completed} מתוך {stat.total} מסלולים
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Statistics Cards Component
  const StatCard = ({ title, value, icon, color = '#007AFF', onPress = null, isVisible = true, settingKey = null }) => {
    return (
      <View style={[styles.statCard, { borderLeftColor: color }]}>
        <TouchableOpacity 
          style={styles.statContent}
          onPress={onPress}
          disabled={!onPress}
        >
          <Text style={styles.statIcon}>{icon}</Text>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{isVisible ? value : 'פרטי'}</Text>
            <Text style={styles.statTitle}>{title}</Text>
          </View>
          {onPress && (
            <Text style={styles.statArrow}>›</Text>
          )}
        </TouchableOpacity>
        
        {/* Privacy Toggle */}
        {isEditingPrivacy && settingKey && (
          <View style={styles.privacyToggleContainer}>
            <Text style={styles.privacyToggleLabel}>הצג לאחרים</Text>
            <Switch
              value={privacySettings[settingKey]}
              onValueChange={(value) => {
                const newSettings = { ...privacySettings, [settingKey]: value };
                savePrivacySettings(newSettings);
              }}
              trackColor={{ false: '#ccc', true: '#27ae60' }}
              thumbColor={privacySettings[settingKey] ? '#27ae60' : '#f4f3f4'}
              style={styles.privacySwitch}
            />
          </View>
        )}
      </View>
    );
  };

  // Stats Dashboard Component
  const StatsDashboard = () => {
    // Calculate overall completion percentage
    const totalRoutes = allRoutes.length;
    const totalCompleted = Object.values(gradeStats).reduce((sum, stat) => sum + stat.completed, 0);
    const overallPercentage = totalRoutes > 0 ? ((totalCompleted / totalRoutes) * 100).toFixed(1) : '0.0';

    return (
        <View style={styles.statsContainer}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>📊 הסטטיסטיקות שלי</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={[styles.editButton, isEditingPrivacy && styles.editButtonActive]}
                onPress={() => setIsEditingPrivacy(!isEditingPrivacy)}
              >
                <Text style={[styles.editButtonText, isEditingPrivacy && styles.editButtonTextActive]}>
                  {isEditingPrivacy ? '✓ סיום עריכה' : '⚙️ עריכה'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Privacy editing notification */}
          {isEditingPrivacy && (
            <View style={styles.privacyEditNotification}>
              <Text style={styles.privacyEditText}>
                🔧 מצב עריכת פרטיות פעיל - ערוך אילו נתונים יוצגו לאחרים
              </Text>
            </View>
          )}
          
          <View style={styles.statsGrid}>
          <StatCard 
            title="מסלולים שסגרתי"
            value={userStats.totalRoutesSent}
            icon="🎯"
            color="#28a745"
            isVisible={privacySettings.showTotalRoutes}
            settingKey="showTotalRoutes"
          />
          
          <StatCard 
            title="דירוג הכי גבוה"
            value={userStats.highestGrade}
            icon="🏆"
            color="#ffc107"
            isVisible={privacySettings.showHighestGrade}
            settingKey="showHighestGrade"
          />
          
          <StatCard 
            title="סה״כ פידבקים"
            value={userStats.totalFeedbacks}
            icon="💬"
            color="#17a2b8"
            isVisible={privacySettings.showFeedbackCount}
            settingKey="showFeedbackCount"
          />
          
          <StatCard 
            title="דירוג כוכבים ממוצע"
            value={userStats.averageStarRating.toFixed(1)}
            icon="⭐"
            color="#fd7e14"
            isVisible={privacySettings.showAverageRating}
            settingKey="showAverageRating"
          />
          
          <StatCard 
            title="אחוזי סגירה לכל הקיר"
            value={`${overallPercentage}%`}
            icon="📈"
            color="#8e44ad"
            onPress={privacySettings.showGradeStats ? () => setShowStatsModal(true) : null}
            isVisible={privacySettings.showGradeStats}
            settingKey="showGradeStats"
          />
        </View>
        
        {userStats.joinDate && (privacySettings.showJoinDate || isEditingPrivacy) && (
          <View style={styles.joinDateContainer}>
            <View style={styles.joinDateContent}>
              <Text style={styles.joinDateText}>
                🗓️ חבר מאז: {privacySettings.showJoinDate ? userStats.joinDate.toLocaleDateString('he-IL') : 'פרטי'}
              </Text>
              {isEditingPrivacy && (
                <View style={styles.joinDatePrivacy}>
                  <Text style={styles.privacyToggleLabel}>הצג לאחרים</Text>
                  <Switch
                    value={privacySettings.showJoinDate}
                    onValueChange={(value) => {
                      const newSettings = { ...privacySettings, showJoinDate: value };
                      savePrivacySettings(newSettings);
                    }}
                    trackColor={{ false: '#ccc', true: '#27ae60' }}
                    thumbColor={privacySettings.showJoinDate ? '#27ae60' : '#f4f3f4'}
                    style={styles.privacySwitch}
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  // Create styles based on current theme
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainContent}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#8e44ad']}
            tintColor='#8e44ad'
          />
        }
      >
        {/* Header with user name and menu button */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{displayName || 'משתמש'}</Text>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={toggleSidePanel}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Social Section */}
        <View style={styles.socialSection}>
          <Text style={styles.sectionTitle}>👥 רשת חברתית</Text>
          <View style={styles.socialTabs}>
            <TouchableOpacity 
              style={[styles.socialTab, socialActiveTab === 'search' && styles.activeSocialTab]}
              onPress={() => setSocialActiveTab('search')}
            >
              <Text style={[styles.socialTabText, socialActiveTab === 'search' && styles.activeSocialTabText]}>
                חיפוש
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.socialTab, socialActiveTab === 'following' && styles.activeSocialTab]}
              onPress={() => setSocialActiveTab('following')}
            >
              <Text style={[styles.socialTabText, socialActiveTab === 'following' && styles.activeSocialTabText]}>
                עוקב ({following.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.socialTab, socialActiveTab === 'followers' && styles.activeSocialTab]}
              onPress={() => setSocialActiveTab('followers')}
            >
              <Text style={[styles.socialTabText, socialActiveTab === 'followers' && styles.activeSocialTabText]}>
                עוקבים ({followers.length})
              </Text>
            </TouchableOpacity>
          </View>

          {socialActiveTab === 'search' && (
            <View style={styles.socialContent}>
              <TextInput
                style={styles.searchInput}
                placeholder="חפש משתמשים לפי שם..."
                value={searchTerm}
                onChangeText={handleSearch}
                textAlign="right"
              />
              {searchResults.length > 0 && (
                <View style={styles.userList}>
                  {searchResults.map((item) => (
                    <View key={item.id} style={styles.userItem}>
                      <TouchableOpacity 
                        style={styles.userInfo}
                        onPress={() => showUserProfile(item)}
                      >
                        <Image 
                          source={item.avatar ? { uri: item.avatar } : require('../assets/default-avatar.png')}
                          style={styles.socialAvatar}
                        />
                        <Text style={styles.userName}>{item.displayName || item.email}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.followButton, isUserFollowed(item.id) && styles.unfollowButton]}
                        onPress={() => handleFollowToggle(item.id, isUserFollowed(item.id))}
                      >
                        <Text style={[styles.followButtonText, isUserFollowed(item.id) && styles.unfollowButtonText]}>
                          {isUserFollowed(item.id) ? 'בטל מעקב' : 'עקוב'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}          {socialActiveTab === 'following' && (
            <View style={styles.socialContent}>
              <View style={styles.userList}>
                {following.map((item) => (
                  <View key={item.id} style={styles.userItem}>
                    <TouchableOpacity 
                      style={styles.userInfo}
                      onPress={() => showUserProfile(item)}
                    >
                      <Image 
                        source={item.avatar ? { uri: item.avatar } : require('../assets/default-avatar.png')}
                        style={styles.socialAvatar}
                      />
                      <Text style={styles.userName}>{item.displayName || item.email}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.unfollowButton}
                      onPress={() => handleFollowToggle(item.id, true)}
                    >
                      <Text style={styles.unfollowButtonText}>בטל מעקב</Text>
                    </TouchableOpacity>
                  </View>                ))}
              </View>
            </View>
          )}

          {socialActiveTab === 'followers' && (
            <View style={styles.socialContent}>
              <View style={styles.userList}>
                {followers.map((item) => (
                  <TouchableOpacity 
                    key={item.id}
                    style={styles.userItem}
                    onPress={() => showUserProfile(item)}
                  >
                    <View style={styles.userInfo}>
                      <Image 
                        source={item.avatar ? { uri: item.avatar } : require('../assets/default-avatar.png')}
                        style={styles.socialAvatar}
                      />
                      <Text style={styles.userName}>{item.displayName || item.email}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Stats Dashboard */}
        <StatsDashboard />
      </ScrollView>

      {/* Side Panel */}
      {showSidePanel && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={toggleSidePanel}
        />
      )}
      
      <Animated.View style={[styles.sidePanel, { left: slideAnim }]}>
        <ScrollView 
          style={styles.sidePanelContent}
          contentContainerStyle={styles.sidePanelScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Section */}
          <View style={styles.sidePanelHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={toggleSidePanel}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.sidePanelTitle}>הגדרות פרופיל</Text>
          </View>
          
          {/* Avatar and Profile Info */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} disabled={loading}>
              <Image source={avatarSource} style={styles.sideAvatar} />
              {loading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.avatarButtons}>
              <TouchableOpacity onPress={pickImage} disabled={loading}>
                <Text style={styles.editPhoto}>📸 ערוך תמונה</Text>
              </TouchableOpacity>
              {photoURL && (
                <TouchableOpacity onPress={removeProfileImage} disabled={loading}>
                  <Text style={styles.removePhoto}>🗑️ הסר תמונה</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Profile Edit */}
          <View style={styles.profileEditSection}>
            <Text style={styles.fieldLabel}>שם משתמש</Text>
            {editing ? (
              <TextInput
                style={styles.sideInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="שם משתמש"
              />
            ) : (
              <Text style={styles.fieldValue}>{displayName || 'שם משתמש'}</Text>
            )}
            
            <Text style={styles.fieldLabel}>אימייל</Text>
            <Text style={styles.fieldValue}>{email}</Text>
            
            <TouchableOpacity 
              style={editing ? styles.saveButton : styles.editButton} 
              onPress={editing ? handleSave : () => setEditing(true)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'שומר...' : editing ? '💾 שמור' : '✏️ ערוך פרופיל'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Circle Size Preferences */}
          <View style={styles.preferencesSection}>
            <Text style={styles.sectionTitle}>⚙️ העדפות תצוגה</Text>
            <Text style={styles.preferencesSubtitle}>גודל עיגולי המסלולים במפה</Text>
            
            <View style={styles.circleSizeColumn}>
              {[
                { size: 10, label: 'קטן' },
                { size: 15, label: 'בינוני' },
                { size: 20, label: 'גדול' },
                { size: 25, label: 'ענק' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.size}
                  style={[
                    styles.circleSizeRow,
                    circleSize === option.size && styles.circleSizeRowSelected
                  ]}
                  onPress={() => setCircleSize(option.size)}
                >
                  <View style={styles.circleSizeRowContent}>
                    <Text style={[
                      styles.circleSizeRowLabel,
                      circleSize === option.size && styles.circleSizeRowLabelSelected
                    ]}>
                      {option.label}
                    </Text>
                    <View style={[
                      styles.circleSizeRowPreview,
                      { 
                        width: option.size * 1.5, 
                        height: option.size * 1.5, 
                        borderRadius: option.size * 0.75,
                        backgroundColor: circleSize === option.size ? '#667eea' : '#bdc3c7'
                      }
                    ]}>
                      <Text style={[
                        styles.circleSizePreviewText,
                        { fontSize: Math.max(6, option.size * 0.4) }
                      ]}>V5</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Theme Preferences */}
          <View style={styles.preferencesSection}>
            <Text style={styles.sectionTitle}>🎨 ערכת צבעים</Text>
            <Text style={styles.preferencesSubtitle}>בחר בין מצב יום ומצב לילה</Text>
            
            <View style={styles.themeToggleContainer}>
              <View style={styles.themeOption}>
                <Text style={[
                  styles.themeOptionLabel,
                  !isDarkMode && styles.themeOptionLabelSelected
                ]}>
                  ☀️ מצב יום
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.themeToggle, isDarkMode && styles.themeToggleDark]}
                onPress={toggleTheme}
              >
                <View style={[
                  styles.themeToggleThumb,
                  isDarkMode && styles.themeToggleThumbDark
                ]} />
              </TouchableOpacity>
              
              <View style={styles.themeOption}>
                <Text style={[
                  styles.themeOptionLabel,
                  isDarkMode && styles.themeOptionLabelSelected
                ]}>
                  🌙 מצב לילה
                </Text>
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>🚪 התנתק</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
      
      {/* Grade Statistics Modal */}
      <GradeStatsModal />
    </View>
  );
}

// Create dynamic styles based on theme
const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  // Header styles
  header: {
    backgroundColor: theme.headerGradient,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'right',
    flex: 1,
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    marginLeft: 15,
  },
  menuIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Section styles
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
    textAlign: 'right',
  },
  // Social section
  socialSection: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginTop: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  socialTabs: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
  },
  socialTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
    minWidth: 0,
  },
  activeSocialTab: {
    backgroundColor: '#667eea',
  },
  socialTabText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
    numberOfLines: 1,
  },
  activeSocialTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  socialContent: {
    minHeight: 200,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'right',
    backgroundColor: '#f8f9fa',
  },
  userList: {
    maxHeight: 300,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  socialAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginLeft: 12,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  userName: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  followButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  unfollowButton: {
    backgroundColor: '#e74c3c',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  unfollowButtonText: {
    color: '#fff',
  },
  // Side panel styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  sidePanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: screenWidth * 0.8,
    backgroundColor: theme.surface,
    zIndex: 999,
    shadowColor: theme.shadow,
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 15,
  },
  sidePanelContent: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
  },
  sidePanelScrollContent: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  sidePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 20,
  },
  sidePanelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
    textAlign: 'right',
  },
  closeButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },  closeButtonText: {
    fontSize: 18,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  // Avatar section in side panel
  avatarSection: {
    alignItems: 'center',
    marginBottom: 25,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
  },
  sideAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
    borderWidth: 3,
    borderColor: '#667eea',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    marginTop: 10,
  },
  editPhoto: {
    color: '#667eea',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  removePhoto: {
    color: '#e74c3c',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  // Profile edit section
  profileEditSection: {
    marginBottom: 25,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
    textAlign: 'right',
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'right',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sideInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'right',
    backgroundColor: '#fff',
  },
  editButton: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Preferences section
  preferencesSection: {
    marginBottom: 25,
  },
  preferencesSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
    textAlign: 'right',
  },
  circleSizeColumn: {
    gap: 10,
  },
  circleSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circleSizeRowSelected: {
    backgroundColor: '#e8f4fd',
    borderColor: '#667eea',
  },
  circleSizeRowContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  circleSizeRowLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  circleSizeRowLabelSelected: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  circleSizeRowPreview: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  circleSizePreviewText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Statistics section
  statsSection: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    fontWeight: '600',
  },
  // Admin section
  adminSection: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 15,
    textAlign: 'right',
  },
  adminButtons: {
    gap: 10,
  },
  adminButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  adminButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  privacyButton: {
    backgroundColor: '#f39c12',
  },
  // Loading and empty states
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    padding: 30,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    padding: 20,
  },
  statsContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginTop: 0,
    marginBottom: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: (screenWidth - 60) / 2,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statTitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  statArrow: {
    fontSize: 20,
    color: '#8e44ad',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  joinDateContainer: {
    backgroundColor: '#e8f4f8',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  joinDateText: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'right',
    fontWeight: '500',
  },
  adminSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  adminSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'right',
  },
  adminSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  adminSwitchLabel: {
    fontSize: 16,
    marginRight: 12,
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'right',
  },
  adminButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  adminButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  preferencesSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  preferencesSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  preferencesSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
  },
  circleSizeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleSizeOption: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
    flex: 1,
    marginHorizontal: 4,
  },
  circleSizeOptionSelected: {
    backgroundColor: '#e8f5e8',
    borderColor: '#27ae60',
  },
  circleSizePreview: {
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  circleSizePreviewText: {
    color: 'white',
    fontWeight: 'bold',
  },
  circleSizeLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  circleSizeLabelSelected: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#8e44ad',
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  overallStatsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  overallStatsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'right',
  },
  gradeStatRow: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  gradeStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  gradePercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8e44ad',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  gradeStatDetails: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'right',
  },
  // New privacy-related styles
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8e44ad',
  },
  editButtonActive: {
    backgroundColor: '#8e44ad',
  },
  editButtonText: {
    color: '#8e44ad',
    fontSize: 12,
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: '#fff',
  },
  privacyToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  privacyToggleLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  privacySwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  joinDateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  joinDatePrivacy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyEditNotification: {
    backgroundColor: '#e8f5e8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#27ae60',
  },
  privacyEditText: {
    fontSize: 13,
    color: '#27ae60',
    fontWeight: '500',
    textAlign: 'right',
  },
  // Theme toggle styles
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
  },
  themeOptionLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  themeOptionLabelSelected: {
    color: theme.primary,
    fontWeight: 'bold',
  },
  themeToggle: {
    width: 60,
    height: 30,
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  themeToggleDark: {
    backgroundColor: theme.primary,
  },
  themeToggleThumb: {
    width: 26,
    height: 26,
    backgroundColor: '#fff',
    borderRadius: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    alignSelf: 'flex-start',
  },
  themeToggleThumbDark: {
    alignSelf: 'flex-end',
  },
});
