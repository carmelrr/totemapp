import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import { Route, Rating, Feedback, RouteCreateData, RouteUpdateData } from '@/types/routes';

// Routes collection operations
export const getRoutes = async (wallId: string): Promise<Route[]> => {
  try {
    const routesRef = collection(db, 'routes');
    const q = query(routesRef, where('wallId', '==', wallId), orderBy('number', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Route[];
  } catch (error) {
    console.error('Error fetching routes:', error);
    throw new Error('Failed to fetch routes');
  }
};

export const getRoute = async (routeId: string): Promise<Route | null> => {
  try {
    const routeRef = doc(db, 'routes', routeId);
    const snapshot = await getDoc(routeRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: snapshot.data().createdAt?.toDate() || new Date(),
    } as Route;
  } catch (error) {
    console.error('Error fetching route:', error);
    throw new Error('Failed to fetch route');
  }
};

export const createRoute = async (routeData: RouteCreateData): Promise<string> => {
  try {
    const routesRef = collection(db, 'routes');
    const docRef = await addDoc(routesRef, {
      ...routeData,
      createdAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating route:', error);
    throw new Error('Failed to create route');
  }
};

export const updateRoute = async (routeId: string, updates: RouteUpdateData): Promise<void> => {
  try {
    const routeRef = doc(db, 'routes', routeId);
    await updateDoc(routeRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating route:', error);
    throw new Error('Failed to update route');
  }
};

export const deleteRoute = async (routeId: string): Promise<void> => {
  try {
    const routeRef = doc(db, 'routes', routeId);
    await deleteDoc(routeRef);
  } catch (error) {
    console.error('Error deleting route:', error);
    throw new Error('Failed to delete route');
  }
};

// Ratings operations
export const getRouteRatings = async (routeId: string): Promise<Rating[]> => {
  try {
    const ratingsRef = collection(db, 'ratings');
    const q = query(ratingsRef, where('routeId', '==', routeId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Rating[];
  } catch (error) {
    console.error('Error fetching ratings:', error);
    throw new Error('Failed to fetch ratings');
  }
};

export const getUserRating = async (routeId: string, userId: string): Promise<Rating | null> => {
  try {
    const ratingsRef = collection(db, 'ratings');
    const q = query(ratingsRef, where('routeId', '==', routeId), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    } as Rating;
  } catch (error) {
    console.error('Error fetching user rating:', error);
    throw new Error('Failed to fetch user rating');
  }
};

export const submitRating = async (routeId: string, userId: string, rating: number): Promise<void> => {
  try {
    // Check if user already has a rating for this route
    const existingRating = await getUserRating(routeId, userId);
    
    if (existingRating) {
      // Update existing rating
      const ratingRef = doc(db, 'ratings', existingRating.id);
      await updateDoc(ratingRef, {
        rating,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new rating
      const ratingsRef = collection(db, 'ratings');
      await addDoc(ratingsRef, {
        routeId,
        userId,
        rating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error submitting rating:', error);
    throw new Error('Failed to submit rating');
  }
};

// Feedback operations
export const getRouteFeedback = async (routeId: string, limitCount: number = 50): Promise<Feedback[]> => {
  try {
    const feedbackRef = collection(db, 'feedback');
    const q = query(
      feedbackRef, 
      where('routeId', '==', routeId), 
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    // Get user data for each feedback
    const feedbackWithUsers = await Promise.all(
      snapshot.docs.map(async (feedbackDoc) => {
        const feedbackData = feedbackDoc.data();
        
        // Get user data
        let userData = { displayName: 'משתמש אנונימי', photoURL: undefined };
        try {
          const userRef = doc(db, 'users', feedbackData.userId);
          const userSnapshot = await getDoc(userRef);
          if (userSnapshot.exists()) {
            const user = userSnapshot.data();
            userData = {
              displayName: user.displayName || user.email || 'משתמש אנונימי',
              photoURL: user.photoURL,
            };
          }
        } catch (userError) {
          console.warn('Error fetching user data for feedback:', userError);
        }
        
        return {
          id: feedbackDoc.id,
          ...feedbackData,
          createdAt: feedbackData.createdAt?.toDate() || new Date(),
          updatedAt: feedbackData.updatedAt?.toDate() || new Date(),
          user: userData,
        } as Feedback;
      })
    );
    
    return feedbackWithUsers;
  } catch (error) {
    console.error('Error fetching feedback:', error);
    throw new Error('Failed to fetch feedback');
  }
};

export const submitFeedback = async (
  routeId: string, 
  userId: string, 
  text: string, 
  rating?: number
): Promise<void> => {
  try {
    const feedbackRef = collection(db, 'feedback');
    const feedbackData: any = {
      routeId,
      userId,
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    if (rating !== undefined) {
      feedbackData.rating = rating;
      
      // Also submit/update the rating separately
      await submitRating(routeId, userId, rating);
    }
    
    await addDoc(feedbackRef, feedbackData);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw new Error('Failed to submit feedback');
  }
};

export const deleteFeedback = async (feedbackId: string): Promise<void> => {
  try {
    const feedbackRef = doc(db, 'feedback', feedbackId);
    await deleteDoc(feedbackRef);
  } catch (error) {
    console.error('Error deleting feedback:', error);
    throw new Error('Failed to delete feedback');
  }
};
