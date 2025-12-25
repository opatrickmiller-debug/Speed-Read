/* eslint-disable no-restricted-globals */

// VERSION - increment this to force cache refresh on all clients
const SW_VERSION = '1.2.0';
const CACHE_NAME = `speedshield-v${SW_VERSION}`;
const STATIC_CACHE = `speedshield-static-v${SW_VERSION}`;
const DYNAMIC_CACHE = `speedshield-dynamic-v${SW_VERSION}`;
const API_CACHE = `speedshield-api-v${SW_VERSION}`;

// Files to cache immediately on install
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json'
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  '/api/speed-limit',
  '/api/speed-ahead',
  '/api/weather'
];

// Cache TTLs (in milliseconds)
const CACHE_TTLS = {
  speedLimit: 24 * 60 * 60 * 1000,  // 24 hours
  weather: 30 * 60 * 1000,          // 30 minutes
  speedAhead: 5 * 60 * 1000,        // 5 minutes
  static: 7 * 24 * 60 * 60 * 1000   // 7 days
};

// Install event - cache static files and skip waiting
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing Service Worker...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log(`[SW ${SW_VERSION}] Caching static files`);
        return cache.addAll(STATIC_FILES).catch(err => {
          console.log(`[SW ${SW_VERSION}] Some static files failed to cache:`, err);
        });
      })
      .then(() => {
        console.log(`[SW ${SW_VERSION}] Skip waiting - activating immediately`);
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up ALL old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating Service Worker...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete any cache that doesn't match current version
            return !name.includes(SW_VERSION);
          })
          .map((name) => {
            console.log(`[SW ${SW_VERSION}] Deleting old cache:`, name);
            return caches.delete(name);
          })
      );
    })
    .then(() => {
      console.log(`[SW ${SW_VERSION}] Claiming all clients`);
      return self.clients.claim();
    })
    .then(() => {
      // Notify all clients that update is available
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: SW_VERSION
          });
        });
      });
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Handle API requests with smart caching
  if (url.pathname.startsWith('/api/')) {
    // Use stale-while-revalidate for speed limit (most important for offline)
    if (url.pathname.includes('/speed-limit')) {
      event.respondWith(staleWhileRevalidate(request, 'speedLimit'));
      return;
    }
    // Use network-first for other APIs
    event.respondWith(networkFirst(request));
    return;
  }

  // Handle Google Maps API separately (don't cache)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy (for static assets)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Fetch failed:', error);
    // Return offline fallback if available
    return caches.match('/offline.html') || new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for API calls)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful API responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response for API
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale-while-revalidate strategy (best for speed limits)
async function staleWhileRevalidate(request, cacheType) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        // Update cache with fresh response
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Return cached response immediately if available
  if (cachedResponse) {
    // Check if cache is still valid
    const cachedDate = cachedResponse.headers.get('date');
    const ttl = CACHE_TTLS[cacheType] || CACHE_TTLS.speedLimit;
    
    if (cachedDate) {
      const age = Date.now() - new Date(cachedDate).getTime();
      if (age < ttl) {
        return cachedResponse;
      }
    }
    
    // Cache is stale but still return it while fetching fresh data
    return cachedResponse;
  }

  // No cache, wait for network
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Network failed, no cache available
  return new Response(
    JSON.stringify({ error: 'Offline', cached: false }),
    { 
      status: 503, 
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Handle background sync for trip data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trip-data') {
    event.waitUntil(syncTripData());
  }
  if (event.tag === 'sync-queued-actions') {
    event.waitUntil(syncQueuedActions());
  }
});

async function syncTripData() {
  console.log('[SW] Syncing trip data...');
  // Notify clients to sync their data
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_TRIP_DATA' });
  });
}

async function syncQueuedActions() {
  console.log('[SW] Syncing queued actions...');
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_QUEUED_ACTIONS' });
  });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Speed Alert', {
        body: data.body || 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [200, 100, 200],
        tag: 'speedshield',
        requireInteraction: true,
        actions: [
          { action: 'open', title: 'Open App' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Periodic background sync for keeping cache fresh
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-speed-cache') {
    event.waitUntil(refreshSpeedCache());
  }
});

async function refreshSpeedCache() {
  console.log('[SW] Periodic cache refresh...');
  // This could prefetch commonly used routes
}

// Handle messages from the app (e.g., SKIP_WAITING for updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log(`[SW ${SW_VERSION}] Received SKIP_WAITING message, activating new version...`);
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});
