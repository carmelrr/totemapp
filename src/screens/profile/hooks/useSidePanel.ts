import { useState, useRef } from "react";
import { Animated, Dimensions } from "react-native";

const { width: screenWidth } = Dimensions.get("window");

export function useSidePanel() {
  const [showSidePanel, setShowSidePanel] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;

  const toggleSidePanel = () => {
    if (showSidePanel) {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setShowSidePanel(false));
    } else {
      setShowSidePanel(true);
      Animated.timing(slideAnim, {
        toValue: screenWidth * 0.2,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  return {
    showSidePanel,
    slideAnim,
    toggleSidePanel,
  };
}
