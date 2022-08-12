'use strict';
importScripts('/static/vendor/domparser_bundle.js');
const DOMParser = jsdom.DOMParser;
const cacheName = 'HEAVY_DEV-v20-7-12-2022-P14';
const cacheCDNName = 'DEV-v2-11';
const origin = location.origin
const offlineUrl = '/offline';
const cacheOptions = {
    cacheKernel: 'offline-kernel-' + cacheName,
    cacheConfig: 'offline-config-' + cacheName,
    cacheGeneral: 'offline-generic-' + cacheName,
    tempCacheCDN: 'temp-cdn-' + cacheCDNName,
    tempCacheProxy: 'temp-proxy-' + cacheCDNName,
    builtFiles: 'spanned-files-' + cacheCDNName,
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
        '/device-login',
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
        '/sidebar',
        '/homeImage',
        '/internal'
    ],
    updateCache: [
        '/homeImage',
        '/juneOS',
        '/sidebar'
    ],
    preloadCache: [
        offlineUrl,
        "/static/img/acr-logo.png",
        "/static/img/sequenzia-logo-nav.png",
        "/js/client/worker.unpacker.js",
        "/static/vendor/domparser_bundle.js",
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
        "/js/client/home-lite.min.js",
        "/js/client/onload.min.js",
        "/js/client/displayHistory.min.js",
        "/static/img/sequenzia-logo-mini.png",
        "/static/img/sequenzia-logo-new.png",
        "/static/img/sequenzia-logo-white.png",
        "/js/client/media-enabler.min.js",
        "/static/img/kongoumedialogo-wide.png",
        "/static/img/kms-background.jpeg",
        "/static/js/sb-admin-2.min.js",
        "/js/client/media.min.js",
        "/static/img/boot-logo.png",
        "/static/img/bootlogo-inner.jpeg",
        "/static/img/aak.png",
        "/static/img/about-bg.jpeg",
        "/static/img/kongoumedialogo-wide.png",
        "/static/img/kongoumedialogo-menu-dark.png",
        "/static/img/kongoumedialogo-menu.png",
        "/static/img/kongoumedialogo-bg.png",
        "/static/img/kongou-group.png",
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
        "/static/vendor/fontawesome/css/fontawesome.min.css",
        "/static/vendor/fontawesome/css/all.min.css",
        "/css/custom.min.css",
        "/css/custom-lite.min.css",
        "/css/home-lite.min.css",
        "/static/img/loading_bg.jpeg",
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
    ]
};
let swDebugMode = (origin && origin.includes('localhost:3000'));
let swUseInternalUnpacker = false;
let browserStorageAvailable = false;
let offlineContent;
let downloadSpannedController = new Map();
let downloadSpannedResponse = new Map();
let offlineDownloadSignals = new Map();
let downloadSpannedSignals = new Map();
let activeSpannedJob = false;
const imageFiles = ['jpg','jpeg','jfif','png','webp','gif'];
const videoFiles = ['mp4','mov','m4v', 'webm'];
const audioFiles = ['mp3','m4a','wav', 'ogg', 'flac'];
let offlineMessages = [];
let syncActive = false;

async function broadcastAllMessage(message) {
    self.clients.matchAll({
        includeUncontrolled: true,
        type: "window"
    }).then(all => all.map(client => client.postMessage(message)));
}
function selectCache(url) {
    const uri = url.split(origin).pop().toString()
    if (cacheOptions.configCache.filter(b => uri.startsWith(b)).length > 0 || uri === '/' || uri === '/home')
        return cacheOptions.cacheConfig
    if ((uri.startsWith('/attachments/') || uri.startsWith('/full_attachments/')) && !url.includes('.discordapp.'))
        return cacheOptions.tempCacheCDN
    if (uri.startsWith('/media_attachments/') && !url.includes('.discordapp.'))
        return cacheOptions.tempCacheProxy
    if (url.toString().startsWith(cacheOptions.cdnCache.cdn))
        return cacheOptions.tempCacheCDN
    if (url.toString().startsWith(cacheOptions.cdnCache.media))
        return cacheOptions.tempCacheProxy
    if (cacheOptions.preloadCache.filter(b => uri.startsWith(b) || uri === b).length > 0)
        return cacheOptions.cacheKernel
    return cacheOptions.cacheGeneral
}
async function handleResponse(url, response, reqType) {
    const uri = url.split(origin).pop().toString()
    if (response.status < 204 &&
        cacheOptions.blockedCache.filter(b => uri.startsWith(b)).length === 0 &&
        !((uri.includes('/attachments/') || uri.includes('/full_attachments/') || uri.includes('/media_attachments/')) && (uri.includes('JFS_') || uri.includes('PARITY_'))) &&
        !(url.includes('.discordapp.') && url.includes('/attachments/'))) {
        const selectedCache = selectCache(url);
        if (swDebugMode)
            console.log(`JulyOS Kernel: ${(reqType) ? reqType + ' + ': ''}Cache (${selectedCache}) - ${url}`);
        const copy = response.clone();
        const cacheURL = (url.includes('/full_attachments/')) ? '/full_attachments/' + url.split('/full_attachments/').pop() : (url.includes('/media_attachments/')) ? '/media_attachments/' + url.split('/media_attachments/').pop() : url;
        const cache = await caches.open(selectedCache)
        await cache.put(cacheURL, copy)
        if (url.includes('/homeImage')) {
            const lastResponse = await caches.match(cacheURL);
            await handleHomeImageCachesEvent(uri, selectedCache, lastResponse);
        }
    } else {
        if (swDebugMode)
            console.log(`JulyOS Kernel: ${(reqType) ? reqType : 'Network'} Only (Bypass Cache) - ${url}`);
    }
    if (uri.includes('/discord/login') || uri.includes('/discord/destroy') || uri.includes('/discord/refresh')) {
        console.log(`Config Cache will be cleared!`);
        await caches.delete(cacheOptions.cacheConfig)
    }
    return response;
}
async function shouldRecache(event, response) {
    if (cacheOptions.updateCache.filter(b => event.request.url.split(origin).pop().toString().startsWith(b)).length > 0 || event.request.url.split(origin).pop().toString() === '/' || event.request.url.split(origin).pop().toString() === '/home')
        reCache(event, response)
}
async function handleHomeImageCachesEvent(url, selectedCache, lastResponse) {
    try {
        if (lastResponse) {
            const lastJson = await lastResponse.json();
            if (lastJson.randomImagev2 && lastJson.randomImagev2.length > 0) {
                const lastFullImage = await caches.match(replaceDiscordCDN(lastJson.randomImagev2[0].fullImage)) || await fetch(replaceDiscordCDN(lastJson.randomImagev2[0].fullImage));
                if (lastFullImage)
                    caches.open(selectedCache).then(cache => cache.put('/internal/last_full.jpg', lastFullImage))
                if (swDebugMode)
                    console.log('Cached last image for transition')
            }
        } else {
            if (swDebugMode)
                console.log('JSON not valid!')
        }
        if (swDebugMode)
            console.log('Fetching next home image')
        const response = await caches.match(url);
        const json = await response.json();
        if (json.randomImagev2 && json.randomImagev2.length > 0) {
            const previewImage = replaceDiscordCDN(json.randomImagev2[0].previewImage);
            const fullImage = replaceDiscordCDN(json.randomImagev2[0].fullImage);
            const previewImageResults = await fetch(previewImage)
            if (previewImageResults)
                caches.open(selectedCache).then(cache => cache.put(previewImage, previewImageResults));
            const fullImageResults = await fetch(fullImage)
            if (fullImageResults)
                caches.open(selectedCache).then(cache => cache.put(fullImage, fullImageResults));
            if (swDebugMode)
                console.log('Got new images for cache!')
        } else {
            if (swDebugMode)
                console.log('JSON not valid!')
        }
    } catch (e) {
        console.error('Error cacheing next image request for home page');
        console.error(e.message);
    }
}
async function reCache(event, cacheName) {
    return fetch(event.request)
        .then(async response => {
            const selectedCache = cacheName || selectCache(event.request.url);
            if (swDebugMode)
                console.log(`JulyOS Kernel: Update Cache (${selectedCache}) - ${event.request.url}`)
            const lastResponse = await caches.match(event.request.url);
            const cache = await caches.open(selectedCache)
            await cache.put(event.request, response)
            if (event.request.url.includes('/homeImage')) {
                await handleHomeImageCachesEvent(event.request.url, selectedCache, lastResponse);
            }
        })
        .catch(error => {
            console.error('JulyOS Kernel: Update Failed - ' + event.request.url);
            console.error(error);
        })
}
function decodeURLRecursively(uri) {
    while (uri !== decodeURIComponent(uri || '')){
        uri = decodeURIComponent(uri);
    }
    return uri;
}
function params(_removeParams, _addParams, _url, keep) {
    let _URL = new URL(origin);
    let _params = new URLSearchParams(_URL.search);
    if (_url) {
        _URL = new URL(origin + _url);
        if (keep && keep === true) {
            console.log('Keeping URL for param')
        } else {
            _params = new URLSearchParams(_URL.search);
        }
    }
    _removeParams.forEach(param => {
        if (_params.has(param)) {
            _params.delete(param);
            if (param === 'offset') {
                _params.delete('_h');
            }
        }
    })
    _addParams.forEach(param => {
        if (_params.has(param[0])) {
            _params.delete(param[0]);
        }
        _params.set(param[0], encodeURIComponent(decodeURLRecursively(param[1])));
    })
    return `${_URL.pathname}?${_params.toString()}`
}

