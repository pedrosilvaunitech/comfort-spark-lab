/**
 * Auth recovery utilities for self-hosted/local Supabase environments.
 * Handles localStorage cleanup on auth errors to prevent infinite refresh loops.
 */

const SUPABASE_STORAGE_PREFIX = "sb-";

/**
 * Clear all Supabase auth tokens from localStorage.
 * This breaks the "death loop" where an expired/invalid token
 * prevents new authentication from succeeding.
 */
export function clearSupabaseAuthStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SUPABASE_STORAGE_PREFIX) && key.includes("-auth-token")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      console.warn("[AuthRecovery] Removing stale auth key:", key);
      localStorage.removeItem(key);
    });
    return keysToRemove.length > 0;
  } catch (err) {
    console.error("[AuthRecovery] Failed to clear storage:", err);
    return false;
  }
}

/**
 * Determines if an error is a network/CORS error vs an auth error.
 * Logs detailed debug information.
 */
export function diagnoseAuthError(error: any, context: string): "network" | "auth" | "unknown" {
  const message = error?.message || String(error);
  const status = error?.status || error?.statusCode;

  console.error(`[AuthDiag] Context: ${context}`);
  console.error(`[AuthDiag] Message: ${message}`);
  console.error(`[AuthDiag] Status: ${status || "N/A"}`);
  console.error(`[AuthDiag] Error object:`, error);

  // Network/CORS errors
  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("CORS") ||
    message.includes("net::ERR_")
  ) {
    console.error("[AuthDiag] → NETWORK/CORS error detected. Check that Supabase is running and accessible.");
    return "network";
  }

  // Auth errors (401/403) — clear storage to break refresh loops
  if (status === 401 || status === 403 || message.includes("Invalid Refresh Token") || message.includes("refresh_token")) {
    console.error("[AuthDiag] → AUTH error detected. Clearing stale tokens...");
    clearSupabaseAuthStorage();
    return "auth";
  }

  console.error("[AuthDiag] → Unknown error type.");
  return "unknown";
}
