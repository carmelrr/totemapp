import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { RouteDoc } from '@/features/routes-map/types/route';

type RouteStatus = 'unsent' | 'project' | 'sent' | 'flashed';

interface QuickStatusBarProps {
  route: RouteDoc;
  onStatusUpdate: (routeId: string, status: RouteStatus) => void;
  currentStatus?: RouteStatus;
}

/**
 * פס סטטוס מהיר בסגנון TopLogger
 * מאפשר עדכון מהיר של סטטוס המסלול בלחיצה אחת
 */
export default function QuickStatusBar({
  route,
  onStatusUpdate,
  currentStatus = 'unsent',
}: QuickStatusBarProps) {
  
  const statusOptions: Array<{
    key: RouteStatus;
    label: string;
    emoji: string;
    color: string;
  }> = [
    {
      key: 'unsent',
      label: 'לא שלח',
      emoji: '❌',
      color: '#ef4444',
    },
    {
      key: 'project',
      label: 'פרויקט',
      emoji: '🎯',
      color: '#f59e0b',
    },
    {
      key: 'sent',
      label: 'שלח',
      emoji: '✅',
      color: '#10b981',
    },
    {
      key: 'flashed',
      label: 'פלאש',
      emoji: '⚡',
      color: '#8b5cf6',
    },
  ];

  const handleStatusPress = (status: RouteStatus) => {
    onStatusUpdate(route.id, status);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>סטטוס מסלול:</Text>
      <View style={styles.buttonsContainer}>
        {statusOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.statusButton,
              {
                backgroundColor: currentStatus === option.key 
                  ? option.color 
                  : '#f3f4f6',
                borderColor: option.color,
              },
            ]}
            onPress={() => handleStatusPress(option.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{option.emoji}</Text>
            <Text
              style={[
                styles.buttonText,
                {
                  color: currentStatus === option.key 
                    ? '#ffffff' 
                    : option.color,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    minWidth: 80,
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