const offlineContentDB = self.indexedDB.open("offlineContent", 4);
offlineContentDB.onerror = event => {
    console.error(event.errorCode);
    broadcastAllMessage({type: 'NOTIFY_ERROR', message: `IndexedDB Is Not Available: Offline Content will not be available!`});
    console.error(`IndexedDB Is Not Available: Offline Content will not be available!`)
};
offlineContentDB.onsuccess = event => {
    offlineContent = event.target.result;
    console.log('Offline Database is available');
    setInterval(() => checkExpiredFiles, 900000);
    checkExpiredFiles();
    broadcastAllMessage({type: 'NOTIFY_OFFLINE_READY', status: true });
    browserStorageAvailable = true;
};
offlineContentDB.onupgradeneeded = event => {
    // Save the IDBDatabase interface
    const db = event.target.result;
    // Create an objectStore for this database
    if (event.oldVersion < 1) {
        const spannedFilesStore = db.createObjectStore("spanned_files", {keyPath: "id"});
        spannedFilesStore.createIndex("id", "id", {unique: true});
        spannedFilesStore.createIndex("name", "name", {unique: false});
        spannedFilesStore.createIndex("size", "size", {unique: false});
        spannedFilesStore.createIndex("channel", "channel", {unique: false});
        spannedFilesStore.transaction.oncomplete = event => {
        }
        const offlinePageStore = db.createObjectStore("offline_pages", {keyPath: "url"});
        offlinePageStore.createIndex("url", "url", {unique: true});
        offlinePageStore.createIndex("title", "title", {unique: false});
        offlinePageStore.createIndex("files", "files", {unique: false});
        offlinePageStore.createIndex("previews", "previews", {unique: false});
        offlinePageStore.transaction.oncomplete = event => {
        }
        const offlineItemsStore = db.createObjectStore("offline_items", {keyPath: "eid"});
        offlineItemsStore.createIndex("eid", "eid", {unique: true});
        offlineItemsStore.createIndex("data_type", "data_type", {unique: false});
        offlineItemsStore.createIndex("full_url", "full_url", {unique: true});
        offlineItemsStore.createIndex("preview_url", "preview_url", {unique: false});
        offlineItemsStore.transaction.oncomplete = event => {
        }
    }
    if (event.oldVersion < 2) {
        const offlineKongouShows = db.createObjectStore("offline_kongou_shows", {keyPath: "showId"});
        offlineKongouShows.createIndex("showId", "showId", {unique: true});
        offlineKongouShows.transaction.oncomplete = event => {
        }
        const offlineKongouEpisode = db.createObjectStore("offline_kongou_episodes", {keyPath: "eid"});
        offlineKongouEpisode.createIndex("eid", "eid", {unique: true});
        offlineKongouEpisode.createIndex("showId", "showId", {unique: false});
        offlineKongouEpisode.transaction.oncomplete = event => {
        }
    }
    if (event.oldVersion < 3) {
        const offlineStorageData = db.createObjectStore("offline_filedata", {keyPath: "url"});
        offlineStorageData.createIndex("url", "url", {unique: true});
        offlineStorageData.transaction.oncomplete = event => {
        }
    }
};

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
    console.log('JulyOS Kernel Started');
    // Remove unwanted caches
    e.waitUntil(async function() {
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(cache => (cache.startsWith('offline-kernel-') && cache !== cacheOptions.cacheKernel ||
            cache.startsWith('offline-generic-') && cache !== cacheOptions.cacheGeneral ||
            cache.startsWith('offline-config-') && cache !== cacheOptions.cacheConfig ||
            cache.startsWith('offline-proxy-') ||
            cache.startsWith('offline-cdn-')))
        oldCaches.map(cache => {
                console.log('JulyOS Kernel: Clearing Old Cache - ' + cache);
                return caches.delete(cache);
        })
        if (oldCaches.length > 0) {
            caches.open(cacheOptions.cacheKernel).then(function(cache) {
                const results = cacheOptions.preloadCache.map(async u => {
                    return await cache.add(u);
                }).filter(f => !(f && f.ok)).length > 1
                console.log(results)
                return results
            })
            setTimeout(() => {
                broadcastAllMessage({
                    type: 'MAKE_TOAST',
                    level: 'success',
                    title: '<i class="fas fa-sync pr-2"></i>Update Successful',
                    subtitle: '',
                    content: `<p class="text-center">The application and kernel was updated!</p><p class="text-center">Version: "${cacheName}"</p><a class="btn btn-primary w-100" href="/"><i class="fas fa-sync pr-2"></i>Restart</a>`
                });
            }, 3000)
        }
    }());
});

