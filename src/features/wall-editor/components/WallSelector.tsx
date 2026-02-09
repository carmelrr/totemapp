// WallSelector - Admin panel for selecting and managing published walls

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { Room } from '../types';
import { setRoomVisibility, unpublishRoom } from '../services/editorService';

interface WallSelectorProps {
  /** Available published rooms */
  rooms: Room[];
  /** Currently selected room ID */
  selectedRoomId: string | null;
  /** Callback when a room is selected */
  onSelectRoom: (roomId: string | null) => void;
  /** Whether user is admin */
  isAdmin: boolean;
  /** Callback when rooms need to be refreshed */
  onRefresh?: () => void;
  /** Navigate to editor */
  onEditRoom?: (roomId: string) => void;
}

export function WallSelector({
  rooms,
  selectedRoomId,
  onSelectRoom,
  isAdmin,
  onRefresh,
  onEditRoom,
}: WallSelectorProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [showModal, setShowModal] = useState(false);
  
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  
  const handleToggleVisibility = useCallback(async (room: Room) => {
    try {
      await setRoomVisibility(room.id, !room.isHidden);
      Alert.alert(
        'הצלחה',
        room.isHidden ? 'הקיר כעת גלוי למשתמשים' : 'הקיר כעת מוסתר ממשתמשים'
      );
      onRefresh?.();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      Alert.alert(t.common.error, t.alerts.wallVisibilityFailed);
    }
  }, [onRefresh]);
  
  const handleUnpublish = useCallback(async (room: Room) => {
    Alert.alert(
      'הסרת קיר',
      `האם אתה בטוח שברצונך להסיר את "${room.name}" ממפת המסלולים?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            try {
              await unpublishRoom(room.id);
              if (selectedRoomId === room.id) {
                onSelectRoom(rooms[0]?.id || null);
              }
              Alert.alert(t.common.success, t.alerts.wallRemoved);
              onRefresh?.();
            } catch (error) {
              console.error('Error unpublishing room:', error);
              Alert.alert(t.common.error, t.alerts.wallRemoveFailed);
            }
          },
        },
      ]
    );
  }, [rooms, selectedRoomId, onSelectRoom, onRefresh]);
  
  if (rooms.length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Wall selector button */}
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="map" size={18} color={theme.text} />
        <Text style={styles.selectorText} numberOfLines={1}>
          {selectedRoom?.name || 'בחר קיר'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
      
      {/* Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>קירות פעילים</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.roomsList}>
              {rooms.map(room => (
                <TouchableOpacity
                  key={room.id}
                  style={[
                    styles.roomItem,
                    selectedRoomId === room.id && styles.roomItemSelected,
                    room.isHidden && styles.roomItemHidden,
                  ]}
                  onPress={() => {
                    onSelectRoom(room.id);
                    setShowModal(false);
                  }}
                >
                  <View style={styles.roomInfo}>
                    <View style={styles.roomNameRow}>
                      <Text style={[
                        styles.roomName,
                        room.isHidden && styles.roomNameHidden,
                      ]}>
                        {room.name}
                      </Text>
                      {room.isHidden && (
                        <Ionicons name="eye-off" size={14} color={theme.textSecondary} />
                      )}
                    </View>
                    <Text style={styles.roomMeta}>
                      {room.walls.length} קירות • {room.sectors?.length || 0} סקטורים
                    </Text>
                  </View>
                  
                  {isAdmin && (
                    <View style={styles.roomActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleVisibility(room);
                        }}
                      >
                        <Ionicons
                          name={room.isHidden ? "eye" : "eye-off"}
                          size={18}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                      {onEditRoom && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            setShowModal(false);
                            onEditRoom(room.id);
                          }}
                        >
                          <Ionicons name="pencil" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleUnpublish(room);
                        }}
                      >
                        <Ionicons name="trash" size={18} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    selectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 8,
      maxWidth: 180,
    },
    selectorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.background,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    roomsList: {
      padding: 16,
    },
    roomItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: theme.surface,
    },
    roomItemSelected: {
      backgroundColor: `${theme.primary}20`,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    roomItemHidden: {
      opacity: 0.6,
    },
    roomInfo: {
      flex: 1,
    },
    roomNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    roomName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    roomNameHidden: {
      color: theme.textSecondary,
    },
    roomMeta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    roomActions: {
      flexDirection: 'row',
      gap: 4,
    },
    actionButton: {
      padding: 6,
      borderRadius: 6,
    },
  });

export default WallSelector;
