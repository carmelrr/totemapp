import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SprayHeader from '../../components/spray/SprayHeader';
import { useSprayWall } from '../../state/spray/useSprayWall';
import { checkIsAdmin } from '../../utils/permissions';

const WALL_ID = 'totem-35';

const SprayWallHomeScreen = ({ navigation }) => {
  const { currentSeason, routes, loading, error, refreshSeason } = useSprayWall(WALL_ID);
  const [searchText, setSearchText] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [filteredRoutes, setFilteredRoutes] = useState([]);

  useEffect(() => {
    checkIsAdmin().then(setIsAdmin);
  }, []);

  useEffect(() => {
    // Filter routes based on search text
    if (searchText.trim() === '') {
      setFilteredRoutes(routes);
    } else {
      const filtered = routes.filter(route =>
        route.name.toLowerCase().includes(searchText.toLowerCase()) ||
        route.grade.toLowerCase().includes(searchText.toLowerCase()) ||
        route.setterName?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredRoutes(filtered);
    }
  }, [routes, searchText]);

  const handleAddRoute = () => {
    if (!currentSeason) {
      Alert.alert('No Active Season', 'Please create a new season by adding an image first.');
      return;
    }
    navigation.navigate('SprayEditor', { 
      wallId: WALL_ID, 
      seasonId: currentSeason.id,
      season: currentSeason
    });
  };

  const handleResetSpray = () => {
    navigation.navigate('SprayReset', { 
      wallId: WALL_ID,
      currentSeason: currentSeason 
    });
  };

  const handleLeaderboard = () => {
    navigation.navigate('SprayLeaderboard', { 
      wallId: WALL_ID,
      seasonId: currentSeason?.id 
    });
  };

  const renderRoute = ({ item: route }) => (
    <TouchableOpacity style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <Text style={styles.routeName}>{route.name}</Text>
        <Text style={styles.routeGrade}>{route.grade}</Text>
      </View>
      <View style={styles.routeDetails}>
        <Text style={styles.setter}>Set by: {route.setterName || 'Unknown'}</Text>
        <Text style={styles.holdCount}>
          {route.holds?.length || 0} holds
        </Text>
      </View>
      {route.createdAt && (
        <Text style={styles.dateText}>
          {new Date(route.createdAt.seconds * 1000).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View>
      <SprayHeader 
        imageUrl={currentSeason?.imageURL} 
        wallName="Spray Wall" 
        angle="35°" 
      />
      
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search routes..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLeaderboard}>
            <Ionicons name="trophy" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Leaderboard</Text>
          </TouchableOpacity>
          
          {isAdmin && (
            <TouchableOpacity style={styles.actionButton} onPress={handleResetSpray}>
              <Ionicons name="camera" size={20} color="#FF6B6B" />
              <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>
                {currentSeason ? 'Replace Image' : 'Add Image'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Routes ({filteredRoutes.length})
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading spray wall...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshSeason}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredRoutes}
        renderItem={renderRoute}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshSeason} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchText ? 'No routes match your search' : 'No routes yet'}
            </Text>
            {!searchText && !currentSeason && (
              <Text style={styles.emptySubtext}>
                {isAdmin ? 'Add an image to create the first season' : 'Wait for admin to set up the wall'}
              </Text>
            )}
          </View>
        }
      />
      
      {/* Floating Add Button */}
      {currentSeason && (
        <TouchableOpacity style={styles.fab} onPress={handleAddRoute}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 80,
  },
  controlsContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  sectionHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  routeCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  routeGrade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  setter: {
    fontSize: 14,
    color: '#666',
  },
  holdCount: {
    fontSize: 14,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default SprayWallHomeScreen;
