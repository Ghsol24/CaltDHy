import { authService } from './authService';
import { prefetchOAuthProviders } from './oauthFlow';

let registrationMemory = null;
let registrationPending = null;

/** Returns in-memory registration mode ('open' | 'invite') for the current page load, or null. */
export function getCachedRegistrationStatus() {
  return registrationMemory;
}

/** Fetches and caches registration mode in memory for this page session, deduplicating concurrent calls. */
export async function loadRegistrationStatus({ force = false } = {}) {
  if (!force && registrationMemory !== null) {
    return registrationMemory;
  }
  if (!force && registrationPending) {
    return registrationPending;
  }
  const request = authService.registration().then((data) => {
    const status = data?.inviteOnly === true ? 'invite' : 'open';
    registrationMemory = status;
    return status;
  }).finally(() => {
    if (registrationPending === request) registrationPending = null;
  });
  registrationPending = request;
  return request;
}

export function prefetchRegistrationStatus() {
  void loadRegistrationStatus().catch(() => {});
}

export function prefetchLoginRoute() {
  void import('../pages/LoginPage').catch(() => {});
  prefetchOAuthProviders();
}

export function prefetchSignupRoute() {
  void import('../pages/SignupPage').catch(() => {});
  prefetchRegistrationStatus();
  prefetchOAuthProviders();
}

export function resetRegistrationStatusCache() {
  registrationMemory = null;
  registrationPending = null;
}
