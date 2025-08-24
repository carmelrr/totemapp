import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './Dashboard';
import Achievements from './Achievements';
import ActivityHeatmap from './ActivityHeatmap';

type AnalyticsTab = 'dashboard' | 'achievements' | 'activity';

/**
 * מסך אנליטיקה מאוחד בסגנון TopLogger
 * מכיל דשבורד, הישגים ולוח פעילות
 */
export default function AnalyticsScreen() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('dashboard');

  const tabs = [
    { id: 'dashboard' as AnalyticsTab, title: 'דשבורד', icon: '📊' },
    { id: 'achievements' as AnalyticsTab, title: 'הישגים', icon: '🏆' },
    { id: 'activity' as AnalyticsTab, title: 'פעילות', icon: '📅' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'achievements':
        return <Achievements />;
      case 'activity':
        return <ActivityHeatmap />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* מבחר טאבים */}
      <View style={styles.tabContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[
              styles.tabTitle,
              activeTab === tab.id && styles.activeTabTitle
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* תוכן הטאב */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#3b82f6',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabTitle: {
    color: '#3b82f6',
  },
  content: {
    flex: 1,
  },
});