self.addEventListener('fetch', event => {
    event.respondWith(async function() {
        try {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) {
                if (swDebugMode)
                    console.log('JulyOS Kernel: Cache - ' + event.request.url);
                shouldRecache(event);
                return cachedResponse;
            }

            if (event.request.url.includes('_attachments/') || (event.request.url.includes('attachments/') && event.request.url.includes('.discordapp.'))) {
                const newURL = (event.request.url.includes('.discordapp.') && event.request.url.includes('/attachments/')) ? `/${event.request.url.includes('https://media.discordapp.net/') ? 'media_' : 'full_'}attachments/${event.request.url.split('/attachments/').pop()}` : event.request.url.split(origin).pop();
                const cachedFile = await caches.match(newURL)
                if (cachedFile) {
                    if (swDebugMode)
                        console.log('JulyOS Kernel: Indirect Cache - ' + event.request.url);
                    return cachedFile
                }
                const offlineFile = await getDataIfAvailable(newURL)
                if (offlineFile) {
                    if (swDebugMode)
                        console.log('JulyOS Kernel: Offline Storage - ' + event.request.url);
                    return new Response(offlineFile, { status: 200 });
                }
                if (event.request.url.includes('https://media.discordapp.net/')) {
                    const cachedFile = await caches.match(newURL.split('?')[0])
                    if (cachedFile) {
                        if (swDebugMode)
                            console.log('JulyOS Kernel: Indirect Cache (Resolution Bypass) - ' + event.request.url);
                        return cachedFile
                    }
                    const offlineFile = await getDataIfAvailable(newURL.split('?')[0])
                    if (offlineFile) {
                        if (swDebugMode)
                            console.log('JulyOS Kernel: Offline Storage (Resolution Bypass) - ' + event.request.url);
                        return offlineFile;
                    }
                }
            }
        } catch (err) {
            console.error('JulyOS Kernel: Error fetching cache or preloaded response - ' + event.request.url)
            console.error(err);
        }
        if (event.request.url.includes('/internal/'))
            return new Response(null, { status: 405 });
        // Else try the network.
        try {
            const response = (await event.preloadResponse || await fetch(event.request))
            if (response) {
                handleResponse(event.request.url, response, "Network");
                return response;
            } else {
                console.log('JulyOS Kernel: Offline - ' + event.request.url);
                if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html')))
                    return caches.match(offlineUrl);
            }
        } catch (err) {
            console.log('JulyOS Kernel: Offline - ' + event.request.url);
            if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html')))
                return caches.match(offlineUrl);
            console.error(err);
        }
    }());
});
self.addEventListener('sync', async (event) => {
    console.log(event.tag);
    await refreshOfflineItemCache();
    switch (event.tag) {
        case 'test-tag-from-devtools':
        case 'SYNC_PAGES_NEW_ONLY':
        case 'SYNC_PAGES':
            if (!syncActive) {
                syncActive = true;
                const pages = await getAllOfflinePages()
                let itemsUpdated = 0;
                let pagesUpdated = [];
                if (pages && pages.length > 0) {
                    for (let page of pages) {
                        const results = await cachePageOffline(undefined, page.url, undefined, (event.tag === 'SYNC_PAGES_NEW_ONLY'));
                        if (results && results.count > 0) {
                            itemsUpdated += results.count
                            pagesUpdated.push(`${(results.title) ? results.title : page.url}${(!results.ok) ? ' (Failed)' : ' (' + results.count + ')'}`);
                        }
                    }
                    if (itemsUpdated > 0) {
                        if ('showNotification' in self.registration) {
                            self.registration.showNotification("Synced Pages", {
                                body: pagesUpdated.join('\n'),
                                badge: '/static/vendor/fontawesome/svgs/solid/arrows-rotate.svg'
                            });
                        }
                        console.log('Background Sync Complete');
                        console.log(pagesUpdated.join('\n'));
                    }
                }
                setTimeout(() => {syncActive = false}, 90000)
            } else {
                if (swDebugMode)
                    console.log('Sync Request Already Active!')
            }
            break;
        case 'SYNC_SERIES':

            break;
        case 'CLEAN_TEMP_CACHE':
            expireTempCache();
            break;
        default:
            console.error('Sync Tag not recognized - ' + event.tag);
            break;
    }
});
self.addEventListener('periodicsync', async (event) => {
    console.log(event.tag);
    await refreshOfflineItemCache();
    switch (event.tag) {
        case 'test-tag-from-devtools':
        case 'SYNC_PAGES_NEW_ONLY':
            if (!syncActive) {
                syncActive = true;
                const pages = await getAllOfflinePages()
                let itemsUpdated = 0;
                let pagesUpdated = [];
                if (pages && pages.length > 0) {
                    for (let page of pages) {
                        const results = await cachePageOffline(undefined, page.url, undefined, (event.tag === 'SYNC_PAGES_NEW_ONLY'));
                        if (results && results.count > 0) {
                            itemsUpdated += results.count
                            pagesUpdated.push(`${(results.title) ? results.title : page.url}${(!results.ok) ? ' (Failed)' : ' (' + results.count + ')'}`);
                        }
                    }
                    if (itemsUpdated > 0) {
                        if ('showNotification' in self.registration) {
                            self.registration.showNotification("Synced Pages", {
                                body: pagesUpdated.join('\n'),
                                badge: '/static/vendor/fontawesome/svgs/solid/arrows-rotate.svg'
                            });
                        }
                        console.log('Background Sync Complete');
                        console.log(pagesUpdated.join('\n'));
                    }
                }
                setTimeout(() => {syncActive = false}, 90000)
            } else {
                if (swDebugMode)
                    console.log('Sync Request Already Active!')
            }
            break;
        case 'SYNC_SERIES':

            break;
        default:
            console.error('Periodic Sync Tag not recognized - ' + event.tag);
            break;
    }
});
self.addEventListener('message', async (event) => {
    switch (event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            event.ports[0].postMessage(true);
            break;
        case 'CANCEL_UNPACK_FILE':
            stopUnpackingFiles(event.data.fileid);
            event.ports[0].postMessage(true);
            break;
        case 'CANCEL_STORAGE_PAGE':
            offlineDownloadSignals.delete(event.data.url);
            event.ports[0].postMessage(true);
            break;
        case 'CLEAR_ALL_STORAGE':
            deleteAllOfflineData();
            event.ports[0].postMessage(true);
            break;
        case 'SAVE_STORAGE_PAGE':
            cachePageOffline(undefined, event.data.url, event.data.limit)
            event.ports[0].postMessage(true);
            break;
        case 'SAVE_STORAGE_FILE':
            cacheFileOffline(event.data.meta, event.data.noconfirm)
            event.ports[0].postMessage(true);
            break;
        case 'SAVE_STORAGE_KMS_EPISODE':
            cacheEpisodeOffline(event.data.meta, event.data.noconfirm)
            event.ports[0].postMessage(true);
            break;
        case 'GET_STORAGE_ALL_PAGES':
            event.ports[0].postMessage(await getAllOfflinePages());
            break;
        case 'GET_STORAGE_PAGE':
            event.ports[0].postMessage(await getPageIfAvailable(event.data.url));
            break;
        case 'GET_STORAGE_PAGE_ITEMS':
            event.ports[0].postMessage(await getPageItemsIfAvailable(event.data.url));
            break;
        case 'GET_STORAGE_ALL_FILES':
            event.ports[0].postMessage(await getAllOfflineFiles());
            break;
        case 'GET_STORAGE_FILE':
            event.ports[0].postMessage(await getFileIfAvailable(event.data.eid));
            break;
        case 'GET_STORAGE_ALL_SPANNED_FILES':
            event.ports[0].postMessage(await getAllOfflineSpannedFiles());
            break;
        case 'GET_STORAGE_SPANNED_FILE':
            event.ports[0].postMessage(await getSpannedFileIfAvailable(event.data.fileid));
            break;
        case 'GET_STORAGE_KMS_SHOW':
            event.ports[0].postMessage(await getEpisodesIfAvailable(event.data.id));
            break;
        case 'GET_STORAGE_ALL_KMS_SHOW':
            event.ports[0].postMessage(await getAllOfflineSeries());
            break;
        case 'GET_TOTAL_STORAGE_USAGE':
            event.ports[0].postMessage(await getTotalStorageUsage());
            break;
        case 'REMOVE_STORAGE_PAGE':
            event.ports[0].postMessage(await deleteOfflinePage(event.data.url, (!!event.data.noupdate)));
            break;
        case 'EXPIRE_STORAGE_PAGE':
            event.ports[0].postMessage(await expireOfflinePage(event.data.url, (!!event.data.noupdate), (event.data.hours)));
            break;
        case 'REMOVE_STORAGE_FILE':
            event.ports[0].postMessage(await deleteOfflineFile(event.data.eid, (!!event.data.noupdate), (!!event.data.preemptive)));
            break;
        case 'EXPIRE_STORAGE_FILE':
            event.ports[0].postMessage(await expireOfflineFile(event.data.eid, (!!event.data.noupdate), (event.data.hours)));
            break;
        case 'KEEP_EXPIRE_STORAGE_FILE':
            event.ports[0].postMessage(await keepExpireOfflineFile(event.data.eid, (!!event.data.noupdate)));
            break;
        case 'REMOVE_STORAGE_SPANNED_FILE':
            event.ports[0].postMessage(await deleteOfflineSpannedFile(event.data.fileid));
            break;
        case 'EXPIRE_STORAGE_SPANNED_FILE':
            event.ports[0].postMessage(await expireSpannedFile(event.data.fileid, (!!event.data.noupdate), (event.data.hours)));
            break;
        case 'PING':
            event.ports[0].postMessage(true);
            break;
        case 'PING_STORAGE':
            await refreshOfflineItemCache();
            event.ports[0].postMessage(browserStorageAvailable);
            break;
        case 'STATUS_UNPACK_STARTED':
        case 'STATUS_UNPACK_QUEUED':
        case 'STATUS_UNPACK_DUPLICATE':
            downloadSpannedSignals.set(event.data.fileid, true);
            event.ports[0].postMessage(true);
            break;
        case 'STATUS_UNPACK_FAILED':
        case 'STATUS_UNPACKER_FAILED':
            downloadSpannedResponse.set(event.data.fileid, false);
            downloadSpannedSignals.delete(event.data.fileid);
            event.ports[0].postMessage(true);
            break;
        case 'STATUS_UNPACK_COMPLETED':
            downloadSpannedResponse.set(event.data.fileid, true);
            downloadSpannedSignals.delete(event.data.fileid);
            event.ports[0].postMessage(true);
            break;
        case 'STATUS_UNPACKER_ACTIVE':
            event.ports[0].postMessage(true);
            break;
        case 'SYNC_PAGES_NEW_ONLY':
        case 'SYNC_PAGES':
            if (!syncActive) {
                syncActive = true;
                const pages = await getAllOfflinePages()
                let itemsUpdated = 0;
                let pagesUpdated = [];
                if (pages && pages.length > 0) {
                    for (let page of pages) {
                        const results = await cachePageOffline(undefined, page.url, undefined, (event.data.type === 'SYNC_PAGES_NEW_ONLY'));
                        if (results && results.count > 0) {
                            itemsUpdated += results.count
                            pagesUpdated.push(`${(results.title) ? results.title : page.url}${(!results.ok) ? ' (Failed)' : ' (' + results.count + ')'}`);
                        }
                    }
                    if (itemsUpdated > 0) {
                        if ('showNotification' in self.registration) {
                            self.registration.showNotification("Synced Pages", {
                                body: pagesUpdated.join('\n'),
                                badge: '/static/vendor/fontawesome/svgs/solid/arrows-rotate.svg'
                            });
                        }
                        console.log('Background Sync Complete');
                        console.log(pagesUpdated.join('\n'));
                        event.ports[0].postMessage({
                            didActions: true,
                            itemsGot: itemsUpdated
                        });
                    } else {
                        event.ports[0].postMessage({
                            didActions: true,
                            itemsGot: 0
                        });
                    }
                } else {
                    event.ports[0].postMessage({
                        didActions: true,
                        itemsGot: 0
                    });
                }
                setTimeout(() => {syncActive = false}, 90000)
            } else {
                event.ports[0].postMessage({
                    didActions: false,
                    itemsGot: 0
                });
            }
            break;
        case 'INSTALL_KERNEL':
            const cache = await caches.open(cacheOptions.cacheKernel)
            cacheOptions.preloadCache.map(async u => {
                return await cache.add(u);
            })
            event.ports[0].postMessage(true);
            break;
        case 'GET_ALL_ACTIVE_JOBS':
            event.ports[0].postMessage({
                activeSpannedJob,
                activeSpannedJobs: Array.from(downloadSpannedController.values())
            });
            break;
        default:
            console.log(event);
            console.log(event.data);
            console.log('Unknown Message');
            event.ports[0].postMessage(false);
    break;
    }
});
self.addEventListener('backgroundfetchsuccess', event => {
    console.log('[Service Worker]: Background Fetch Success', event.registration);
});

function expireTempCache() {
    Promise.all([cacheOptions.tempCacheCDN, cacheOptions.tempCacheProxy].map(async cacheName => {
        await caches.delete(cacheName);
    }))
}

