'use strict';
importScripts('/static/vendor/domparser_bundle.js');
const DOMParser = jsdom.DOMParser;

const cacheName = 'DEV-v2-19';
const cacheCDNName = 'DEV-v2-10';
const origin = location.origin
const offlineUrl = './offline';
const cacheOptions = {
    cacheKernel: 'offline-kernel-' + cacheName,
    cacheConfig: 'offline-config-' + cacheName,
    cacheGeneral: 'offline-generic-' + cacheName,
    cacheCDN: 'offline-cdn-' + cacheCDNName,
    cacheProxy: 'offline-proxy-' + cacheCDNName,
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
        offlineUrl
    ]
};
let swDebugMode = false;
let swCacheCDN = false;
let browserStorageAvailable = false;
let offlineContent;
let downloadSpannedController = new Map();
let offlineDownloadSignals = new Map();
let activeSpannedJob = false;
let tempURLController = new Map();
const imageFiles = ['jpg','jpeg','jfif','png','webp','gif'];
const videoFiles = ['mp4','mov','m4v', 'webm'];
const audioFiles = ['mp3','m4a','wav', 'ogg', 'flac'];
let offlineMessages = [];

async function broadcastAllMessage(message) {
    self.clients.matchAll({
        includeUncontrolled: true,
        type: "window"
    }).then(all => all.map(client => client.postMessage(message)));
}
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
async function handleResponse(event, response, reqType) {
    const uri = event.request.url.split(origin).pop().toString()
    if (response.status < 300 &&
        cacheOptions.blockedCache.filter(b => uri.startsWith(b)).length === 0 && uri !== '/' &&
        !((uri.includes('/attachments/') || uri.includes('/full_attachments/') || uri.includes('/media_attachments/')) && (uri.includes('JFS_') || uri.includes('PARITY_'))) &&
        !(event.request.url.includes('.discordapp.') && event.request.url.includes('/attachments/') && !swCacheCDN)) {
        const selectedCache = selectCache(event);
        if (swDebugMode)
            console.log(`JulyOS Kernel: ${(reqType) ? reqType + ' + ': ''}Cache (${selectedCache}) - ${event.request.url}`);
        const copy = response.clone();
        const cacheURL = (event.request.url.includes('/full_attachments/')) ? '/full_attachments/' + event.request.url.split('/full_attachments/').pop() : (event.request.url.includes('/media_attachments/')) ? '/media_attachments/' + event.request.url.split('/media_attachments/').pop() : event.request;
        caches.open(selectedCache).then(cache => cache.put(cacheURL, copy))
    } else {
        if (swDebugMode)
            console.log(`JulyOS Kernel: ${(reqType) ? reqType : ''} Only (Bypass Cache) - ${event.request.url}`);
    }
    return response;
}
async function shouldRecache(event) {
    if (cacheOptions.updateCache.filter(b => event.request.url.split(origin).pop().toString().startsWith(b)).length > 0 || event.request.url.includes('responseType=offline'))
        reCache(event)
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

const offlineContentDB = self.indexedDB.open("offlineContent", 2);
offlineContentDB.onerror = event => {
    console.error(event.errorCode);
    broadcastAllMessage({type: 'NOTIFY_ERROR', message: `IndexedDB Is Not Available: Offline Content will not be available!`});
    console.error(`IndexedDB Is Not Available: Offline Content will not be available!`)
};
offlineContentDB.onsuccess = event => {
    offlineContent = event.target.result;
    console.log('Offline Database is available');
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

            if (event.request.url.includes('.discordapp.') && event.request.url.includes('/attachments/')) {
                const newURL = `/${event.request.url.includes('https://media.discordapp.net/') ? 'media_' : 'full_'}attachments/${event.request.url.split('/attachments/').pop()}`;
                const cachedResponse = await caches.match(newURL);
                if (cachedResponse) {
                    if (swDebugMode)
                        console.log('JulyOS Kernel: Indirect CDN Cache - ' + event.request.url);
                    return cachedResponse;
                }
                if (event.request.url.includes('https://media.discordapp.net/')) {
                    const proxyCache = await caches.open(cacheOptions.cacheProxy);
                    const cachedNoQueryResponse = await proxyCache.match(newURL.split('?')[0]);
                    if (cachedNoQueryResponse) {
                        if (swDebugMode)
                            console.log('JulyOS Kernel: Indirect CDN Cache (Resolution Bypass) - ' + event.request.url);
                        return cachedNoQueryResponse;
                    }
                }
            }
        } catch (err) {
            console.error('JulyOS Kernel: Error fetching cache or preloaded response - ' + event.request.url)
            console.error(err);
        }

        // Else try the network.
        try {
            const response = (await event.preloadResponse || await fetch(event.request))
            if (response) {
                handleResponse(event, response, "Network");
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
    switch (event.tag) {
        case 'test-tag-from-devtools':
        case 'SYNC_PAGES_NEW_ONLY':
        case 'SYNC_PAGES':
            const pages = await getAllOfflinePages()
            if (pages && pages.length > 0) {
                for (let page of pages) {
                    await cachePageOffline(undefined, page.url, undefined, (event.tag === 'SYNC_PAGES_NEW_ONLY'));
                }
                self.registration.showNotification("Pages have been synced");
            }
            break;
        case 'SYNC_SERIES':

            break;
        default:
            console.error('Sync Tag not recognized - ' + event.tag);
            break;
    }
});
self.addEventListener('periodicsync', async (event) => {
    console.log(event.tag);
    switch (event.tag) {
        case 'test-tag-from-devtools':
        case 'SYNC_PAGES_NEW_ONLY':
            const pages = await getAllOfflinePages()
            if (pages && pages.length > 0) {
                event.waitUntil(async () => {
                    for (let page of pages) {
                        await cachePageOffline(undefined, page.url, undefined, (event.tag === 'SYNC_PAGES_NEW_ONLY'));
                    }
                    return true;
                })
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
            break;
        case 'UNPACK_FILE':
            openUnpackingFiles(event.data.options, event.ports[0]);
            break;
        case 'CANCEL_UNPACK_FILE':
            stopUnpackingFiles(event.data.fileid);
            event.ports[0].postMessage(true);
            break;
        case 'CLEAR_ALL_STORAGE':
            clearAllOfflineData();
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
        case 'REMOVE_STORAGE_PAGE':
            event.ports[0].postMessage(await deleteOfflinePage(event.data.url, (!!event.data.noupdate)));
            break;
        case 'REMOVE_STORAGE_FILE':
            event.ports[0].postMessage(await deleteOfflineFile(event.data.eid, (!!event.data.noupdate), (!!event.data.preemptive)));
            break;
        case 'REMOVE_STORAGE_SPANNED_FILE':
            event.ports[0].postMessage(await removeCacheItem(event.data.fileid));
            break;
        case 'PING':
            broadcastAllMessage({type: 'PONG'})
            await getAllOfflineEIDs();
            event.ports[0].postMessage({type: 'PONG'});
            break;
        default:
            console.log(event);
            console.log(event.data);
            console.log('Unknown Message');
            break;
    }
});


function replaceDiscordCDN(url) {
    return (url.includes('.discordapp.') && url.includes('attachments')) ? `/${(url.startsWith('https://media.discordapp') ? 'media_' : 'full_')}attachments${url.split('attachments').pop()}` : url;
}
function extractMetaFromElement(e, preemptive) {
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

    let required_build = (postFilID && !postCached);
    let data_type = null;
    let fullItem = null;
    let previewItem = null;
    let extpreviewItem = null;
    let kongouPoster = null;
    let kongouBackdrop = null;

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
    if (postKMSJSON && postKMSJSON.show.poster)
        kongouPoster = replaceDiscordCDN(`https://media.discordapp.net/attachments${postKMSJSON.show.poster}`)
    if (postKMSJSON && postKMSJSON.show.background)
        kongouBackdrop = replaceDiscordCDN(`https://media.discordapp.net/attachments${postKMSJSON.show.background}`)

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
        kongou_meta: (postKMSJSON && postKMSJSON.show.id) ? postKMSJSON : null,
    }
}
async function getPageIfAvailable(url) {
    return new Promise((resolve) => {
        try {
            if (url && browserStorageAvailable) {
                offlineContent.transaction("offline_pages").objectStore("offline_pages").get(url).onsuccess = event => {
                    if (event.target.result && event.target.result.items) {
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
                    if (event.target.result && event.target.result.url) {
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
async function getFileIfAvailable(eid) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_items").objectStore("offline_items").get(eid).onsuccess = event => {
                    if (event.target.result && event.target.result.eid) {
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
async function getShowIfAvailable(showId) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_kongou_shows").objectStore("offline_kongou_shows").get(showId).onsuccess = event => {
                    if (event.target.result && event.target.result.meta) {
                        resolve({ ...event.target.result })
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
async function getEpisodesIfAvailable(showId) {
    return new Promise(async (resolve) => {
        try {
            if (browserStorageAvailable && !isNaN(parseInt(showId.toString()))) {
                const transaction = offlineContent.transaction(["offline_kongou_shows", "offline_kongou_episodes"])
                const showData = await new Promise((data) => {
                    transaction.objectStore("offline_kongou_shows").get(parseInt(showId.toString())).onsuccess = event => {
                        if (event.target.result && event.target.result.meta) {
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
                                const episodes = await Promise.all(event.target.result.map(async episode => {
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
async function getAllOfflinePages() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_pages").objectStore("offline_pages").getAll().onsuccess = event => {
                    resolve(event.target.result.map(e => {
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
async function getAllOfflineSeries() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_kongou_shows").objectStore("offline_kongou_shows").getAll().onsuccess = event => {
                    resolve(event.target.result.map(e => {
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
async function getAllOfflineFiles() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_items").objectStore("offline_items").getAll().onsuccess = event => {
                    resolve(event.target.result.map(e => {
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
async function getAllOfflineEIDs() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("offline_items").objectStore("offline_items").getAll().onsuccess = event => {
                    offlineMessages = [...event.target.result.map(e => e.id)]
                    broadcastAllMessage({
                        type: 'STATUS_STORAGE_CACHE_LIST',
                        entities: [...event.target.result.map(e => e.eid)],
                        messages: offlineMessages
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
async function updateNotficationsPanel() { // TODO: Send notifications to all clients to update the notifications panel

}
async function deleteOfflinePage(url, noupdate) {
    try {
        if (url) {
            const page = await getPageIfAvailable(url);
            if (page) {
                let blockedItems = [];
                const linkedItems = (await getAllOfflinePages()).filter(e => e.url !== url).map(page => blockedItems.push(...page.items))
                const cachesList = await caches.keys();
                const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
                const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
                const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
                const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;
                const files = await getAllOfflineFiles();
                const pageItems = files.filter(e => blockedItems.indexOf(e.eid) === -1 && page.items.indexOf(e.eid) !== -1);

                for (let e of pageItems) {
                    const indexDBUpdate = offlineContent.transaction(["offline_items"], "readwrite").objectStore("offline_items").delete(e.eid);
                    indexDBUpdate.onsuccess = event => {
                        if (cdnCache) {
                            if (e.full_url)
                                cdnCache.delete(e.full_url);
                            if (e.preview_url)
                                cdnCache.delete(e.preview_url);
                            if (e.extpreview_url)
                                cdnCache.delete(e.extpreview_url);
                        }
                        if (proxyCache) {
                            if (e.full_url)
                                proxyCache.delete(e.full_url);
                            if (e.preview_url)
                                proxyCache.delete(e.preview_url);
                            if (e.extpreview_url)
                                proxyCache.delete(e.extpreview_url);
                        }
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
                        }
                        updateNotficationsPanel();
                        getAllOfflineEIDs();
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
async function deleteOfflineFile(eid, noupdate, preemptive) {
    try {
        let blockedItems = [];
        const linkedItems = (await getAllOfflinePages()).map(page => blockedItems.push(...page.items))
        const file = await getFileIfAvailable(eid);
        if (file && (!preemptive || (preemptive && file.preemptive_download)) && blockedItems.indexOf(file.eid) === -1) {
            const cachesList = await caches.keys();
            const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
            const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
            const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
            const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;
            if (file.fileid)
                await removeCacheItem(file.fileid)

            if (cdnCache) {
                if (file.full_url)
                    await cdnCache.delete(file.full_url);
                if (file.preview_url)
                    await cdnCache.delete(file.preview_url);
                if (file.extpreview_url)
                    await cdnCache.delete(file.extpreview_url);
            }
            if (proxyCache) {
                if (file.full_url)
                    await proxyCache.delete(file.full_url);
                if (file.preview_url)
                    await proxyCache.delete(file.preview_url);
                if (file.extpreview_url)
                    await proxyCache.delete(file.extpreview_url);
            }
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
                    }
                    getAllOfflineEIDs();
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
async function clearAllOfflineData() {
    (await getAllOfflinePages()).map(async e => await deleteOfflinePage(e.url, true));
    (await getAllOfflineFiles()).map(async e => await deleteOfflineFile(e.eid, true));
    broadcastAllMessage({
        type: 'MAKE_SNACK',
        level: 'success',
        text: `<i class="fas fa-sd-card pr-2"></i>Removed all offline files and pages`,
        timeout: 5000
    });
}
async function removeCacheItem(id) {
    if (browserStorageAvailable) {
        const indexDBUpdate = offlineContent.transaction(["spanned_files"], "readwrite").objectStore("spanned_files").delete(id);
        indexDBUpdate.onsuccess = event => {
            getAllOfflineEIDs();
        };
    }
}

async function fetchBackground(name, url) {
    if (false && self.BackgroundFetchManager && self.registration && self.registration.backgroundFetch) {
        return self.registration.backgroundFetch.fetch(name, url);
    } else {
        return fetch(url);
    }
}
async function fetchBackgroundRequest(name, request, options) {
    if (false && self.BackgroundFetchManager && self.registration && self.registration.backgroundFetch) {
        return self.registration.backgroundFetch.fetch(name, request, options);
    } else {
        return fetch(request, options);
    }
}
async function cacheFileURL(object, page_item) {
    return new Promise(async (resolve) => {
        try {
            let fetchResults = {}
            let fetchKMSResults = {}
            if ((object.id && offlineMessages.indexOf(object.id) === -1) || !object.id) {
                if (object.full_url)
                    fetchResults["full_url"] = (await fetchBackground(`${object.id}-full_url`, object.full_url)).status
                if (object.preview_url)
                    fetchResults["preview_url"] = (await fetchBackground(`${object.id}-preview_url`, object.preview_url)).status
                if (object.extpreview_url)
                    fetchResults["extpreview_url"] = (await fetchBackground(`${object.id}-extpreview_url`, object.extpreview_url)).status
                if (object.kongou_poster_url)
                    fetchKMSResults["kongou_poster_url"] = (await fetchBackground(`${object.id}-kongou_poster_url`, object.kongou_poster_url)).status
                if (object.kongou_backdrop_url)
                    fetchKMSResults["kongou_backdrop_url"] = (await fetchBackground(`${object.id}-kongou_backdrop_url`, object.kongou_backdrop_url)).status
                if (object.required_build) {
                    const unpackerJob = {
                        id: object.fileid,
                        name: object.filename,
                        size: object.file_size,
                        channel: object.channel,
                        preemptive: true,
                        expires: false,
                        offline: true,
                    }
                    broadcastAllMessage({
                        type: 'STATUS_UNPACKER_NOTIFY',
                        fileid: object.fileid,
                        object: unpackerJob,
                    })
                    openUnpackingFiles(unpackerJob);
                    fetchResults['spanned_file'] = await new Promise((resolve) => {
                        function setTimer() {
                            setTimeout(() => {
                                if (!downloadSpannedController.has(object.fileid)) {
                                    resolve((!!getSpannedFileIfAvailable(object.fileid)));
                                } else {
                                    setTimer();
                                }
                            }, 1000)
                        }
                        setTimer();
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
                    const transaction = offlineContent.transaction(['offline_items', 'offline_kongou_shows', 'offline_kongou_episodes'], "readwrite")
                    if (object.kongou_meta && object.kongou_meta.show) {
                        transaction.objectStore('offline_kongou_shows').put({
                            showId: object.kongou_meta.show.id,
                            ...object.kongou_meta.show,
                            fetchResults: fetchKMSResults
                        })
                    }
                    if (object.kongou_meta && object.kongou_meta.show && object.kongou_meta.meta) {
                        transaction.objectStore('offline_kongou_episodes').put({
                            showId: object.kongou_meta.show.id,
                            eid: object.kongou_meta.meta.entity,
                            episode: object.kongou_meta.episode,
                            season: object.kongou_meta.season,
                            meta: object.kongou_meta.meta,
                            fetchResults: fetchKMSResults
                        })
                    }
                    transaction.objectStore('offline_items').put({
                        ...object,
                        page_item: (!!page_item),
                        fetchResults: fetchResults
                    }).onsuccess = event => {
                        resolve({
                            ...fetchResults,
                            ...fetchKMSResults,
                            dbWriteOK: (!event.target.error),
                        });
                    };
                } catch (e) {
                    console.error(`Failed to save record for ${object.eid}`);
                    console.error(e)
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
        const _cacheItem = await fetchBackground(`${url}-results`, url);
        if (_cacheItem) {
            const content = await (new DOMParser().parseFromString((await _cacheItem.text()).toString(), 'text/html'));
            const title = content.querySelector('title').text;

            const itemsToCache = Array.from(content.querySelectorAll('[data-msg-url-full]')).map(e => extractMetaFromElement(e)).filter(e => e.data_type && (!newOnly || (newOnly && offlineMessages.indexOf(e.id) === -1)));
            const totalFiles = itemsToCache.length;

            if (totalFiles === 0) {
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
                return false;
            }

            let downloadedFiles = 0;
            let status = {
                url: params(['offset', '_h', 'responseType'], [], url),
                title,
                downloaded: downloadedFiles,
                items: itemsToCache.map(e => e.eid),
                totalItems: totalFiles
            }
            broadcastAllMessage({
                type: 'STATUS_STORAGE_CACHE_PAGE_ACTIVE',
                url,
                status
            })
            offlineDownloadSignals.set(url, true);

            for (let e of itemsToCache) {
                if (!offlineDownloadSignals.has(url))
                    break;
                try {
                    const fetchResult = await cacheFileURL(e, true)
                    if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400)) {
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

            if (!offlineDownloadSignals.has(url)) {
                console.error('Offline download was canceled!')
                const cachesList = await caches.keys();
                const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
                const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
                const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
                const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;
                if (cdnCache) {
                    for (let e of itemsToCache) {
                        if (e.full_url)
                            cdnCache.delete(e.full_url);
                        if (e.preview_url)
                            cdnCache.delete(e.preview_url);
                        if (e.extpreview_url)
                            cdnCache.delete(e.extpreview_url);
                    }
                }
                if (proxyCache) {
                    for (let e of itemsToCache) {
                        if (e.full_url)
                            proxyCache.delete(e.full_url);
                        if (e.preview_url)
                            proxyCache.delete(e.preview_url);
                        if (e.extpreview_url)
                            proxyCache.delete(e.extpreview_url);
                    }
                }
                broadcastAllMessage({
                    type: 'MAKE_SNACK',
                    level: 'error',
                    text: `<i class="fas fa-sd-card pr-2"></i>Offline Download Canceled or Failed`,
                    timeout: 5000
                });
            } else {
                if (browserStorageAvailable) {
                    try {
                        offlineContent.transaction([`offline_pages`], "readwrite").objectStore('offline_pages').put(status).onsuccess = event => {
                            broadcastAllMessage({
                                type: 'MAKE_SNACK',
                                level: 'success',
                                text: `<i class="fas fa-sd-card pr-2"></i>Page with ${totalFiles} files are available offline`,
                                timeout: 5000
                            });
                            console.log(`Page Saved Offline!`);
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
                }
                broadcastAllMessage({
                    type: 'STATUS_STORAGE_CACHE_PAGE_COMPLETE',
                    url
                })
                offlineDownloadSignals.delete(url);
            }
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
    }
    return false;
}
async function cacheFileOffline(meta, noConfirm) {
    try {
        if (meta) {
            const fetchResult = await cacheFileURL(meta, false);
            if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400)) {
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
                }
                getAllOfflineEIDs();
                broadcastAllMessage({
                    type: 'STATUS_STORAGE_CACHE_MARK',
                    id: meta.id,
                });
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
            content: `<p>Could not download offline item</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
    }
    return false;
}
async function cacheEpisodeOffline(meta, noConfirm) {
    try {
        if (meta) {
            const fetchResult = await cacheFileURL(meta, true);
            if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400)) {
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
                getAllOfflineEIDs();
                broadcastAllMessage({
                    type: 'STATUS_STORAGE_CACHE_MARK',
                    id: meta.id,
                });
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
            content: `<p>Could not download offline item</p><p>Internal Application Error: ${err.message}</p>`,
            timeout: 10000
        });
    }
    return false;
}

async function getSpannedFileIfAvailable(fileid) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("spanned_files").objectStore("spanned_files").get(fileid).onsuccess = async (event) => {
                    if (event.target.result && event.target.result.id && event.target.result.block) {
                        await checkExpiredFiles([event.target.result]);
                        if (!(event.target.result.expires && event.target.result.expires < Date.now())) {
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
async function getAllOfflineSpannedFiles() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("spanned_files").objectStore("spanned_files").getAll().onsuccess = async (event) => {
                    await checkExpiredFiles(event.target.result);
                    resolve(event.target.result.filter(e => !(e.expires && e.expires < Date.now())).map(e => {
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
async function checkExpiredFiles(filesArray) {
    return await Promise.all(filesArray.filter(e => (e.expires && e.expires < Date.now())).map(e => removeCacheItem(e.id)))
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
                        broadcastAllMessage({type: 'STATUS_UNPACK_COMPLETED', fileid: object.id})
                    } else {
                        broadcastAllMessage({type: 'STATUS_UNPACK_FAILED', fileid: object.id})
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
                const response = await fetchBackgroundRequest(`parity-${activeID}`, new Request(`/parity/${activeID}?${(new Date()).getTime()}`, {
                    type: 'GET',
                    redirect: "follow",
                    headers: {
                        'X-Requested-With': 'SequenziaXHR',
                        'x-Requested-Page': 'SeqClientUnpacker'
                    }
                }))
                if (response.status < 300) {
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
                                                const block = await fetchBackgroundRequest(`parity-block-${activeID}-${item}`, new Request(pendingBlobs[item], {
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
