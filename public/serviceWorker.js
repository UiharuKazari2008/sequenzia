const cacheName = 'v1';

// Call Install Event
self.addEventListener('install', e => {
    console.log('Service Worker: Installed');
});

// Call Activate Event
self.addEventListener('activate', e => {
    console.log('Service Worker: Activated');
    // Remove unwanted caches
    e.waitUntil(async function() {
        // Feature-detect
        if (self.registration.navigationPreload) {
            // Enable navigation preloads!
            await self.registration.navigationPreload.enable();
        }
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== cacheName) {
                        console.log('Service Worker: Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    }());
});

addEventListener('fetch', event => {
    console.log(`Service Worker: Fetching`);
    event.respondWith(async function() {
        // Respond from the cache if we can
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // Else, use the preloaded response, if it's there
        const response = await event.preloadResponse;
        if (response) return response;

        // Else try the network.
        return fetch(event.request);
    }());
});