function replaceDiscordCDN(url) {
    return (url.includes('.discordapp.') && url.includes('attachments')) ? `/${(url.startsWith('https://media.discordapp') ? 'media_' : 'full_')}attachments${url.split('attachments').pop()}` : url;
}
function returnDiscordCDN(url) {
    return (url.includes('_attachments')) ? `https://${(url.startsWith('/media_') ? 'media.discordapp.net' : 'cdn.discordapp.com')}/attachments${url.split('attachments').pop()}` : url;
}
async function extractMetaFromElement(e, preemptive) {
    const postChannelString = e.getAttribute('data-msg-channel-string');
    const postChannelIcon = e.getAttribute('data-msg-channel-icon');
    const postDownload = e.getAttribute('data-msg-download');
    const postFilename = e.getAttribute('data-msg-filename');
    const postFilID = e.getAttribute('data-msg-fileid');
    const postCached = e.getAttribute('data-msg-filecached') === 'true';
    const postEID = e.getAttribute('data-msg-eid');
    const postID = e.getAttribute('data-msg-id');
    const fileSize = e.getAttribute('data-msg-filesize');
    const postDate = e.getAttribute('data-msg-date');
    const postPreviewImage = e.getAttribute('data-msg-url-preview');
    const postExtraPreviewImage = e.getAttribute('data-msg-url-extpreview');
    const postFullImage = e.getAttribute('data-msg-url-full');
    const postColor = decodeURIComponent(e.getAttribute('data-search-color')).split(':');
    const postKMSJSON = ((_data) => {
        if (_data && _data.length > 2) {
            try {
                return JSON.parse(_data);
            } catch (err) {
                console.error(`Failed to parse Kongou Media Data`);
                console.error(err);
                return false
            }
        }
        return false
    })(e.getAttribute('data-kms-json'));
    const attribs = Array.from(e.attributes).map(f => f.nodeName + '="' + f.value.split('"').join('&quot;') + '"');

    let required_build = (postFilID && !postCached && !(await getSpannedFileIfAvailable(postFilID)));
    let data_type = null;
    let fullItem = null;
    let previewItem = null;
    let extpreviewItem = null;
    let kongouPoster = null;
    let kongouBackdrop = null;
    let kongouisMovie = null;

    if (imageFiles.indexOf(postFilename.split('.').pop().split('?')[0].toLowerCase().trim()) > -1) {
        data_type = 'image';
    } else if (videoFiles.indexOf(postFilename.split('.').pop().split('?')[0].toLowerCase().trim()) > -1) {
        data_type = 'video';
    } else if (audioFiles.indexOf(postFilename.split('.').pop().split('?')[0].toLowerCase().trim()) > -1) {
        data_type = 'audio';
    }
    if (postPreviewImage)
        previewItem = replaceDiscordCDN(postPreviewImage);
    if (postExtraPreviewImage)
        extpreviewItem = replaceDiscordCDN(postExtraPreviewImage);
    if (postFullImage)
        fullItem = replaceDiscordCDN(postFullImage);
    if (postDownload && !(postFilID && !postCached) && !required_build)
        fullItem = replaceDiscordCDN(postDownload);
    if (postKMSJSON) {
        kongouisMovie = (!!postKMSJSON.show)
        if (postKMSJSON.show.poster) {
            kongouPoster = replaceDiscordCDN(`https://media.discordapp.net/attachments${postKMSJSON.show.poster}`)
        }
        if (postKMSJSON.show.background) {
            kongouBackdrop = replaceDiscordCDN(`https://media.discordapp.net/attachments${postKMSJSON.show.background}`)
        }
    }

    return {
        full_url: fullItem,
        preview_url: previewItem,
        kongou_poster_url: kongouPoster,
        kongou_backdrop_url: kongouBackdrop,
        extpreview_url: extpreviewItem,
        data_type,
        fileid: postFilID,
        channel: postChannelString,
        channel_icon: postChannelIcon,
        filename: postFilename,
        id: postID,
        date: postDate,
        file_size: fileSize,
        color: postColor,
        eid: postEID,
        required_build: required_build,
        preemptive_download: (!!preemptive),
        htmlAttributes: attribs,
        kongou_meta: (postKMSJSON && postKMSJSON.show) ? postKMSJSON : null,
    }
}
async function getPageIfAvailable(url, includeExpired) {
    return new Promise((resolve) => {
        try {
            if (url && browserStorageAvailable) {
                offlineContent.transaction("offline_pages").objectStore("offline_pages").get(url).onsuccess = event => {
                    if (event.target.result && event.target.result.items && (includeExpired || !(event.target.result.expires && event.target.result.expires < Date.now()))) {
                        resolve({
                            ...event.target.result
                        })
                    } else {
                        resolve(false)
                    }
                };
            } else {
                resolve(false)
            }
        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function getPageItemsIfAvailable(_url) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_pages").objectStore("offline_pages").get(_url).onsuccess = event => {
                    if (event.target.result && event.target.result.url && !(event.target.result.expires && event.target.result.expires < Date.now())) {
                        resolve({
                            ...event.target.result
                        })
                    } else {
                        resolve(false)
                    }
                };
            } else {
                resolve(false)
            }
        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function getFileIfAvailable(eid, includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_items").objectStore("offline_items").get(eid).onsuccess = event => {
                    if (event.target.result && event.target.result.eid && (includeExpired || !(event.target.result.expires && event.target.result.expires < Date.now()))) {
                        resolve({
                            ...event.target.result
                        })
                    } else {
                        resolve(false)
                    }
                };
            } else {
                resolve(false)
            }
        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function getSpannedFileIfAvailable(fileid, includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("spanned_files").objectStore("spanned_files").get(fileid).onsuccess = async (event) => {
                    if (event.target.result && event.target.result.id && event.target.result.block) {
                        if (includeExpired || !(event.target.result.expires && event.target.result.expires < Date.now())) {
                            resolve({
                                ...event.target.result
                            })
                        } else {
                            resolve(false)
                        }
                    } else {
                        resolve(false)
                    }
                };
            } else {
                resolve(false)
            }
        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function getDataIfAvailable(url, includeExpired) {
    return new Promise((resolve) => {
        let timeout = setTimeout(() => { resolve(false); }, 2500);
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_filedata").objectStore("offline_filedata").get(url).onsuccess = event => {
                    if (event.target.result && event.target.result.data && (includeExpired || !(event.target.result.expires && event.target.result.expires < Date.now()))) {
                        resolve(event.target.result.data)
                    } else {
                        resolve(false)
                    }
                    clearTimeout(timeout);
                    timeout = null;
                };
            } else {
                resolve(false);
                clearTimeout(timeout);
                timeout = null;
            }
        } catch (e) {
            console.log(e);
            clearTimeout(timeout);
            timeout = null;
            resolve(false)
        }
    })
}
async function getEpisodesIfAvailable(showId, includeExpired) {
    return new Promise(async (resolve) => {
        try {
            if (browserStorageAvailable && !isNaN(parseInt(showId.toString()))) {
                const transaction = offlineContent.transaction(["offline_kongou_shows", "offline_kongou_episodes"])
                const showData = await new Promise((data) => {
                    transaction.objectStore("offline_kongou_shows").get(parseInt(showId.toString())).onsuccess = event => {
                        if (event.target.result && event.target.result.meta && (includeExpired || !(event.target.result.expires && event.target.result.expires < Date.now()))) {
                            data({ ...event.target.result })
                        } else {
                            data(false)
                        }
                    };
                })
                if (showData) {
                    const episodeData = await new Promise((data) => {
                        transaction.objectStore("offline_kongou_episodes").index('showId').getAll(parseInt(showId.toString())).onsuccess = async (event) => {
                            if (event.target.result && event.target.result.length > 0) {
                                const episodes = await Promise.all(event.target.result.filter(e => includeExpired || !(e.expires && e.expires < Date.now())).map(async episode => {
                                    const ep_item = await getFileIfAvailable(episode.eid.toString())
                                    if (ep_item) {
                                        return {
                                            ...ep_item,
                                            media: episode
                                        }
                                    } else {
                                        return false;
                                    }
                                }))
                                if (episodes.length > 0) {
                                    data({show: showData, episodes})
                                } else {
                                    data(false)
                                }
                            } else {
                                data(false)
                            }
                        };
                    })
                    resolve(episodeData);
                } else {
                    resolve(false)
                }
            } else {
                resolve(false)
            }
        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function getAllOfflinePages(includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_pages").objectStore("offline_pages").getAll().onsuccess = event => {
                    resolve(event.target.result.filter(e => includeExpired || !(e.expires && e.expires < Date.now())).map(e => {
                        return {
                            ...e
                        }
                    }))
                }
            } else {
                resolve([])
            }
        } catch (e) {
            console.log(e);
            resolve([])
        }
    })
}
async function getAllOfflineSeries(includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_kongou_shows").objectStore("offline_kongou_shows").getAll().onsuccess = event => {
                    resolve(event.target.result.filter(e => includeExpired || !(e.expires && e.expires < Date.now())).map(e => {
                        return {
                            ...e
                        }
                    }))
                }
            } else {
                resolve([])
            }
        } catch (e) {
            console.log(e);
            resolve([])
        }
    })
}
async function getAllOfflineFiles(includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_items").objectStore("offline_items").getAll().onsuccess = event => {
                    resolve(event.target.result.filter(e => includeExpired || !(e.expires && e.expires < Date.now())).map(e => {
                        return {
                            ...e
                        }
                    }))
                }
            } else {
                resolve([]);
            }
        } catch (e) {
            console.log(e);
            resolve([])
        }
    })
}
async function getAllOfflineData(includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_filedata").objectStore("offline_filedata").getAll().onsuccess = event => {
                    resolve(event.target.result.filter(e => includeExpired || !(e.expires && e.expires < Date.now())).map(e => {
                        return {
                            ...e
                        }
                    }))
                }
            } else {
                resolve([]);
            }
        } catch (e) {
            console.log(e);
            resolve([])
        }
    })
}
async function getAllOfflineSpannedFiles(includeExpired) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("spanned_files").objectStore("spanned_files").getAll().onsuccess = async (event) => {
                    resolve(event.target.result.filter(e => includeExpired || !(e.expires && e.expires < Date.now())).map(e => {
                        return {
                            ...e
                        }
                    }))
                }
            } else {
                resolve([]);
            }
        } catch (e) {
            console.log(e);
            resolve([])
        }
    })
}
async function refreshOfflineItemCache() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_items").objectStore("offline_items").getAll().onsuccess = event => {
                    const items = event.target.result
                    offlineMessages = [...items.map(e => e.id)]
                    broadcastAllMessage({
                        type: 'STATUS_STORAGE_CACHE_LIST',
                        entities: [...items.map(e => e.eid)],
                        expires_entities: [...items.filter(e => !!e.expires).map(e => e.eid)],
                        messages: offlineMessages,
                        expires_messages: [...items.filter(e => !!e.expires).map(e => e.id)],
                        expires_time: [...items.filter(e => !!e.expires).map(e => e.expires)]
                    });
                    resolve(true);
                }
            } else {
                resolve(false);
            }
        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function getTotalStorageUsage() {
    return new Promise(async (resolve) => {
        try {
            let totalSpannedUsage = 0;
            let totalDataUsage = 0;
            (await getAllOfflineSpannedFiles()).filter(e => !!e.block).map(e => {
                totalSpannedUsage += e.block.size
            });
            (await getAllOfflineData()).filter(e => !!e.data).map(e => {
                totalDataUsage += e.data.size
            });
            resolve({
                spanned: totalSpannedUsage,
                data: totalDataUsage
            });

        } catch (e) {
            console.log(e);
            resolve(false)
        }
    })
}
async function updateNotficationsPanel() {
    // TODO: Send notifications to all clients to update the notifications panel
}

