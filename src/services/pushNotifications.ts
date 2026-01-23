/**
 * Push Notifications Service
 * שירות התראות Push באמצעות Expo Notifications + Firebase Cloud Messaging
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { db, auth } from '@/features/data/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

// ===== CONFIGURATION =====

// הגדרת התנהגות ההתראות כשהאפליקציה פתוחה
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ===== TYPES =====

export interface PushNotificationState {
  token: string | null;
  isEnabled: boolean;
  error: string | null;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

// ===== MAIN FUNCTIONS =====

/**
 * בקשת הרשאות ורישום להתראות
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // בדיקה שזה מכשיר אמיתי (לא סימולטור)
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // בדיקת הרשאות קיימות
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // בקשת הרשאות אם לא קיימות
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission for push notifications was denied');
      return null;
    }

    // קבלת ה-token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id', // תחליף ב-projectId שלך מ-app.json
    });
    
    const token = tokenData.data;
    console.log('Push token:', token);

    // הגדרות ספציפיות לאנדרואיד
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });

      // ערוץ למסלולים חדשים
      await Notifications.setNotificationChannelAsync('routes', {
        name: 'מסלולים חדשים',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'התראות על מסלולים חדשים',
      });

      // ערוץ לתחרויות
      await Notifications.setNotificationChannelAsync('competitions', {
        name: 'תחרויות',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'התראות על תחרויות',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * שמירת ה-token ב-Firebase לשליחת התראות מהשרת
 */
export async function savePushToken(token: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in, cannot save push token');
    return;
  }

  try {
    await setDoc(
      doc(db, 'userPushTokens', user.uid),
      {
        token,
        platform: Platform.OS,
        updatedAt: new Date(),
        userId: user.uid,
      },
      { merge: true }
    );
    console.log('Push token saved to Firebase');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * הסרת ה-token (כשמתנתקים)
 */
export async function removePushToken(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await deleteDoc(doc(db, 'userPushTokens', user.uid));
    console.log('Push token removed from Firebase');
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

/**
 * שליחת התראה מקומית (לבדיקות)
 */
export async function sendLocalNotification(notification: NotificationPayload): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    },
    trigger: null, // מיידי
  });
}

/**
 * ביטול כל ההתראות המתוזמנות
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * האזנה להתראות
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * האזנה ללחיצה על התראה
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// ===== HOOK FOR EASY USE =====

import { useState, useEffect, useRef } from 'react';

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // רישום להתראות
    registerForPushNotifications().then((pushToken) => {
      if (pushToken) {
        setToken(pushToken);
        savePushToken(pushToken);
      }
    });

    // האזנה להתראות נכנסות
    notificationListener.current = addNotificationReceivedListener((notif) => {
      setNotification(notif);
    });

    // האזנה ללחיצות על התראות
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      // כאן אפשר לנווט למסך ספציפי לפי ה-data
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return {
    token,
    notification,
    sendLocalNotification,
  };
}

// ===== NOTIFICATION TEMPLATES =====

export const NotificationTemplates = {
  newRoute: (routeName: string, grade: string) => ({
    title: '🧗 מסלול חדש!',
    body: `מסלול ${grade} חדש נוסף: ${routeName}`,
    data: { type: 'new_route' },
  }),
  
  competitionStarting: (competitionName: string, time: string) => ({
    title: '🏆 תחרות מתחילה בקרוב!',
    body: `${competitionName} מתחילה ב-${time}`,
    data: { type: 'competition' },
  }),
  
  feedbackReceived: (routeName: string) => ({
    title: '⭐ פידבק חדש!',
    body: `מישהו הגיב על המסלול שלך: ${routeName}`,
    data: { type: 'feedback' },
  }),
  
  followerAdded: (followerName: string) => ({
    title: '👋 עוקב חדש!',
    body: `${followerName} התחיל לעקוב אחריך`,
    data: { type: 'follower' },
  }),
  
  maintenance: (message: string) => ({
    title: '🔧 הודעת מערכת',
    body: message,
    data: { type: 'maintenance' },
  }),
};
