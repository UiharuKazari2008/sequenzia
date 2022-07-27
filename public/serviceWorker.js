'use strict';

const cacheName = 'DEV-v2-9';
const cacheCDNName = 'DEV-v2-8';
const origin = location.origin
const offlineUrl = './offline';
const cacheOptions = {
    cacheKernel: 'offline-kernel-' + cacheName,
    cacheConfig: 'offline-config-' + cacheName,
    cacheGeneral: 'offline-generic-' + cacheName,
    cacheCDN: 'offline-cdn-' + cacheCDNName,
    cacheProxy: 'offline-proxy-' + cacheCDNName,
    cacheUserData: [
        'offline-content-data',
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
        '/ambient-',
        '/app',
    ],
    cdnCache: {
        media: 'https://media.discordapp.net/attachments/',
        cdn: 'https://cdn.discordapp.com/attachments/',
        local: '/attachments/'
    },
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
let swDebugMode = false;
let swCacheCDN = false;


self.addEventListener('install', event => {
    console.log('Waiting for kernel to install...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(cacheOptions.cacheKernel).then(function(cache) {
            const results = cacheOptions.preloadCache.map(async u => {
                return await cache.add(u);
            }).filter(f => !(f && f.ok)).length > 1
            console.log(results)
            return results
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
            return Promise.all(
                cacheNames.map(cache => {
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
    const uri = event.request.url.split(origin).pop().toString()
    if (cacheOptions.configCache.filter(b => uri.startsWith(b)).length > 0)
        return cacheOptions.cacheConfig
    if ((uri.startsWith('/attachments/') || uri.startsWith('/full_attachments/')) && !event.request.url.includes('.discordapp.'))
        return cacheOptions.cacheCDN
    if (uri.startsWith('/media_attachments/') && !event.request.url.includes('.discordapp.'))
        return cacheOptions.cacheProxy
    if (event.request.url.toString().startsWith(cacheOptions.cdnCache.cdn))
        return cacheOptions.cacheCDN
    if (event.request.url.toString().startsWith(cacheOptions.cdnCache.media))
        return cacheOptions.cacheProxy
    if (cacheOptions.preloadCache.filter(b => uri.startsWith(b) || uri === b).length > 0)
        return cacheOptions.cacheKernel
    return cacheOptions.cacheGeneral
}

function handleResponse(event, response, reqType) {
    const uri = event.request.url.split(origin).pop().toString()
    if (response.status < 400 &&
        cacheOptions.blockedCache.filter(b => uri.startsWith(b)).length === 0 && uri !== '/' &&
        !((uri.includes('/attachments/') || uri.includes('/full_attachments/') || uri.includes('/media_attachments/')) && (uri.includes('JFS_') || uri.includes('PARITY_'))) &&
        !(event.request.url.includes('.discordapp.') && event.request.url.includes('/attachments/') && !swCacheCDN)) {
        const selectedCache = selectCache(event);
        if (swDebugMode)
            console.log(`JulyOS Kernel: ${(reqType) ? reqType + ' + ': ''}Cache (${selectedCache}) - ${event.request.url}`);
        const copy = response.clone();
        const cacheURL = (event.request.url.includes('/full_attachments/')) ? '/full_attachments/' + event.request.url.split('/full_attachments/').pop() : (event.request.url.includes('/media_attachments/')) ? '/media_attachments/' + event.request.url.split('/media_attachments/').pop() : event.request;
        event.waitUntil(
            caches.open(selectedCache).then(cache => cache.put(cacheURL, copy))
        );
    } else {
        if (swDebugMode)
            console.log(`JulyOS Kernel: ${(reqType) ? reqType : ''} Only (Bypass Cache) - ${event.request.url}`);
    }
    return response;
}
async function reCache(event, cacheName) {
    return fetch(event.request)
        .then(response => {
            const selectedCache = cacheName || selectCache(event);
            if (swDebugMode)
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
                if (swDebugMode)
                    console.log('JulyOS Kernel: Cache - ' + event.request.url);
                if (cacheOptions.updateCache.filter(b => event.request.url.split(origin).pop().toString().startsWith(b)).length > 0 || event.request.url.includes('responseType=offline'))
                    reCache(event)
                return cachedResponse;
            }

            if (event.request.url.includes('.discordapp.') && event.request.url.includes('/attachments/')) {
                const newURL = `/${event.request.url.startsWith('https://media.discordapp.net/') ? 'media_' : 'full_'}attachments/${event.request.url.split('/attachments/').pop()}`;
                const cachedResponse = await caches.match(newURL, { ignoreSearch: true });
                if (cachedResponse) {
                    if (swDebugMode)
                        console.log('JulyOS Kernel: Indirect CDN Cache - ' + event.request.url);
                    return cachedResponse;
                }
            }

            event.waitUntil(async () => {
                const response = await event.preloadResponse;
                if (response) {
                    return handleResponse(event, response, 'Preload');
                }
            })
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

self.addEventListener('sync', event => {
    console.log(event.tag);
    if (event.tag === 'refresh' || event.tag === 'test-tag-from-devtools') {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(async cache => {
                    if (cache.startsWith('offline-content-')) {
                        const cacheItem = await caches.open(cache);
                        const keys = await cacheItem.keys();
                        await Promise.all(keys.map(page => {
                            reCache(page.url, cache)
                            console.log(`Refreshed page: ${page.url}`);
                        }))
                        //caches.delete(cache);
                    }
                })
            );
        })
    }
});
