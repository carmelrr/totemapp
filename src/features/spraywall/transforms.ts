// features/spraywall/transforms.ts
import { Vec2, Transform } from "./types";
import { screenToCanonical, canonicalToScreen } from "@/utils/matrix";
import { isPointInCircle, getScreenConstantRadius } from "@/utils/geometry";
import { Hold } from "@/features/routes/types";

// ניהול Pan/Zoom למסך מגע
export class CanvasTransform {
  private transform: Transform = { scale: 1, tx: 0, ty: 0 };
  private canvasSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  private imageSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };

  constructor(canvasWidth: number, canvasHeight: number) {
    this.setCanvasSize(canvasWidth, canvasHeight);
  }

  setCanvasSize(width: number, height: number) {
    this.canvasSize = { width, height };
    this.fitImageToCanvas();
  }

  setImageSize(width: number, height: number) {
    this.imageSize = { width, height };
    this.fitImageToCanvas();
  }

  // התאמת התמונה לקנבס (fit)
  private fitImageToCanvas() {
    if (this.canvasSize.width === 0 || this.imageSize.width === 0) return;

    const scaleX = this.canvasSize.width / this.imageSize.width;
    const scaleY = this.canvasSize.height / this.imageSize.height;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% של המסך

    const tx = (this.canvasSize.width - this.imageSize.width * scale) / 2;
    const ty = (this.canvasSize.height - this.imageSize.height * scale) / 2;

    this.transform = { scale, tx, ty };
  }

  // Pan (גרירה)
  pan(deltaX: number, deltaY: number) {
    this.transform.tx += deltaX;
    this.transform.ty += deltaY;
    this.clampTransform();
  }

  // Zoom (פינץ')
  zoom(scaleFactor: number, focalX: number, focalY: number) {
    const newScale = this.transform.scale * scaleFactor;

    // הגבל זום
    const minScale = 0.1;
    const maxScale = 5.0;
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));

    if (clampedScale === this.transform.scale) return;

    // זום סביב נקודת המוקד
    const ratio = clampedScale / this.transform.scale;
    this.transform.tx = focalX - (focalX - this.transform.tx) * ratio;
    this.transform.ty = focalY - (focalY - this.transform.ty) * ratio;
    this.transform.scale = clampedScale;

    this.clampTransform();
  }

  // הגבלת התמרה (למנוע יציאה מהגבולות)
  private clampTransform() {
    const scaledWidth = this.imageSize.width * this.transform.scale;
    const scaledHeight = this.imageSize.height * this.transform.scale;

    // הגבל Pan כך שהתמונה תמיד תהיה נראית חלקית
    const minTx = this.canvasSize.width - scaledWidth - 50;
    const maxTx = 50;
    const minTy = this.canvasSize.height - scaledHeight - 50;
    const maxTy = 50;

    this.transform.tx = Math.max(minTx, Math.min(maxTx, this.transform.tx));
    this.transform.ty = Math.max(minTy, Math.min(maxTy, this.transform.ty));
  }

  // המרות קואורדינטות
  screenToCanonical(screenX: number, screenY: number): Vec2 {
    return screenToCanonical(
      screenX,
      screenY,
      this.transform.tx,
      this.transform.ty,
      this.transform.scale,
    );
  }

  canonicalToScreen(canonicalX: number, canonicalY: number): Vec2 {
    return canonicalToScreen(
      canonicalX,
      canonicalY,
      this.transform.tx,
      this.transform.ty,
      this.transform.scale,
    );
  }

  // בדיקת hit-testing לאחיזות
  hitTestHold(screenX: number, screenY: number, hold: Hold): boolean {
    const screenPos = this.canonicalToScreen(hold.x, hold.y);
    const screenRadius = getScreenConstantRadius(
      hold.size * 1000,
      this.transform.scale,
      15,
    );

    return isPointInCircle({ x: screenX, y: screenY }, screenPos, screenRadius);
  }

  // מציאת כל האחיזות תחת נקודה
  getHoldsAtPoint(screenX: number, screenY: number, holds: Hold[]): Hold[] {
    return holds.filter((hold) => this.hitTestHold(screenX, screenY, hold));
  }

  // קבלת רדיוס שמשמר גודל על המסך
  getScreenRadius(canonicalRadius: number): number {
    return getScreenConstantRadius(
      canonicalRadius * 1000,
      this.transform.scale,
      8,
    );
  }

  // איפוס זום ופאן
  resetTransform() {
    this.fitImageToCanvas();
  }

  // קבלת מצב נוכחי
  getTransform(): Transform {
    return { ...this.transform };
  }

  // הגדרת מצב
  setTransform(transform: Partial<Transform>) {
    this.transform = { ...this.transform, ...transform };
    this.clampTransform();
  }
}

// פונקציית עזר ליצירת טרנספורם לאנימציות
export function createAnimatedTransform(
  from: Transform,
  to: Transform,
  progress: number, // 0-1
): Transform {
  return {
    scale: from.scale + (to.scale - from.scale) * progress,
    tx: from.tx + (to.tx - from.tx) * progress,
    ty: from.ty + (to.ty - from.ty) * progress,
  };
}

// פונקציה לחישוב גבולות התמונה במסך
export function getImageBounds(
  imageWidth: number,
  imageHeight: number,
  transform: Transform,
): { x: number; y: number; width: number; height: number } {
  return {
    x: transform.tx,
    y: transform.ty,
    width: imageWidth * transform.scale,
    height: imageHeight * transform.scale,
  };
}
