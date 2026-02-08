import { useState, useRef, useEffect, useCallback } from "react";
import { Animated, Dimensions } from "react-native";

const { width: screenWidth } = Dimensions.get("window");
const panelWidth = screenWidth * 0.8; // 80% of screen width

export function useSidePanel() {
  const [showSidePanel, setShowSidePanel] = useState(false);
  // Start with panel off-screen to the right (negative value positions panel to the right of screen)
  const slideAnim = useRef(new Animated.Value(-panelWidth)).current;
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
      // Close: slide panel off to the right
      animationRef.current = Animated.timing(slideAnim, {
        toValue: -panelWidth,
        duration: 300,
        useNativeDriver: false,
      });
      animationRef.current.start(() => {
        setShowSidePanel(false);
        animationRef.current = null;
      });
    } else {
      // Open: slide panel in from the right (right: 0 means panel is at right edge of screen)
      setShowSidePanel(true);
      animationRef.current = Animated.timing(slideAnim, {
        toValue: 0,
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
