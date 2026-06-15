// WallEditorScreen - Main screen for the wall/room editor

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/context/AuthContext';

import { useEditorStore } from '../store/useEditorStore';
import {
  EditorCanvas,
  EditorToolbar,
  CreateRoomModal,
  StyleControlsPanel,
  PointEditPanel,
  CropModal,
  CreateSectorModal,
} from '../components';
import type { EditorCanvasHandle } from '../components';
import { Point, EditorMode, CreateRoomPayload, Room, Wall, DEFAULT_OVERLAY, EntranceArrow, Sector, TextLabel } from '../types';
import { 
  updateRoom as updateRoomInDb, 
  publishRoom as publishRoomInDb,
  unpublishRoom as unpublishRoomInDb,
  subscribeToRooms,
} from '../services/editorService';

// Cloud Function URL - loaded from environment variables
const OBJ_TO_TOP_VIEW_URL = process.env.EXPO_PUBLIC_OBJ_TO_TOP_VIEW_URL;
if (!OBJ_TO_TOP_VIEW_URL) {
  console.warn('EXPO_PUBLIC_OBJ_TO_TOP_VIEW_URL is not set. 3D top view feature will not work.');
}

// Route creation modal props
interface MatFormData {
  color: string;
}

const MAT_COLORS = [
  '#4A90D9', '#22C55E', '#EF4444', '#F59E0B',
  '#8B5CF6', '#EC4899', '#10B981', '#F97316',
];

// Helper: minimum distance from a point to a line segment
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Helper: check if point is inside a closed polygon (ray casting)
function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Find the wall at the given room-coordinate point (returns wallId or null)
function findWallAtPoint(point: Point, walls: Wall[], threshold: number = 5): string | null {
  // First check closed polygons (filled areas)
  for (const wall of walls) {
    if (wall.isClosed && wall.points.length > 2 && pointInPolygon(point, wall.points)) {
      return wall.id;
    }
  }
  // Then check proximity to wall segments
  let bestId: string | null = null;
  let bestDist = threshold;
  for (const wall of walls) {
    const pts = wall.points;
    const count = wall.isClosed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const d = distToSegment(point, a, b);
      if (d < bestDist) {
        bestDist = d;
        bestId = wall.id;
      }
    }
  }
  return bestId;
}

