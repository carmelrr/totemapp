import { db, auth, storage } from '../firebase-config';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  onSnapshot,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

// Spray Wall Management
export async function createSprayWall(sprayWallData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Archive previous spray wall if exists
    await archivePreviousSprayWall();

    // Upload image to Firebase Storage
    const firebaseUrl = await uploadImageToFirebase(sprayWallData.imageUri);

    // Create new spray wall document with the Firebase Storage URL
    const wallData = {
      imageUrl: firebaseUrl,
      description: sprayWallData.description,
      width: sprayWallData.width,
      height: sprayWallData.height,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      isActive: true,
      season: generateSeasonName(),
    };

    const docRef = await addDoc(collection(db, 'sprayWalls'), wallData);
    
    return { id: docRef.id, ...wallData };
  } catch (error) {
    throw error;
  }
}

// Get spray wall with preset holds
export async function getSprayWallWithHolds(sprayWallId) {
  try {
    const docRef = doc(db, 'sprayWalls', sprayWallId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const wallData = { id: docSnap.id, ...docSnap.data() };
      console.log('Loaded spray wall with preset holds:', wallData.presetHolds?.length || 0);
      return wallData;
    } else {
      throw new Error('Spray wall not found');
    }
  } catch (error) {
    console.error('Error getting spray wall:', error);
    throw error;
  }
}

// Helper function to upload image to Firebase Storage
async function uploadImageToFirebase(imageUri) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Create unique filename
    const filename = `spray_wall_${user.uid}_${Date.now()}.jpg`;
    const imageRef = ref(storage, `sprayWalls/${filename}`);

    // Convert image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Upload to Firebase Storage
    await uploadBytes(imageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (error) {
    throw new Error(`Failed to upload image to Firebase: ${error.message}`);
  }
}

// Helper function to delete image from Firebase Storage
async function deleteImageFromFirebase(imageUrl) {
  try {
    if (!imageUrl || !imageUrl.includes('firebase')) {
      return; // Not a Firebase URL, skip deletion
    }
    
    // Extract file path from Firebase Storage URL
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.*?)\?/);
    if (pathMatch && pathMatch[1]) {
      const filePath = decodeURIComponent(pathMatch[1]);
      const imageRef = ref(storage, filePath);
      await deleteObject(imageRef);
    }
  } catch (error) {
    // Silently handle deletion errors - image might already be deleted
    console.warn('Failed to delete image from Firebase Storage:', error.message);
  }
}

export async function getCurrentSprayWall() {
  try {
    // Now using orderBy since we have the composite index
    const q = query(
      collection(db, 'sprayWalls'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    // Get the first (most recent) document
    const firstDoc = querySnapshot.docs[0];
    return { id: firstDoc.id, ...firstDoc.data() };
  } catch (error) {
    console.error('Error getting current spray wall:', error);
    throw error;
  }
}

async function archivePreviousSprayWall() {
  try {
    const currentWall = await getCurrentSprayWall();
    if (currentWall) {
      // Delete the old image from Firebase Storage before archiving
      if (currentWall.imageUrl) {
        await deleteImageFromFirebase(currentWall.imageUrl);
      }
      
      // Archive the wall
      await updateDoc(doc(db, 'sprayWalls', currentWall.id), {
        isActive: false,
        archivedAt: serverTimestamp(),
      });

      // Reset leaderboard for new season
      await resetLeaderboard();
      
      console.log('Previous spray wall archived successfully');
    }
  } catch (error) {
    console.error('Error archiving previous spray wall:', error);
    // Don't throw - allow the new wall to be created even if archiving fails
  }
}

async function resetLeaderboard() {
  // This function will be called when a new spray wall is created
  // The leaderboard is calculated dynamically, so no reset is needed
  console.log('New spray season started - leaderboard will be recalculated');
}

function generateSeasonName() {
  const now = new Date();
  const month = now.toLocaleDateString('he-IL', { month: 'long' });
  const year = now.getFullYear();
  return `${month} ${year}`;
}

// Spray Route Management
export async function createSprayRoute(routeData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const sprayRouteData = {
      ...routeData,
      createdBy: user.uid,
      creatorName: user.displayName || 'משתמש',
      creatorAvatar: user.photoURL,
      createdAt: serverTimestamp(),
      attempts: [],
      avgRating: 0,
      completionRate: 0,
    };

    const docRef = await addDoc(collection(db, 'sprayRoutes'), sprayRouteData);
    
    return { id: docRef.id, ...sprayRouteData };
  } catch (error) {
    console.error('Error creating spray route:', error);
    throw error;
  }
}

export async function getSprayWallRoutes(sprayWallId = null) {
  try {
    let q;
    
    if (sprayWallId) {
      // Using orderBy - may require composite index for sprayWallId + createdAt
      q = query(
        collection(db, 'sprayRoutes'),
        where('sprayWallId', '==', sprayWallId),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Get routes for current spray wall
      const currentWall = await getCurrentSprayWall();
      if (!currentWall) return [];
      
      q = query(
        collection(db, 'sprayRoutes'),
        where('sprayWallId', '==', currentWall.id),
        orderBy('createdAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const routes = [];

    querySnapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data() });
    });

    return routes;
  } catch (error) {
    console.error('Error getting spray routes:', error);
    throw error;
  }
}

export async function getSprayRoute(routeId) {
  try {
    const docRef = doc(db, 'sprayRoutes', routeId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error('Route not found');
    }
  } catch (error) {
    console.error('Error getting spray route:', error);
    throw error;
  }
}

// Attempt Management
export async function recordAttempt(routeId, attemptData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const attempt = {
      userId: user.uid,
      userName: user.displayName || 'משתמש',
      userAvatar: user.photoURL,
      ...attemptData,
      timestamp: serverTimestamp(),
    };

    const routeRef = doc(db, 'sprayRoutes', routeId);
    const routeDoc = await getDoc(routeRef);
    
    if (!routeDoc.exists()) {
      throw new Error('Route not found');
    }

    const routeData = routeDoc.data();
    const existingAttempts = routeData.attempts || [];
    
    // Check if user already has an attempt
    const existingAttemptIndex = existingAttempts.findIndex(
      att => att.userId === user.uid
    );

    let updatedAttempts;
    if (existingAttemptIndex !== -1) {
      // Update existing attempt
      updatedAttempts = [...existingAttempts];
      updatedAttempts[existingAttemptIndex] = attempt;
    } else {
      // Add new attempt
      updatedAttempts = [...existingAttempts, attempt];
    }

    // Calculate new stats
    const completions = updatedAttempts.filter(att => att.completed).length;
    const totalAttempts = updatedAttempts.length;
    const completionRate = totalAttempts > 0 ? (completions / totalAttempts) * 100 : 0;
    
    const ratings = updatedAttempts
      .filter(att => att.completed && att.rating)
      .map(att => att.rating);
    const avgRating = ratings.length > 0 ? 
      ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;

    // Update route document
    await updateDoc(routeRef, {
      attempts: updatedAttempts,
      completionRate: Math.round(completionRate),
      avgRating: Math.round(avgRating * 10) / 10,
    });

    return attempt;
  } catch (error) {
    console.error('Error recording attempt:', error);
    throw error;
  }
}

