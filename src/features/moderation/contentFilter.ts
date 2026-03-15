// Basic profanity filter for user-generated content (EN + HE)
// This list is intentionally minimal — extend as needed.

const BLOCKED_WORDS_EN = [
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cunt",
  "nigger", "faggot", "retard", "whore", "slut",
];

const BLOCKED_WORDS_HE = [
  "זונה", "שרמוטה", "מניאק", "בןזונה", "כוס", "זין",
  "מזדיין", "חרא", "אידיוט",
];

const ALL_BLOCKED = [...BLOCKED_WORDS_EN, ...BLOCKED_WORDS_HE];

// Build regex once — match whole words (case-insensitive for English)
const pattern = new RegExp(
  ALL_BLOCKED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  // Normalize — remove common letter-substitution tricks
  const normalized = text
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a");
  return pattern.test(normalized);
}

export function filterText(text: string): string {
  if (!text) return text;
  return text.replace(pattern, (match) => "*".repeat(match.length));
}
