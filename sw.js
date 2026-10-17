// TeamSync Progressive Web App Service Worker
// Version: 1.0.0

const CACHE_NAME = 'teamsync-pwa-v1.0.0';
const DYNAMIC_CACHE_NAME = 'teamsync-dynamic-v1.0.0';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './login.html',
    './dashboard.html',
    './tasks.html',
    './attendance.html',
    './chat.html',
    './analytics.html',
    './members.html',
    './teams.html',
    './notifications.html',
    './profile.html',
    './help.html',
    './offline.html',
    './manifest.json',
    './css/style.css',
    './js/sidebar.js',
    './js/data.js',
    './js/smart-assistant.js',
    './js/ai-helper.js',
    './js/mail-helper.js',
    './js/firebase-config.js',
    './js/pwa.js',
    './logo.png',
    './image1.png',
    './image2.png',
    './image3.png',
    './image4.png',
    './image5.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-16x16.png',
    './icons/favicon-32x32.png',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-180x180.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png',
    './icons/maskable-icon-192x192.png',
    './icons/maskable-icon-512x512.png'
];

// Domains/URLs that should ALWAYS be network-only (never cached)
const NETWORK_ONLY_PATTERNS = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'api.groq.com',
    'api.emailjs.com',
    'firebaseio.com'
];

// 1. Install Event: Cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[TeamSync SW] Pre-caching core app shell');
            // Cache items individually to avoid complete failure if one optional file is missing
            for (const asset of PRECACHE_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('[TeamSync SW] Failed to pre-cache asset:', asset, err);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate Event: Clean up outdated caches and claim clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
                        console.log('[TeamSync SW] Deleting obsolete cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Message listener for skip waiting or user actions
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Helper: Check if request is network-only
function isNetworkOnly(url) {
    return NETWORK_ONLY_PATTERNS.some(pattern => url.includes(pattern));
}

// 4. Fetch Event: Multi-strategy handler
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = request.url;

    // Ignore non-GET requests or chrome-extension schemes
    if (request.method !== 'GET' || url.startsWith('chrome-extension://')) {
        return;
    }

    // Bypass Firebase / Groq / external API calls
    if (isNetworkOnly(url)) {
        return;
    }

    // A. HTML Navigation Requests (Network First, Cache Fallback, then Offline Page)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Try root index if looking for base
                    const offlineFallback = await caches.match('./offline.html');
                    return offlineFallback || new Response('<h1>TeamSync Offline</h1><p>Please check your internet connection.</p>', {
                        headers: { 'Content-Type': 'text/html' }
                    });
                })
        );
        return;
    }

    // B. Static Assets: CSS, JS, Images, Fonts (Stale While Revalidate)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            }).catch((err) => {
                // If offline and request is an image, we could fallback if needed
                return null;
            });

            // Return cached response immediately if present, otherwise await network
            return cachedResponse || fetchPromise;
        })
    );
});

// 5. Push Notifications
self.addEventListener('push', (event) => {
    let payload = {
        title: 'TeamSync Notification',
        body: 'You have a new update in your team workspace.',
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-72x72.png',
        data: { url: './dashboard.html' }
    };

    if (event.data) {
        try {
            payload = Object.assign(payload, event.data.json());
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || 'icons/icon-192x192.png',
        badge: payload.badge || 'icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: payload.data || { url: './dashboard.html' },
        actions: [
            { action: 'open', title: 'Open TeamSync' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// 6. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './dashboard.html';

    if (event.action === 'dismiss') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('teamsync') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
