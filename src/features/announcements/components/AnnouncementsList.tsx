/**
 * @fileoverview Announcements List Component
 * @description Displays active announcements at the top of the feed
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Announcement } from '../types';
import { subscribeToActiveAnnouncements } from '../announcementService';
import { AnnouncementCard } from './AnnouncementCard';

interface AnnouncementsListProps {
  /** Called when an announcement is dismissed */
  onDismiss?: (announcementId: string) => void;
}

export const AnnouncementsList: React.FC<AnnouncementsListProps> = ({
  onDismiss,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = subscribeToActiveAnnouncements((activeAnnouncements) => {
      setAnnouncements(activeAnnouncements);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = (announcementId: string) => {
    setDismissedIds((prev) => new Set([...prev, announcementId]));
    onDismiss?.(announcementId);
  };

  // Filter out dismissed announcements
  const visibleAnnouncements = announcements.filter(
    (a) => !dismissedIds.has(a.id)
  );

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {visibleAnnouncements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          onDismiss={() => handleDismiss(announcement.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
});

export default AnnouncementsList;
