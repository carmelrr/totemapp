/**
 * TV Display constants.
 *
 * The wall-mounted TV runs the app in a dedicated read-only "TV mode" that
 * shows the climbing wall map with all live route grades. It is enabled at
 * build time via the EXPO_PUBLIC_TV_MODE env flag.
 */

/** Whether the app is running as the wall-mounted TV display. */
export const IS_TV_MODE = process.env.EXPO_PUBLIC_TV_MODE === '1';

/**
 * URL the QR code points to so gym visitors can download the app.
 * Override with EXPO_PUBLIC_TV_APP_URL; defaults to the Google Play listing.
 */
export const TV_APP_URL =
  process.env.EXPO_PUBLIC_TV_APP_URL ||
  'https://play.google.com/store/apps/details?id=com.totemapp.climbing';
