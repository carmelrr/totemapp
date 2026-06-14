/**
 * @fileoverview Staff push token registration
 * @description Registers the device's native FCM/APNs token for staff users and
 *  saves it via the saveFcmToken Cloud Function. Called when a worker/manager
 *  enters the staff (Shifts) area — regular climbers never trigger this.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Foreground notifications: show a banner. Keys cover both old/new expo-notifications shapes.
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }) as any,
});

let registered = false;

/** Idempotent per session. Requests permission, gets the native push token, saves it. */
export async function registerStaffPushToken(): Promise<void> {
  try {
    if (registered) return;
    if (!Device.isDevice) return; // push doesn't work on simulators

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'התראות',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResp = await Notifications.getDevicePushTokenAsync(); // native FCM (Android) / APNs (iOS)
    const token = tokenResp && (tokenResp.data as string);
    if (!token) return;

    const save = httpsCallable(getFunctions(getApp()), 'saveFcmToken');
    await save({ token });
    registered = true;
  } catch (e: any) {
    console.warn('registerStaffPushToken failed:', e?.message || e);
  }
}
