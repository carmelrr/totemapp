/**
 * @fileoverview Q&A Types
 * @description Staff knowledge base — questions asked by workers, answered by managers.
 * Answers can be plain text (`answer`) or structured ordered `steps`; entries can live in a
 * folder, carry image/video media, and cross-link to other entries (optionally a step within).
 */

export type QuestionStatus = 'open' | 'answered';

export type QAMediaKind = 'image' | 'video';
export type QAMediaSource = 'upload' | 'link';

/** A single image or video attached to a question, answer, or step. */
export interface QAMedia {
  id: string;
  kind: QAMediaKind;
  source: QAMediaSource;   // 'upload' = Firebase Storage URL; 'link' = external (YouTube/…)
  url: string;
  thumbnailUrl?: string;
}

/** A cross-reference from one entry/step to another Q&A entry (optionally a specific step). */
export interface QAStepLink {
  questionId: string;
  stepId?: string | null;  // when set, the target detail view focuses this step
  label?: string;          // display label (defaults to the target's title)
}

/** One ordered step of a structured answer. */
export interface QAStep {
  id: string;
  text: string;
  media: QAMedia[];
  links: QAStepLink[];
}

/** A single-level folder used to group knowledge-base entries (e.g. "קפה"). */
export interface QAFolder {
  id: string;
  name: string;
  order: number;
  createdBy: string;
  createdAt: Date;
}

export interface Question {
  id: string;
  authorUid: string;
  authorName: string;     // Display name snapshot
  title: string;
  body: string;
  status: QuestionStatus;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: Date | null;
  visible: boolean;       // Whether it appears in the public knowledge base
  createdAt: Date;

  // --- Structured content (all optional → backward compatible with legacy entries) ---
  folderId?: string | null;  // null/absent = uncategorized
  media?: QAMedia[];         // media on the question/answer itself
  steps?: QAStep[];          // ordered steps; when empty, render the plain `answer`
}
