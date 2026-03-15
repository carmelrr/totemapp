import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SectionProps {
  title: string;
  theme: any;
  isRTL: boolean;
  children: React.ReactNode;
  rightElement?: React.ReactNode;
}

export default function Section({ title, theme, isRTL, children, rightElement }: SectionProps) {
  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[styles.title, { color: theme.text }, isRTL && { textAlign: 'right' }]}>
          {title}
        </Text>
        {rightElement}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
