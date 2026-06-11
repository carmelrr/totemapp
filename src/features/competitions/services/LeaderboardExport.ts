/**
 * @fileoverview Leaderboard CSV export utility.
 * @description Builds a UTF-8 CSV (with BOM so Excel renders Hebrew correctly)
 * for a leaderboard snapshot and hands it to the OS share sheet.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import type { Competition, LeaderboardEntry } from '../types';
import { isZoneTopFormat } from '../constants';

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
/**
 * Rank a single category's entries. Entries are sorted by points (descending);
 * equal point totals share a rank, and entries with no points are shown with a
 * dash so they still appear in the export.
 */
function rankWithinCategory(
  list: LeaderboardEntry[]
): { entry: LeaderboardEntry; rankLabel: string | number }[] {
  const sorted = [...list].sort((a, b) => (b.points || 0) - (a.points || 0));
  const ranked: { entry: LeaderboardEntry; rankLabel: string | number }[] = [];
  let lastPoints: number | null = null;
  let lastRank = 0;
  sorted.forEach((entry, index) => {
    const pts = entry.points || 0;
    if (pts === 0) {
      ranked.push({ entry, rankLabel: '-' });
      return;
    }
    let rank: number;
    if (lastPoints !== null && pts === lastPoints) {
      rank = lastRank; // tie shares the previous rank
    } else {
      rank = index + 1;
      lastRank = rank;
      lastPoints = pts;
    }
    ranked.push({ entry, rankLabel: rank });
  });
  return ranked;
}

export function buildLeaderboardCsv(
  competition: Competition,
  entries: LeaderboardEntry[],
  opts?: { uncategorizedLabel?: string }
): string {
  const uncat = opts?.uncategorizedLabel ?? 'כללי';
  const isZoneTop = isZoneTopFormat(competition.format);

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

  const buildDataRow = (
    e: LeaderboardEntry,
    rankLabel: string | number,
    categoryName: string
  ): string => {
    const row: (string | number | undefined)[] = [
      rankLabel,
      e.participantName || e.userName || '',
      categoryName,
      e.points ?? 0,
      e.routesCompleted ?? 0,
      e.totalAttempts ?? 0,
    ];
    if (isZoneTop) {
      row.push(e.totalTops ?? 0, e.totalZones ?? 0);
    }
    return row.map(escapeCsv).join(',');
  };

  // Group entries by category, preserving the order in which categories first
  // appear so the export layout is stable.
  const groups: { key: string; name: string; entries: LeaderboardEntry[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const e of entries) {
    const key = e.category || '__uncategorized__';
    const name = e.categoryName || uncat;
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(key, idx);
      groups.push({ key, name, entries: [] });
    }
    groups[idx].entries.push(e);
  }

  const onlyUncategorized =
    groups.length === 0 ||
    (groups.length === 1 && groups[0].key === '__uncategorized__');

  const lines: string[] = [];
  // Leading title row with the competition name for context.
  if (competition.name) {
    lines.push(escapeCsv(competition.name));
    lines.push('');
  }

  if (onlyUncategorized) {
    // No categories — a single ranked table (same as before).
    lines.push(header.join(','));
    const ranked = rankWithinCategory(groups[0]?.entries ?? entries);
    for (const { entry, rankLabel } of ranked) {
      lines.push(buildDataRow(entry, rankLabel, entry.categoryName || uncat));
    }
  } else {
    // One independent, separately-ranked section per category.
    groups.forEach((group, i) => {
      lines.push(escapeCsv(group.name));
      lines.push(header.join(','));
      const ranked = rankWithinCategory(group.entries);
      for (const { entry, rankLabel } of ranked) {
        lines.push(buildDataRow(entry, rankLabel, group.name));
      }
      if (i < groups.length - 1) {
        lines.push(''); // blank separator between categories
      }
    });
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
    // On web, trigger a real CSV file download via a Blob URL. Surface any
    // failure to the caller (instead of silently swallowing it) so it can
    // show an error to the user.
    try {
      const g: any = globalThis as any;
      if (g.document && g.Blob && g.URL?.createObjectURL) {
        const blob = new g.Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = g.URL.createObjectURL(blob);
        const link = g.document.createElement('a');
        link.href = url;
        link.download = filename;
        g.document.body.appendChild(link);
        link.click();
        g.document.body.removeChild(link);
        g.URL.revokeObjectURL(url);
        return url;
      }
      // Fallback when the DOM download API isn't available.
      await Share.share({ message: csv, title: filename });
      return null;
    } catch (e) {
      console.warn('[LeaderboardExport] web export failed', e);
      throw e;
    }
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