export default function WallEditorScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  
  // Editor store
  const {
    rooms,
    currentRoomId,
    mode,
    selection,
    styles: editorStyles,
    gridConfig,
    buildingWall,
    buildingMat,
    history,
    historyIndex,
    createRoom,
    deleteRoom,
    setCurrentRoom,
    updateRoomStyle,
    setMode,
    setSelection,
    clearSelection,
    startWall,
    addPointToWall,
    finishWall,
    cancelWall,
    startMat,
    addPointToMat,
    finishMat,
    cancelMat,
    updateStyles,
    updateGridConfig,
    moveWallPoint,
    deleteWall,
    deleteMat,
    undo,
    redo,
    getCurrentRoom,
    overlay,
    setOverlay,
    updateOverlay,
    clearOverlay,
    loadRooms,
    updateWall,
  } = useEditorStore();
  
  // Canvas ref for zoom control
  const canvasRef = useRef<EditorCanvasHandle>(null);
  
  // Local UI state
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
  const [showOverlayControls, setShowOverlayControls] = useState(false);
  const [showOverlayOptionsModal, setShowOverlayOptionsModal] = useState(false);
  const [showOBJViewModal, setShowOBJViewModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showCreateSectorModal, setShowCreateSectorModal] = useState(false);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const [arrowStartPoint, setArrowStartPoint] = useState<Point | null>(null);
  const [matColor, setMatColor] = useState(MAT_COLORS[0]);
  const [matOpacity, setMatOpacity] = useState(0.5);
  const [wallFillColor, setWallFillColor] = useState('#4A90D9');
  const [wallFillOpacity, setWallFillOpacity] = useState(0.3);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const currentRoom = getCurrentRoom();
  
  // Load rooms from Firebase on mount
  useEffect(() => {
    console.log('[WallEditorScreen] useEffect - user:', user?.uid);
    if (!user) {
      console.log('[WallEditorScreen] No user, skipping subscription');
      return;
    }
    
    console.log('[WallEditorScreen] Subscribing to rooms for user:', user.uid);
    const unsubscribe = subscribeToRooms(
      (loadedRooms) => {
        console.log('[WallEditorScreen] Received rooms:', loadedRooms.length);
        loadRooms(loadedRooms);
      },
      user.uid
    );
    
    return unsubscribe;
  }, [user, loadRooms]);
  
  // Get selected point coordinates
  const selectedPoint = useMemo(() => {
    if (!currentRoom || selection.type !== 'point') return null;
    
    if (selection.wallId && selection.pointIndex !== undefined) {
      const wall = currentRoom.walls.find(w => w.id === selection.wallId);
      return wall?.points[selection.pointIndex] || null;
    }
    
    return null;
  }, [currentRoom, selection]);

  // Get selected wall
  const selectedWall = useMemo(() => {
    if (!currentRoom || selection.type !== 'wall' || !selection.wallId) return null;
    return currentRoom.walls.find(w => w.id === selection.wallId) || null;
  }, [currentRoom, selection]);
  
  // Loading state for OBJ conversion
  const [isLoadingOverlay, setIsLoadingOverlay] = useState(false);
  
  // Handlers
  const handleCreateRoom = useCallback((payload: CreateRoomPayload) => {
    createRoom(payload);
    setShowRoomList(false);
  }, [createRoom]);
  
  // Entrance arrow handlers
  const handleUpdateEntranceArrow = useCallback((arrow: EntranceArrow | undefined) => {
    if (currentRoom) {
      updateRoomStyle(currentRoom.id, { entranceArrow: arrow } as any);
    }
  }, [currentRoom, updateRoomStyle]);
  
  const handleStartDrawArrow = useCallback(() => {
    setIsDrawingArrow(true);
    setArrowStartPoint(null);
  }, []);

  const handleCancelDrawArrow = useCallback(() => {
    setIsDrawingArrow(false);
    setArrowStartPoint(null);
  }, []);
  
  // Text label handlers
  const handleUpdateTextLabels = useCallback((textLabels: TextLabel[]) => {
    if (currentRoom) {
      updateRoomStyle(currentRoom.id, { textLabels } as any);
    }
  }, [currentRoom, updateRoomStyle]);
  
  const handleAddTextLabel = useCallback(() => {
    if (!currentRoom) return;
    
    // Calculate default position in center of room
    const roomWidth = currentRoom.width || 800;
    const roomHeight = currentRoom.height || 600;
    
    const newLabel: TextLabel = {
      id: `label-${Date.now()}`,
      text: 'כיתוב חדש',
      position: {
        x: roomWidth / 2,
        y: roomHeight / 2,
      },
      fontSize: 16,
      color: '#ffffff',
      opacity: 1,
      fontWeight: 'bold',
    };
    
    const updatedLabels = [...(currentRoom.textLabels || []), newLabel];
    handleUpdateTextLabels(updatedLabels);
  }, [currentRoom, handleUpdateTextLabels]);
  
  // Sector handlers
  const handleUpdateSectors = useCallback((sectors: Sector[]) => {
    if (currentRoom) {
      updateRoomStyle(currentRoom.id, { sectors } as any);
    }
  }, [currentRoom, updateRoomStyle]);
  
  const handleAddSector = useCallback(() => {
    setShowCreateSectorModal(true);
  }, []);
  
  const handleCreateSector = useCallback((name: string, color: string) => {
    if (!currentRoom) return;
    
    // Calculate default bounds in center of room
    const roomWidth = currentRoom.width || 800;
    const roomHeight = currentRoom.height || 600;
    const sectorWidth = roomWidth * 0.3;
    const sectorHeight = roomHeight * 0.3;
    
    const newSector: Sector = {
      id: `sector-${Date.now()}`,
      name,
      bounds: {
        x: (roomWidth - sectorWidth) / 2,
        y: (roomHeight - sectorHeight) / 2,
        width: sectorWidth,
        height: sectorHeight,
      },
      color,
      order: (currentRoom.sectors?.length || 0) + 1,
    };
    
    const updatedSectors = [...(currentRoom.sectors || []), newSector];
    handleUpdateSectors(updatedSectors);
    setShowCreateSectorModal(false);
  }, [currentRoom, handleUpdateSectors]);
  
  // Zoom to sector handler
  const handleZoomToSector = useCallback((sector: Sector) => {
    canvasRef.current?.zoomToRect(sector.bounds);
  }, []);
  
  // Save room to database
  const handleSaveRoom = useCallback(async () => {
    if (!currentRoom || !user) return;
    
    setIsSaving(true);
    try {
      await updateRoomInDb(currentRoom.id, {
        name: currentRoom.name,
        width: currentRoom.width,
        height: currentRoom.height,
        backgroundColor: currentRoom.backgroundColor,
        gridColor: currentRoom.gridColor,
        gridSize: currentRoom.gridSize,
        showGrid: currentRoom.showGrid,
        walls: currentRoom.walls,
        mats: currentRoom.mats,
        sectors: currentRoom.sectors,
        entranceArrow: currentRoom.entranceArrow ?? null,
        textLabels: currentRoom.textLabels ?? [],
        createdBy: user.uid,
      });
      Alert.alert(t.alerts.wallSaveTitle, t.alerts.wallSaved);
    } catch (error) {
      console.error('Error saving room:', error);
      Alert.alert(t.common.error, t.alerts.wallSaveFailed);
    } finally {
      setIsSaving(false);
    }
  }, [currentRoom, user]);
  
  // Publish room to routes map
  const handlePublishRoom = useCallback(async () => {
    if (!currentRoom) return;
    
    const isPublished = currentRoom.isPublished;
    
    Alert.alert(
      isPublished ? 'ביטול פרסום' : 'פרסום למפת המסלולים',
      isPublished 
        ? 'האם אתה בטוח שברצונך להסיר את הקיר ממפת המסלולים?' 
        : 'האם אתה בטוח שברצונך לפרסם את הקיר למפת המסלולים?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: isPublished ? 'הסר' : 'פרסם',
          style: isPublished ? 'destructive' : 'default',
          onPress: async () => {
            setIsPublishing(true);
            try {
              if (isPublished) {
                await unpublishRoomInDb(currentRoom.id);
                Alert.alert(t.common.success, t.alerts.wallUnpublished);
              } else {
                // Save first, then publish
                await handleSaveRoom();
                await publishRoomInDb(currentRoom.id);
                Alert.alert(t.common.success, t.alerts.wallPublished);
              }
              // Update local state
              updateRoomStyle(currentRoom.id, { isPublished: !isPublished } as any);
            } catch (error) {
              console.error('Error publishing room:', error);
              Alert.alert(t.common.error, t.alerts.wallPublishFailed);
            } finally {
              setIsPublishing(false);
            }
          },
        },
      ]
    );
  }, [currentRoom, handleSaveRoom, updateRoomStyle]);
  
  // Read file as base64 - platform specific
  const readFileAsBase64 = useCallback(async (fileUri: string, file?: File): Promise<string> => {
    if (Platform.OS === 'web') {
      // On web, we need to fetch the blob from the URI if file object is not available
      if (file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1] || result;
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      }
      // Fallback: fetch the URI as blob
      const response = await fetch(fileUri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(blob);
      });
    }
    return FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
  }, []);
  
  // Pick OBJ file and convert to top-view image
  const handlePickOBJFile = useCallback(async (viewMode: 'auto' | 'front' | 'top' | 'side' = 'auto') => {
    try {
      console.log('Opening document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' ? '*/*' : ['*/*'],
        copyToCacheDirectory: true,
      });
      
      console.log('Document picker result:', JSON.stringify(result, null, 2));
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('Document picker canceled or no assets');
        return;
      }
      
      const asset = result.assets[0];
      console.log('Selected asset:', { 
        name: asset.name, 
        uri: asset.uri?.substring(0, 100), 
        mimeType: asset.mimeType,
        size: asset.size,
        hasFile: !!(asset as any).file 
      });
      
      const filename = asset.name.toLowerCase();
      
      // Check if it's an OBJ file
      if (!filename.endsWith('.obj')) {
        Alert.alert(t.common.error, t.alerts.selectObjFile);
        return;
      }
      
      setIsLoadingOverlay(true);
      
      // Read file as base64
      console.log('Reading file as base64...');
      const base64 = await readFileAsBase64(asset.uri, (asset as any).file);
      console.log('File read, base64 length:', base64.length);
      
      // Check if file is too large (max ~6MB for Cloud Functions)
      if (base64.length > 6000000) {
        throw new Error('הקובץ גדול מדי. נסה קובץ קטן יותר (עד 6MB)');
      }
      
      // Call Cloud Function (with auth token)
      console.log('Calling Cloud Function:', OBJ_TO_TOP_VIEW_URL);
      const { auth: firebaseAuth } = require('@/features/data/firebase');
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('יש להתחבר כדי להשתמש בעיבוד OBJ');
      }
      const response = await fetch(OBJ_TO_TOP_VIEW_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fileData: base64,
          filename: asset.name,
          options: { 
            width: 1000, 
            height: 1000,
            view: viewMode,        // auto, front, top, side
            outlineOnly: true,     // Use only outline edges for cleaner look
          },
        }),
      });
      
      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      // Check for error status codes
      if (response.status === 413) {
        throw new Error('הקובץ גדול מדי');
      }
      if (response.status === 504 || response.status === 503) {
        throw new Error('הזמן קצוב. הקובץ גדול מדי או עמוס');
      }
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('Response text length:', responseText.length);
      console.log('Response preview:', responseText.substring(0, 500));
      
      if (!responseText) {
        throw new Error('Empty response from server');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Invalid response from server');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'שגיאה בעיבוד הקובץ');
      }
      
      console.log('Success! Image URL length:', data.imageUrl?.length);
      
      // Set overlay with the generated image
      setOverlay({
        uri: data.imageUrl,
        name: asset.name,
        x: 0,
        y: 0,
        originalWidth: 1000,
        originalHeight: 1000,
        scale: 0.5,
        opacity: 0.5,
        rotation: 0,
        locked: false,
        flipX: false,
        flipY: false,
      } as any);
      setShowOverlayControls(true);
      
    } catch (error) {
      console.error('Error processing OBJ:', error);
      Alert.alert(t.common.error, error instanceof Error ? error.message : t.alerts.objProcessFailed);
    } finally {
      setIsLoadingOverlay(false);
    }
  }, [readFileAsBase64, setOverlay]);
  
  // Pick reference image (regular image)
  const handlePickOverlayImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setOverlay({
          uri: asset.uri,
          name: asset.fileName || 'reference-image',
          x: 0,
          y: 0,
          originalWidth: asset.width || 500,
          originalHeight: asset.height || 500,
          scale: 0.5, // Start at 50% to fit in view
          opacity: 0.5,
          brightness: 1,
          rotation: 0,
          locked: false,
          flipX: false,
          flipY: false,
        });
        setShowOverlayControls(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t.common.error, t.alerts.imageLoadFailed);
    }
  }, [setOverlay]);
  
  // Show OBJ view options dialog
  const handleShowOBJViewOptions = useCallback(() => {
    if (Platform.OS === 'web') {
      setShowOBJViewModal(true);
    } else {
      Alert.alert(
        'בחר זווית מבט',
        'מאיזה כיוון להציג את המודל?',
        [
          { text: 'ביטול', style: 'cancel' },
          { text: 'אוטומטי', onPress: () => handlePickOBJFile('auto') },
          { text: 'מלפנים', onPress: () => handlePickOBJFile('front') },
          { text: 'מלמעלה', onPress: () => handlePickOBJFile('top') },
          { text: 'מהצד', onPress: () => handlePickOBJFile('side') },
        ]
      );
    }
  }, [handlePickOBJFile]);
  
  // Handle OBJ view selection (for web modal)
  const handleOBJViewSelect = useCallback((view: 'auto' | 'front' | 'top' | 'side') => {
    setShowOBJViewModal(false);
    handlePickOBJFile(view);
  }, [handlePickOBJFile]);
  
  // Show options for overlay type
  const handleShowOverlayOptions = useCallback(() => {
    if (overlay) {
      // If overlay exists, toggle controls
      setShowOverlayControls(!showOverlayControls);
    } else {
      // Show options dialog
      if (Platform.OS === 'web') {
        setShowOverlayOptionsModal(true);
      } else {
        Alert.alert(
          'בחר סוג רפרנס',
          'באיזה סוג קובץ תרצה להשתמש?',
          [
            { text: 'ביטול', style: 'cancel' },
            { text: 'תמונה', onPress: handlePickOverlayImage },
            { text: 'קובץ OBJ', onPress: handleShowOBJViewOptions },
          ]
        );
      }
    }
  }, [overlay, showOverlayControls, handlePickOverlayImage, handleShowOBJViewOptions]);
  
  // Handle overlay type selection (for web modal)
  const handleOverlayTypeSelect = useCallback((type: 'image' | 'obj') => {
    setShowOverlayOptionsModal(false);
    if (type === 'image') {
      handlePickOverlayImage();
    } else {
      handleShowOBJViewOptions();
    }
  }, [handlePickOverlayImage, handleShowOBJViewOptions]);
  
  const handleDeleteRoom = useCallback((roomId: string) => {
    Alert.alert(
      'מחיקת חלל',
      'האם למחוק את החלל? פעולה זו בלתי הפיכה.',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: () => deleteRoom(roomId) },
      ]
    );
  }, [deleteRoom]);
  
  const handleCanvasTap = useCallback((point: Point) => {
    // Handle arrow drawing mode
    if (isDrawingArrow && currentRoom) {
      if (!arrowStartPoint) {
        // First tap - set start point
        setArrowStartPoint(point);
      } else {
        // Second tap - create the arrow
        const newArrow = {
          start: arrowStartPoint,
          end: point,
          color: currentRoom.entranceArrow?.color || '#22C55E',
          strokeWidth: 4,
          label: 'כניסה',
          visible: true,
        };
        handleUpdateEntranceArrow(newArrow);
        setIsDrawingArrow(false);
        setArrowStartPoint(null);
      }
      return;
    }
    
    if (mode === 'wall') {
      if (buildingWall) {
        addPointToWall(point);
      } else {
        startWall(point);
      }
    } else if (mode === 'mat') {
      if (buildingMat) {
        addPointToMat(point);
      } else {
        startMat(point, matColor, matOpacity);
      }
    } else if (mode === 'text') {
      // Place a new text label at the tapped position
      if (currentRoom) {
        const newLabel: TextLabel = {
          id: `label-${Date.now()}`,
          text: 'כיתוב חדש',
          position: point,
          fontSize: 16,
          color: '#ffffff',
          opacity: 1,
          fontWeight: 'bold',
        };
        const updatedLabels = [...(currentRoom.textLabels || []), newLabel];
        handleUpdateTextLabels(updatedLabels);
      }
    } else if (mode === 'select') {
      // Try to find a wall at the tap point before clearing
      if (currentRoom) {
        const hitWallId = findWallAtPoint(point, currentRoom.walls);
        if (hitWallId) {
          setSelection({ type: 'wall', wallId: hitWallId });
        } else {
          clearSelection();
        }
      } else {
        clearSelection();
      }
    }
  }, [mode, buildingWall, buildingMat, startWall, addPointToWall, startMat, addPointToMat, matColor, matOpacity, clearSelection, isDrawingArrow, arrowStartPoint, currentRoom, handleUpdateEntranceArrow, handleUpdateTextLabels, setSelection]);
  
  const handleWallPointSelect = useCallback((wallId: string, pointIndex: number) => {
    if (mode === 'select') {
      setSelection({ type: 'point', wallId, pointIndex });
    } else if (mode === 'erase') {
      // In erase mode, delete the wall
      if (currentRoom) {
        deleteWall(currentRoom.id, wallId);
      }
    }
  }, [mode, currentRoom, setSelection, deleteWall]);
  
  const handleWallSelect = useCallback((wallId: string) => {
    if (mode === 'select') {
      setSelection({ type: 'wall', wallId });
    } else if (mode === 'erase') {
      if (currentRoom) {
        deleteWall(currentRoom.id, wallId);
      }
    }
  }, [mode, currentRoom, setSelection, deleteWall]);
  
  const handleModeChange = useCallback((newMode: EditorMode) => {
    setMode(newMode);
  }, [setMode]);
  
  const handlePointPositionChange = useCallback((newPosition: Point) => {
    if (!currentRoom || selection.type !== 'point') return;
    
    if (selection.wallId !== undefined && selection.pointIndex !== undefined) {
      moveWallPoint(currentRoom.id, selection.wallId, selection.pointIndex, newPosition);
    }
  }, [currentRoom, selection, moveWallPoint]);
  
  const handleDeleteSelected = useCallback(() => {
    if (!currentRoom) return;
    
    if (selection.type === 'wall' && selection.wallId) {
      deleteWall(currentRoom.id, selection.wallId);
      clearSelection();
    }
  }, [currentRoom, selection, deleteWall, clearSelection]);
  
  // Render room list modal
  const renderRoomListModal = () => (
    <Modal
      visible={showRoomList}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowRoomList(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.roomListContainer}>
          <View style={styles.roomListHeader}>
            <Text style={styles.roomListTitle}>חללים</Text>
            <TouchableOpacity 
              onPress={() => setShowRoomList(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.roomList}>
            {rooms.length === 0 ? (
              <View style={styles.emptyRooms}>
                <Ionicons name="cube-outline" size={48} color={theme.textSecondary} />
                <Text style={styles.emptyRoomsText}>אין חללים עדיין</Text>
                <Text style={styles.emptyRoomsSubtext}>צור חלל חדש להתחיל</Text>
              </View>
            ) : (
              rooms.map(room => (
                <TouchableOpacity
                  key={room.id}
                  style={[
                    styles.roomItem,
                    currentRoomId === room.id && styles.roomItemActive,
                  ]}
                  onPress={() => {
                    setCurrentRoom(room.id);
                    setShowRoomList(false);
                  }}
                >
                  <View style={styles.roomItemInfo}>
                    <Text style={styles.roomItemName}>{room.name}</Text>
                    <Text style={styles.roomItemDimensions}>
                      {room.width} × {room.height} | {room.walls.length} קירות | {room.mats?.length || 0} מזרנים
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.roomDeleteButton}
                    onPress={() => handleDeleteRoom(room.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.createRoomButton}
            onPress={() => {
              setShowRoomList(false);
              setShowCreateRoom(true);
            }}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.createRoomButtonText}>צור חלל חדש</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.roomSelector}
            onPress={() => setShowRoomList(true)}
          >
            <Text style={styles.roomName}>
              {currentRoom?.name || 'בחר חלל'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, currentRoom?.isPublished && styles.headerButtonActive]}
              onPress={handlePublishRoom}
              disabled={!currentRoom || isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons 
                  name={currentRoom?.isPublished ? "cloud-done" : "cloud-upload"} 
                  size={20} 
                  color={currentRoom?.isPublished ? theme.success : theme.text} 
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSaveRoom}
              disabled={!currentRoom || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons 
                  name="save" 
                  size={20} 
                  color={theme.text} 
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, overlay && styles.headerButtonActive]}
              onPress={handleShowOverlayOptions}
              disabled={isLoadingOverlay}
            >
              {isLoadingOverlay ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons 
                  name="image" 
                  size={20} 
                  color={overlay ? theme.primary : theme.text} 
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowStylePanel(!showStylePanel)}
            >
              <Ionicons 
                name="color-palette" 
                size={20} 
                color={showStylePanel ? theme.primary : theme.text} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Toolbar */}
        <EditorToolbar
          currentMode={mode}
          onModeChange={handleModeChange}
          isBuildingWall={!!buildingWall}
          isBuildingMat={!!buildingMat}
          onFinishWall={() => finishWall(false)}
          onCloseWall={() => finishWall(true, wallFillColor, wallFillOpacity)}
          onCancelWall={cancelWall}
          onFinishMat={finishMat}
          onCancelMat={cancelMat}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
        />
        
        {/* Main canvas area */}
        <View style={styles.canvasContainer}>
          {/* Text label placement banner */}
          {mode === 'text' && (
            <View style={styles.arrowBanner}>
              <View style={styles.arrowBannerContent}>
                <View style={styles.arrowBannerIconRow}>
                  <Ionicons name="text" size={20} color="#fff" />
                  <Text style={styles.arrowBannerTitle}>הוספת כיתוב</Text>
                </View>
                <Text style={styles.arrowBannerText}>
                  לחץ על המפה כדי למקם כיתוב חדש
                </Text>
              </View>
            </View>
          )}
          {/* Arrow drawing instruction banner */}
          {isDrawingArrow && (
            <View style={styles.arrowBanner}>
              <View style={styles.arrowBannerContent}>
                <View style={styles.arrowBannerIconRow}>
                  <Ionicons name="navigate-outline" size={20} color="#fff" />
                  <Text style={styles.arrowBannerTitle}>ציור חץ כניסה</Text>
                </View>
                <Text style={styles.arrowBannerText}>
                  {arrowStartPoint
                    ? 'לחץ על נקודת הסיום של החץ (לכיוון החלל)'
                    : 'לחץ על נקודת ההתחלה של החץ (מהכניסה)'}
                </Text>
                {arrowStartPoint && (
                  <View style={styles.arrowBannerSteps}>
                    <View style={styles.arrowStepDone}>
                      <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                      <Text style={styles.arrowStepDoneText}>נקודת התחלה</Text>
                    </View>
                    <View style={styles.arrowStepPending}>
                      <Ionicons name="ellipse-outline" size={14} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.arrowStepPendingText}>נקודת סיום</Text>
                    </View>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.arrowBannerClose}
                onPress={handleCancelDrawArrow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          )}
          {currentRoom ? (
            <EditorCanvas
              ref={canvasRef}
              room={currentRoom}
              mode={mode}
              selection={selection}
              onCanvasTap={handleCanvasTap}
              onWallPointSelect={handleWallPointSelect}
              onWallSelect={handleWallSelect}
            />
          ) : (
            <View style={styles.noRoomMessage}>
              <Ionicons name="cube-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.noRoomText}>אין חלל נבחר</Text>
              <Text style={styles.noRoomSubtext}>צור חלל חדש או בחר חלל קיים</Text>
              <TouchableOpacity
                style={styles.createFirstRoomButton}
                onPress={() => setShowCreateRoom(true)}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.createFirstRoomText}>צור חלל</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Mat/Wall fill settings panel - visible when in mat or wall mode */}
        {(mode === 'mat' || mode === 'wall') && currentRoom && (
          <View style={styles.fillSettingsPanel}>
            <Text style={styles.fillSettingsTitle}>
              {mode === 'mat' ? 'הגדרות מזרן' : 'הגדרות מילוי קיר'}
            </Text>
            
            {/* Color picker */}
            <View style={styles.fillColorRow}>
              <Text style={styles.fillSettingsLabel}>צבע:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPickerScroll}>
                {MAT_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      (mode === 'mat' ? matColor : wallFillColor) === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => mode === 'mat' ? setMatColor(color) : setWallFillColor(color)}
                  />
                ))}
              </ScrollView>
            </View>
            
            {/* Hex color code input */}
            <View style={styles.hexColorRow}>
              <Text style={styles.fillSettingsLabel}>קוד צבע:</Text>
              <View style={styles.hexInputWrapper}>
                <View style={[
                  styles.hexColorPreview,
                  { backgroundColor: mode === 'mat' ? matColor : wallFillColor },
                ]} />
                <TextInput
                  style={styles.hexColorInput}
                  value={mode === 'mat' ? matColor : wallFillColor}
                  onChangeText={(text) => {
                    const cleaned = text.startsWith('#') ? text : '#' + text;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(cleaned)) {
                      if (mode === 'mat') setMatColor(cleaned);
                      else setWallFillColor(cleaned);
                    }
                  }}
                  placeholder="#4A90D9"
                  placeholderTextColor={theme.textSecondary}
                  maxLength={7}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            
            {/* Opacity slider */}
            <View style={styles.fillOpacityRow}>
              <Text style={styles.fillSettingsLabel}>שקיפות:</Text>
              <View style={styles.opacitySliderContainer}>
                <Slider
                  style={styles.opacitySlider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.1}
                  value={mode === 'mat' ? matOpacity : wallFillOpacity}
                  onValueChange={(value) => mode === 'mat' ? setMatOpacity(value) : setWallFillOpacity(value)}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
                <Text style={styles.opacityValue}>
                  {Math.round((mode === 'mat' ? matOpacity : wallFillOpacity) * 100)}%
                </Text>
              </View>
            </View>
          </View>
        )}
        
        {/* Wall edit panel (when wall is selected) */}
        {selectedWall && currentRoom && (
          <View style={styles.wallEditPanel}>
            <Text style={styles.fillSettingsTitle}>עריכת קיר</Text>
            
            {/* Wall stroke color */}
            <View style={styles.fillColorRow}>
              <Text style={styles.fillSettingsLabel}>צבע קו:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPickerScroll}>
                {MAT_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedWall.color === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => updateWall(currentRoom.id, selectedWall.id, { color })}
                  />
                ))}
              </ScrollView>
            </View>
            <View style={styles.hexColorRow}>
              <Text style={styles.fillSettingsLabel}>קוד צבע קו:</Text>
              <View style={styles.hexInputWrapper}>
                <View style={[styles.hexColorPreview, { backgroundColor: selectedWall.color }]} />
                <TextInput
                  style={styles.hexColorInput}
                  value={selectedWall.color}
                  onChangeText={(text) => {
                    const cleaned = text.startsWith('#') ? text : '#' + text;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(cleaned)) {
                      updateWall(currentRoom.id, selectedWall.id, { color: cleaned });
                    }
                  }}
                  placeholder="#FFFFFF"
                  placeholderTextColor={theme.textSecondary}
                  maxLength={7}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Wall fill color (for closed walls) */}
            {selectedWall.isClosed && (
              <>
                <View style={styles.fillColorRow}>
                  <Text style={styles.fillSettingsLabel}>צבע מילוי:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPickerScroll}>
                    {MAT_COLORS.map(color => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          selectedWall.fillColor === color && styles.colorOptionSelected,
                        ]}
                        onPress={() => updateWall(currentRoom.id, selectedWall.id, { fillColor: color })}
                      />
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.hexColorRow}>
                  <Text style={styles.fillSettingsLabel}>קוד מילוי:</Text>
                  <View style={styles.hexInputWrapper}>
                    <View style={[styles.hexColorPreview, { backgroundColor: selectedWall.fillColor || 'transparent' }]} />
                    <TextInput
                      style={styles.hexColorInput}
                      value={selectedWall.fillColor || ''}
                      onChangeText={(text) => {
                        const cleaned = text.startsWith('#') ? text : '#' + text;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(cleaned)) {
                          updateWall(currentRoom.id, selectedWall.id, { fillColor: cleaned });
                        }
                      }}
                      placeholder="#4A90D9"
                      placeholderTextColor={theme.textSecondary}
                      maxLength={7}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
                <View style={styles.fillOpacityRow}>
                  <Text style={styles.fillSettingsLabel}>שקיפות מילוי:</Text>
                  <View style={styles.opacitySliderContainer}>
                    <Slider
                      style={styles.opacitySlider}
                      minimumValue={0}
                      maximumValue={1}
                      step={0.1}
                      value={selectedWall.fillOpacity ?? 0.3}
                      onValueChange={(value) => updateWall(currentRoom.id, selectedWall.id, { fillOpacity: value })}
                      minimumTrackTintColor={theme.primary}
                      maximumTrackTintColor={theme.border}
                      thumbTintColor={theme.primary}
                    />
                    <Text style={styles.opacityValue}>
                      {Math.round((selectedWall.fillOpacity ?? 0.3) * 100)}%
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Stroke width */}
            <View style={styles.fillOpacityRow}>
              <Text style={styles.fillSettingsLabel}>עובי קו:</Text>
              <View style={styles.opacitySliderContainer}>
                <Slider
                  style={styles.opacitySlider}
                  minimumValue={1}
                  maximumValue={10}
                  step={0.5}
                  value={selectedWall.strokeWidth}
                  onValueChange={(value) => updateWall(currentRoom.id, selectedWall.id, { strokeWidth: value })}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
                <Text style={styles.opacityValue}>
                  {selectedWall.strokeWidth}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Point edit panel (when point is selected) */}
        <PointEditPanel
          selection={selection}
          point={selectedPoint}
          onPositionChange={handlePointPositionChange}
          onDelete={handleDeleteSelected}
          label={
            selection.type === 'point' && selection.pointIndex !== undefined
              ? `נקודה ${selection.pointIndex + 1}`
              : 'נקודה נבחרת'
          }
        />
        
        {/* Style controls panel - includes all tabs: room, grid, wall, reference */}
        <StyleControlsPanel
          room={currentRoom}
          styles={editorStyles}
          gridConfig={gridConfig}
          onUpdateRoomStyle={(updates) => {
            if (currentRoom) {
              updateRoomStyle(currentRoom.id, updates);
            }
          }}
          onUpdateStyles={updateStyles}
          onUpdateGridConfig={updateGridConfig}
          isExpanded={showStylePanel}
          onToggleExpand={() => setShowStylePanel(!showStylePanel)}
          overlay={overlay}
          onUpdateOverlay={updateOverlay}
          onClearOverlay={() => {
            clearOverlay();
            setShowOverlayControls(false);
          }}
          onPickOverlay={handleShowOverlayOptions}
          onOpenCrop={() => setShowCropModal(true)}
          onUpdateEntranceArrow={handleUpdateEntranceArrow}
          onUpdateSectors={handleUpdateSectors}
          onStartDrawArrow={handleStartDrawArrow}
          onAddSector={handleAddSector}
          onZoomToSector={handleZoomToSector}
          onUpdateTextLabels={handleUpdateTextLabels}
          onAddTextLabel={handleAddTextLabel}
        />
        </KeyboardAvoidingView>
      </SafeAreaView>
      
      {/* Modals */}
      <CreateRoomModal
        visible={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        onCreate={handleCreateRoom}
      />
      
      <CreateSectorModal
        visible={showCreateSectorModal}
        onClose={() => setShowCreateSectorModal(false)}
        onCreate={handleCreateSector}
        existingSectors={currentRoom?.sectors || []}
      />
      
      {renderRoomListModal()}
      
      {/* Overlay Type Modal (for web) */}
      <Modal
        visible={showOverlayOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverlayOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowOverlayOptionsModal(false)}
        >
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsModalTitle}>בחר סוג רפרנס</Text>
            <Text style={styles.optionsModalSubtitle}>באיזה סוג קובץ תרצה להשתמש?</Text>
            
            <View style={styles.optionsButtonsContainer}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleOverlayTypeSelect('image')}
              >
                <Ionicons name="image" size={24} color={theme.text} />
                <Text style={styles.optionButtonText}>תמונה</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleOverlayTypeSelect('obj')}
              >
                <Ionicons name="cube" size={24} color={theme.text} />
                <Text style={styles.optionButtonText}>קובץ OBJ</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowOverlayOptionsModal(false)}
            >
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* OBJ View Options Modal (for web) */}
      <Modal
        visible={showOBJViewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOBJViewModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowOBJViewModal(false)}
        >
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsModalTitle}>בחר זווית מבט</Text>
            <Text style={styles.optionsModalSubtitle}>מאיזה כיוון להציג את המודל?</Text>
            
            <View style={styles.optionsButtonsGrid}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleOBJViewSelect('auto')}
              >
                <Ionicons name="sparkles" size={24} color={theme.text} />
                <Text style={styles.optionButtonText}>אוטומטי</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleOBJViewSelect('front')}
              >
                <Ionicons name="eye" size={24} color={theme.text} />
                <Text style={styles.optionButtonText}>מלפנים</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleOBJViewSelect('top')}
              >
                <Ionicons name="arrow-down" size={24} color={theme.text} />
                <Text style={styles.optionButtonText}>מלמעלה</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleOBJViewSelect('side')}
              >
                <Ionicons name="arrow-forward" size={24} color={theme.text} />
                <Text style={styles.optionButtonText}>מהצד</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowOBJViewModal(false)}
            >
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Crop Modal */}
      {overlay && (
        <CropModal
          visible={showCropModal}
          overlay={overlay}
          onClose={() => setShowCropModal(false)}
          onCrop={(crop) => {
            // Update overlay with new crop and reset scale to 100%
            updateOverlay({ 
              crop,
              // Update the "effective" dimensions for scale calculation
              originalWidth: crop.width,
              originalHeight: crop.height,
              scale: 1, // Reset scale to 100% of the cropped area
            });
          }}
        />
      )}
    </GestureHandlerRootView>
  );
}

