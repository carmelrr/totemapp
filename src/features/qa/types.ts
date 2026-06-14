/**
 * @fileoverview Q&A Types
 * @description Staff knowledge base — questions asked by workers, answered by managers.
 */

export type QuestionStatus = 'open' | 'answered';

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
}
