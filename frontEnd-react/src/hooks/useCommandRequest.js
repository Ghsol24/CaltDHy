import { useEffect, useRef } from 'react';
import { useSpendingStore } from '../stores/useSpendingStore';

// A request the palette left more than this long ago (its screen never opened) is dropped.
const MAX_AGE_MS = 15000;
const handled = new WeakSet();

/**
 * Runs `handler(request)` once when the command palette asks this screen for
 * `action` (see useSpendingStore.requestCommand). Waits until `ready`, so a
 * screen can finish loading the data the dialog needs first.
 */
export function useCommandRequest(action, handler, ready = true) {
  const request = useSpendingStore((state) => state.commandRequest);
  const consume = useSpendingStore((state) => state.consumeCommandRequest);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ready || request?.action !== action || handled.has(request)) return;
    handled.add(request);
    consume(request);
    if (Date.now() - request.at <= MAX_AGE_MS) handlerRef.current(request);
  }, [action, consume, ready, request]);
}
