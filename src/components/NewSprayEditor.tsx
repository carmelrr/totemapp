// src/components/NewSprayEditor.tsx
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { useNewSprayEditor } from '@/hooks/'useNewSprayEditor';
import { BottomToolbar } from './ui/BottomToolbar';
import { FloatingPanel } from './ui/FloatingPanel';
import { ToolButton } from './ui/ToolButton';
import { ROLE_ORDER, HOLD_ROLE_CONFIG } from '@/constants/'roles';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface NewSprayEditorProps {
  wallImageUri?: string;
  wallId?: string;
  onSave?: (routeData: any) => void;
  onCancel?: () => void;
}

export const NewSprayEditor: React.FC<NewSprayEditorProps> = ({
  wallImageUri,
  wallId,
  onSave,
  onCancel,
}) => {
  const canvasHeight = screenHeight - 200; // השאר מקום לטולבר
  
  const editor = useNewSprayEditor({
    canvasWidth: screenWidth,
    canvasHeight: canvasHeight,
    imageWidth: 1000, // זמני
    imageHeight: 1000, // זמני
  });

  // הגדרת Pan Responder למחוות מגע
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        editor.handleCanvasTouch(locationX, locationY);
      },
      
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.numberActiveTouches === 1) {
          // Pan עם אצבע אחת
          editor.pan(gestureState.dx, gestureState.dy);
        } else if (gestureState.numberActiveTouches === 2) {
          // TODO: Zoom עם שתי אצבעות
          // צריך logic נוסף לחישוב מרחק ומוקד
        }
      },
      
      onPanResponderRelease: () => {
        // סיום מגע
      },
    })
  ).current;

  const tools = [
    { id: 'circle', title: 'טבעת', icon: '⭕' },
    { id: 'dot', title: 'נקודה', icon: '⚫' },
    { id: 'volume', title: 'נפח', icon: '📦', disabled: true },
    { id: 'outline', title: 'קו מתאר', icon: '🔲', disabled: true },
  ];

  const handleToolSelect = (toolId: string) => {
    editor.setSelectedTool(toolId as any);
  };

  const handleRoleSelect = (role: string) => {
    editor.setSelectedRole(role as any);
  };

  const handleSave = () => {
    const validation = editor.validateRoute();
    if (!validation.isValid) {
      console.warn('Route validation failed:', validation.errors);
      return;
    }
    
    onSave?.(editor.route);
  };

  const currentHolds = editor.route.holds || [];
  const selectedHold = editor.getSelectedHold();

  return (
    <View style={styles.container}>
      {/* Canvas Area */}
      <View 
        style={styles.canvas} 
        {...panResponder.panHandlers}
      >
        {/* TODO: כאן יהיה קנבס Skia עם תמונת הקיר והאחיזות */}
        <View style={styles.placeholder}>
          {/* רנדור זמני של אחיזות */}
          {currentHolds.map((hold, index) => {
            const screenPos = editor.getHoldScreenPosition(hold);
            const radius = editor.getHoldScreenRadius(hold);
            const isSelected = index === editor.selectedHoldIndex;
            
            return (
              <View
                key={hold.id}
                style={[
                  styles.hold,
                  {
                    left: screenPos.x - radius,
                    top: screenPos.y - radius,
                    width: radius * 2,
                    height: radius * 2,
                    backgroundColor: hold.color,
                    borderColor: isSelected ? '#FFD700' : '#FFFFFF',
                    borderWidth: isSelected ? 3 : 1,
                  }
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Role Selection Panel */}
      <FloatingPanel position="top-left">
        <View style={styles.rolePanel}>
          {ROLE_ORDER.map((role) => {
            const config = HOLD_ROLE_CONFIG[role];
            return (
              <ToolButton
                key={role}
                title={config.name}
                icon={config.icon}
                isSelected={editor.selectedRole === role}
                onPress={() => handleRoleSelect(role)}
                style={styles.roleButton}
              />
            );
          })}
        </View>
      </FloatingPanel>

      {/* Actions Panel */}
      <FloatingPanel position="top-right">
        <View style={styles.actionsPanel}>
          <ToolButton
            title="Undo"
            icon="↶"
            onPress={editor.undo}
            disabled={!editor.canUndo()}
          />
          <ToolButton
            title="Redo"
            icon="↷"
            onPress={editor.redo}
            disabled={!editor.canRedo()}
          />
          <ToolButton
            title="Clear"
            icon="🗑️"
            onPress={editor.clearAllHolds}
            disabled={currentHolds.length === 0}
          />
        </View>
      </FloatingPanel>

      {/* Selected Hold Info */}
      {selectedHold && (
        <FloatingPanel position="bottom-left">
          <View style={styles.holdInfo}>
            <ToolButton
              title="מחק אחיזה"
              icon="❌"
              onPress={editor.removeSelectedHold}
            />
            <ToolButton
              title="סיים עריכה"
              icon="✅"
              onPress={editor.finishEditing}
            />
          </View>
        </FloatingPanel>
      )}

      {/* Save/Cancel Panel */}
      <FloatingPanel position="bottom-right">
        <View style={styles.savePanel}>
          {onCancel && (
            <ToolButton
              title="ביטול"
              icon="❌"
              onPress={onCancel}
            />
          )}
          <ToolButton
            title="שמור"
            icon="💾"
            onPress={handleSave}
          />
        </View>
      </FloatingPanel>

      {/* Bottom Toolbar */}
      <BottomToolbar
        selectedTool={editor.selectedTool}
        onToolSelect={handleToolSelect}
        tools={tools}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#E5E5E5',
    position: 'relative',
  },
  hold: {
    position: 'absolute',
    borderRadius: 50,
    opacity: 0.8,
  },
  rolePanel: {
    gap: 8,
  },
  roleButton: {
    minWidth: 60,
  },
  actionsPanel: {
    flexDirection: 'row',
    gap: 8,
  },
  holdInfo: {
    gap: 8,
  },
  savePanel: {
    flexDirection: 'row',
    gap: 8,
  },
});
