import test from 'node:test';
import assert from 'node:assert/strict';
import { pushSupport } from '../src/utils/pushSupport.js';

const browser = (overrides = {}) => ({
  navigator: { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130', serviceWorker: {}, ...overrides.navigator },
  PushManager: function PushManager() {},
  Notification: { permission: 'default', ...overrides.Notification },
  matchMedia: () => ({ matches: Boolean(overrides.standalone) }),
  ...overrides.window,
});

test('push support distinguishes ready, blocked, unsupported and iPhone-needs-install', () => {
  assert.equal(pushSupport(browser()), 'ready');
  assert.equal(pushSupport(browser({ Notification: { permission: 'granted' } })), 'ready');
  assert.equal(pushSupport(browser({ Notification: { permission: 'denied' } })), 'denied');
  assert.equal(pushSupport(browser({ window: { PushManager: undefined } })), 'unsupported');
  assert.equal(pushSupport({ navigator: { userAgent: 'Mozilla/5.0' } }), 'unsupported');
  const iphone = { navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', serviceWorker: {} } };
  assert.equal(pushSupport(browser(iphone)), 'needs-install');
  assert.equal(pushSupport(browser({ ...iphone, standalone: true })), 'ready');
  const ipad = { navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5, serviceWorker: {} } };
  assert.equal(pushSupport(browser(ipad)), 'needs-install');
});
