/**
 * @fileoverview Link Validation Utility - בדיקת אבטחה של לינקים לסרטונים
 * @description מוודא שלינקים שמשתמשים מעלים הם מפלטפורמות מוכרות ובטוחות
 */

import { Linking } from 'react-native';

/**
 * רשימת הדומיינים המותרים לשיתוף סרטונים
 */
const ALLOWED_VIDEO_DOMAINS = [
    // YouTube
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'm.youtube.com',
    
    // Instagram
    'instagram.com',
    'www.instagram.com',
    'instagr.am',
    
    // Facebook
    'facebook.com',
    'www.facebook.com',
    'fb.com',
    'fb.watch',
    'm.facebook.com',
    
    // TikTok
    'tiktok.com',
    'www.tiktok.com',
    'vm.tiktok.com',
    
    // Vimeo
    'vimeo.com',
    'www.vimeo.com',
    'player.vimeo.com',
    
    // Google Drive
    'drive.google.com',
    
    // Dropbox
    'dropbox.com',
    'www.dropbox.com',
    'dl.dropboxusercontent.com',
    
    // Streamable
    'streamable.com',
    
    // Twitch
    'twitch.tv',
    'www.twitch.tv',
    'clips.twitch.tv',
];

/**
 * דפוסים חשודים שעלולים להצביע על לינק זדוני
 */
const SUSPICIOUS_PATTERNS = [
    /javascript:/i,          // JavaScript injection
    /data:/i,                // Data URLs
    /<script/i,              // Script tags
    /on\w+=/i,               // Event handlers
    /&#/,                    // HTML entities
    /%3C/i,                  // Encoded < 
    /%3E/i,                  // Encoded >
    /\\.exe/i,               // Executable files
    /\\.bat/i,               // Batch files
    /\\.cmd/i,               // Command files
    /\\.msi/i,               // Installer files
    /\\.scr/i,               // Screen saver (often malware)
    /\\.vbs/i,               // VBScript
    /bit\\.ly/i,             // URL shorteners (can hide malicious links)
    /tinyurl/i,
    /goo\\.gl/i,
    /t\\.co/i,
];

export interface LinkValidationResult {
    isValid: boolean;
    isSecure: boolean;
    error?: string;
    errorKey?: string;  // Translation key for the error
    domain?: string;
    platform?: string;
}

/**
 * בדיקת פורמט URL בסיסי
 */
