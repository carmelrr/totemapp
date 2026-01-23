import { useState, useRef, useEffect, useCallback } from "react";
import { Animated, Dimensions } from "react-native";

const { width: screenWidth } = Dimensions.get("window");

export function useSidePanel() {
  const [showSidePanel, setShowSidePanel] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  // Track the current animation to stop it on unmount
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Cleanup animation on unmount to prevent memory leaks and touch issues
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []);

  const toggleSidePanel = useCallback(() => {
    // Stop any running animation before starting a new one
    if (animationRef.current) {
      animationRef.current.stop();
    }

    if (showSidePanel) {
      animationRef.current = Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: false,
      });
      animationRef.current.start(() => {
        setShowSidePanel(false);
        animationRef.current = null;
      });
    } else {
      setShowSidePanel(true);
      animationRef.current = Animated.timing(slideAnim, {
        toValue: screenWidth * 0.2,
        duration: 300,
        useNativeDriver: false,
      });
      animationRef.current.start(() => {
        animationRef.current = null;
      });
    }
  }, [showSidePanel, slideAnim]);

  return {
    showSidePanel,
    slideAnim,
    toggleSidePanel,
  };
}