const createStyles = (theme: any, layout: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
    },
    roomSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    roomName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.background,
    },
    headerButtonActive: {
      backgroundColor: `${theme.primary}20`,
    },
    canvasContainer: {
      flex: 1,
    },
    // Arrow drawing banner
    arrowBanner: {
      position: 'absolute',
      top: 12,
      left: 16,
      right: 16,
      zIndex: 100,
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: 'rgba(30, 58, 95, 0.92)',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
      borderWidth: 1,
      borderColor: 'rgba(74, 144, 226, 0.35)',
    },
    arrowBannerContent: {
      flex: 1,
      gap: 4,
    },
    arrowBannerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    arrowBannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    arrowBannerText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 18,
    },
    arrowBannerSteps: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 6,
    },
    arrowStepDone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    arrowStepDoneText: {
      fontSize: 12,
      color: '#4ADE80',
      fontWeight: '600',
    },
    arrowStepPending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    arrowStepPendingText: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.6)',
    },
    arrowBannerClose: {
      padding: 4,
      marginStart: 8,
    },
    noRoomMessage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    noRoomText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    noRoomSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    createFirstRoomButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.primary,
      borderRadius: 10,
    },
    createFirstRoomText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    
    // Room list modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    roomListContainer: {
      width: '90%',
      maxWidth: 400,
      maxHeight: '70%',
      backgroundColor: theme.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    roomListHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    roomListTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    roomList: {
      padding: 8,
    },
    emptyRooms: {
      alignItems: 'center',
      padding: 32,
    },
    emptyRoomsText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginTop: 12,
    },
    emptyRoomsSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    roomItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.background,
      marginBottom: 8,
    },
    roomItemActive: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    roomItemInfo: {
      flex: 1,
    },
    roomItemName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    roomItemDimensions: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    roomDeleteButton: {
      padding: 8,
    },
    createRoomButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      margin: 16,
      padding: 14,
      backgroundColor: theme.primary,
      borderRadius: 10,
    },
    createRoomButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    
    // Route modal
    routeModalContainer: {
      width: '90%',
      maxWidth: 400,
      backgroundColor: theme.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    routeModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    routeModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    routeFormGroup: {
      padding: 16,
      paddingTop: 12,
    },
    routeFormLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    routeFormInput: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    colorOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    gradeOptions: {
      flexDirection: 'row',
      gap: 8,
    },
    gradeOption: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    gradeOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    gradeOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    gradeOptionTextSelected: {
      color: '#ffffff',
    },
    routeModalActions: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    routeModalCancel: {
      flex: 1,
      padding: 14,
      borderRadius: 10,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    routeModalCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    routeModalCreate: {
      flex: 2,
      padding: 14,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: 'center',
    },
    routeModalCreateText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    
    // Options Modal (for web)
    optionsModalContent: {
      width: '90%',
      maxWidth: 350,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    optionsModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    optionsModalSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    optionsButtonsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    optionsButtonsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
      marginBottom: 16,
    },
    optionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: theme.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 100,
      gap: 8,
    },
    optionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    cancelButton: {
      padding: 12,
      width: '100%',
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    // Wall edit panel styles
    wallEditPanel: {
      backgroundColor: theme.surface,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    // Fill settings panel styles
    fillSettingsPanel: {
      backgroundColor: theme.surface,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    fillSettingsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    fillColorRow: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      marginBottom: 12,
    },
    colorPickerScroll: {
      flex: 1,
    },
    fillSettingsLabel: {
      fontSize: 14,
      color: theme.text,
      marginStart: 12,
      minWidth: 50,
    },
    colorOption: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginHorizontal: 4,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: theme.primary,
      borderWidth: 3,
    },
    hexColorRow: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      marginBottom: 12,
    },
    hexInputWrapper: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center',
      marginHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      backgroundColor: theme.inputBackground || theme.background,
    },
    hexColorPreview: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginEnd: 8,
    },
    hexColorInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      paddingVertical: 8,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fillOpacityRow: {
      flexDirection: 'row' as const,
      alignItems: 'center',
    },
    opacitySliderContainer: {
      flex: 1,
      marginHorizontal: 12,
    },
    opacitySlider: {
      width: '100%',
      height: 40,
    },
    opacityValue: {
      fontSize: 14,
      color: theme.text,
      minWidth: 40,
      textAlign: 'center' as const,
    },
  });