function isValidUrl(url: string): boolean {
    try {
        // React Native compatible URL validation
        const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
        if (!urlPattern.test(url)) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * חילוץ הדומיין מה-URL
 */
function extractDomain(url: string): string | null {
    try {
        // React Native compatible domain extraction
        const match = url.match(/^https?:\/\/([^\/\?\#]+)/i);
        if (match && match[1]) {
            return match[1].toLowerCase();
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * זיהוי הפלטפורמה מהדומיין
 */
function identifyPlatform(domain: string): string | null {
    if (domain.includes('youtube') || domain.includes('youtu.be')) return 'YouTube';
    if (domain.includes('instagram') || domain.includes('instagr.am')) return 'Instagram';
    if (domain.includes('facebook') || domain.includes('fb.')) return 'Facebook';
    if (domain.includes('tiktok')) return 'TikTok';
    if (domain.includes('vimeo')) return 'Vimeo';
    if (domain.includes('twitch')) return 'Twitch';
    if (domain.includes('drive.google')) return 'Google Drive';
    if (domain.includes('dropbox')) return 'Dropbox';
    if (domain.includes('streamable')) return 'Streamable';
    return null;
}

/**
 * בדיקה אם הדומיין נמצא ברשימה המותרת
 */
function isAllowedDomain(domain: string): boolean {
    return ALLOWED_VIDEO_DOMAINS.some(allowed => 
        domain === allowed || domain.endsWith('.' + allowed)
    );
}

/**
 * בדיקה אם ה-URL מכיל דפוסים חשודים
 */
function hasSuspiciousPatterns(url: string): boolean {
    return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * בדיקה מלאה של לינק לסרטון - פונקציה ראשית
 * @param url הלינק לבדיקה
 * @returns תוצאת הבדיקה עם כל הפרטים
 */
export function validateVideoLink(url: string): LinkValidationResult {
    // בדיקה שהשדה לא ריק
    if (!url || url.trim() === '') {
        return {
            isValid: false,
            isSecure: false,
            error: 'יש להזין לינק',
            errorKey: 'videoLink.errors.empty',
        };
    }

    const trimmedUrl = url.trim();

    // בדיקת פורמט URL בסיסי
    if (!isValidUrl(trimmedUrl)) {
        return {
            isValid: false,
            isSecure: false,
            error: 'פורמט לינק לא תקין. הלינק צריך להתחיל ב-http:// או https://',
            errorKey: 'videoLink.errors.invalidFormat',
        };
    }

    // בדיקת דפוסים חשודים
    if (hasSuspiciousPatterns(trimmedUrl)) {
        return {
            isValid: false,
            isSecure: false,
            error: 'הלינק מכיל תוכן חשוד ולא ניתן לשמור אותו',
            errorKey: 'videoLink.errors.suspicious',
        };
    }

    // חילוץ הדומיין
    const domain = extractDomain(trimmedUrl);
    if (!domain) {
        return {
            isValid: false,
            isSecure: false,
            error: 'לא הצלחנו לזהות את הדומיין',
            errorKey: 'videoLink.errors.invalidDomain',
        };
    }

    // בדיקה שהדומיין ברשימה המותרת
    if (!isAllowedDomain(domain)) {
        return {
            isValid: false,
            isSecure: false,
            error: 'ניתן לשתף רק לינקים מפלטפורמות מוכרות כמו YouTube, Instagram, Facebook, TikTok, Vimeo',
            errorKey: 'videoLink.errors.notAllowed',
            domain,
        };
    }

    // בדיקה אם זה HTTPS
    const isSecure = trimmedUrl.toLowerCase().startsWith('https://');
    const platform = identifyPlatform(domain);

    return {
        isValid: true,
        isSecure,
        domain,
        platform: platform || undefined,
    };
}

/**
 * פתיחת לינק בדפדפן החיצוני בצורה בטוחה
 */
export async function openVideoLink(url: string): Promise<boolean> {
    // וולידציה לפני פתיחה
    const validation = validateVideoLink(url);
    if (!validation.isValid) {
        console.warn('Attempted to open invalid video link:', url);
        return false;
    }

    try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error opening video link:', error);
        return false;
    }
}

/**
 * בדיקה מהירה אם הלינק נראה כמו לינק לסרטון
 * (לשימוש לפני שהמשתמש סיים להקליד)
 */
export function looksLikeVideoUrl(url: string): boolean {
    if (!url || url.length < 10) return false;
    
    const domain = extractDomain(url);
    if (!domain) return false;
    
    return isAllowedDomain(domain);
}

/**
 * קבלת אייקון הפלטפורמה לפי הלינק
 */
export function getPlatformIcon(url: string): string {
    const domain = extractDomain(url);
    if (!domain) return '🎬';
    
    const platform = identifyPlatform(domain);
    switch (platform) {
        case 'YouTube': return '▶️';
        case 'Instagram': return '📸';
        case 'Facebook': return '👤';
        case 'TikTok': return '🎵';
        case 'Vimeo': return '🎥';
        case 'Twitch': return '🎮';
        case 'Google Drive': return '📁';
        case 'Dropbox': return '📦';
        default: return '🎬';
    }
}

/**
 * רשימת הפלטפורמות המותרות לתצוגה למשתמש
 */
export const SUPPORTED_PLATFORMS = [
    { name: 'YouTube', icon: '▶️' },
    { name: 'Instagram', icon: '📸' },
    { name: 'Facebook', icon: '👤' },
    { name: 'TikTok', icon: '🎵' },
    { name: 'Vimeo', icon: '🎥' },
    { name: 'Twitch', icon: '🎮' },
];
