import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { RouteDoc } from '../types/route';
import { getContrastTextColor } from '../utils/colors';

interface RouteBottomSheetProps {
  visible: boolean;
  route: RouteDoc | null;
  onClose: () => void;
  onMarkTop?: (route: RouteDoc) => void;
  onRate?: (route: RouteDoc, rating: number) => void;
  onShare?: (route: RouteDoc) => void;
  onReport?: (route: RouteDoc) => void;
}

export default function RouteBottomSheet({
  visible,
  route,
  onClose,
  onMarkTop,
  onRate,
  onShare,
  onReport,
}: RouteBottomSheetProps) {
  if (!route) return null;

  const textColor = getContrastTextColor(route.color);

  const handleMarkTop = () => {
    onMarkTop?.(route);
  };

  const handleRate = (rating: number) => {
    onRate?.(route, rating);
  };

  const handleShare = () => {
    onShare?.(route);
  };

  const handleReport = () => {
    onReport?.(route);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: route.color }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: textColor }]}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.routeName, { color: textColor }]}>{route.name}</Text>
            <Text style={[styles.routeGrade, { color: textColor }]}>{route.grade}</Text>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Route Info */}
          <View style={styles.section}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{route.rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{route.tops}</Text>
                <Text style={styles.statLabel}>Tops</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{route.comments}</Text>
                <Text style={styles.statLabel}>Comments</Text>
              </View>
            </View>
          </View>

          {/* Details */}
          <View style={styles.section}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <View style={[styles.statusBadge, getStatusStyle(route.status)]}>
                <Text style={[styles.statusText, getStatusTextStyle(route.status)]}>
                  {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                </Text>
              </View>
            </View>
            
            {route.setter && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Setter:</Text>
                <Text style={styles.detailValue}>{route.setter}</Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created:</Text>
              <Text style={styles.detailValue}>{formatDate(route.createdAt)}</Text>
            </View>

            {route.tags && route.tags.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tags:</Text>
                <View style={styles.tagsContainer}>
                  {route.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleMarkTop}>
              <Text style={styles.actionButtonText}>🏆 Mark as Topped</Text>
            </TouchableOpacity>

            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Rate this route:</Text>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleRate(star)}
                    style={styles.starButton}
                  >
                    <Text style={[
                      styles.starText,
                      star <= route.rating && styles.filledStar
                    ]}>
                      ⭐
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Text style={styles.actionButtonText}>📤 Share Route</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.reportButton]} onPress={handleReport}>
              <Text style={[styles.actionButtonText, styles.reportButtonText]}>🚩 Report Issue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'active':
      return { backgroundColor: '#dcfce7' };
    case 'archived':
      return { backgroundColor: '#fef3c7' };
    case 'draft':
      return { backgroundColor: '#e5e7eb' };
    default:
      return { backgroundColor: '#f3f4f6' };
  }
}

function getStatusTextStyle(status: string) {
  switch (status) {
    case 'active':
      return { color: '#166534' };
    case 'archived':
      return { color: '#92400e' };
    case 'draft':
      return { color: '#4b5563' };
    default:
      return { color: '#6b7280' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 40,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginRight: 32, // Compensate for close button
  },
  routeName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  routeGrade: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 4,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#4b5563',
  },
  actionButton: {
    backgroundColor: '#f9fafb',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
  },
  reportButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  reportButtonText: {
    color: '#dc2626',
  },
  ratingSection: {
    marginVertical: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  starText: {
    fontSize: 24,
    opacity: 0.3,
  },
  filledStar: {
    opacity: 1,
  },
});
