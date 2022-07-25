'use strict';

const cacheName = 'DEV-v2-4';
const origin = location.origin
const offlineUrl = './offline';
const cacheOptions = {
    cacheKernel: 'offline-kernel-' + cacheName,
    cacheConfig: 'offline-config-' + cacheName,
    cacheGeneral: 'offline-generic-' + cacheName,
    cacheCDN: 'offline-cdn-' + cacheName,
    cacheUserData: [
        'offline-content-images',
        'offline-content-previews',
        'offline-content-pages',
        'offline-content-albums',
    ],
    blockedCache: [
        '/discord/',
        '/gallery',
        '/cards',
        '/files',
        '/artists',
        '/listTheater',
        '/tvTheater',
        '/albums',
        '/login',
        '/actions/',
        '/status',
        '/parity',
        '/ping',
        '/ads-widget',
        '/ads-micro',
        '/ambient-'
    ],
    cdnCache: [
        'https://media.discordapp.net/attachments/',
        'https://cdn.discordapp.com/attachments/'
    ],
    configCache: [
        '/juneOS',
        '/sidebar'
    ],
    updateCache: [
        '/homeImage',
        '/juneOS',
        '/sidebar'
    ],
    preloadCache: [
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
        "/static/img/sequenzia-logo-white.png",
        "/js/client/media-enabler.min.js",
        "/static/img/kongoumedialogo-wide.png",
        "/static/js/sb-admin-2.min.js",
        "/js/client/media.min.js",
        "/static/img/boot-logo.png",
        "/static/img/aak.png",
        "/static/img/kongoumedialogo-wide.png",
        "/static/img/kongoumedialogo-menu-dark.png",
        "/static/img/kongoumedialogo-menu.png",
        "/static/img/kongoumedialogo-bg.png",
        "/static/img/awatsukidps.png",
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
        "/static/font/Digital7-1e1Z.woff2",
        "/static/font/Segment7.woff2",
        "/static/vendor/fontawesome/webfonts/fa-regular-400.woff2",
        "/static/vendor/fontawesome/webfonts/fa-light-300.woff2",
        "/static/vendor/fontawesome/webfonts/fa-solid-900.woff2",
        "/static/vendor/fontawesome/webfonts/fa-brands-400.woff2",
        "/static/vendor/fontawesome/webfonts/fa-thin-100.woff2",
        "/static/vendor/fontawesome/webfonts/fa-duotone-900.woff2",
        "/static/manifest.json",
        "https://cdn.jsdelivr.net/gh/fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.js",
        'https://fonts.gstatic.com/s/productsans/v5/HYvgU2fE2nRJvZ5JFAumwegdm0LZdjqr5-oayXSOefg.woff2',
        'https://cdnjs.cloudflare.com/ajax/libs/axios/0.19.2/axios.min.js',
        'https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i',
        'https://fonts.googleapis.com/css2?family=Comfortaa&family=Poppins&display=swap',
        offlineUrl
    ]
};


self.addEventListener('install', event => {
    console.log('Waiting for kernel to install...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(cacheOptions.cacheKernel).then(function(cache) {
            return cacheOptions.preloadCache.map(async u => {
                return await cache.add(u);
            }).filter(f => (!f)).length > 1
        })
    );
    console.log('JulyOS is now installed!');
});
self.addEventListener('activate', e => {
    console.log('JulyOS Kernel [OK]');
    // Remove unwanted caches
    e.waitUntil(async function() {
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }
        caches.keys().then(cacheNames => {
            console.log(`Local Caches Stores:`);
            return Promise.all(
                cacheNames.map(cache => {
                    console.log(cache)
                    if ((cache.startsWith('offline-kernel-') && cache !== cacheOptions.cacheKernel || cache.startsWith('offline-generic-') && cache !== cacheOptions.cacheGeneral || cache.startsWith('offline-config-') && cache !== cacheOptions.cacheConfig)) {
                        console.log('JulyOS Kernel: Clearing Old Cache - ' + cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    }());
});

function selectCache(event) {
    if (cacheOptions.configCache.filter(b => event.request.url.split(origin).pop().toString().startsWith(b)).length > 0)
        return cacheOptions.cacheConfig
    if (cacheOptions.cdnCache.filter(b => event.request.url.split(origin).pop().toString().startsWith(b)).length > 0)
        return cacheOptions.cacheCDN
    return cacheOptions.cacheGeneral
}

function handleResponse(event, response, reqType) {
    const uri = event.request.url.split(origin).pop().toString()
    if (cacheOptions.blockedCache.filter(b => uri.startsWith(b)).length === 0 && uri !== '/' && !(uri.includes('/attachments/') && (uri.includes('JFS_') || uri.includes('PARITY_')))) {
        const selectedCache = selectCache(event);
        console.log(`JulyOS Kernel: ${(reqType) ? reqType + ' + ': ''}Cache (${selectedCache}) - ${event.request.url}`);
        const copy = response.clone();
        event.waitUntil(
            caches.open(selectedCache).then(cache => cache.put(event.request, copy))
        );
    } else {
        console.log(`JulyOS Kernel: ${(reqType) ? reqType : ''} Only (Bypass Cache) - ${event.request.url}`);
    }
    return response;
}
async function reCache(event) {
    return fetch(event.request)
        .then(response => {
            const selectedCache = selectCache(event);
            console.log(`JulyOS Kernel: Update Cache (${selectedCache}) - ${event.request.url}`);
            caches.open(selectedCache).then(cache => cache.put(event.request, response))
        })
        .catch(error => {
            console.error('JulyOS Kernel: Update Failed - ' + event.request.url);
            console.error(error);
        })
}
addEventListener('fetch', event => {
    event.respondWith(async function() {
        try {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) {
                console.log('JulyOS Kernel: Cache - ' + event.request.url);
                if (cacheOptions.updateCache.filter(b => event.request.url.split(origin).pop().toString().startsWith(b)).length > 0)
                    reCache(event)
                return cachedResponse;
            }

            // Else, use the preloaded response, if it's there
            const response = await event.preloadResponse;
            if (response) {
                return handleResponse(event, response, 'Preload');
            }
        } catch (err) {
            console.error('JulyOS Kernel: Error fetching cache or preloaded response - ' + event.request.url)
            console.error(err);
        }

        // Else try the network.
        return fetch(event.request)
            .then(response => {
                return handleResponse(event, response, "Network");
            })
            .catch(error => {
                console.log('JulyOS Kernel: Offline - ' + event.request.url);
                if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html')))
                    return caches.match(offlineUrl);
                console.error(error);
            })
    }());
});
