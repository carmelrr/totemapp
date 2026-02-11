// src/features/data/deleteAccountClient.ts
// Client-side helper to call the deleteAccount Cloud Function

import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApp } from "firebase/app";

let functions: ReturnType<typeof getFunctions> | null = null;

function getFirebaseFunctions() {
  if (!functions) {
    const app = getApp(); // reuse the already-initialized app
    functions = getFunctions(app);
  }
  return functions;
}

/**
 * Calls the `deleteAccount` Cloud Function.
 * – Must be called while the user is authenticated.
 * – Throws if the server rejects the request.
 */
export async function deleteAccountCallable(): Promise<{
  success: boolean;
  message?: string;
}> {
  const fn = httpsCallable<void, { success: boolean; message?: string }>(
    getFirebaseFunctions(),
    "deleteAccount"
  );
  const result = await fn();
  return result.data;
}
