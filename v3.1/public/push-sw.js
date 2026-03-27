/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'kpi-quest-v1';
const OFFLINE_URL = '/offline';

// Assets to cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = {
    title: 'KPI Quest',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'notification',
    data: {} as Record<string, unknown>,
  };

  // Try to parse notification data from push event
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = {
        title: pushData.title || data.title,
        body: pushData.body || data.body,
        icon: pushData.icon || data.icon,
        badge: pushData.badge || data.badge,
        tag: pushData.tag || data.tag,
        data: pushData.data || {},
      };
    } catch {
      // If parsing fails, use default data but try to use text content
      const text = event.data.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          data = { ...data, ...parsed };
        } catch {
          data.body = text;
        }
      }
    }
  }

  // Show notification
  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: {
      url: data.data?.url || '/',
      ...data.data,
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  // Handle dismiss action
  if (action === 'dismiss') {
    return;
  }

  // Default: open the app
  let urlToOpen = notificationData?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Check if there's already a window/tab open
      for (const client of clients) {
        // If the app is already open, focus it
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (client.navigate) {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event (user dismissed notification)
self.addEventListener('notificationclose', (event) => {
  // Could send analytics event here if needed
  console.log('Notification closed:', event.notification.tag);
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  // Skip SSE requests
  if (event.request.url.includes('/sse')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response to cache it
        const responseClone = response.clone();

        // Only cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's a navigation request, return the offline page
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL);
          return offlineResponse || new Response('Offline', { status: 503 });
        }

        // Return a generic error response
        return new Response('Network error', { status: 503 });
      })
  );
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_SUBSCRIPTION') {
    event.waitUntil(
      self.registration.pushManager
        .getSubscription()
        .then((subscription) => {
          event.ports[0]?.postMessage({ subscription });
        })
        .catch((error) => {
          event.ports[0]?.postMessage({ error: error.message });
        })
    );
  }
});

export {};
