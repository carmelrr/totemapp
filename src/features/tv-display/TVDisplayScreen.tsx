/**
 * TVDisplayScreen — read-only wall-mounted TV view.
 *
 * Shows the gym's climbing wall map with every active route's grade/color,
 * updating live whenever a route's grade changes (Firestore onSnapshot via
 * useActiveRoutes). The screen is fully non-interactive: gestures are disabled
 * on the map and nothing is tappable.
 *
 * Layout (landscape):
 *   ┌───────────────────────────┬──────────────┐
 *   │                           │  Gym header  │
 *   │      Live wall map        │  Legend      │
 *   │   (all routes, no pan)    │  Easiest     │
 *   │                           │  Hardest     │
 *   │                           │  QR + link   │
 *   └───────────────────────────┴──────────────┘
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import WallMap from '@/components/WallMap/WallMap';
import { useActiveRoutes } from '@/features/routes-map/hooks/useFirebaseRoutes';
import { useWallTapes } from '@/features/routes-map/hooks/useWallTapes';
import { usePublishedRooms } from '@/features/wall-editor';
import { RouteDoc } from '@/features/routes-map/types/route';
import { getGradeColor, getGradeNumber } from '@/features/routes-map/utils/grades';
import { useLanguage } from '@/features/language';
import { TV_APP_URL } from './constants';

const BG = '#0B0B0F';
const SURFACE = '#15151C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#FF6B35';

export default function TVDisplayScreen() {
  const { language } = useLanguage();
  const he = language === 'he';

  const { routes, isLoading } = useActiveRoutes();
  const { rooms } = usePublishedRooms({ includeHidden: false });
  const { tapes } = useWallTapes();

  // Use the first published room as the displayed wall.
  const room = rooms.length > 0 ? rooms[0] : null;

  // Clock for "last updated" footer.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Easiest / hardest active route by V-grade.
  const { easiest, hardest } = useMemo(() => {
    const graded = routes.filter((r) => r.grade && getGradeNumber(r.grade) >= -1);
    if (graded.length === 0) {
      return { easiest: null as RouteDoc | null, hardest: null as RouteDoc | null };
    }
    let lo = graded[0];
    let hi = graded[0];
    for (const r of graded) {
      if (getGradeNumber(r.grade) < getGradeNumber(lo.grade)) lo = r;
      if (getGradeNumber(r.grade) > getGradeNumber(hi.grade)) hi = r;
    }
    return { easiest: lo, hardest: hi };
  }, [routes]);

  // Legend rows: prefer admin-configured wall tapes (color -> grade range);
  // fall back to a grade->color scale derived from the active routes.
  const legend = useMemo(() => {
    const tapesWithRange = tapes.filter((tp) => tp.gradeMin && tp.gradeMax);
    if (tapesWithRange.length > 0) {
      return tapesWithRange.map((tp) => ({
        key: tp.id,
        hex: tp.hex,
        label: he ? tp.nameHe : tp.nameEn,
        range:
          tp.gradeMin === tp.gradeMax
            ? tp.gradeMin!
            : `${tp.gradeMin}–${tp.gradeMax}`,
      }));
    }
    // Fallback: distinct grades present, sorted easy -> hard.
    const grades = Array.from(
      new Set(routes.map((r) => r.grade).filter(Boolean)),
    ).sort((a, b) => getGradeNumber(a) - getGradeNumber(b));
    return grades.map((g) => ({
      key: g,
      hex: getGradeColor(g),
      label: g,
      range: '',
    }));
  }, [tapes, routes, he]);

  const txt = {
    title: he ? 'קיר הבולדרינג' : 'Bouldering Wall',
    routesCount: (n: number) => (he ? `${n} מסלולים פעילים` : `${n} active routes`),
    legend: he ? 'מקרא דרגות' : 'Grade legend',
    easiest: he ? 'הכי קל' : 'Easiest',
    hardest: he ? 'הכי קשה' : 'Hardest',
    scan: he ? 'סרקו להורדת האפליקציה' : 'Scan to get the app',
    loading: he ? 'טוען מפה…' : 'Loading map…',
    noRoom: he ? 'לא נמצא קיר פעיל' : 'No active wall found',
    updated: he ? 'עודכן' : 'Updated',
  };

  if (isLoading && routes.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>{txt.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Map area */}
      <View style={styles.mapArea}>
        {room ? (
          <WallMap
            routes={routes}
            wallWidth={room.width}
            wallHeight={room.height}
            room={room}
            gesturesEnabled={false}
            showSectorLabels
          />
        ) : (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>{txt.noRoom}</Text>
          </View>
        )}
      </View>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View>
          <Text style={styles.title}>{txt.title}</Text>
          <Text style={styles.subtitle}>{txt.routesCount(routes.length)}</Text>
        </View>

        {/* Legend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{txt.legend}</Text>
          <View style={styles.legendList}>
            {legend.map((row) => (
              <View key={row.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: row.hex }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                {!!row.range && <Text style={styles.legendRange}>{row.range}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Easiest / hardest */}
        <View style={styles.extremesRow}>
          <ExtremeCard
            label={txt.easiest}
            route={easiest}
            tint="#22c55e"
            he={he}
          />
          <ExtremeCard
            label={txt.hardest}
            route={hardest}
            tint="#ef4444"
            he={he}
          />
        </View>

        {/* QR */}
        <View style={styles.qrCard}>
          <View style={styles.qrBox}>
            <QRCode value={TV_APP_URL} size={120} backgroundColor="#fff" />
          </View>
          <Text style={styles.qrText}>{txt.scan}</Text>
        </View>

        <Text style={styles.footer}>
          {txt.updated} {now.toLocaleTimeString(he ? 'he-IL' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

function ExtremeCard({
  label,
  route,
  tint,
  he,
}: {
  label: string;
  route: RouteDoc | null;
  tint: string;
  he: boolean;
}) {
  return (
    <View style={[styles.extremeCard, { borderColor: tint }]}>
      <Text style={[styles.extremeLabel, { color: tint }]}>{label}</Text>
      {route ? (
        <>
          <Text style={styles.extremeGrade}>{route.grade}</Text>
          <Text style={styles.extremeName} numberOfLines={1}>
            {route.name}
          </Text>
        </>
      ) : (
        <Text style={styles.extremeName}>{he ? '—' : '—'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: BG,
  },
  mapArea: {
    flex: 1,
    backgroundColor: BG,
  },
  sidebar: {
    width: 340,
    backgroundColor: SURFACE,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  loadingText: {
    color: TEXT_DIM,
    fontSize: 20,
    marginTop: 16,
  },
  title: {
    color: TEXT,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: TEXT_DIM,
    fontSize: 16,
    marginTop: 4,
  },
  card: {
    backgroundColor: BG,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  legendList: {
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  legendLabel: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  legendRange: {
    color: TEXT_DIM,
    fontSize: 15,
    fontWeight: '700',
  },
  extremesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  extremeCard: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
  },
  extremeLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  extremeGrade: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '900',
  },
  extremeName: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 4,
    maxWidth: '100%',
  },
  qrCard: {
    backgroundColor: BG,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
  },
  qrText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  footer: {
    color: TEXT_DIM,
    fontSize: 13,
    textAlign: 'center',
  },
});
