# FlexibleCropper - Advanced Image Cropping System

## Overview

The FlexibleCropper is an advanced image cropping system for React Native that provides three key features:

1. **Dynamic Free-form Cropping** - Quadrilateral cropping with draggable corners
2. **Magnifier Glass** - Real-time magnification during corner dragging
3. **Perspective Transformation** - Final image warping to correct perspective

## Architecture

The system consists of four main components:

### 1. FlexibleCropper.js (Main Interface)

- Entry point that wraps the SprayWallEditor
- Maintains backward compatibility with existing code
- Simple interface: `imageUri`, `onSave`, `onCancel`

### 2. SprayWallEditor.js (Core Controller)

- Main orchestration component
- Manages crop points, magnifier state, and image processing
- Handles undo/redo functionality
- Controls perspective transformation mode

### 3. CropTool.js (Interactive Overlay)

- Renders the quadrilateral crop outline
- Handles gesture detection for corner dragging
- Provides visual feedback with colored corner handles
- Uses React Native SVG for smooth path rendering

### 4. Magnifier.js (Magnification System)

- Circular magnifying glass that appears during dragging
- 2.5x magnification with crosshair targeting
- Automatically positions above the finger
- Stays within container bounds

### 5. ImageCanvas.js (Rendering Engine)

- Renders the image with crop clipping or perspective transformation
- Uses React Native SVG for advanced transformations
- Supports both preview mode and final warped output

## Features

### Free-form Cropping

- **Quad-based cropping**: Each corner can be dragged independently
- **Visual feedback**: Color-coded corners (red, cyan, blue, orange)
- **Boundary constraints**: Corners stay within image bounds
- **Smooth interactions**: Responsive gesture handling

### Magnifier System

- **Auto-positioning**: Appears above finger during drag operations
- **High magnification**: 2.5x zoom for precise positioning
- **Crosshair targeting**: Center crosshair for exact positioning
- **Smart bounds**: Stays within screen boundaries

### Perspective Transformation

- **Matrix calculation**: Computes projective transformation
- **Real-time preview**: See transformation before saving
- **Toggle mode**: Switch between crop and warp views
- **High quality output**: Maintains image resolution

### History Management

- **Undo/Redo**: Navigate through crop adjustments
- **Reset function**: Return to default rectangle
- **State preservation**: Maintains crop points across mode switches

## Usage

```javascript
import FlexibleCropper from "../components/FlexibleCropper";

// Basic usage
<FlexibleCropper
  imageUri={selectedImage.uri}
  onSave={handleCropSave}
  onCancel={handleCropCancel}
/>;
```

### onSave Callback Data

```javascript
{
  uri: "file://...",              // Final processed image URI
  width: 360,                     // Canvas width
  height: 480,                    // Canvas height
  cropPoints: {                   // Corner positions
    topLeft: { x: 30, y: 30 },
    topRight: { x: 330, y: 30 },
    bottomRight: { x: 330, y: 450 },
    bottomLeft: { x: 30, y: 450 }
  },
  originalImageUri: "file://...", // Original image URI
  imageDimensions: {              // Image display dimensions
    width: 300,
    height: 400,
    originalWidth: 1200,
    originalHeight: 1600
  },
  isWarped: false                 // Whether perspective was applied
}
```

## Technical Implementation

### Gesture Handling

- Uses `react-native-gesture-handler` for smooth interactions
- `worklet` functions for 60fps performance
- Shared values for real-time updates

### Image Processing

- `react-native-svg` for clipping and transformations
- `react-native-view-shot` for final image capture
- Perspective transformation using SVG matrices

### Performance Optimizations

- Debounced state updates during dragging
- Efficient corner hit detection
- Lazy image dimension loading
- Optimized re-renders with proper dependency arrays

## Dependencies

Required packages:

- `react-native-gesture-handler` (gestures)
- `react-native-reanimated` (animations)
- `react-native-svg` (rendering)
- `react-native-view-shot` (image capture)
- `expo-file-system` (file operations)

## Corner Color Coding

- **Top Left**: Red (#FF6B6B)
- **Top Right**: Cyan (#4ECDC4)
- **Bottom Right**: Blue (#45B7D1)
- **Bottom Left**: Orange (#FFA07A)

## Controls

### Crop Mode

- **Drag corners**: Adjust crop boundaries
- **Undo/Redo**: Navigate crop history
- **Reset**: Return to default rectangle
- **Apply Perspective**: Switch to warp mode

### Warp Mode

- **Preview**: See final transformed image
- **Back to Crop**: Return to editing mode
- **Save**: Capture final result

## Error Handling

- Graceful degradation for unsupported image formats
- Automatic bounds constraint for corner positions
- Fallback image dimensions if loading fails
- User feedback for save operations

## Future Enhancements

Possible improvements:

- Grid overlay for rule of thirds
- Rotation gesture support
- Multiple crop presets (square, 16:9, etc.)
- Advanced filters during cropping
- Batch processing support

## Integration Notes

The FlexibleCropper maintains full backward compatibility with existing implementations. Simply replace the import and the component will work with enhanced features.

For Spray Wall applications, the perspective correction is particularly useful for photographed climbing walls where the camera angle creates distortion.
