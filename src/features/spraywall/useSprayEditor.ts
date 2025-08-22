import { useState } from 'react';

// helper function for clamping values between 0 and 1
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const useSprayEditor = () => {
  const [holds, setHolds] = useState([]);
  const [selectedHoldType, setSelectedHoldType] = useState(null); // Start with no type selected
  const [selectedHoldIndex, setSelectedHoldIndex] = useState(-1);
  const [tapes, setTapes] = useState({ start: 0, top: 0, feet: 0 });
  const [numbersEnabled, setNumbersEnabled] = useState(false);

  // מצב עריכה
  const isEditing = selectedHoldIndex >= 0;
  
  const getSelectedHold = () => (isEditing ? holds[selectedHoldIndex] : null);

  const beginEditingHold = (index) => setSelectedHoldIndex(index);

  const addHold = (xPx, yPx, imageWidth, imageHeight) => {
    console.log('addHold called:', { xPx, yPx, imageWidth, imageHeight, selectedHoldType });
    
    const basePx = 24; // רדיוס התחלתי בפיקסלים
    const newHold = {
      id: Date.now().toString(),
      type: selectedHoldType,
      x: clamp01(xPx / imageWidth),
      y: clamp01(yPx / imageHeight),
      r: Math.max(0.01, basePx / Math.min(imageWidth, imageHeight)),
    };
    
    console.log('Creating new hold:', newHold);
    
    setHolds(prev => {
      const newHolds = [...prev, newHold];
      console.log('Updated holds array:', newHolds);
      // התחל עריכה של הטבעת החדשה
      setSelectedHoldIndex(newHolds.length - 1);
      return newHolds;
    });
    setSelectedHoldIndex(holds.length);
  };

  const updateHold = (index, { x, y, r }, imageWidth, imageHeight) => {
    console.log('updateHold called:', { index, x, y, r, imageWidth, imageHeight });
    
    setHolds(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        x: clamp01(x / imageWidth),
        y: clamp01(y / imageHeight),
        r: Math.max(0.005, r / Math.min(imageWidth, imageHeight)),
      };
      console.log('Updated hold:', next[index]);
      return next;
    });
  };

  const removeHold = (index) => {
    setHolds(prev => prev.filter((_, i) => i !== index));
    setSelectedHoldIndex(-1);
  };

  const clearHolds = () => {
    setHolds([]);
    setSelectedHoldIndex(-1);
  };

  const getHoldsByType = (type) => {
    return holds.filter(hold => hold.type === type);
  };

  const confirmCurrentHold = () => {
    setSelectedHoldIndex(-1);
  };

  return {
    holds,
    selectedHoldType,
    selectedHoldIndex,
    isEditing,
    tapes,
    numbersEnabled,
    setSelectedHoldType,
    setSelectedHoldIndex,
    setTapes,
    setNumbersEnabled,
    addHold,
    updateHold,
    removeHold,
    clearHolds,
    getHoldsByType,
    getSelectedHold,
    beginEditingHold,
    confirmCurrentHold
  };
};
