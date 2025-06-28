import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export default function RouteList({ routes }) {
  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.title}>V{item.grade}</Text>
      <Text>{item.color}</Text>
    </View>
  );

  return (
    <FlatList
      data={routes}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    paddingHorizontal: 20,
  },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  title: {
    fontWeight: 'bold',
  },
});

