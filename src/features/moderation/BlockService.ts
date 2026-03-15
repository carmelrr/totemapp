import { doc, setDoc, deleteDoc, getDocs, collection, serverTimestamp, addDoc } from "firebase/firestore";
import { auth, db } from "@/features/data/firebase";

export const BlockService = {
  async blockUser(blockedUserId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Must be logged in to block a user");
    if (currentUser.uid === blockedUserId) throw new Error("Cannot block yourself");

    // Save block record
    await setDoc(
      doc(db, "users", currentUser.uid, "blockedUsers", blockedUserId),
      { blockedAt: serverTimestamp() }
    );

    // Notify admin via content report
    await addDoc(collection(db, "contentReports"), {
      contentId: blockedUserId,
      contentType: "user_block",
      reason: "blocked_by_user",
      reportedBy: currentUser.uid,
      status: "pending",
      createdAt: serverTimestamp(),
    });
  },

  async unblockUser(blockedUserId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Must be logged in");

    await deleteDoc(doc(db, "users", currentUser.uid, "blockedUsers", blockedUserId));
  },

  async getBlockedUserIds(): Promise<string[]> {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    const snapshot = await getDocs(collection(db, "users", currentUser.uid, "blockedUsers"));
    return snapshot.docs.map((d) => d.id);
  },
};
