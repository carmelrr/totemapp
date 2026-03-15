import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";

export type ReportContentType = "route" | "comment" | "feedback" | "user";

export type ReportReason = "offensive" | "spam" | "inappropriate" | "other";

interface ReportData {
  contentId: string;
  contentType: ReportContentType;
  reason: ReportReason;
  details?: string;
}

export const ReportService = {
  async reportContent({ contentId, contentType, reason, details }: ReportData): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Must be logged in to report content");

    await addDoc(collection(db, "contentReports"), {
      contentId,
      contentType,
      reason,
      details: details || "",
      reportedBy: currentUser.uid,
      status: "pending",
      createdAt: serverTimestamp(),
    });
  },
};
