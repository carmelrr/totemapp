// services/holdDetectionService.js
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';

/**
 * יוצר גריד של נקודות אחיזה אפשריות עבור תמונת קיר ספריי
 * @param {string} sprayWallId - מזהה קיר הספריי
 * @param {number} imageWidth - רוחב התמונה
 * @param {number} imageHeight - גובה התמונה
 */
export const generateHoldGrid = async (sprayWallId, imageWidth, imageHeight) => {
  try {
    console.log('Generating hold grid for spray wall:', sprayWallId);
    
    // הגדרות הגריד - ניתן לכוונן
    const GRID_DENSITY = 20; // מרחק בין נקודות (פיקסלים)
    const MARGIN_PERCENT = 0.1; // שוליים של 10% מכל צד
    
    const marginX = imageWidth * MARGIN_PERCENT;
    const marginY = imageHeight * MARGIN_PERCENT;
    
    const startX = marginX;
    const endX = imageWidth - marginX;
    const startY = marginY;
    const endY = imageHeight - marginY;
    
    const holdPositions = [];
    let holdIndex = 0;
    
    // יצירת גריד של נקודות
    for (let y = startY; y < endY; y += GRID_DENSITY) {
      for (let x = startX; x < endX; x += GRID_DENSITY) {
        // המרה לקואורדינטות יחסיות (0-1)
        const relativeX = x / imageWidth;
        const relativeY = y / imageHeight;
        
        // הוספת רעש קל כדי שהגריד לא יראה מכני
        const noiseX = (Math.random() - 0.5) * 0.02; // רעש של ±1%
        const noiseY = (Math.random() - 0.5) * 0.02;
        
        holdPositions.push({
          id: `auto_hold_${holdIndex}`,
          x: Math.max(0, Math.min(1, relativeX + noiseX)),
          y: Math.max(0, Math.min(1, relativeY + noiseY)),
          type: 'available', // סוג מיוחד לאחיזות זמינות
          confidence: calculateConfidence(relativeX, relativeY), // רמת ביטחון בהתבסס על מיקום
          generated: true,
          createdAt: serverTimestamp()
        });
        
        holdIndex++;
      }
    }
    
    console.log(`Generated ${holdPositions.length} potential hold positions`);
    
    // שמירה ב-Firestore
    const holdGridRef = doc(db, 'sprayWalls', sprayWallId, 'holdGrid', 'positions');
    await setDoc(holdGridRef, {
      positions: holdPositions,
      imageWidth,
      imageHeight,
      gridDensity: GRID_DENSITY,
      marginPercent: MARGIN_PERCENT,
      generatedAt: serverTimestamp(),
      version: 1
    });
    
    console.log('Hold grid saved to Firestore');
    return holdPositions;
    
  } catch (error) {
    console.error('Error generating hold grid:', error);
    throw error;
  }
};

/**
 * מחשב רמת ביטחון לאחיזה בהתבסס על המיקום
 * @param {number} relativeX - X יחסי (0-1)
 * @param {number} relativeY - Y יחסי (0-1)
 * @returns {number} רמת ביטחון (0-1)
 */
const calculateConfidence = (relativeX, relativeY) => {
  // אחיזות במרכז התמונה נחשבות יותר אמינות
  const centerX = 0.5;
  const centerY = 0.5;
  
  const distanceFromCenter = Math.sqrt(
    Math.pow(relativeX - centerX, 2) + Math.pow(relativeY - centerY, 2)
  );
  
  // רמת ביטחון גבוהה יותר ככל שקרוב למרכז
  const maxDistance = Math.sqrt(0.5); // מרחק מקסימלי מהמרכז
  let confidence = 1 - (distanceFromCenter / maxDistance);
  
  // בונוס לגובה בינוני (לא גבוה מדי, לא נמוך מדי)
  if (relativeY > 0.2 && relativeY < 0.8) {
    confidence *= 1.2;
  }
  
  // בונוס לרוחב בינוני
  if (relativeX > 0.2 && relativeX < 0.8) {
    confidence *= 1.1;
  }
  
  return Math.max(0.1, Math.min(1, confidence));
};

/**
 * מביא את גריד האחיזות הזמינות עבור קיר ספריי
 * @param {string} sprayWallId - מזהה קיר הספריי
 */
export const getAvailableHolds = async (sprayWallId) => {
  try {
    const holdGridRef = doc(db, 'sprayWalls', sprayWallId, 'holdGrid', 'positions');
    const docSnap = await getDoc(holdGridRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.positions || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error getting available holds:', error);
    return [];
  }
};

/**
 * מוצא את האחיזה הקרובה ביותר לנקודה שנלחצה
 * @param {number} tapX - X של הלחיצה (יחסי 0-1)
 * @param {number} tapY - Y של הלחיצה (יחסי 0-1)
 * @param {Array} availableHolds - רשימת אחיזות זמינות
 * @param {number} maxDistance - מרחק מקסימלי לחיפוש (ברירת מחדל 0.05)
 */
export const findNearestHold = (tapX, tapY, availableHolds, maxDistance = 0.05) => {
  let nearestHold = null;
  let minDistance = maxDistance;
  
  for (const hold of availableHolds) {
    const distance = Math.sqrt(
      Math.pow(hold.x - tapX, 2) + Math.pow(hold.y - tapY, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestHold = hold;
    }
  }
  
  return nearestHold;
};
