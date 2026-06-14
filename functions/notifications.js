/**
 * Push notifications for the staff shift system.
 * Reads fcmTokens from users/{uid}, sends a multicast, and prunes invalid tokens.
 * All texts in Hebrew. CommonJS to match functions/index.js.
 */
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
]);

/** Send a push to a set of users; prunes invalid tokens from their docs. */
async function sendPush(uids, title, body, data) {
  const unique = [...new Set(uids)].filter(Boolean);
  if (unique.length === 0) return;

  const db = getFirestore();
  const tokenOwner = new Map();
  await Promise.all(
    unique.map(async (uid) => {
      const snap = await db.collection("users").doc(uid).get();
      const tokens = (snap.data() && snap.data().fcmTokens) || [];
      for (const t of tokens) tokenOwner.set(t, uid);
    })
  );

  const tokens = [...tokenOwner.keys()];
  if (tokens.length === 0) {
    logger.info(`[sendPush] "${title}" — no tokens for ${unique.length} user(s)`);
    return;
  }

  const stringData = {};
  if (data) for (const [k, v] of Object.entries(data)) stringData[k] = String(v);

  const messaging = getMessaging();
  const invalid = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: stringData,
    });
    res.responses.forEach((r, idx) => {
      if (!r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code)) {
        invalid.push(batch[idx]);
      }
    });
  }

  if (invalid.length > 0) {
    const byUid = new Map();
    for (const t of invalid) {
      const uid = tokenOwner.get(t);
      if (!uid) continue;
      const arr = byUid.get(uid) || [];
      arr.push(t);
      byUid.set(uid, arr);
    }
    await Promise.all(
      [...byUid.entries()].map(([uid, toks]) =>
        db.collection("users").doc(uid).update({ fcmTokens: FieldValue.arrayRemove(...toks) })
      )
    );
  }

  logger.info(`[sendPush] "${title}" — sent to ${tokens.length} token(s), pruned ${invalid.length}`);
}

/** uids of all shift managers (userShiftRoles.isShiftManager == true). */
async function getManagerUids() {
  const db = getFirestore();
  const snap = await db.collection("userShiftRoles").where("isShiftManager", "==", true).get();
  return snap.docs.map((d) => d.id);
}

/** Display name of a user (fallback "עובד"). */
async function getUserName(uid) {
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).get();
  return (snap.data() && (snap.data().displayName || snap.data().name)) || "עובד";
}

module.exports = { sendPush, getManagerUids, getUserName };
