'use strict';

const cacheName = 'v2-2';
const currentCache = {
    offline: 'offline-cache-' + cacheName,
    stores: [
        'offline-content-images',
        'offline-content-previews',
        'offline-content-pages',
        'offline-content-albums',
    ]
};
const offlineUrl = './offline';

// Call Install Event
self.addEventListener('install', event => {
    console.log('Waiting for juneOS/julyOS Kernel to install...');
    event.waitUntil(
        caches.open(currentCache.offline).then(function(cache) {
            return [
                "/static/vendor/jquery/jquery.min.js",
                "/static/js/jquery.history.min.js",
                "/static/css/fluid-gallery.min.css",
                "/static/css/daterangepicker.min.css",
                "/static/css/toast.min.css",
                "/static/js/toast.min.js",
                "/static/js/daterangepicker.min.js",
                "/static/js/bootstrap-slider.min.js",
                "/js/client/sideloader-layout.min.js",
                "/js/client/sideloader.min.js",
                "/js/client/onload.min.js",
                "/js/client/displayHistory.min.js",
                "/static/img/sequenzia-logo-mini.png",
                "/static/img/sequenzia-logo-new.png",
                "/js/client/media-enabler.min.js",
                "/static/img/kongoumedialogo-wide.png",
                "/static/js/sb-admin-2.min.js",
                "/js/client/media.min.js",
                "/static/img/boot-logo.png",
                "/static/js/moment.min.js",
                "/static/vendor/bootstrap/js/bootstrap.bundle.min.js",
                "/static/vendor/jquery-easing/jquery.easing.min.js",
                "/static/img/icons/android/android-launchericon-192-192.png",
                "/static/img/icons/firefox/firefox-general-32-32.png",
                "/static/css/sb-admin-2.min.css",
                "/favicon.ico",
                "/static/css/jquery.fancybox.min.css",
                "/static/css/bootstrap-slider.min.css",
                "/static/vendor/fontawesome/css/all.min.css",
                "/css/custom.min.css",
                "/static/img/loading_bg.jpg",
                "/static/font/london2012.woff2",
                "/static/vendor/fontawesome/webfonts/fa-regular-400.woff2",
                "/static/vendor/fontawesome/webfonts/fa-light-300.woff2",
                "/static/vendor/fontawesome/webfonts/fa-solid-900.woff2",
                "/static/vendor/fontawesome/webfonts/fa-brands-400.woff2",
                "/static/vendor/fontawesome/webfonts/fa-thin-100.woff2",
                "/static/vendor/fontawesome/webfonts/fa-duotone-900.woff2",
                "https://cdn.jsdelivr.net/gh/fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.js",
                offlineUrl
            ].map(async u => {
                return await cache.add(u);
            }).filter(f => (!f)).length > 1
        })
    );
    console.log('JuneOS and JulyOS are now available!');
});

function cleanResponse(response) {
    const clonedResponse = response.clone();

    // Not all browsers support the Response.body stream, so fall back to reading
    // the entire body into memory as a blob.
    const bodyPromise = 'body' in clonedResponse ?
        Promise.resolve(clonedResponse.body) :
        clonedResponse.blob();

    return bodyPromise.then((body) => {
        // new Response() is happy when passed either a stream or a Blob.
        return new Response(body, {
            headers: clonedResponse.headers,
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
        });
    });
}

// Call Activate Event
self.addEventListener('activate', e => {
    console.log('Network Kernel [OK]');
    // Remove unwanted caches
    e.waitUntil(async function() {
        // Feature-detect
        if (self.registration.navigationPreload) {
            // Enable navigation preloads!
            await self.registration.navigationPreload.enable();
        }
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(e => !(e === currentCache.offline || e.indexOf(currentCache.stores) !== -1)).map(cache => {
                    console.log(cache)
                    console.log('Service Worker: Clearing Old Cache');
                    return caches.delete(cache);
                })
            );
        })
    }());
});

addEventListener('fetch', event => {
    /*if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
        event.respondWith(
            fetch(event.request.url).catch(error => {
                return caches.match(offlineUrl);
            })
        );
    }
    else{*/
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
    //}
});
