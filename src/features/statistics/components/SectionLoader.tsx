import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

interface SectionLoaderProps {
  theme: any;
}

export default function SectionLoader({ theme }: SectionLoaderProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
