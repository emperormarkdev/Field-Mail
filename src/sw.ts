/// <reference lib="webworker" />
/**
 * Custom service worker: precaches the whole app shell so SiteReport opens with
 * no network, and listens for a Background Sync wake-up which it forwards to any
 * open window. Background Sync is a bonus nudge, never the primary path — the
 * app also flushes on `online`, on foreground and on a timer.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Every navigation resolves to the cached shell; API calls stay untouched.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
);

self.addEventListener('message', (event) => {
  const data = (event as ExtendableMessageEvent).data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

type SyncEvent = ExtendableEvent & { tag?: string };

self.addEventListener('sync', (event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag !== 'flush-outbox') return;
  syncEvent.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) client.postMessage({ type: 'FLUSH_OUTBOX' });
      })
      .catch(() => undefined),
  );
});

clientsClaim();
