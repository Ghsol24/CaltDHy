// Kept apart from oauthFlow.js on purpose: the auth store needs this check at startup, and the
// 350 KiB startup budget has no room for the rest of the social sign-in code.
export const OAUTH_INTENT_KEY = 'caltdhy_oauth_intent';

/**
 * True exactly once: this tab started a Google/Facebook sign-in within the last 15 minutes and the
 * server has just sent it back signed in (/login?oauth=done). Only then may the sign-in lift the
 * local "logout pending" barrier, the same way a deliberate password login does.
 */
export function consumeOAuthSignIn() {
  try {
    const search = window.location.search;
    const startedAt = +sessionStorage.getItem(OAUTH_INTENT_KEY);
    // Any return from the provider (signed in, needs confirmation, or an error) ends this attempt.
    if (/[?&]oauth(_error)?=/.test(search)) sessionStorage.removeItem(OAUTH_INTENT_KEY);
    return /[?&]oauth=done(&|$)/.test(search) && startedAt > 0 && Date.now() - startedAt < 9e5;
  } catch { return false; }
}
