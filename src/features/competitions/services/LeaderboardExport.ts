/**
 * @fileoverview Leaderboard CSV export utility.
 * @description Builds a UTF-8 CSV (with BOM so Excel renders Hebrew correctly)
 * for a leaderboard snapshot and hands it to the OS share sheet.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import type { Competition, LeaderboardEntry } from '../types';

export interface LeaderboardExportRow {
  rank: number;
  name: string;
  categoryName: string;
  points: number;
  routesCompleted: number;
  totalAttempts: number;
  totalTops?: number;
  totalZones?: number;
}

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Build a CSV string from leaderboard entries. The header row uses Hebrew
 * labels, and the BOM at the start ensures Excel opens it correctly.
 */
export function buildLeaderboardCsv(
  competition: Competition,
  entries: LeaderboardEntry[],
  opts?: { uncategorizedLabel?: string }
): string {
  const uncat = opts?.uncategorizedLabel ?? 'כללי';
  const isZoneTop =
    competition.format === 'zone_top' || competition.format === 'ifsc_points';

  const header = isZoneTop
    ? [
        'מיקום',
        'שם',
        'קטגוריה',
        'נקודות',
        'מסלולים',
        'ניסיונות',
        'טופים',
        'זונות',
      ]
    : ['מיקום', 'שם', 'קטגוריה', 'נקודות', 'מסלולים', 'ניסיונות'];

  const lines: string[] = [header.join(',')];
  for (const e of entries) {
    const row: (string | number | undefined)[] = [
      e.rank || '',
      e.participantName || e.userName || '',
      e.categoryName || uncat,
      e.points ?? 0,
      e.routesCompleted ?? 0,
      e.totalAttempts ?? 0,
    ];
    if (isZoneTop) {
      row.push(e.totalTops ?? 0, e.totalZones ?? 0);
    }
    lines.push(row.map(escapeCsv).join(','));
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function safeFileName(input: string): string {
  return input.replace(/[^\p{L}\p{N}\-_ ]+/gu, '_').trim().replace(/\s+/g, '_');
}

/**
 * Write the CSV to a temp file and open the OS share sheet. Returns the file
 * URI on success. On web or when sharing is unavailable, falls back to
 * React Native's Share.share with the CSV as plain text.
 */
export async function exportLeaderboardCsv(
  competition: Competition,
  entries: LeaderboardEntry[],
  opts?: { uncategorizedLabel?: string; fileNamePrefix?: string }
): Promise<string | null> {
  const csv = buildLeaderboardCsv(competition, entries, opts);
  const prefix = opts?.fileNamePrefix ?? 'leaderboard';
  const filename = `${safeFileName(prefix + '_' + (competition.name || competition.id))}.csv`;

  if (Platform.OS === 'web') {
    // Best effort: fall back to plain-text share.
    try {
      await Share.share({ message: csv, title: filename });
    } catch {
      // no-op
    }
    return null;
  }

  const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
  if (!cacheDir) return null;

  const fileUri = cacheDir + filename;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8',
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: competition.name || 'Leaderboard',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    await Share.share({ message: csv, title: filename });
  }

  return fileUri;
}
