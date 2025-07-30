import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import RouteDialog from './RouteDialog';
import { getDisplayGrade, getDisplayStarRating, getCompletionCount } from '../routesService';

export default function RouteList({ routes, refreshing, onRefresh, onRouteSelect, isEditMode = false, editingRoute = null }) {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showRouteDialog, setShowRouteDialog] = useState(false);

  // Ensure routes is an array to prevent undefined errors
  const safeRoutes = routes || [];

  const handleRoutePress = (route) => {
    if (onRouteSelect) {
      onRouteSelect(route);
    } else {
      setSelectedRoute(route);
      setShowRouteDialog(true);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push('★');
    }
    
    if (hasHalfStar) {
      stars.push('☆');
    }
    
    // Fill remaining with empty stars up to 5
    while (stars.length < 5) {
      stars.push('☆');
    }
    
    return stars.join('');
  };

  const renderItem = ({ item }) => {
    const displayGrade = getDisplayGrade(item);
    const starRating = getDisplayStarRating(item);
    const completionCount = getCompletionCount(item);
    const isSelected = editingRoute && editingRoute.id === item.id;
    
    return (
      <TouchableOpacity 
        style={[
          styles.item, 
          { backgroundColor: item.color || '#f0f0f0' },
          isEditMode && styles.editModeItem,
          isSelected && styles.selectedItem
        ]}
        onPress={() => handleRoutePress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.itemContent}>
          <View style={styles.leftContent}>
            <Text style={[styles.title, { color: getTextColor(item.color) }]}>{displayGrade || 'V?'}</Text>
            {isEditMode && (
              <Text style={styles.editModeIndicator}>✎</Text>
            )}
          </View>
          <View style={styles.ratingContainer}>
            <Text style={styles.starsText}>{renderStars(starRating)}</Text>
            <Text style={styles.completionText}>
              ✓ {completionCount}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedIndicatorText}>נבחר</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // פונקציה לקבלת צבע הטקסט המתאים לצבע הרקע
  const getTextColor = (backgroundColor) => {
    if (!backgroundColor) return '#000';
    
    // מיפוי שמות הצבעים בעברית לקודי צבעים
    const colorMap = {
      'אדום': '#FF0000', 'אדום כהה': '#FF1744', 'אדום כתום': '#FF5722', 'ורוד אדום': '#E91E63', 
      'אדום חי': '#F44336', 'אדום בהיר': '#FF6B6B', 'אדום פסטל': '#FF8A80', 'ורוד בהיר': '#FFCDD2',
      'כתום': '#FF9800', 'כתום זהב': '#FF8F00', 'כתום כהה': '#FF6F00', 'כתום בהיר': '#FFB74D', 
      'כתום צהוב': '#FFCC02', 'כתום חיוור': '#FFE082', 'כתום פסטל': '#FFECB3',
      'צהוב': '#FFEB3B', 'צהוב זהב': '#FFC107', 'צהוב כתום': '#FF8F00', 'צהוב בהיר': '#FFFF00', 
      'צהוב חיוור': '#FFFF8D', 'שנהב': '#FFFDE7', 'ירוק צהוב': '#F9FBE7',
      'ירוק': '#4CAF50', 'ירוק בהיר': '#8BC34A', 'ירוק ליים': '#CDDC39', 'ירוק זית': '#689F38', 
      'ירוק יער': '#388E3C', 'ירוק כהה': '#2E7D32', 'ירוק פסטל': '#A5D6A7', 'ירוק חיוור': '#C8E6C9',
      'תכלת': '#00BCD4', 'תכלת בהיר': '#26C6DA', 'תכלת כהה': '#00ACC1', 'תכלת עמוק': '#0097A7', 
      'תכלת חיוור': '#80DEEA', 'תכלת פסטל': '#B2EBF2', 'אקווה': '#E0F2F1', 'ציאן': '#4DD0E1',
      'כחול': '#2196F3', 'כחול כהה': '#1976D2', 'כחול נייבי': '#0D47A1', 'כחול בהיר': '#42A5F5', 
      'כחול שמיים': '#64B5F6', 'כחול חיוור': '#90CAF9', 'כחול פסטל': '#BBDEFB', 'כחול בייבי': '#E3F2FD',
      'סגול': '#9C27B0', 'סגול כהה': '#673AB7', 'סגול כחול': '#3F51B5', 'סגול עמוק': '#7B1FA2', 
      'סגול בהיר': '#AB47BC', 'סגול ורוד': '#BA68C8', 'סגול חיוור': '#CE93D8', 'סגול פסטל': '#E1BEE7',
      'חום': '#795548', 'חום בהיר': '#8D6E63', 'חום כהה': '#6D4C41', 'חום קפה': '#5D4037', 
      'חום חול': '#A1887F', 'חום פסטל': '#BCAAA4', 'בז\'': '#D7CCC8', 'קרם': '#EFEBE9',
      'אפור': '#9E9E9E', 'אפור כהה': '#757575', 'אפור פחם': '#424242', 'אפור בהיר': '#BDBDBD', 
      'אפור חיוור': '#E0E0E0', 'אפור פסטל': '#F5F5F5',
      'שחור': '#000000', 'לבן': '#FFFFFF', 'לבן שנהב': '#FFFEF7'
    };

    // המר את שם הצבע לקוד צבע אם צריך
    const colorCode = colorMap[backgroundColor] || backgroundColor;
    
    // צבעים בהירים שצריכים טקסט שחור
    const lightColors = [
      '#FFFFFF', '#FFFEF7', '#FFFDE7', '#F9FBE7', '#F0F4C3', '#E0F2F1', '#E3F2FD',
      '#E1BEE7', '#EFEBE9', '#D7CCC8', '#BCAAA4', '#E0E0E0', '#F5F5F5', '#FFCDD2',
      '#FFE082', '#FFECB3', '#A5D6A7', '#C8E6C9', '#B2EBF2', '#80DEEA', '#90CAF9',
      '#BBDEFB', '#CE93D8', '#FFFF8D', '#FFFF00', '#FFCC02', '#FFB74D', '#FFE082',
      '#FFECB3', '#FF8A80', '#FF6B6B', '#BDBDBD', '#f0f0f0'
    ];
    
    return lightColors.includes(colorCode) ? '#000000' : '#FFFFFF';
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={safeRoutes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        refreshControl={
          refreshing !== undefined && onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3498db']}
              tintColor='#3498db'
            />
          ) : undefined
        }
      />
      
      <RouteDialog
        visible={showRouteDialog}
        route={selectedRoute}
        onClose={() => {
          setShowRouteDialog(false);
          setSelectedRoute(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    width: '100%',
    paddingHorizontal: 20,
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 10,
    marginVertical: 3,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 2,
    textAlign: 'right',
  },
  gradeSubtext: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  starsText: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  completionText: {
    fontSize: 11,
    color: '#27AE60',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '600',
  },
  editModeItem: {
    borderWidth: 2,
    borderColor: '#3498db',
    borderStyle: 'dashed',
  },
  selectedItem: {
    borderWidth: 3,
    borderColor: '#f39c12',
    borderStyle: 'solid',
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  editModeIndicator: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: 'bold',
    marginLeft: 5,
    textAlign: 'right',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#f39c12',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});

