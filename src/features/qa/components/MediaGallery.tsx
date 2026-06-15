/**
 * @fileoverview MediaGallery — renders a list of Q&A media items.
 * Images via expo-image; uploaded videos open in the native player via Linking;
 * external video links reuse the existing VideoLinkButton.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Text, Linking } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { VideoLinkButton } from '@/components/feedback/VideoLinkButton';
import type { QAMedia } from '../types';

/** Opens an uploaded video URL in the device's native video player. */
function UploadedVideoButton({ url }: { url: string }) {
  return (
    <TouchableOpacity
      style={styles.videoButton}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.75}
    >
      <Ionicons name="play-circle" size={40} color="#fff" />
      <Text style={styles.videoButtonText}>נגן וידאו</Text>
    </TouchableOpacity>
  );
}

function MediaItemView({ item }: { item: QAMedia }) {
  if (item.kind === 'image') {
    return (
      <ExpoImage
        style={styles.media}
        source={{ uri: item.url }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  // video
  if (item.source === 'link') {
    return <VideoLinkButton url={item.url} />;
  }
  return <UploadedVideoButton url={item.url} />;
}

export function MediaGallery({ media, style }: { media?: QAMedia[]; style?: ViewStyle }) {
  if (!media || media.length === 0) return null;
  return (
    <View style={[styles.container, style]}>
      {media.map((m) => (
        <MediaItemView key={m.id} item={m} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 8 },
  media: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#00000010',
  },
  videoButton: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#000000cc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MediaGallery;