async function deleteOfflinePage(url, noupdate) {
    try {
        if (url) {
            const page = await getPageIfAvailable(url);
            if (page) {
                let blockedItems = [];
                (await getAllOfflinePages()).filter(e => e.url !== url).map(page => blockedItems.push(...page.items))
                const files = await getAllOfflineFiles();
                const pageItems = files.filter(e => blockedItems.indexOf(e.eid) === -1 && page.items.indexOf(e.eid) !== -1);

                for (let e of pageItems) {
                    const indexDBUpdate = offlineContent.transaction(["offline_items"], "readwrite").objectStore("offline_items").delete(e.eid);
                    indexDBUpdate.onsuccess = async event => {
                        if (e.full_url)
                            await deleteOfflineData(e.full_url);
                        if (e.preview_url)
                            await deleteOfflineData(e.preview_url);
                        if (e.extpreview_url)
                            await deleteOfflineData(e.extpreview_url);
                        if (e.kongou_poster_url) {
                            await deleteOfflineData(e.kongou_poster_url);
                            await deleteOfflineData(e.kongou_poster_url +'?height=580&width=384');
                        }
                        if (e.kongou_backdrop_url)
                            await deleteOfflineData(e.kongou_backdrop_url);
                    }
                }
                if (browserStorageAvailable) {
                    const indexDBUpdate = offlineContent.transaction(["offline_pages"], "readwrite").objectStore("offline_pages").delete(url);
                    indexDBUpdate.onsuccess = event => {
                        if (!noupdate) {
                            broadcastAllMessage({
                                type: 'MAKE_SNACK',
                                level: 'success',
                                text: `<i class="fas fa-sd-card pr-2"></i>Removed Page and ${pageItems.length} files`,
                                timeout: 5000
                            });
                            refreshOfflineItemCache();
                        }
                        updateNotficationsPanel();
                    };
                } else {
                    updateNotficationsPanel();
                }
            } else {
                console.error('Could not find the offline content')
            }
        } else {
            console.log('URL not validated')
        }
    } catch (err) {
        console.error(`Uncaught Item Download Error`);
        console.error(err)
        broadcastAllMessage({
            type: 'MAKE_TOAST',
            level: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not delete offline item</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
    }
}
async function expireOfflinePage(url, noupdate, hours) {
    return new Promise(async resolve => {
        try {
            const page = await getPageIfAvailable(url, true);
            if (page) {
                if (browserStorageAvailable) {
                    offlineContent.transaction(["offline_pages"], "readwrite").objectStore("offline_pages").put({
                        ...page,
                        expires:(new Date().getTime()) + ((hours || 1.5) * 3600000)
                    }).onsuccess = event => {
                        if (!noupdate) {
                            updateNotficationsPanel();
                            refreshOfflineItemCache();
                        }
                        resolve(true);
                    };
                } else {
                    if (!noupdate) {
                        updateNotficationsPanel();
                        refreshOfflineItemCache();
                    }
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } catch (err) {
            console.error(`Uncaught Item Download Error`);
            console.error(err)
            broadcastAllMessage({
                type: 'MAKE_TOAST',
                level: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Could not make page expireable</p><p>Internal Application Error: ${err.message}</p>`,
                timeout: 10000
            });
            resolve(false);
        }
    })
}
async function deleteOfflineFile(eid, noupdate, preemptive, bypassBlocking) {
    try {
        let blockedItems = [];
        const linkedItems = (await getAllOfflinePages()).map(page => blockedItems.push(...page.items))
        const file = await getFileIfAvailable(eid, true);
        if (file && (!preemptive || (preemptive && file.preemptive_download)) && (bypassBlocking || blockedItems.indexOf(file.eid) === -1)) {
            const cachesList = await caches.keys();
            const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
            const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
            const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
            const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;
            if (file.fileid)
                await deleteOfflineSpannedFile(file.fileid)
            if (file.full_url)
                await deleteOfflineData(file.full_url);
            if (file.preview_url)
                await deleteOfflineData(file.preview_url);
            if (file.extpreview_url)
                await deleteOfflineData(file.extpreview_url);
            if (file.kongou_poster_url) {
                await deleteOfflineData(file.kongou_poster_url);
                await deleteOfflineData(file.kongou_poster_url + '?height=580&width=384');
            }
            if (file.kongou_backdrop_url)
                await deleteOfflineData(file.kongou_backdrop_url);
            if (browserStorageAvailable) {
                const indexDBUpdate = offlineContent.transaction(["offline_items", "offline_kongou_shows", "offline_kongou_episodes"], "readwrite");
                indexDBUpdate.objectStore("offline_kongou_episodes").delete(parseInt(eid.toString()))
                const allEpisodes = await new Promise(resolve => {
                    indexDBUpdate.objectStore("offline_kongou_episodes").getAll().onsuccess = event => {
                        resolve(event.target.result.map(e => e.showId))
                    }
                })
                indexDBUpdate.objectStore("offline_kongou_shows").getAll().onsuccess = event => {
                    if (event.target.result && event.target.result.length > 0) {
                        event.target.result.filter(e => allEpisodes.indexOf(e.showId) === -1).map(e => {
                            indexDBUpdate.objectStore("offline_kongou_shows").delete(e.showId);
                        })
                    }
                }
                indexDBUpdate.objectStore("offline_items").delete(eid).onsuccess = event => {
                    if (!noupdate) {
                        broadcastAllMessage({
                            type: 'MAKE_SNACK',
                            level: 'success',
                            text: `<i class="fas fa-sd-card pr-2"></i>Removed Offline File`,
                            timeout: 5000
                        });
                        updateNotficationsPanel();
                        refreshOfflineItemCache();
                    }
                    broadcastAllMessage({
                        type: 'STATUS_STORAGE_CACHE_UNMARK',
                        id: file.id,
                    });
                };
            } else {
                if (!noupdate)
                    updateNotficationsPanel();
            }
        }
    } catch (err) {
        console.error(`Uncaught Item Download Error`);
        console.error(err)
        broadcastAllMessage({
            type: 'MAKE_TOAST',
            level: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not delete offline item</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
    }
}
async function expireOfflineFile(eid, noupdate, hours, bypassBlocking) {
    return new Promise(async resolve => {
        try {
            let blockedItems = [];
            (await getAllOfflinePages()).map(page => blockedItems.push(...page.items))
            const file = await getFileIfAvailable(eid, true);
            if (file && (bypassBlocking || blockedItems.indexOf(file.eid) === -1)) {
                if (browserStorageAvailable) {
                    offlineContent.transaction(["offline_items"], "readwrite").objectStore("offline_items").put({
                        ...file,
                        expires:(new Date().getTime()) + ((hours || 1.5) * 3600000)
                    }).onsuccess = event => {
                        if (!noupdate) {
                            updateNotficationsPanel();
                            refreshOfflineItemCache();
                        }
                        resolve(true);
                    };
                } else {
                    if (!noupdate) {
                        updateNotficationsPanel();
                        refreshOfflineItemCache();
                    }
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } catch (err) {
            console.error(`Uncaught Item Download Error`);
            console.error(err)
            broadcastAllMessage({
                type: 'MAKE_TOAST',
                level: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Could not mak file expireable</p><p>Internal Application Error: ${err.message}</p>`,
                timeout: 10000
            });
            resolve(false);
        }
    })
}
async function keepExpireOfflineFile(eid, noupdate) {
    return new Promise(async resolve => {
        try {
            const file = await getFileIfAvailable(eid, true);
            if (file) {
                if (browserStorageAvailable) {
                    offlineContent.transaction(["offline_items"], "readwrite").objectStore("offline_items").put({
                        ...file,
                        expires: false
                    }).onsuccess = event => {
                        if (!noupdate) {
                            updateNotficationsPanel();
                            refreshOfflineItemCache();
                        }
                        resolve(true);
                    };
                } else {
                    if (!noupdate) {
                        updateNotficationsPanel();
                        refreshOfflineItemCache();
                    }
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } catch (err) {
            console.error(`Uncaught Item Download Error`);
            console.error(err)
            broadcastAllMessage({
                type: 'MAKE_TOAST',
                level: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Could not mak file expireable</p><p>Internal Application Error: ${err.message}</p>`,
                timeout: 10000
            });
            resolve(false);
        }
    })
}
async function expireSpannedFile(fileid, noupdate, hours) {
    return new Promise(async resolve => {
        try {
            const file = await getSpannedFileIfAvailable(fileid, true);
            if (file) {
                if (browserStorageAvailable) {
                    offlineContent.transaction(["spanned_files"], "readwrite").objectStore("spanned_files").put({
                        ...file,
                        expires:(new Date().getTime()) + ((hours || 1.5) * 3600000)
                    }).onsuccess = event => {
                        if (!noupdate) {
                            updateNotficationsPanel();
                            refreshOfflineItemCache();
                        }
                        resolve(true);
                    };
                } else {
                    if (!noupdate) {
                        updateNotficationsPanel();
                        refreshOfflineItemCache();
                    }
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } catch (err) {
            console.error(`Uncaught Item Download Error`);
            console.error(err)
            broadcastAllMessage({
                type: 'MAKE_TOAST',
                level: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Could not make spanned file expireable</p><p>Internal Application Error: ${err.message}</p>`,
                timeout: 10000
            });
            resolve(false);
        }
    })
}
async function deleteAllOfflineData() {
    const pages = await getAllOfflinePages();
    await Promise.all(pages.map(async e => await deleteOfflinePage(e.url, true)));
    const files = await getAllOfflineFiles();
    await Promise.all(files.map(async e => await deleteOfflineFile(e.eid, true)));
    const spanned = await getAllOfflineSpannedFiles();
    await Promise.all(spanned.map(async e => await deleteOfflineSpannedFile(e.id)));
    broadcastAllMessage({
        type: 'MAKE_SNACK',
        level: 'success',
        text: `<i class="fas fa-sd-card pr-2"></i>Removed all offline files and pages`,
        timeout: 5000
    });
}
async function deleteOfflineSpannedFile(id) {
    if (browserStorageAvailable) {
        const indexDBUpdate = offlineContent.transaction(["spanned_files"], "readwrite").objectStore("spanned_files").delete(id);
        indexDBUpdate.onsuccess = event => {
            refreshOfflineItemCache();
        };
    }
}
async function deleteOfflineData(url) {
    if (browserStorageAvailable) {
        return new Promise((resolve) => {
            const indexDBUpdate = offlineContent.transaction(["offline_filedata"], "readwrite").objectStore("offline_filedata").delete(url);
            indexDBUpdate.onsuccess = event => {
                resolve(event.target.result);
            };
        })
    }
}

async function fetchBackground(name, save, url, request, options) {
    const offlineFile = await getDataIfAvailable(url)
    if (offlineFile) {
        if (swDebugMode)
            console.log('JulyOS Internal Kernel: Offline Storage - ' + url);
        return offlineFile
    }
    if (false && self.BackgroundFetchManager && self.registration && self.registration.backgroundFetch) {
        return self.registration.backgroundFetch.fetch(name, (request || url), options);
    } else {
        try {
            const response = await fetch((request || url), options)
            if (response && response.status < 204) {
                if (save) {
                    const copy = await response.clone();
                    const blob = await copy.blob();
                    offlineContent.transaction(['offline_filedata'], "readwrite").objectStore('offline_filedata').put({
                        url: url.split(origin).pop(),
                        data: blob
                    }).onsuccess = event => {
                        if (swDebugMode)
                            console.log('JulyOS Internal Kernel: Network + Storage - ' + url);
                    }
                } else {
                    if (swDebugMode)
                        console.log('JulyOS Internal Kernel: Network Only - ' + url);
                }
                return response
            } else {
                if (swDebugMode)
                    console.log('JulyOS Internal Kernel: Offline - ' + url);
                return new Response(null, {
                    status: 501
                })
            }
        } catch (err) {
            console.error(err);
            console.log('JulyOS Internal Kernel: Offline - ' + url);
            return new Response(null, {
                status: 501
            })
        }
    }
}
async function cacheFileURL(object, page_item) {
    return new Promise(async (resolve) => {
        try {
            let fetchResults = {}
            let fetchKMSResults = {}
            if ((object.id && offlineMessages.indexOf(object.id) === -1) || !object.id) {
                if (object.full_url && !object.full_url.includes('/stream'))
                    fetchResults["full_url"] = (await fetchBackground(`${object.id}-full_url`, true, object.full_url)).status
                if (object.preview_url && !object.full_url.includes('/stream'))
                    fetchResults["preview_url"] = (await fetchBackground(`${object.id}-preview_url`, true, object.preview_url)).status
                if (object.extpreview_url && !object.full_url.includes('/stream'))
                    fetchResults["extpreview_url"] = (await fetchBackground(`${object.id}-extpreview_url`, true, object.extpreview_url)).status
                if (object.kongou_poster_url) {
                    fetchKMSResults["kongou_poster_url_0"] = (await fetchBackground(`${object.id}-kongou_poster_url_0`, true, object.kongou_poster_url + '?height=580&width=384')).status
                    fetchKMSResults["kongou_poster_url_1"] = (await fetchBackground(`${object.id}-kongou_poster_url_1`, true, object.kongou_poster_url)).status
                }
                if (object.kongou_backdrop_url)
                    fetchKMSResults["kongou_backdrop_url"] = (await fetchBackground(`${object.id}-kongou_backdrop_url`, true, object.kongou_backdrop_url)).status
                if (object.required_build) {
                    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(e => e.url.includes('juneOS'))
                    const unpackerJob = {
                        id: object.fileid,
                        name: object.filename,
                        size: object.file_size,
                        channel: object.channel,
                        preemptive: true,
                        expires: false,
                        offline: true,
                        swHandeler: (windows.length === 0 || (navigator.userAgent.indexOf('Chrome') !== -1 && swUseInternalUnpacker))
                    }
                    fetchResults['spanned_file'] = await new Promise(async resolve => {
                        if (windows.length === 0 || (navigator.userAgent.indexOf('Chrome') !== -1 && swUseInternalUnpacker)) {
                            if (windows.length === 0) {
                                console.error('No windows available, ServiceWorker must unpack the file!')
                            } else {
                                console.log('Using ServiceWorker for request!')
                            }
                            broadcastAllMessage({
                                type: 'STATUS_UNPACKER_NOTIFY',
                                fileid: object.fileid,
                                object: unpackerJob,
                            })
                            openUnpackingFiles(unpackerJob);
                            function setInternalTimer() {
                                setTimeout(async () => {
                                    if (!downloadSpannedController.has(unpackerJob.id)) {
                                        const fileIfAvailable = await getSpannedFileIfAvailable(unpackerJob.id)
                                        resolve((fileIfAvailable && fileIfAvailable.id));
                                    } else {
                                        setInternalTimer();
                                    }
                                }, 1000)
                            }
                            setInternalTimer();
                        } else if (windows.length > 0) {
                            console.log(`${windows.length} windows are available, sending request to first window`)
                            windows[0].postMessage({type: 'UNPACK_FILE', object: unpackerJob});
                            let i = 0;
                            function setExternalTimer() {
                                setTimeout(() => {
                                    if (!downloadSpannedSignals.has(object.fileid) && i > 30) {
                                        console.error(`Spanned file ${object.fileid} could not be downloaded, No worker response received`)
                                        resolve(false);
                                    } else if (!downloadSpannedSignals.has(object.fileid) && downloadSpannedResponse.has(object.fileid)) {
                                        resolve(downloadSpannedResponse.get(object.fileid) || false);
                                        downloadSpannedResponse.delete(object.fileid);
                                    } else {
                                        setExternalTimer();
                                    }
                                }, 1000)
                            }
                            setExternalTimer();
                        } else {
                            console.error(`Unable to download ${object.fileid} because there is no worker available`);
                            resolve(false);
                        }
                    })
                }
            } else {
                if (object.full_url)
                    fetchResults["full_url"] = 0
                if (object.preview_url)
                    fetchResults["preview_url"] = 0
                if (object.extpreview_url)
                    fetchResults["extpreview_url"] = 0
            }
            if (browserStorageAvailable) {
                try {
                    let requestedTargets = ['offline_items'];
                    if (object.kongou_meta && object.kongou_meta.show && object.kongou_meta.show.id)
                        requestedTargets.push('offline_kongou_shows');
                    if (object.kongou_meta && object.kongou_meta.show && object.kongou_meta.meta)
                        requestedTargets.push('offline_kongou_episodes');
                    const transaction = offlineContent.transaction(requestedTargets, "readwrite")
                    if (object.kongou_meta && object.kongou_meta.show && object.kongou_meta.show.id) {
                        transaction.objectStore('offline_kongou_shows').put({
                            showId: object.kongou_meta.show.id,
                            ...object.kongou_meta.show,
                            fetchResults: fetchKMSResults
                        })
                    }
                    if (object.kongou_meta && object.kongou_meta.show && object.kongou_meta.show.id && object.kongou_meta.meta) {
                        if (object.kongou_meta.meta.entity) {
                            transaction.objectStore('offline_kongou_episodes').put({
                                showId: object.kongou_meta.show.id,
                                eid: object.kongou_meta.meta.entity,
                                episode: object.kongou_meta.episode,
                                season: object.kongou_meta.season,
                                meta: object.kongou_meta.meta,
                                fetchResults: fetchKMSResults
                            })
                        } else {
                            transaction.objectStore('offline_kongou_episodes').put({
                                showId: object.kongou_meta.show.id,
                                eid: object.kongou_meta.meta,
                                episode: object.kongou_meta.episode,
                                season: object.kongou_meta.season,
                                fetchResults: fetchKMSResults
                            })
                        }
                    }
                    transaction.objectStore('offline_items').put({
                        ...object,
                        page_item: (!!page_item),
                        fetchResults: fetchResults
                    }).onsuccess = event => {
                        console.log(event)
                        resolve({
                            ...fetchResults,
                            ...fetchKMSResults,
                            dbWriteOK: (!event.target.error),
                        });
                    };
                } catch (e) {
                    console.error(`Failed to save record for ${object.eid}`);
                    console.error(e)
                    console.error(object);
                    console.error(fetchResults);
                    console.error(fetchKMSResults);
                    resolve({
                        ...fetchResults,
                        ...fetchKMSResults,
                        dbWriteOK: false,
                    })
                }
            } else {
                resolve({
                    ...fetchResults,
                    dbWriteOK: false,
                })
            }
        } catch (err) {
            console.error(`Uncaught Downloader Error for${object.eid}`);
            console.error(err)
            resolve(false);
        }
    })
}
async function cachePageOffline(type, _url, limit, newOnly) {
    let requestOpts = [['responseType', 'offline']];
    if (limit && limit.length > 0 && !isNaN(parseInt(limit)))
        requestOpts.push(['num', limit]);
    const url = params(['offset', 'limit', '_h'], requestOpts, _url);
    if (offlineDownloadSignals.has(url)) {
        console.error(`Will not be starting a new task!`)
        return false;
    }
    try {
        console.log(url);
        const _cacheItem = await fetchBackground(`${url}-results`, false, url);
        if (_cacheItem) {
            const content = await (new DOMParser().parseFromString((await _cacheItem.text()).toString(), 'text/html'));
            const title = (content.querySelector('title').text).toString().trim().replace('Sequenzia - ', '');
            const titleBarHTML = (content.querySelector('#titleBarContents').innerHTML).trim();

            const itemsToCache = (await Promise.all(Array.from(content.querySelectorAll('[data-msg-url-full]')).map(async e => await extractMetaFromElement(e)))).filter(e => e.data_type);
            const existingItems = await getPageIfAvailable(url);
            const newItems = itemsToCache.filter(e =>  !newOnly || (newOnly && offlineMessages.indexOf(e.id) === -1))
            let itemsRemovedCount = 0;

            if (existingItems && existingItems.items && existingItems.items.length > 0) {
                const itemsRemoved = existingItems.items.filter(e => itemsToCache.filter(f => f.eid === e).length === 0);
                for (let remove of itemsRemoved) {
                    await deleteOfflineFile(remove.eid, true, false, true);
                    itemsRemovedCount++
                }
                console.log(`Removed ${itemsRemoved.length} items`);
            }
            if (newItems.length === 0) {
                if (!newOnly) {
                    broadcastAllMessage({
                        type: 'MAKE_TOAST',
                        level: 'error',
                        title: '<i class="fas fa-sd-card pr-2"></i>No Items',
                        subtitle: '',
                        content: `<p>There are no media files on this page that can be made offline!</p>`,
                        timeout: 10000
                    });
                }
                return {title, count: itemsRemovedCount, ok: true};
            }

            let downloadedFiles = 0;
            let status = {
                url: params(['offset', '_h', 'responseType'], [], url),
                title,
                titleBarHTML,
                downloaded: downloadedFiles,
                items: itemsToCache.map(e => e.eid),
                totalItems: itemsToCache.length
            }
            broadcastAllMessage({
                type: 'STATUS_STORAGE_CACHE_PAGE_ACTIVE',
                url,
                totalItems: newItems.length,
                status
            })
            offlineDownloadSignals.set(url, true);

            for (let e of newItems) {
                if (!offlineDownloadSignals.has(url))
                    break;
                try {
                    const fetchResult = await cacheFileURL(e, true)
                    if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400) || (fetchResult.required_build !== undefined && fetchResult.required_build === false)) {
                        offlineDownloadSignals.delete(url);
                        break;
                    }
                } catch (err) {
                    console.error(err);
                    offlineDownloadSignals.delete(url);
                    break;
                }
                downloadedFiles++;
                status = {
                    ...status,
                    downloaded: downloadedFiles
                }
                broadcastAllMessage({
                    type: 'STATUS_STORAGE_CACHE_PAGE_ACTIVE',
                    url,
                    status
                })
            }
            console.log(`Cached ${downloadedFiles} Items`);

            return await new Promise((resolve) => {
                if (!offlineDownloadSignals.has(url)) {
                    console.error('Offline download was canceled!')
                    broadcastAllMessage({
                        type: 'MAKE_SNACK',
                        level: 'error',
                        text: `<i class="fas fa-sd-card pr-2"></i>Offline Download Canceled or Failed`,
                        timeout: 5000
                    });
                    broadcastAllMessage({
                        type: 'STATUS_STORAGE_CACHE_PAGE_COMPLETE',
                        url
                    });
                    resolve({title, count: 0, ok: false})
                } else {
                    if (browserStorageAvailable) {
                        try {
                            offlineContent.transaction([`offline_pages`], "readwrite").objectStore('offline_pages').put(status).onsuccess = async event => {
                                broadcastAllMessage({
                                    type: 'MAKE_SNACK',
                                    level: 'success',
                                    text: `<p class="mb-0"><i class="fas fa-sd-card pr-2"></i>${title}</p>Synced ${newItems.length} Items Offline!`,
                                    timeout: 5000
                                });
                                await refreshOfflineItemCache();
                                if (!newOnly) {
                                    if ('showNotification' in self.registration) {
                                        self.registration.showNotification("Sync Page", {
                                            body: `${title}\nSynced ${newItems.length} Items Offline!`,
                                            badge: '/static/vendor/fontawesome/svgs/solid/arrows-rotate.svg'
                                        });
                                    }
                                }
                                console.log(`Page Saved Offline!`);
                                resolve({title, count: (newItems.length + itemsRemovedCount), ok: true})
                            };
                        } catch (e) {
                            broadcastAllMessage({
                                type: 'MAKE_TOAST',
                                level: 'error',
                                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                                subtitle: '',
                                content: `<p>Failed to save offline storage record "${title}"!</p><p>${e.message}</p>`,
                                timeout: 10000
                            });
                            console.error(`Failed to save record for ${url}`);
                            resolve({title, count: 0, ok: false})
                        }
                    } else {
                        broadcastAllMessage({
                            type: 'MAKE_TOAST',
                            level: 'error',
                            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                            subtitle: '',
                            content: `<p>Failed access offline storage databsae!</p>`,
                            timeout: 10000
                        });
                        resolve({title, count: 0, ok: false})
                    }
                    broadcastAllMessage({
                        type: 'STATUS_STORAGE_CACHE_PAGE_COMPLETE',
                        url
                    })
                    offlineDownloadSignals.delete(url);
                }
            })
        } else {
            broadcastAllMessage({
                type: 'MAKE_TOAST',
                level: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Failed to get offline page results, Try again later</p>`,
                timeout: 10000
            });
            broadcastAllMessage({
                type: 'STATUS_STORAGE_CACHE_PAGE_COMPLETE',
                url
            })
            console.error('Item did not hit cache. Please try again')
            return {count: 0, ok: false}
        }
    } catch (err) {
        console.error(`Uncaught Page Download Error`);
        console.error(err)
        broadcastAllMessage({
            type: 'STATUS_STORAGE_CACHE_PAGE_COMPLETE',
            url
        })
        offlineDownloadSignals.delete(url);
        broadcastAllMessage({
            type: 'MAKE_TOAST',
            level: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not download offline page results</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
        return {count: 0, ok: false}
    }
}
async function cacheFileOffline(meta, noConfirm) {
    try {
        if (meta) {
            const fetchResult = await cacheFileURL(meta, false);
            if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400) || (fetchResult.required_build !== undefined && fetchResult.required_build === false)) {
                broadcastAllMessage({
                    type: 'MAKE_TOAST',
                    level: 'error',
                    title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                    subtitle: '',
                    content: `<p>Failed to save offline storage record "${meta.id}"!</p>`,
                    timeout: 10000
                });
                console.error(`Failed to save record for ${meta.id}`);
            } else {
                if (!noConfirm) {
                    broadcastAllMessage({
                        type: 'MAKE_SNACK',
                        level: 'success',
                        text: `<i class="fas fa-sd-card pr-2"></i>File available offline`,
                        timeout: 5000
                    });
                    refreshOfflineItemCache();
                }
                broadcastAllMessage({
                    type: 'STATUS_STORAGE_CACHE_MARK',
                    id: meta.id,
                });
            }
        } else {
            console.error(`Failed to offline file, missing required metadata`)
        }
        broadcastAllMessage({
            type: 'STATUS_STORAGE_CACHE_COMPLETE'
        });
    } catch (err) {
        console.error(`Uncaught Item Download Error`);
        console.error(err)
        broadcastAllMessage({
            type: 'MAKE_TOAST',
            level: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not download offline item</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
        broadcastAllMessage({
            type: 'STATUS_STORAGE_CACHE_COMPLETE'
        });
    }
    return false;
}
async function cacheEpisodeOffline(meta, noConfirm) {
    try {
        if (meta) {
            const fetchResult = await cacheFileURL(meta, true);
            if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400) || (fetchResult.required_build !== undefined && fetchResult.required_build === false)) {
                broadcastAllMessage({
                    type: 'MAKE_TOAST',
                    level: 'error',
                    title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                    subtitle: '',
                    content: `<p>Failed to save offline storage record "${meta.id}"!`,
                    timeout: 10000
                });
                console.error(`Failed to save record for ${meta.id}`);
            } else {
                if (!noConfirm) {
                    broadcastAllMessage({
                        type: 'MAKE_SNACK',
                        level: 'success',
                        text: `<i class="fas fa-sd-card pr-2"></i>File available offline`,
                        timeout: 5000
                    });
                }
                refreshOfflineItemCache();
                broadcastAllMessage({
                    type: 'STATUS_STORAGE_CACHE_MARK',
                    id: meta.id,
                });
            }
        }
        broadcastAllMessage({
            type: 'STATUS_STORAGE_CACHE_COMPLETE'
        });
    } catch (err) {
        console.error(`Uncaught Item Download Error`);
        console.error(err)
        broadcastAllMessage({
            type: 'MAKE_TOAST',
            level: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not download offline item</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
        broadcastAllMessage({
            type: 'STATUS_STORAGE_CACHE_COMPLETE'
        });
    }
    return false;
}

async function checkExpiredFiles() {
    if (swDebugMode)
        console.log('Checking for expired files');
    await new Promise(async resolve => {
        offlineContent.transaction(["spanned_files"]).objectStore("spanned_files").getAll().onsuccess = async (files) => {
            if (files && files.target && files.target.result && files.target.result.length > 0) {
                resolve(await Promise.all(files.target.result.filter(e => e.expires && e.expires < Date.now()).map(async e => {
                    console.log("Spanned Files Expired: " + e.id);
                    await deleteOfflineSpannedFile(e.id);
                })))
            } else {
                resolve([])
            }
        }
    })
    await new Promise(async resolve => {
        offlineContent.transaction(["offline_items"]).objectStore("offline_items").getAll().onsuccess = async (files) => {
            if (files && files.target && files.target.result && files.target.result.length > 0) {
                resolve(await Promise.all(files.target.result.filter(e => e.expires && e.expires < Date.now()).map(async e => {
                    console.log("Offline Files Expired: " + e.eid);
                    await deleteOfflineFile(e.eid, true);
                })))
            } else {
                resolve([])
            }
        }
    })
    await new Promise(async resolve => {
        offlineContent.transaction(["offline_filedata"]).objectStore("offline_filedata").getAll().onsuccess = async (files) => {
            if (files && files.target && files.target.result && files.target.result.length > 0) {
                resolve(await Promise.all(files.target.result.filter(e => e.expires && e.expires < Date.now()).map(async e => {
                    console.log("Offline Data Expired: " + e.url);
                    await deleteOfflineData(e.url);
                })))
            } else {
                resolve([])
            }
        }
    })
    if (swDebugMode)
        console.log("Completed Expired Files Check")
    updateNotficationsPanel();
    refreshOfflineItemCache();
}
async function openUnpackingFiles(object, channel) {
    /*{
        id: ,
        name: ,
        size: ,
        channel: ,
        preemptive: ,
        offline: ,
        play:
    }*/
    if (object.id && object.id.length > 0) {
        if (downloadSpannedController.size === 0 && !activeSpannedJob) {
            downloadSpannedController.set(object.id, {
                ...object,
                pending: true,
                ready: true
            })
            if (channel)
                channel.postMessage({type: 'STATUS_UNPACK_STARTED', fileid: object.id});
            while (downloadSpannedController.size !== 0) {
                const itemToGet = Array.from(downloadSpannedController.keys())[0]
                activeSpannedJob = downloadSpannedController.get(itemToGet)
                if (activeSpannedJob.ready && activeSpannedJob.pending) {
                    const download = await unpackFile();
                    if (download) {
                        broadcastAllMessage({type: 'STATUS_UNPACK_COMPLETED', fileid: activeSpannedJob.id})
                    } else {
                        broadcastAllMessage({type: 'STATUS_UNPACK_FAILED', fileid: activeSpannedJob.id})
                    }
                }
                downloadSpannedController.delete(itemToGet);
                console.log(`Job Complete: ${downloadSpannedController.size} Jobs Left`)
            }
            activeSpannedJob = false;
        } else if (!downloadSpannedController.has(object.id)) {
            downloadSpannedController.set(object.id, {
                ...object,
                pending: true,
                ready: true
            })
            if (channel)
                channel.postMessage({type: 'STATUS_UNPACK_QUEUED', fileid: object.id})
        } else if (channel) {
            channel.postMessage({type: 'STATUS_UNPACK_DUPLICATE', fileid: object.id})
        }
    } else if (channel) {
        channel.postMessage({type: 'STATUS_UNPACK_FAILED', fileid: object.id})
    }
}
async function unpackFile() {
    if (activeSpannedJob && activeSpannedJob.id && activeSpannedJob.pending && activeSpannedJob.ready) {
        console.log(`Downloading File ${activeSpannedJob.id}...`)
        const activeID = activeSpannedJob.id + '';
        activeSpannedJob.pending = false;
        let blobs = []
        broadcastAllMessage({type: 'STATUS_UNPACKER_ACTIVE', action: 'GET_METADATA', fileid: activeID});
        return await new Promise(async (job) => {
            try {
                const response = await fetchBackground(`parity-${activeID}`, false, `/parity/${activeID}`, new Request(`/parity/${activeID}`, {
                    type: 'GET',
                    redirect: "follow",
                    headers: {
                        'X-Requested-With': 'SequenziaXHR',
                        'x-Requested-Page': 'SeqClientUnpacker'
                    }
                }))
                if (response.status < 204) {
                    try {
                        const object = JSON.parse((await response.text()).toString());
                        activeSpannedJob = {
                            ...object,
                            ...activeSpannedJob,
                            progress: '0%',
                            abort: new AbortController()
                        };

                        if (activeSpannedJob.parts && activeSpannedJob.parts.length > 0 && activeSpannedJob.expected_parts) {
                            if (activeSpannedJob.parts.length === activeSpannedJob.expected_parts) {
                                broadcastAllMessage({type: 'STATUS_UNPACKER_ACTIVE', action: 'EXPECTED_PARTS', expected_parts: activeSpannedJob.expected_parts, fileid: activeID});
                                let pendingBlobs = {}
                                let retryBlobs = {}
                                activeSpannedJob.parts.map((e,i) => {
                                    pendingBlobs[i] = e;
                                    retryBlobs[i] = 0;
                                })
                                function calculatePercent() {
                                    const percentage = (Math.abs((Object.keys(pendingBlobs).length - activeSpannedJob.parts.length) / activeSpannedJob.parts.length)) * 100
                                    activeSpannedJob.progress = percentage.toFixed(0);
                                    broadcastAllMessage({
                                        type: 'STATUS_UNPACKER_ACTIVE',
                                        action: 'FETCH_PARTS_PROGRESS',
                                        percentage: activeSpannedJob.progress,
                                        fetchedBlocks: blobs.length,
                                        pendingBlocks: activeSpannedJob.parts.length - blobs.length,
                                        totalBlocks: activeSpannedJob.parts.length,
                                        fileid: activeID});
                                }
                                while (Object.keys(pendingBlobs).length !== 0) {
                                    if (!(activeSpannedJob && activeSpannedJob.ready))
                                        break;
                                    let downloadKeys = Object.keys(pendingBlobs).slice(0,8)
                                    const results = await Promise.all(downloadKeys.map(async item => {
                                        return new Promise(async ok => {
                                            try {
                                                const block = await fetchBackground(`parity-block-${activeID}-${item}`, false, pendingBlobs[item], new Request(pendingBlobs[item], {
                                                    method: 'GET',
                                                    signal: activeSpannedJob.abort.signal
                                                }))
                                                if (block && (block.status === 200 || block.status === 0)) {
                                                    console.log(`Downloaded Parity ${item}`);
                                                    const blob = await block.blob()
                                                    if (blob.size > 5) {
                                                        blobs[item] = blob;
                                                        calculatePercent();
                                                        delete pendingBlobs[item];
                                                        ok(true);
                                                    } else {
                                                        if (activeSpannedJob)
                                                            activeSpannedJob.ready = false;
                                                        ok(false);
                                                    }
                                                } else if (block) {
                                                    console.error(`Failed Parity ${item} (Retry attempt #${retryBlobs[item]}) - ${block.status}`)
                                                    retryBlobs[item] = retryBlobs[item] + 1
                                                    if (retryBlobs[item] > 3) {
                                                        if (activeSpannedJob)
                                                            activeSpannedJob.ready = false;
                                                        ok(false);
                                                    } else {
                                                        ok(null);
                                                    }
                                                } else {
                                                    ok(false);
                                                }
                                            } catch (err) {
                                                console.error(`Failed Parity ${item} (Retry attempt #${retryBlobs[item]})`)
                                                retryBlobs[item] = retryBlobs[item] + 1
                                                if (retryBlobs[item] > 3) {
                                                    if (activeSpannedJob)
                                                        activeSpannedJob.ready = false;
                                                    ok(false);
                                                } else {
                                                    ok(null);
                                                }
                                            }
                                        })
                                    }))
                                    if (results.filter(e => e === false).length > 0)
                                        break;
                                }

                                if (activeSpannedJob && blobs.length === activeSpannedJob.expected_parts) {
                                    activeSpannedJob.progress = `100%`;
                                    let blobType = {}
                                    if (activeSpannedJob.play === 'video' || activeSpannedJob.play === 'kms-video' || videoFiles.indexOf(activeSpannedJob.filename.split('.').pop().toLowerCase().trim()) > -1)
                                        blobType.type = 'video/' + activeSpannedJob.filename.split('.').pop().toLowerCase().trim();
                                    if (activeSpannedJob.play === 'audio' || audioFiles.indexOf(activeSpannedJob.filename.split('.').pop().toLowerCase().trim()) > -1)
                                        blobType.type = 'audio/' + activeSpannedJob.filename.split('.').pop().toLowerCase().trim();

                                    const finalBlock = new Blob(blobs, blobType);
                                    if (browserStorageAvailable) {
                                        try {
                                            offlineContent.transaction([`spanned_files`], "readwrite").objectStore('spanned_files').put({
                                                ...activeSpannedJob,
                                                block: finalBlock,
                                                parts: undefined,
                                                expected_parts: undefined,
                                                pending: undefined,
                                                ready: undefined,
                                                blobs: undefined,
                                                abort: undefined,
                                                progress: undefined,
                                                offline: undefined,
                                            }).onsuccess = event => {
                                                console.log(`File Saved Offline!`);
                                            };
                                        } catch (e) {
                                            console.error(`Failed to save block ${activeID}`);
                                            console.error(e);
                                        }
                                    }


                                    broadcastAllMessage({type: 'STATUS_UNPACKER_ACTIVE', action: 'BLOCKS_ACQUIRED', fileid: activeID});
                                    job(true);
                                } else {
                                    broadcastAllMessage({type: 'STATUS_UNPACKER_FAILED', action: 'EXPECTED_FETCH_PARTS', fileid: activeID});
                                    job(false);
                                }
                            } else {
                                broadcastAllMessage({type: 'STATUS_UNPACKER_FAILED', action: 'EXPECTED_PARTS', fileid: activeID});
                                job(false);
                            }
                        } else {
                            broadcastAllMessage({type: 'STATUS_UNPACKER_FAILED', action: 'READ_METADATA', fileid: activeID});
                            job(false);
                        }
                    } catch (e) {
                        console.error(e);
                        broadcastAllMessage({type: 'STATUS_UNPACKER_FAILED', action: 'UNCAUGHT_ERROR', message: e.message, fileid: activeID});
                        job(false);
                    }
                } else {
                    broadcastAllMessage({type: 'STATUS_UNPACKER_FAILED', action: 'GET_METADATA', message: (await response.text()), fileid: activeID})
                    job(false);
                }
                if (activeSpannedJob) {
                    blobs = null;
                    activeSpannedJob.parts = null;
                    delete activeSpannedJob.parts;
                }
            } catch (err) {
                broadcastAllMessage({type: 'STATUS_UNPACKER_FAILED', action: 'GET_METADATA', fileid: activeID})
                blobs = null;
                activeSpannedJob.parts = null;
                delete activeSpannedJob.parts;
                console.error(err);
                job(false);
            }
        })
    } else {
        return false
    }
}
async function stopUnpackingFiles(fileid) {
    if (downloadSpannedController.has(fileid)) {
        const _controller = downloadSpannedController.get(fileid)
        if (_controller.pending === true) {
            _controller.pending = false;
            _controller.ready = false;
            downloadSpannedController.delete(fileid)
        } else {
            activeSpannedJob.abort.abort();
            activeSpannedJob = null;
            downloadSpannedController.delete(fileid);
        }
    }
}
