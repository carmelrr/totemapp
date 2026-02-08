// CreateSectorModal - Modal for creating a new sector
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { Sector } from '../types';

const SECTOR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
];

interface CreateSectorModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  existingSectors: Sector[];
}

export default function CreateSectorModal({
  visible,
  onClose,
  onCreate,
  existingSectors,
}: CreateSectorModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [name, setName] = useState('');
  const [color, setColor] = useState(SECTOR_COLORS[0]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    setName('');
    setColor(SECTOR_COLORS[(existingSectors.length + 1) % SECTOR_COLORS.length]);
    onClose();
  };

  const suggestedNames = [
    'אזור A', 'אזור B', 'אזור C',
    'קיר חזית', 'קיר צד', 'קיר אחורי',
    'סלאב', 'אובר', 'גג',
    'פינה שמאלית', 'פינה ימנית', 'מרכז',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.modal} 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>הוסף סקטור</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>שם הסקטור</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="לדוגמה: אזור A"
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />

          {/* Suggested names */}
          <Text style={styles.label}>שמות מוצעים</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
          >
            <View style={styles.suggestions}>
              {suggestedNames.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={[
                    styles.suggestionChip,
                    name === suggestion && styles.suggestionChipActive,
                  ]}
                  onPress={() => setName(suggestion)}
                >
                  <Text style={[
                    styles.suggestionText,
                    name === suggestion && styles.suggestionTextActive,
                  ]}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>צבע</Text>
          <View style={styles.colors}>
            {SECTOR_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  color === c && styles.colorSwatchSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createButtonText}>צור סקטור</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            לאחר יצירת הסקטור, סמן את האזור שלו על הקיר בעזרת גרירה
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  suggestionsScroll: {
    marginBottom: 16,
  },
  suggestions: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  suggestionChipActive: {
    backgroundColor: `${theme.primary}20`,
    borderColor: theme.primary,
  },
  suggestionText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  suggestionTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
