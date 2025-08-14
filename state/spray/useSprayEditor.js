import { useState } from 'react';
import { normalizeHoldPosition, denormalizeHoldPosition } from '../../services/spray/validations';

export const useSprayEditor = () => {
  const [holds, setHolds] = useState([]);
  const [selectedHoldType, setSelectedHoldType] = useState('START');
  const [selectedHoldIndex, setSelectedHoldIndex] = useState(-1);
  const [tapes, setTapes] = useState({ start: 0, top: 0, feet: 0 });
  const [numbersEnabled, setNumbersEnabled] = useState(false);

  const addHold = (x, y, imageWidth, imageHeight, radius = 30) => {
    const normalizedHold = normalizeHoldPosition(x, y, radius, imageWidth, imageHeight);
    const newHold = {
      id: Date.now().toString(),
      type: selectedHoldType,
      ...normalizedHold
    };
    
    setHolds(prev => [...prev, newHold]);
    setSelectedHoldIndex(holds.length);
  };

  const updateHold = (index, updates, imageWidth, imageHeight) => {
    setHolds(prev => prev.map((hold, i) => {
      if (i === index) {
        if (updates.x !== undefined || updates.y !== undefined || updates.r !== undefined) {
          // Normalize position updates
          const normalized = normalizeHoldPosition(
            updates.x || denormalizeHoldPosition(hold, imageWidth, imageHeight).x,
            updates.y || denormalizeHoldPosition(hold, imageWidth, imageHeight).y,
            updates.r || denormalizeHoldPosition(hold, imageWidth, imageHeight).r,
            imageWidth,
            imageHeight
          );
          return { ...hold, ...normalized };
        }
        return { ...hold, ...updates };
      }
      return hold;
    }));
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
    confirmCurrentHold
  };
};
