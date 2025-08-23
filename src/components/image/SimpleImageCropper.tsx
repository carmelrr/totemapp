// SimpleImageCropper.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  Image as RNImage,
  Platform,
} from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Image as ExpoImage } from "expo-image";

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

const { width: screenWidth } = Dimensions.get("window");

export default function SimpleImageCropper({ imageUri, onSave, onCancel }) {
  const [processing, setProcessing] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState(null);

  // נציג תמיד מסגרת 4:3
  const frameWidth = screenWidth - 24;
  const frameHeight = Math.floor((frameWidth * 3) / 4);

  // מצב התצוגה
  const [displayUri, setDisplayUri] = useState(null);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // shared values לעבודה ב־worklets
  const natW = useSharedValue(0);
  const natH = useSharedValue(0);
  const baseScale = useSharedValue(1); // התאמה למסגרת (cover)
  const scale = useSharedValue(1); // זום משתמש
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const ready = useSharedValue(false);

  const initFromSize = useCallback(
    (w, h) => {
      console.log("[Cropper] getSize ->", w, h);

      // התאמת תמונה כך שתכסה את המסגרת
      const s = Math.max(frameWidth / w, frameHeight / h);
      baseScale.value = s;
      scale.value = 1;

      // מרכז המסגרת
      const dispW = w * s;
      const dispH = h * s;
      tx.value = (frameWidth - dispW) / 2;
      ty.value = (frameHeight - dispH) / 2;

      natW.value = w;
      natH.value = h;

      setDisplayW(w);
      setDisplayH(h);
      setDisplayUri(imageUri);

      ready.value = true;
      setIsReady(true);
      setImageLoading(false);

      console.log("[Cropper] ready ->", true);
    },
    [
      frameWidth,
      frameHeight,
      baseScale,
      scale,
      tx,
      ty,
      natW,
      natH,
      ready,
      imageUri,
    ],
  );

  // מדידת תמונה (פשוט בלי downscale)
  useEffect(() => {
    if (!imageUri) return;
    setImageLoading(true);
    setError(null);
    setIsReady(false);
    ready.value = false;
    setDisplayUri(null);
    setDisplayW(0);
    setDisplayH(0);

    // ניסיון ראשון: getSize
    RNImage.getSize(
      imageUri,
      (w, h) => initFromSize(w, h),
      () => {
        console.warn("getSize failed, falling back to onLoad");
        // נמדוד דרך onLoad של תמונה נסתרת
        // השאר imageLoading=true כדי שה-RNImage הנסתר ירונדר וימדוד ב-onLoad
      },
    );
  }, [imageUri, initFromSize, ready]);

  // אם getSize נכשל – נמדוד ב־onLoad של תמונה נסתרת
  const handleHiddenLoad = (e) => {
    const src = e?.nativeEvent?.source;
    console.log("onLoad measured:", src?.width, src?.height);
    const w = src?.width;
    const h = src?.height;
    if (w && h && !natW.value) {
      initFromSize(w, h);
    }
  };

  // קלאמפ לתרגומים – רץ ב־UI thread ולכן משתמש רק ב־shared values
  const clampTranslations = () => {
    "worklet";
    if (!ready.value) return;
    const totalScale = baseScale.value * scale.value;
    const dispW = natW.value * totalScale;
    const dispH = natH.value * totalScale;

    const minX = frameWidth - dispW;
    const maxX = 0;
    const minY = frameHeight - dispH;
    const maxY = 0;

    if (tx.value < minX) tx.value = minX;
    if (tx.value > maxX) tx.value = maxX;
    if (ty.value < minY) ty.value = minY;
    if (ty.value > maxY) ty.value = maxY;
  };

  // מחוות
  const panGesture = Gesture.Pan().onChange((e) => {
    tx.value += e.changeX;
    ty.value += e.changeY;
    clampTranslations();
  });

  const pinchGesture = Gesture.Pinch()
    .onChange((e) => {
      const next = scale.value * e.scale;
      // זום כולל עד ~4x על בסיס baseScale
      scale.value = Math.min(4, Math.max(1, next));
      clampTranslations();
    })
    .onEnd(() => {
      clampTranslations();
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  // סגנון אנימטי – רק טרנספורם
  const animatedImageStyle = useAnimatedStyle(() => {
    if (!ready.value) return { opacity: 0 };
    const totalScale = baseScale.value * scale.value;
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { scale: totalScale },
      ],
    };
  });

  const handleSave = async () => {
    try {
      setProcessing(true);
      if (!imageUri || !natW.value || !natH.value)
        throw new Error("Image not ready");

      const totalScale = baseScale.value * scale.value;
      const originX = Math.max(0, -tx.value) / totalScale;
      const originY = Math.max(0, -ty.value) / totalScale;
      const width = frameWidth / totalScale;
      const height = frameHeight / totalScale;

      let cropData = {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(width),
        height: Math.round(height),
      };

      console.log("[Cropper] saving crop ->", cropData);

      let sourceUri = imageUri;

      // בלם זכרון: אם התמונה גדולה מדי, הקטן אותה קודם
      const maxSide = Math.max(natW.value, natH.value);
      if (maxSide > 6000) {
        const targetMaxSide = 4000;
        const ratio = targetMaxSide / maxSide;
        const newW = Math.round(natW.value * ratio);
        const newH = Math.round(natH.value * ratio);

        const resized = await manipulateAsync(
          imageUri,
          [{ resize: { width: newW, height: newH } }],
          { compress: 0.9, format: SaveFormat.JPEG },
        );

        sourceUri = resized.uri;

        // התאם את נתוני החיתוך ליחס החדש
        cropData = {
          originX: Math.round(cropData.originX * ratio),
          originY: Math.round(cropData.originY * ratio),
          width: Math.round(cropData.width * ratio),
          height: Math.round(cropData.height * ratio),
        };
      }

      // בצע את החיתוך וההקטנה הסופית
      const cropped = await manipulateAsync(
        sourceUri,
        [{ crop: cropData }, { resize: { width: 1200 } }],
        { compress: 0.8, format: SaveFormat.JPEG },
      );

      onSave({
        uri: cropped.uri,
        width: cropped.width,
        height: cropped.height,
        crop: cropData,
        aspect: "4:3",
      });
    } catch (e) {
      console.error("Error cropping image:", e);
      alert("שגיאה בחיתוך התמונה");
    } finally {
      setProcessing(false);
    }
  };

  // מסך טעינה ראשוני (לפני שנמדד משהו בכלל)
  if (imageLoading && !displayW && !isReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>טוען תמונה...</Text>
          </View>
          {!!imageUri && (
            <RNImage
              source={{ uri: imageUri }}
              style={{ width: 1, height: 1, opacity: 0, position: "absolute" }}
              onLoad={handleHiddenLoad}
              onError={(e) => {
                console.warn("Hidden image load error", e?.nativeEvent);
                setError("שגיאה בטעינת התמונה");
                setImageLoading(false);
              }}
            />
          )}
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.instructions}>
          גרור עם אצבע כדי להזיז, צבוט (פינץ') כדי לבצע זום. שמור לחיתוך 4:3.
        </Text>

        <View style={styles.imageContainer} collapsable={false}>
          <View
            style={[
              styles.cropFrame,
              { width: frameWidth, height: frameHeight },
            ]}
            collapsable={false}
          >
            {/* ספינר קטן בתוך המסגרת עד שהתמונה מוכנה */}
            {!isReady && (
              <View style={styles.inlineLoader}>
                <ActivityIndicator size="small" />
              </View>
            )}

            <GestureDetector gesture={composed}>
              <Animated.View
                style={StyleSheet.absoluteFill}
                pointerEvents="box-none"
              >
                {!!displayUri && isReady && displayW > 0 && (
                  <AnimatedExpoImage
                    source={{ uri: displayUri }}
                    style={[
                      { width: displayW, height: displayH },
                      animatedImageStyle,
                      { position: "absolute", left: 0, top: 0 },
                    ]}
                    contentFit="cover"
                    transition={100}
                    recyclingKey={displayUri}
                    onLoad={() => setIsReady(true)}
                    onError={(e) => {
                      console.warn("Image load error", e?.nativeEvent);
                      setError("שגיאה בטעינת התמונה");
                    }}
                  />
                )}
              </Animated.View>
            </GestureDetector>

            <View pointerEvents="none" style={styles.cropOverlay}>
              <Text style={styles.overlayText}>4:3</Text>
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>ביטול</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, processing && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={processing || !isReady}
          >
            <Text style={styles.saveButtonText}>
              {processing ? "חותך..." : "✓ שמור"}
            </Text>
          </TouchableOpacity>
        </View>

        {!!error && (
          <Text style={{ color: "tomato", marginTop: 8 }}>{error}</Text>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 16,
  },
  instructions: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 22,
    fontWeight: "600",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cropFrame: {
    backgroundColor: "#111",
    borderRadius: Platform.OS === "ios" ? 10 : 0,
    overflow: Platform.OS === "ios" ? "hidden" : "visible",
    position: "relative",
    borderWidth: 3,
    borderColor: "#00FFC2",
  },
  inlineLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  cropOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0, 255, 194, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overlayText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "bold",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    width: "100%",
    paddingVertical: 20,
  },
  cancelButton: {
    backgroundColor: "rgba(255, 0, 0, 0.7)",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
    flex: 1,
  },
  saveButton: {
    backgroundColor: "rgba(0, 200, 0, 0.7)",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
    flex: 1,
  },
  saveButtonDisabled: {
    backgroundColor: "rgba(128, 128, 128, 0.7)",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});
