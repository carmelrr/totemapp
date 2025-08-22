import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const SprayHeader = ({ imageUrl, wallName = "Spray Wall", angle = "35°" }) => {
  // For now, we'll use a solid color background when no image is available
  // const placeholderImage = require('../../assets/spray/placeholder.jpg');

  return (
    <View style={styles.container}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
        />
      ) : (
        <View style={styles.placeholderImage} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.gradient}
      />
      <View style={styles.textContainer}>
        <Text style={styles.wallName}>{wallName}</Text>
        <Text style={styles.angle}>{angle}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8E9AAF',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  textContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  wallName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  angle: {
    color: 'white',
    fontSize: 18,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});

export default SprayHeader;
