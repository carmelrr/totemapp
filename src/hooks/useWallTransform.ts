// hooks/useWallTransform.ts
import { useSharedValue, useDerivedValue, withTiming, runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

type Params = {
    minScale: number;   // 1 או מחושב דינמית - הגודל ההתחלתי והקטן ביותר
    maxScale: number;   // למשל 4
    viewW: number;      // רוחב תצוגה בפיקסלים
    viewH: number;      // גובה תצוגה
    imgW: number;       // רוחב התמונה/ה-SVG ביחידות הקואורדינטות שלה
    imgH: number;       // גובה התמונה
    onTransformChange?: (s: number, tx: number, ty: number) => void; // לאותת ל-React (debounced בחוץ)
};

export const useWallTransform = (p: Params) => {
    const { minScale, maxScale, viewW, viewH, imgW, imgH, onTransformChange } = p;

    const scale = useSharedValue(minScale);
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);

    // ערכי בסיס לגסטורות
    const baseScale = useSharedValue(minScale);
    const baseTx = useSharedValue(0);
    const baseTy = useSharedValue(0);

    const clamp = (v: number, lo: number, hi: number) => {
        'worklet';
        return Math.max(lo, Math.min(hi, v));
    };

    const clampPan = (s: number) => {
        'worklet';
        // גודל התמונה המוצגת במסך
        const scaledImgW = imgW * s;
        const scaledImgH = imgH * s;

        // גבולות פאן כך שלא נשאיר ריק בצדדים
        let minTx = 0;
        let maxTx = 0;
        let minTy = 0;
        let maxTy = 0;

        if (scaledImgW > viewW) {
            minTx = -(scaledImgW - viewW);
            maxTx = 0;
        }

        if (scaledImgH > viewH) {
            minTy = -(scaledImgH - viewH);
            maxTy = 0;
        }

        // אם התמונה קטנה מהמסך, נאפס לאמצע
        if (scaledImgW <= viewW) {
            tx.value = (viewW - scaledImgW) / 2;
        } else {
            tx.value = clamp(tx.value, minTx, maxTx);
        }

        if (scaledImgH <= viewH) {
            ty.value = (viewH - scaledImgH) / 2;
        } else {
            ty.value = clamp(ty.value, minTy, maxTy);
        }
    };

    const pinch = Gesture.Pinch()
        .onStart(() => {
            baseScale.value = scale.value;
            baseTx.value = tx.value;
            baseTy.value = ty.value;
        })
        .onUpdate((e) => {
            const newScale = clamp(baseScale.value * e.scale, minScale, maxScale);
            scale.value = newScale;
            clampPan(newScale);
        });

    const pan = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onStart(() => {
            baseTx.value = tx.value;
            baseTy.value = ty.value;
        })
        .onUpdate((e) => {
            tx.value = baseTx.value + e.translationX;
            ty.value = baseTy.value + e.translationY;
            clampPan(scale.value);
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            scale.value = withTiming(minScale);
            tx.value = withTiming(0);
            ty.value = withTiming(0);
        });

    // איפוס לגודל המינימלי
    const resetToMin = () => {
        scale.value = withTiming(minScale);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
    };

    // העברת עדכון החוצה (רק אם צריך, עדיף לעשות throttle בחוץ)
    useDerivedValue(() => {
        if (onTransformChange) {
            runOnJS(onTransformChange)(scale.value, tx.value, ty.value);
        }
    });

    const composedGestures = Gesture.Simultaneous(
        Gesture.Race(doubleTap, pinch),
        pan
    );

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: tx.value },
            { translateY: ty.value },
            { scale: scale.value },
        ] as const,
    }));

    return {
        scale,
        tx,
        ty,
        composedGestures,
        animatedStyle,
        resetToMin
    };
};
