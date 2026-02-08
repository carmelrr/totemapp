/**
 * @fileoverview Manage Categories Screen
 * @description Create, edit, and manage competition categories
 * Categories can be auto-assigned based on gender, birth year, or skill level
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useLanguage } from '@/features/language';
import { useCompetition, useParticipants } from '@/features/competitions/hooks/useCompetition';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { Category, Gender, SkillLevel, Participant } from '@/features/competitions/types';

interface CategoryFormData {
  name: string;
  description: string;
  gender: Gender | null;
  minAge: string;
  maxAge: string;
  skillLevels: SkillLevel[];
  order: number;
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  description: '',
  gender: null,
  minAge: '',
  maxAge: '',
  skillLevels: [],
  order: 0,
};

// Skill level values (labels will be set dynamically with translations)
const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'pro'];

export default function ManageCategoriesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const rolesContext = useRolesContext();

  // Generate skill level options with translations
  const SKILL_LEVEL_OPTIONS: { value: SkillLevel; label: string }[] = [
    { value: 'beginner', label: t.competitionExt.beginner },
    { value: 'intermediate', label: t.competitionExt.intermediate },
    { value: 'advanced', label: t.competitionExt.advanced },
    { value: 'pro', label: t.competitionExt.pro },
  ];

  const { competition, loading: competitionLoading } = useCompetition(competitionId);
  const { participants, refresh: refreshParticipants } = useParticipants(competitionId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);
  
  // For assigning participants
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  // Check permissions - only head_judge and admin can manage categories
  const canManageCategories = rolesContext.isAdmin || rolesContext.isHeadJudge;

  useEffect(() => {
    loadCategories();
  }, [competitionId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const cats = await ParticipantService.getCategories(competitionId);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert(t.common.error, t.competitionExt.cannotLoadCategories);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setFormData({ ...EMPTY_FORM, order: categories.length });
    setShowModal(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      gender: category.gender || null,
      minAge: category.minAge?.toString() || '',
      maxAge: category.maxAge?.toString() || '',
      skillLevels: category.skillLevels || [],
      order: category.order || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert(t.common.error, t.competitionExt.mustEnterCategoryName);
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        gender: formData.gender || undefined,
        minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : undefined,
        skillLevels: formData.skillLevels.length > 0 ? formData.skillLevels : undefined,
        order: formData.order,
      };

      if (editingCategory) {
        await ParticipantService.updateCategory(competitionId, editingCategory.id, categoryData);
        Alert.alert(t.common.success, t.competitionExt.categoryUpdated);
      } else {
        await ParticipantService.createCategory(competitionId, categoryData);
        Alert.alert(t.common.success, t.competitionExt.categoryCreated);
      }

      setShowModal(false);
      loadCategories();
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.competitionExt.cannotSaveCategory);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      t.competitionExt.deleteCategory,
      t.competitionExt.deleteCategoryConfirm(category.name),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await ParticipantService.deleteCategory(competitionId, category.id);
              loadCategories();
              refreshParticipants();
              Alert.alert(t.common.success, t.competitionExt.categoryDeleted);
            } catch (error) {
              Alert.alert(t.common.error, t.competitionExt.cannotDeleteCategory);
            }
          },
        },
      ]
    );
  };

  const handleAutoAssignAll = async () => {
    Alert.alert(
      t.competitionExt.autoAssign,
      t.competitionExt.autoAssignConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.competitionExt.assign,
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const result = await ParticipantService.autoAssignCategories(competitionId);
              loadCategories();
              refreshParticipants();
              Alert.alert(t.common.success, t.competitionExt.participantsAssigned(result.assigned));
            } catch (error: any) {
              Alert.alert(t.common.error, error.message || t.competitionExt.cannotAssignCategories);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleManualAssign = (participant: Participant) => {
    setSelectedParticipant(participant);
    setShowAssignModal(true);
  };

  const handleAssignToCategory = async (categoryId: string, categoryName: string) => {
    if (!selectedParticipant) return;

    try {
      await ParticipantService.updateParticipant(competitionId, selectedParticipant.id, {
        category: categoryId,
        categoryName: categoryName,
      });
      setShowAssignModal(false);
      setSelectedParticipant(null);
      refreshParticipants();
      loadCategories();
      Alert.alert(t.common.success, t.competitionExt.assignedTo(selectedParticipant.userName, categoryName));
    } catch (error) {
      Alert.alert(t.common.error, t.competitionExt.cannotAssignParticipant);
    }
  };

  const toggleSkillLevel = (level: SkillLevel) => {
    setFormData(prev => ({
      ...prev,
      skillLevels: prev.skillLevels.includes(level)
        ? prev.skillLevels.filter(l => l !== level)
        : [...prev.skillLevels, level],
    }));
  };

  // Get participants without category
  const unassignedParticipants = participants.filter(p => !p.category && p.isActive);

  const styles = createStyles(theme);

  if (!canManageCategories) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.competitionExt.manageCategories}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.error || '#e74c3c'} />
          <Text style={styles.errorText}>{t.competitionExt.noPermission}</Text>
          <Text style={styles.errorSubtext}>
            {t.competitionExt.onlyHeadJudgesAndAdmins}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.competitionExt.manageCategories}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleOpenCreateModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <ScrollView style={styles.content}>
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, isSubmitting && styles.actionButtonDisabled]}
              onPress={handleAutoAssignAll}
              disabled={isSubmitting}
            >
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>{t.competitionExt.autoAssign}</Text>
            </TouchableOpacity>
          </View>

          {/* Categories List */}
          <Text style={styles.sectionTitle}>{t.competitionExt.categoriesCount(categories.length)}</Text>
          {categories.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>{t.competitionExt.noCategoriesYet}</Text>
              <Text style={styles.emptySubtext}>{t.competitionExt.clickPlusToCreate}</Text>
            </View>
          ) : (
            categories.map((category) => (
              <View key={category.id} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {category.participantCount || 0} {t.competitionExt.participantsInCategory}
                    </Text>
                  </View>
                </View>
                
                {category.description && (
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                )}
                
                <View style={styles.categoryRules}>
                  {category.gender && (
                    <Text style={styles.ruleText}>
                      {t.competitionExt.genderFilter}: {category.gender === 'male' ? t.competitionExt.male : t.competitionExt.female}
                    </Text>
                  )}
                  {(category.minAge !== undefined || category.maxAge !== undefined) && (
                    <Text style={styles.ruleText}>
                      {t.competitionExt.ageRange}: {category.minAge ?? '∞'} - {category.maxAge ?? '∞'}
                    </Text>
                  )}
                  {category.skillLevels && category.skillLevels.length > 0 && (
                    <Text style={styles.ruleText}>
                      {t.competitionExt.skillLevels}: {category.skillLevels.map(l => 
                        SKILL_LEVEL_OPTIONS.find(o => o.value === l)?.label
                      ).join(', ')}
                    </Text>
                  )}
                </View>

                <View style={styles.categoryActions}>
                  <TouchableOpacity
                    style={styles.categoryActionBtn}
                    onPress={() => handleOpenEditModal(category)}
                  >
                    <Ionicons name="pencil" size={18} color={theme.primary} />
                    <Text style={[styles.categoryActionText, { color: theme.primary }]}>{t.common.edit}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.categoryActionBtn}
                    onPress={() => handleDelete(category)}
                  >
                    <Ionicons name="trash" size={18} color="#e74c3c" />
                    <Text style={[styles.categoryActionText, { color: '#e74c3c' }]}>{t.common.delete}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* Unassigned Participants */}
          {unassignedParticipants.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {t.competitionExt.unassignedParticipants} ({unassignedParticipants.length})
              </Text>
              {unassignedParticipants.map((participant) => (
                <View key={participant.id} style={styles.participantCard}>
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{participant.userName}</Text>
                    <Text style={styles.participantDetails}>
                      {participant.gender === 'male' ? '👨' : participant.gender === 'female' ? '👩' : ''}
                      {participant.birthYear ? ` ${participant.birthYear}` : ''}
                      {participant.skillLevel ? ` • ${
                        SKILL_LEVEL_OPTIONS.find(o => o.value === participant.skillLevel)?.label
                      }` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.assignButton}
                    onPress={() => handleManualAssign(participant)}
                  >
                    <Ionicons name="arrow-forward-circle" size={24} color={theme.primary} />
                    <Text style={styles.assignButtonText}>{t.competitionExt.assign}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Create/Edit Category Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? t.common.edit : t.common.create}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Name */}
              <Text style={styles.inputLabel}>{t.competitionExt.categoryName}</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="לדוגמה: גברים 18-35"
                placeholderTextColor={theme.textSecondary}
              />

              {/* Description */}
              <Text style={styles.inputLabel}>{t.competitionExt.description}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="תיאור אופציונלי"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={2}
              />

              {/* Gender */}
              <Text style={styles.inputLabel}>{t.competitionExt.genderFilter}</Text>
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    formData.gender === null && styles.genderButtonActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, gender: null }))}
                >
                  <Text style={[
                    styles.genderButtonText,
                    formData.gender === null && styles.genderButtonTextActive,
                  ]}>{t.common.all}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    formData.gender === 'male' && styles.genderButtonActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, gender: 'male' }))}
                >
                  <Text style={[
                    styles.genderButtonText,
                    formData.gender === 'male' && styles.genderButtonTextActive,
                  ]}>{t.competitionExt.male}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    formData.gender === 'female' && styles.genderButtonActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, gender: 'female' }))}
                >
                  <Text style={[
                    styles.genderButtonText,
                    formData.gender === 'female' && styles.genderButtonTextActive,
                  ]}>{t.competitionExt.female}</Text>
                </TouchableOpacity>
              </View>

              {/* Age Range */}
              <Text style={styles.inputLabel}>{t.competitionExt.ageRange}</Text>
              <Text style={styles.inputHint}>
                הגיל מחושב לפי שנתון (שנה נוכחית פחות שנת לידה)
              </Text>
              <View style={styles.yearRow}>
                <TextInput
                  style={[styles.textInput, styles.yearInput]}
                  value={formData.minAge}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, minAge: text }))}
                  placeholder="מגיל"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={styles.yearSeparator}>עד</Text>
                <TextInput
                  style={[styles.textInput, styles.yearInput]}
                  value={formData.maxAge}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, maxAge: text }))}
                  placeholder="עד גיל"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>

              {/* Skill Levels */}
              <Text style={styles.inputLabel}>{t.competitionExt.skillLevels}</Text>
              <View style={styles.skillLevelsGrid}>
                {SKILL_LEVEL_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.skillLevelChip,
                      formData.skillLevels.includes(option.value) && styles.skillLevelChipActive,
                    ]}
                    onPress={() => toggleSkillLevel(option.value)}
                  >
                    <Text style={[
                      styles.skillLevelChipText,
                      formData.skillLevels.includes(option.value) && styles.skillLevelChipTextActive,
                    ]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Order */}
              <Text style={styles.inputLabel}>{t.competitionExt.order}</Text>
              <TextInput
                style={styles.textInput}
                value={formData.order.toString()}
                onChangeText={(text) => setFormData(prev => ({ ...prev, order: parseInt(text) || 0 }))}
                keyboardType="numeric"
                maxLength={2}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingCategory ? t.common.update : t.common.create}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assign Category Modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t.competitionExt.assignTo} {selectedParticipant?.userName}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowAssignModal(false);
                setSelectedParticipant(null);
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {categories.length === 0 ? (
                <Text style={styles.noCategoriesText}>
                  {t.competitionExt.noCategoriesYet}
                </Text>
              ) : (
                categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categorySelectItem}
                    onPress={() => handleAssignToCategory(category.id, category.name)}
                  >
                    <Text style={styles.categorySelectName}>{category.name}</Text>
                    <Text style={styles.categorySelectCount}>
                      {category.participantCount || 0} {t.competitionExt.participantsInCategory}
                    </Text>
                  </TouchableOpacity>
                ))
              )}

              {/* Option to remove from category */}
              {selectedParticipant?.category && (
                <TouchableOpacity
                  style={[styles.categorySelectItem, styles.removeFromCategory]}
                  onPress={() => handleAssignToCategory('', '')}
                >
                  <Text style={styles.removeFromCategoryText}>הסר מקטגוריה</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    addButton: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 20,
      padding: 8,
    },
    placeholder: {
      width: 40,
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    errorText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    errorSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    actionButtons: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.buttonPrimary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
    },
    actionButtonDisabled: {
      opacity: 0.6,
    },
    actionButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
      marginTop: 8,
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 12,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    categoryCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    categoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    categoryBadge: {
      backgroundColor: theme.primary + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    categoryBadgeText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    categoryDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    categoryRules: {
      marginBottom: 12,
    },
    ruleText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    categoryActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
      gap: 16,
    },
    categoryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    categoryActionText: {
      fontSize: 14,
      fontWeight: '500',
    },
    participantCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    participantInfo: {
      flex: 1,
    },
    participantName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    participantDetails: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    assignButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    assignButtonText: {
      color: theme.primary,
      fontWeight: '500',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
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
    modalBody: {
      padding: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
      marginTop: 12,
    },
    inputHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    textInput: {
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    textArea: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    genderButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    genderButton: {
      flex: 1,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    genderButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    genderButtonText: {
      color: theme.text,
      fontWeight: '500',
    },
    genderButtonTextActive: {
      color: '#fff',
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    yearInput: {
      flex: 1,
      textAlign: 'center',
    },
    yearSeparator: {
      color: theme.textSecondary,
    },
    skillLevelsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    skillLevelChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    skillLevelChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    skillLevelChipText: {
      color: theme.text,
      fontSize: 13,
    },
    skillLevelChipTextActive: {
      color: '#fff',
    },
    submitButton: {
      backgroundColor: theme.buttonPrimary,
      margin: 16,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    categorySelectItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 8,
      marginBottom: 8,
    },
    categorySelectName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    categorySelectCount: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    noCategoriesText: {
      textAlign: 'center',
      color: theme.textSecondary,
      padding: 32,
    },
    removeFromCategory: {
      borderWidth: 1,
      borderColor: '#e74c3c',
      backgroundColor: 'transparent',
    },
    removeFromCategoryText: {
      color: '#e74c3c',
      fontWeight: '500',
    },
  });
