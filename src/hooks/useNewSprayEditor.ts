// src/hooks/useNewSprayEditor.ts
import { useState, useCallback, useRef } from 'react';
import { useRouteStore } from '../features/routes/store';
import { useSprayWallStore } from '../features/spraywall/store';
import { CanvasTransform } from '../features/spraywall/transforms';
import { HoldRole, Hold } from '../features/routes/types';
import { HOLD_ROLE_CONFIG } from '../constants/roles';
import { validateHold } from '../features/routes/validators';

export interface UseNewSprayEditorOptions {
  canvasWidth: number;
  canvasHeight: number;
  imageWidth?: number;
  imageHeight?: number;
}

export const useNewSprayEditor = (options: UseNewSprayEditorOptions) => {
  const routeStore = useRouteStore();
  const wallStore = useSprayWallStore();
  
  const [selectedRole, setSelectedRole] = useState<HoldRole>('start');
  const [selectedTool, setSelectedTool] = useState<'circle' | 'dot' | 'volume' | 'outline'>('circle');
  const [isEditing, setIsEditing] = useState(false);
  
  const transformRef = useRef<CanvasTransform>(
    new CanvasTransform(options.canvasWidth, options.canvasHeight)
  );

  // עדכון גדלי קנבס ותמונה
  const updateCanvasSize = useCallback((width: number, height: number) => {
    transformRef.current.setCanvasSize(width, height);
  }, []);

  const updateImageSize = useCallback((width: number, height: number) => {
    transformRef.current.setImageSize(width, height);
  }, []);

  // הוספת אחיזה חדשה
  const addHold = useCallback((screenX: number, screenY: number) => {
    const canonicalPos = transformRef.current.screenToCanonical(screenX, screenY);
    
    // בדוק שהנקודה בטווח תקין
    if (canonicalPos.x < 0 || canonicalPos.x > 1 || canonicalPos.y < 0 || canonicalPos.y > 1) {
      console.warn('Hold position out of bounds:', canonicalPos);
      return;
    }

    const roleConfig = HOLD_ROLE_CONFIG[selectedRole];
    const newHold: Omit<Hold, 'id'> = {
      x: canonicalPos.x,
      y: canonicalPos.y,
      role: selectedRole,
      color: roleConfig.color,
      size: 0.02, // רדיוס בסיסי בקואורדינטות נורמליזציה
    };

    // ולידציה
    const validation = validateHold(newHold);
    if (!validation.isValid) {
      console.warn('Invalid hold:', validation.errors);
      return;
    }

    routeStore.addHold(newHold);
    
    // התחל עריכה של האחיזה החדשה
    const holds = routeStore.route.holds || [];
    routeStore.selectHold(holds.length); // האחיזה החדשה תהיה האחרונה
    setIsEditing(true);
  }, [selectedRole, routeStore]);

  // עדכון אחיזה קיימת
  const updateHold = useCallback((holdId: string, screenX: number, screenY: number, size?: number) => {
    const canonicalPos = transformRef.current.screenToCanonical(screenX, screenY);
    
    const updates: Partial<Hold> = {
      x: Math.max(0, Math.min(1, canonicalPos.x)),
      y: Math.max(0, Math.min(1, canonicalPos.y)),
    };

    if (size !== undefined) {
      updates.size = Math.max(0.005, Math.min(0.1, size));
    }

    routeStore.updateHold(holdId, updates);
  }, [routeStore]);

  // בחירת אחיזה קיימת
  const selectHold = useCallback((screenX: number, screenY: number) => {
    const holds = routeStore.route.holds || [];
    const hitHolds = transformRef.current.getHoldsAtPoint(screenX, screenY, holds);
    
    if (hitHolds.length > 0) {
      // אם יש כמה אחיזות, בחר את הקרובה ביותר
      const closestHold = hitHolds[0]; // פישוט - בחר את הראשונה
      const holdIndex = holds.findIndex(h => h.id === closestHold.id);
      
      routeStore.selectHold(holdIndex);
      setIsEditing(true);
      return closestHold;
    }
    
    return null;
  }, [routeStore]);

  // סיום עריכה
  const finishEditing = useCallback(() => {
    routeStore.deselectHold();
    setIsEditing(false);
  }, [routeStore]);

  // מחיקת אחיזה
  const removeSelectedHold = useCallback(() => {
    const selectedHold = getSelectedHold();
    if (selectedHold) {
      routeStore.removeHold(selectedHold.id);
      finishEditing();
    }
  }, [routeStore]);

  // קבלת אחיזה נבחרת
  const getSelectedHold = useCallback(() => {
    const holds = routeStore.route.holds || [];
    const selectedIndex = routeStore.selectedHoldIndex;
    return selectedIndex >= 0 && selectedIndex < holds.length ? holds[selectedIndex] : null;
  }, [routeStore.route.holds, routeStore.selectedHoldIndex]);

  // טיפול במגע על הקנבס
  const handleCanvasTouch = useCallback((screenX: number, screenY: number) => {
    switch (selectedTool) {
      case 'circle':
      case 'dot':
        // אם במצב עריכה, נסה לבחור אחיזה קיימת
        if (isEditing) {
          const selected = selectHold(screenX, screenY);
          if (!selected) {
            finishEditing(); // אם לא בחרנו כלום, סיים עריכה
          }
        } else {
          // אם לא במצב עריכה, הוסף אחיזה חדשה
          addHold(screenX, screenY);
        }
        break;
        
      case 'volume':
        // TODO: מימוש כלי נפח
        console.log('Volume tool not implemented yet');
        break;
        
      case 'outline':
        // TODO: מימוש כלי קו מתאר
        console.log('Outline tool not implemented yet');
        break;
    }
  }, [selectedTool, isEditing, selectHold, addHold, finishEditing]);

  // פעולות Pan/Zoom
  const pan = useCallback((deltaX: number, deltaY: number) => {
    transformRef.current.pan(deltaX, deltaY);
    // עדכן store אם נדרש
    wallStore.setTransform(transformRef.current.getTransform());
  }, [wallStore]);

  const zoom = useCallback((scaleFactor: number, focalX: number, focalY: number) => {
    transformRef.current.zoom(scaleFactor, focalX, focalY);
    wallStore.setTransform(transformRef.current.getTransform());
  }, [wallStore]);

  const resetTransform = useCallback(() => {
    transformRef.current.resetTransform();
    wallStore.setTransform(transformRef.current.getTransform());
  }, [wallStore]);

  // קבלת נתונים לרנדור
  const getHoldScreenPosition = useCallback((hold: Hold) => {
    return transformRef.current.canonicalToScreen(hold.x, hold.y);
  }, []);

  const getHoldScreenRadius = useCallback((hold: Hold) => {
    return transformRef.current.getScreenRadius(hold.size);
  }, []);

  const getCurrentTransform = useCallback(() => {
    return transformRef.current.getTransform();
  }, []);

  return {
    // מצב נוכחי
    selectedRole,
    selectedTool,
    isEditing,
    route: routeStore.route,
    selectedHoldIndex: routeStore.selectedHoldIndex,
    
    // פעולות עריכה
    setSelectedRole,
    setSelectedTool,
    handleCanvasTouch,
    updateHold,
    removeSelectedHold,
    finishEditing,
    getSelectedHold,
    
    // פעולות תצוגה
    pan,
    zoom,
    resetTransform,
    updateCanvasSize,
    updateImageSize,
    
    // עזרים לרנדור
    getHoldScreenPosition,
    getHoldScreenRadius,
    getCurrentTransform,
    
    // פעולות מסלול
    undo: routeStore.undo,
    redo: routeStore.redo,
    canUndo: routeStore.canUndo,
    canRedo: routeStore.canRedo,
    clearAllHolds: routeStore.clearAllHolds,
    validateRoute: routeStore.validate,
    
    // Stores
    routeStore,
    wallStore,
  };
};
