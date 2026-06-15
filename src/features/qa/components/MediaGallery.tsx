/**
 * @fileoverview MediaGallery — renders a list of Q&A media items.
 * Images via expo-image; uploaded videos play inline via expo-video; external
 * video links reuse the existing VideoLinkButton (open in browser / native app).
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { VideoLinkButton } from '@/components/feedback/VideoLinkButton';
import type { QAMedia } from '../types';

function UploadedVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      style={styles.media}
      player={player}
      allowsFullscreen
      contentFit="contain"
    />
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
  return <UploadedVideo url={item.url} />;
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
});

export default MediaGallery;