// Leaderboard
export async function getSprayWallLeaderboard(sprayWallId = null, timeframe = 'current') {
  try {
    let routes;
    
    if (timeframe === 'current') {
      routes = await getSprayWallRoutes(sprayWallId);
    } else {
      // Get all routes for all-time leaderboard - simple query without orderBy
      const q = query(collection(db, 'sprayRoutes'));
      const querySnapshot = await getDocs(q);
      const allRoutes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort by createdAt descending in memory
      routes = allRoutes.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
    }

    // Calculate user scores
    const userScores = {};

    routes.forEach(route => {
      route.attempts?.forEach(attempt => {
        if (attempt.completed) {
          const userId = attempt.userId;
          
          if (!userScores[userId]) {
            userScores[userId] = {
              userId,
              displayName: attempt.userName,
              avatar: attempt.userAvatar,
              completedRoutes: 0,
              totalPoints: 0,
              routes: [],
            };
          }

          const points = calculateRoutePoints(route.grade, route.isEndurance);
          userScores[userId].completedRoutes += 1;
          userScores[userId].totalPoints += points;
          userScores[userId].routes.push({
            routeId: route.id,
            routeName: route.name,
            grade: route.grade,
            points,
            completedAt: attempt.timestamp,
          });
        }
      });
    });

    // Convert to array and sort by total points
    const leaderboard = Object.values(userScores)
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return leaderboard;
  } catch (error) {
    console.error('Error getting spray wall leaderboard:', error);
    throw error;
  }
}

function calculateRoutePoints(grade, isEndurance = false) {
  let basePoints = 0;

  if (isEndurance) {
    // Points for endurance routes (French grades)
    const endurancePoints = {
      '6a': 15, '6a+': 18, '6b': 21, '6b+': 24,
      '6c': 27, '6c+': 30, '7a': 35, '7a+': 40,
      '7b': 45, '7b+': 50, '7c': 60, '7c+': 70,
    };
    basePoints = endurancePoints[grade] || 10;
  } else {
    // Points for boulder problems (V-scale)
    const vNumber = parseInt(grade.replace('V', ''));
    basePoints = Math.max(1, vNumber * 5 + 10); // V0=10, V1=15, V2=20, etc.
  }

  return basePoints;
}

// Subscribe to routes changes
export function subscribeToSprayRoutes(sprayWallId, callback) {
  let q;
  
  if (sprayWallId) {
    // Using orderBy - may require composite index for sprayWallId + createdAt
    q = query(
      collection(db, 'sprayRoutes'),
      where('sprayWallId', '==', sprayWallId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'sprayRoutes'),
      orderBy('createdAt', 'desc')
    );
  }

  return onSnapshot(q, (querySnapshot) => {
    const routes = [];
    querySnapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data() });
    });
    
    callback(routes);
  });
}

// Random route name generator
export function generateRandomRouteName() {
  const adjectives = [
    'אמיץ', 'חכם', 'מהיר', 'חזק', 'גמיש', 'נועז', 'יצירתי', 'מסתורי',
    'פרוע', 'שקט', 'עז', 'זהיר', 'מדהים', 'קסום', 'יפה', 'עצום'
  ];
  
  const nouns = [
    'נמר', 'נשר', 'דוב', 'זאב', 'פנתר', 'בז', 'אריה', 'נחש',
    'עכביש', 'יגואר', 'קוף', 'דרקון', 'חתול', 'כריש', 'נמלה', 'צפרדע'
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adjective} ${noun}`;
}
