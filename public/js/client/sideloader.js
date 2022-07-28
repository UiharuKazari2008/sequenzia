function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
}

$(function() {
    // JuneOS Browser Manager
    $.history.on('load change push pushed replace replaced', function(event, url, type) {
        if (event.type === 'change') {
            if (!(url && url.startsWith('/') && url.substring(1).length > 2 && url.substring(1).split('?')[0].length > 2)) {
                console.error(`Impossible to navigate to "${url}"`)
                return false;
            }
            if (url.includes('offset=') && url.includes('_h=')) {
                const _h = parseInt(/_h=([^&]+)/.exec(url)[1])
                if (_h > 0) {
                    window.history.go(-Math.abs(_h));
                } else {
                    getNewContent([], [], url);
                }
            } else {
                getNewContent([], [], url);
            }
            console.log(`Navigating to Path JOS:/${url} ...`);
        }
    }).listen('hash');
    try {
        fetch('/offline').then(r => {})
    } catch (e) {
        console.error('Failed to ensure offline kernel is loaded')
    }
});

let debugMode = false;
let pageType = ''
let last = undefined;
let responseComplete = false;
let itemsRemoved = 0;
let itemsRemovedIds = [];
let cachedID = [];
let initialLoad = true;
let browserStorageAvailable = false;
let offlineContent;
let spannedFilesFIFOOffline = true;
let spannedFilesAlwaysOffline = false;
const offlineContentDB = window.indexedDB.open("offlineContent", 1);
offlineContentDB.onerror = event => {
    console.error(offlineContentDB.errorCode);
    alert(`IndexedDB Is Not Available: Offline Content will not be available!`)
};
offlineContentDB.onsuccess = event => {
    offlineContent = event.target.result;
    browserStorageAvailable = true;
};
offlineContentDB.onupgradeneeded = event => {
    // Save the IDBDatabase interface
    const db = event.target.result;
    // Create an objectStore for this database
    const spannedFilesStore = db.createObjectStore("spanned_files", { keyPath: "id" });
    spannedFilesStore.createIndex("id", "id", { unique: true });
    spannedFilesStore.createIndex("name", "name", { unique: false });
    spannedFilesStore.createIndex("size", "size", { unique: false });
    spannedFilesStore.createIndex("channel", "channel", { unique: false });
    spannedFilesStore.transaction.oncomplete = event => {
    }
    const offlinePageStore = db.createObjectStore("offline_pages", { keyPath: "url" });
    offlinePageStore.createIndex("url", "url", { unique: true });
    offlinePageStore.createIndex("title", "title", { unique: false });
    offlinePageStore.createIndex("files", "files", { unique: false });
    offlinePageStore.createIndex("previews", "previews", { unique: false });
    offlinePageStore.transaction.oncomplete = event => {
    }
    const offlineItemsStore = db.createObjectStore("offline_items", { keyPath: "eid" });
    offlineItemsStore.createIndex("eid", "eid", { unique: true });
    offlineItemsStore.createIndex("data_type", "data_type", { unique: false });
    offlineItemsStore.createIndex("full_url", "full_url", { unique: true });
    offlineItemsStore.createIndex("preview_url", "preview_url", { unique: false });
    offlineItemsStore.transaction.oncomplete = event => {
    }
};

let postsActions = [];
let apiActions = {};
let menuBarLocation = (getCookie("menuBarLocation") !== null) ? getCookie("menuBarLocation") : '';
let postsDestination = (getCookie("postsDestination") !== null) ? getCookie("postsDestination") : '';
let recentPostDestination = (getCookie("recentPostDestination") !== null) ? (() => {
    try {
        return JSON.parse(getCookie("recentPostDestination"))
    } catch (err) {
        return []
    }
})() : [];
let reviewDestination = (getCookie("reviewDestination") !== null) ? getCookie("reviewDestination") : '';
let recentReviewDestination = (getCookie("recentReviewDestination") !== null) ? (() => {
    try {
        return JSON.parse(getCookie("recentReviewDestination"))
    } catch (err) {
        return []
    }
})() : [];
let reviewDestinationMap = (getCookie("reviewDestinationMap") !== null) ? (() => {
    try {
        return JSON.parse(getCookie("reviewDestinationMap"))
    } catch (err) {
        return {}
    }
})() : {};
let _lastChannelSelection = '';
let _lastReviewChannelSelection = '';
let fileWorking = false;
let uploadDestination = (getCookie("UploadChannelSelection") !== null) ? getCookie("UploadChannelSelection") : '';
let uploadServer = (getCookie("UploadServerSelection") !== null) ? getCookie("UploadServerSelection") : '';
let _lastUploadChannelSelection = '';
let _lastUploadServerSelection = '';
let setImageSize = (getCookie("imageSizes") !== null) ? getCookie("imageSizes") : '0';
let widePageResults = (getCookie("widePageResults") !== null) ? getCookie("widePageResults") : '0';
let downloadURLs = [];
let undoActions = [];
let notificationControler = null;
let recoverable
let contextFadeDelay = null
let requestInprogress
let paginatorInprogress
let downloadAllController = null;
let downloadSpannedController = new Map();
let offlineDownloadController = new Map();
let tempURLController = new Map();
let memorySpannedController = [];
let memoryVideoPositions = new Map();
let activeSpannedJob = null;
let kmsVideoWatcher = null;
let search_list = [];
let element_list = [];
let lazyloadImages;

String.prototype.toRGB = function() {
    var hash = 0;
    if (this.length === 0) return hash;
    for (var i = 0; i < this.length; i++) {
        hash = this.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    var rgb = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 255;
        rgb[i] = value;
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
String.prototype.toHex = function() {
    var hash = 0;
    if (this.length === 0) return hash;
    for (var i = 0; i < this.length; i++) {
        hash = this.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    var color = '#';
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 255;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}
function findHeight(ratio = '16:9', width = 1) {
    const [w, h] = ratio
        .split(':')
        .map(Number);
    const height = (width * h) / w;
    return Math.round(height);
};
function msToTime(s,f) {
    // Pad to 2 or 3 digits, default is 2
    function pad(n, z) {
        z = z || 2;
        return ('00' + n).slice(-z);
    }

    var ms = s % 1000;
    s = (s - ms) / 1000;
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;

    return ((hrs > 0 || f) ? pad(hrs) + ':' : '') + pad(mins) + ':' + pad(secs) + ((f) ? '.' + pad(ms, 2) : '')
}

async function writeLoadingBar(){
    if (responseComplete === false) {
        setTimeout(writeLoadingBar, 250)
    } else {
        responseComplete = true
        $('#loadingSpinner').fadeOut(500)
    }
    return false;
}
async function setupReq(push, url) {
    if (!offlinePage) {
        nextContext = (() => {
            if (url && (url.startsWith('/app/'))) {
                return 'browser'
        } else if (url && (url.startsWith('/tvTheater') || url.startsWith('/listTheater'))) {
                return 'ticket'
            } else if (url) {
                return 'seq'
            }
            return 'question'
        })()
        if (!currentContext || (currentContext && currentContext !== nextContext)) {
            let cxswch = document.getElementById('contextSwitchIndicator');
            if (currentContext) {
                if (currentContext === 'seq') {
                    cxswch.querySelector('#contextFrom').classList = 'hidden';
                    cxswch.querySelector('#contextFromSeq').classList = '';
                } else {
                    cxswch.querySelector('#contextFrom').classList = 'fas fa-' + currentContext;
                    cxswch.querySelector('#contextFromSeq').classList = 'hidden';
                }
                if (nextContext === 'seq') {
                    cxswch.querySelector('#contextTo').classList = 'hidden';
                    cxswch.querySelector('#contextToSeq').classList = '';
                } else {
                    cxswch.querySelector('#contextTo').classList = 'fas fa-' + nextContext;
                    cxswch.querySelector('#contextToSeq').classList = 'hidden';
                }
            }
            cxswch.classList.remove('hidden');
            cxswch.style.display = null;
        }
    } else {
        document.getElementById('offlinePages').classList.add('hidden');
    }
    responseComplete = false;
    $('#loadingSpinner').fadeIn();
    if (push !== true)
        $(".container-fluid").fadeTo(500, 0.4);
    if (!initalPageLoad)
        $("#userMenu").collapse("hide");
    $(".sidebar").removeClass('open');
    $("body").addClass("sidebar-toggled");
    $(".sidebar").addClass("toggled");
    $('.sidebar .collapse').collapse('hide');
    $('.modal').modal('hide');
    if ($(window).width() < 1700) {
        $(".music-player").removeClass("toggled");
    }
    writeLoadingBar();
    return false;
}
async function requestCompleted (response, url, lastURL, push) {
    itemsRemoved = 0;
    const pageTitle = $(response).filter('title').text()
    if (pageTitle === 'Lets Login') {
        window.location.href = url;
    } else if (pageTitle.includes(' - No Results') && !initialLoad) {
        $(".container-fluid").fadeTo(2000, 1)
        $.toast({
            type: 'error',
            title: 'No Results Found',
            subtitle: 'Error',
            content: `Nothing was found, Please try another option or search term`,
            delay: 10000,
        });
        responseComplete = true
    } else {
        if (url.startsWith('/app/web/')) {
            if (offlinePage) {
                $.toast({
                    type: 'error',
                    title: 'Navigation Failure',
                    subtitle: 'Now',
                    content: `Applications can not be accessed offline!`,
                    delay: 1000,
                });
                responseComplete = true
                return false;
            }
            $.when($(".container-fluid").fadeOut(250)).done(() => {
                recoverable = response
                let contentPage = $(response);
                if ($("#appStatic").children().length === 0 && contentPage.find('#appStatic').length > 0) {
                    $("#appStatic").html(contentPage.find('#appStatic').children());
                }
                contentPage.find('#topbar').addClass('no-ani').addClass('ready-to-scroll');
                contentPage.find('a[href="#_"], a[href="#"] ').click(function(e){
                    if (_originalURL && _originalURL !== 'undefined')
                        window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
                    e.preventDefault();
                });
                if (contentPage.find('#appTitleBar').length > 0) {
                    $("#topAddressBarInfo").html(contentPage.find('#appTitleBar').children());
                }
                if (contentPage.find('#appPanels').length > 0) {
                    $("#appPanels").html(contentPage.find('#appPanels').children());
                }
                if (contentPage.find('#appNavigation').length > 0) {
                    $("#pageNav").html(contentPage.find('#appNavigation').children());
                }
                if (contentPage.find('#appTitleMenu').length > 0) {
                    $("#appTitleMenu").html(contentPage.find('#appTitleMenu').children());
                } else {
                    $("#appTitleMenu").html('');
                }
                if (contentPage.find('#appMenuRow1').length > 0) {
                    $("#appMenuRow1").html(contentPage.find('#appMenuRow1').children());
                }
                if (contentPage.find('#appMenuRow2').length > 0) {
                    $("#appMenuRow2").append(contentPage.html('#appMenuRow2').children());
                } else if ($("#appMenuRow2Grid").children().length <= 1 && contentPage.find('#appMenuRow2Grid').length > 0) {
                    $("#appMenuRow2Grid").append(contentPage.find('#appMenuRow2Grid').contents());
                }
                $("#appContainer").html(contentPage.find('#appContent').children());
                if ($("#appStaticPost").children().length === 0 && contentPage.find('#appStaticPost').length > 0) {
                    $("#appStaticPost").html(contentPage.find('#appStaticPost').children());
                }
                $(".container-fluid").fadeTo(2000, 1)
                scrollToTop(true);
                if (_originalURL && _originalURL !== 'undefined' )
                    window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
                responseComplete = true
            })
        } else {
            if (push === true && !offlinePage) {
                $('#LoadNextPage').remove();
                $("#contentBlock > .tz-gallery > .row").append($(response).find('#contentBlock > .tz-gallery > .row').contents());
                setImageLayout(setImageSize);
                setPageLayout(false);
                if (Object.values(apiActions).length > 0) {
                    const removedItems = Object.values(apiActions).filter(e => e.action === "RemovePost" || e.action === "MovePost" || e.action === "ArchivePost").map(e => e.messageid);
                    $(Array.from(response.find('[data-msg-id].col-image:not(.hidden)')).filter(e => removedItems.indexOf(e.id.substring(8)) !== -1)).addClass('hidden')
                    if ($.find('[data-msg-id].col-image.hidden').length > 0) {
                        $.find('#hiddenItemsAlert').removeClass('hidden')
                    }
                }
                $("#contentBlock > style").html($(response).find('#contentBlock > style'));
                $("#finalLoad").html($(response).find('#finalLoad'));

                if (!pageTitle.includes(' - Item Details')) {
                    getPaginator(url);
                }
                if (inReviewMode)
                    enableReviewMode();
                updateActionsPanel();
                undoActions = [];
                responseComplete = true
            } else {
                $.when($(".container-fluid").fadeOut(250)).done(() => {
                    let contentPage = $(response).find('#content-wrapper').children();
                    contentPage.find('#topbar').addClass('no-ani').addClass('ready-to-scroll');
                    contentPage.find('a[href="#_"], a[href="#"] ').click(function (e) {
                        if (_originalURL && _originalURL !== 'undefined' )
                            window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
                        e.preventDefault();
                    });
                    if (!offlinePage) {
                        $("#content-wrapper").html(contentPage);
                    } else {
                        const _params = new URLSearchParams('?' + _url.split('#').pop().split('?').pop());
                        $("#contentBlock").html(contentPage.find('#contentBlock').children());
                        const imageRows = $('#contentBlock').find('.tz-gallery > .row').children();
                        const resultsTotal = Array.from(imageRows).length;
                        let offset = (_params.has('offset')) ? parseInt(_params.getAll('offset')[0]) : 0
                        if (resultsTotal < offset)
                            offset = 0;
                        const shift = offset + 100;
                        $("#contentBlock > .tz-gallery > .row").html(imageRows.slice(offset, shift));
                        let pageButtons = [];
                        if (resultsTotal > 100) {
                            if (offset > 0) {
                                pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="getNewContent([], [['offset', '${(offset > 100) ? offset - 100 : 0}']]); return false;"><i class="fas fa-arrow-left"></i></a>`)
                            }
                            if (shift <= resultsTotal) {
                                pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="nextPage" title="Next Page" href="#_" role="button" accesskey="."  onclick="getNewContent([], [['offset', '${shift}']]); return false;"><i class="fa fa-arrow-right"></i></a>`)
                            }
                        }
                        $("#pageNav").html(pageButtons.join(''));
                    }
                    setImageLayout(setImageSize);
                    setPageLayout(false);
                    if (!pageTitle.includes(' - Item Details') && !offlinePage) {
                        getPaginator(url);
                    }
                    scrollToTop(true);
                    if (!offlinePage) {
                        if (inReviewMode)
                            enableReviewMode();
                        updateActionsPanel();
                        updateNotficationsPanel();
                        if (Object.values(apiActions).length > 0) {
                            const removedItems = Object.values(apiActions).filter(e => e.action === "RemovePost" || e.action === "MovePost" || e.action === "ArchivePost").map(e => e.messageid);
                            $(Array.from($("#content-wrapper").find('[data-msg-id].col-image:not(.hidden)')).filter(e => removedItems.indexOf(e.id.substring(8)) !== -1)).addClass('hidden')
                            if ($("#content-wrapper").find('[data-msg-id].col-image.hidden').length > 0) {
                                $('#hiddenItemsAlert').removeClass('hidden')
                            }
                        }
                    } else {
                        $(".container-fluid").fadeTo(500, 1);
                    }
                    undoActions = [];
                    responseComplete = true
                })
            }
            $("title").text(pageTitle);
            let addOptions = [];
            if (url.includes('offset=') && !initialLoad) {
                let _h = (url.includes('_h=')) ? parseInt(/_h=([^&]+)/.exec(url)[1]) : 0;
                addOptions.push(['_h', `${(!isNaN(_h)) ? _h + 1 : 0}`]);
            }
            const _url = params(['responseType', 'nsfwEnable', 'pageinatorEnable', 'limit'], addOptions, url);
            $.history.push(_url, (_url.includes('offset=')));
            responseComplete = true
        }
        pageType = url.split('/')[0];
        if (initialLoad) {
            setTimeout(() => {
                $('#bootUpDisplay').fadeOut(500);
            }, 1000)
        }
        initialLoad = false
        if(!isTouchDevice()) {
            $('[data-tooltip="tooltip"]').tooltip()
            $('[data-tooltip="tooltip"]').tooltip('hide')
        }
    }
    if (contextFadeDelay)
        clearTimeout(contextFadeDelay);
    contextFadeDelay = setTimeout(() => {
        $('#contextSwitchIndicator').fadeOut(500);
    }, 4000)
    currentContext = nextContext;

    return false;
}

async function getNewContent(remove, add, url, keep) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    let _url = (() => {
            try {
                if (url) { return url.split('://' + window.location.host).pop() }
                if ($.history) { return $.history.url() }
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            } catch (e) {
                console.error("Failed to access URL data, falling back")
                console.error(e)
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            }
        })()
    if (_url === null) { location.href = '/'; return false; };
    if (!(_url && _url.startsWith('/') && _url.substring(1).length > 2 && _url.substring(1).split('?')[0].length > 2)) {
        $.toast({
            type: 'error',
            title: 'Navigation Failure',
            subtitle: 'Now',
            content: `Invalid Path JOS:/${_url}`,
            delay: 5000,
        });
        responseComplete = true
        return false;
    }
    setupReq(undefined, _url)
    let _params = undefined;
    try {
        _params = new URLSearchParams(_url.split('?').splice(1).join('?'));
        const _pathname = _url.split('?')[0];
        const _currentURL = window.location.hash.substring(1)

        if (add || remove) {
            for (let e of remove) {
                _params.delete(e)
            }
            for (let e of add) {
                if (_params.has(e[0])) {
                    _params.delete(e[0])
                }
                _params.set(e[0], e[1])
            }
            if (_params.has('nsfw') &&
                (_params.getAll('nsfw').pop() === 'true' && _params.getAll('nsfw').pop() === 'only') &&
                (_currentURL.startsWith('/artists') || _params.getAll('search').length > 0)) {
                _params.set('nsfw', 'true')
            }
            if (!(remove && remove.indexOf('offset') !== -1) && _params.has('offset') && itemsRemoved > 0) {
                const _o = (_params.has('offset'))  ? parseInt(_params.getAll('offset').pop()) : 0;
                if (!isNaN(_o) && _o > itemsRemoved) {
                    _params.set('offset', (_o - itemsRemoved).toString())
                    console.log(`Shifting Results Offset: ${_o - itemsRemoved}`);
                }
            }
        }
        if (_params.has('channel') && _params.getAll('channel').pop() === 'random') {
            _params.delete('channel');
        }
        _url = `${_pathname}?${_params.toString()}`;
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Navigation Failure',
            subtitle: 'Now',
            content: `Parser Failure${(e && e.message) ? '\n' + e.message : ''}`,
            delay: 5000,
        });
        responseComplete = true
        return false;
    }

    console.log(_url);
    if (offlinePage) {
        if ((_url.startsWith('/gallery') || _url.startsWith('/files'))) {
            const eids = await (async () => {
                const revisedUrl = params(['offset', '_h'], [], _url)
                if (revisedUrl.split('?').pop().length === 0)
                    return false;
                const isFoundPage = await getPageItemsIfAvailable(revisedUrl);
                if (isFoundPage)
                    return isFoundPage.items
            })()
            if (_url.startsWith('/gallery')) {
                await generateGalleryHTML(_url, eids);
            } else if (_url.startsWith('/files')) {
                await generateFilesHTML(_url, eids);
            } else {
                $.toast({
                    type: 'error',
                    title: 'Pre-Navigation Failure',
                    subtitle: 'Now',
                    content: `Not available offline, You must make the item available offline before you go offline.`,
                    delay: 2000,
                });
            }
        } else {
            $.toast({
                type: 'error',
                title: 'Pre-Navigation Failure',
                subtitle: 'Now',
                content: `Not available offline, You must make the item available offline before you go offline.`,
                delay: 2000,
            });
        }
        responseComplete = true;
        return true;
    }
    requestInprogress = $.ajax({async: true,
        url: ((offlinePage) ? params(['offset', '_h'], [], _url) : _url),
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR',
            'x-Requested-Page': 'SeqContent'
        },
        success: function (response, textStatus, xhr) {
            requestCompleted(response, _url)
        },
        error: function (xhr) {
            if (initialLoad) {
                window.location.href = '/offline';
            }
            responseComplete = true
            $(".container-fluid").fadeTo(2000, 1);
            $.toast({
                type: 'error',
                title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                subtitle: '',
                content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href="/offline"><i class="fas fa-cloud-slash pr-2"></i>Offline Mode</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
                delay: 10000,
            });
        }
    });
    return false;
}
function getMoreContent(remove, add, url, keep) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    let _url = (() => {
        try {
            if (url) { return url.split('://' + window.location.host).pop() }
            if ($.history) { return $.history.url() }
            if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
            return null
        } catch (e) {
            console.error("Failed to access URL data, falling back")
            console.error(e)
            if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop()}
            return null
        }
    })()
    if (_url === null) { location.href = '/'; return false; };
    if (!(_url && _url.startsWith('/') && _url.substring(1).length > 2 && _url.substring(1).split('?')[0].length > 2)) {
        $.toast({
            type: 'error',
            title: 'Navigation Failure',
            subtitle: 'Now',
            content: `Invalid Path JOS:/${_url}`,
            delay: 5000,
        });
        responseComplete = true
        return false;
    }
    setupReq(true, _url);
    try {
        let _params = new URLSearchParams(_url.split('?').splice(1).join('?'));
        const _pathname = _url.split('?')[0];
        const _currentURL = window.location.hash.substring(1)

        if (add || remove) {
            for (let e of remove) {
                _params.delete(e)
            }
            for (let e of add) {
                if (_params.has(e[0])) {
                    _params.delete(e[0])
                }
                _params.set(e[0], e[1])
            }
            if (_params.has('nsfw') &&
                (_params.getAll('nsfw').pop() === 'true' && _params.getAll('nsfw').pop() === 'only') &&
                (_currentURL.startsWith('/artists') || _params.getAll('search').length > 0)) {
                _params.set('nsfw', 'true')
            }
            if (!(remove && remove.indexOf('offset') !== -1) && _params.has('offset') && itemsRemoved > 0) {
                const _o = parseInt(_params.getAll('offset').pop());
                if (!isNaN(_o) && _o > itemsRemoved) {
                    _params.set('offset', (_o - itemsRemoved).toString())
                    console.log(`Shifting Results Offset: ${_o - itemsRemoved}`);
                }
            }
        }
        if (_params.has('channel') && _params.getAll('channel').pop() === 'random') {
            _params.delete('channel');
        }
        _url = `${_pathname}?${_params.toString()}`;
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Navigation Failure',
            subtitle: 'Now',
            content: `Parser Failure${(e && e.message) ? '\n' + e.message : ''}`,
            delay: 5000,
        });
        responseComplete = true
        return false;
    }
    console.log(_url);
    requestInprogress = $.ajax({async: true,
        url: _url,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR',
            'x-Requested-Page': 'SeqContent'
        },
        success: function (response, textStatus, xhr) {
            window.scrollTo(0,document.getElementById("contentBlock").scrollHeight);
            requestCompleted(response, _url, undefined, true)
        },
        error: function (xhr) {
            if (initialLoad) {
                window.location.href = '/offline';
            }
            responseComplete = true
            $.toast({
                type: 'error',
                title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                subtitle: '',
                content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href="/offline"><i class="fas fa-cloud-slash pr-2"></i>Offline Mode</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
                delay: 10000,
            });
        }
    });
    return false;
}
function getSearchContent(element, url) {
    const searchText = document.getElementById(element).value;
    if (searchText !== null && searchText !== '') {
        if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
        let _url = (() => {
            try {
                if (url) { return url.split('://' + window.location.host).pop() }
                if ($.history) { return $.history.url() }
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            } catch (e) {
                console.error("Failed to access URL data, falling back")
                console.error(e)
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            }
        })()
        if (_url === null) { location.href = '/'; return false; };
        if (!(_url && _url.startsWith('/') && _url.substring(1).length > 2 && _url.substring(1).split('?')[0].length > 2)) {
            $.toast({
                type: 'error',
                title: 'Navigation Failure',
                subtitle: 'Now',
                content: `Invalid Path JOS:/${_url}`,
                delay: 5000,
            });
            responseComplete = true
            return false;
        }
        try {
            let _params = new URLSearchParams(_url.split('?').splice(1).join('?'));
            const _pathname = _url.split('?')[0];
            const _currentURL = window.location.hash.substring(1)

            for (let e of ['search', 'offset', 'sort', 'numdays', 'minres', 'minhres', 'minwres', 'dark']) {
                _params.delete(e);
            }
            if (_params.has('nsfw') &&
                (_params.getAll('nsfw').pop() === 'true' && _params.getAll('nsfw').pop() === 'only') &&
                (_currentURL.startsWith('/artists') || _params.getAll('search').length > 0)) {
                _params.set('nsfw', 'true')
            }
            _params.set('search', searchText);
            if (_params.has('channel') && _params.getAll('channel').pop() === 'random') {
                _params.delete('channel');
            }
            _url = `${_pathname}?${_params.toString()}`;
        } catch (e) {
            $.toast({
                type: 'error',
                title: 'Navigation Failure',
                subtitle: 'Now',
                content: `Parser Failure${(e && e.message) ? '\n' + e.message : ''}`,
                delay: 5000,
            });
            responseComplete = true
            return false;
        }
        setupReq(undefined, _url)
        requestInprogress = $.ajax({async: true,
            url: _url,
            type: "GET", data: '',
            processData: false,
            contentType: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR',
                'x-Requested-Page': 'SeqContent'
            },
            success: function (response) {
                requestCompleted(response, _url)
            },
            error: function (xhr) {
                if (initialLoad) {
                    window.location.href = '/offline';
                }
                responseComplete = true
                $(".container-fluid").fadeTo(2000, 1)
                $.toast({
                    type: 'error',
                    title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                    subtitle: '',
                    content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href="/offline"><i class="fas fa-cloud-slash pr-2"></i>Offline Mode</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
                    delay: 10000,
                });
            }
        });
    }
    return false;
}
function getLimitContent(perm) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    const requestLimit = document.getElementById('limitRequested').value;
    if (requestLimit !== null && requestLimit !== '') {
        const _url = params([], [[(perm) ? 'limit' : 'num', requestLimit ]]);
        setupReq(undefined, _url)
        requestInprogress = $.ajax({async: true,
            url: _url,
            type: "GET", data: '',
            processData: false,
            contentType: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR',
                'x-Requested-Page': 'SeqContent'
            },
            success: function (response) {
                requestCompleted(response, _url)
            },
            error: function (xhr) {
                if (initialLoad) {
                    window.location.href = '/offline';
                }
                responseComplete = true
                $(".container-fluid").fadeTo(2000, 1)
                $.toast({
                    type: 'error',
                    title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                    subtitle: '',
                    content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href="/offline"><i class="fas fa-cloud-slash pr-2"></i>Offline Mode</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
                    delay: 10000,
                });
            }
        });
    }
    return false;

}
function getSidebar(refreshSidebar, disableModels) {
    $.ajax({async: true,
        url: `/sidebar${(refreshSidebar) ? '?refresh=true' : ''}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR',
            'x-Requested-Page': 'SeqSidebar'
        },
        success: function (response, textStatus, xhr) {
            let _sb = $(response).find('#sidebar')
            _sb.find('a[href="#_"], a[href="#"] ').click(function(e){
                if (_originalURL && _originalURL !== 'undefined' )
                    window.history.replaceState({}, null, `/juneOS#${_originalURL}`);
                e.preventDefault();
            });
            $("#accordionSidebar").html(_sb);
            if (!disableModels) {
                $("#dataModels").html($(response).find('#models').html());
            } else {
                setSidebar();
            }
            scrollToTop();
        },
        error: function (xhr) {
            $.toast({
                type: 'error',
                title: 'Page Failed',
                subtitle: 'Now',
                content: `Failed to load sidebar, Try Again!: ${xhr.responseText}`,
                delay: 5000,
            });
        }
    });
    return false;
}
function getPaginator(url) {
    if(paginatorInprogress) { paginatorInprogress.abort(); }
    paginatorInprogress = $.ajax({async: true,
        url: url,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR',
            'x-Requested-Page': 'SeqPaginator'
        },
        success: function (response, textStatus, xhr) {
            let _pn = $(response);
            _pn.find('a[href="#_"], a[href="#"] ').click(function(e){
                if (_originalURL && _originalURL !== 'undefined' )
                    window.history.replaceState({}, null, `/juneOS#${_originalURL}`);
                e.preventDefault();
            });
            $('#totalCount').replaceWith(_pn.find('#totalCount'));
            $('#HistoryDropdown').html(_pn.find('#history').contents());
        },
        error: function (xhr) {
            console.error(`Failed to load paginator - ${xhr.responseText}`)
        }
    });
    return false;
}
function launchContent(remove, add, url) {
    setupReq(undefined, _url)
    document.location.href = params(remove, add, url);
    return false;
}
function getNewURIContent(element, type) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    try {
        let _url = document.querySelector('#' + element).value.toString().trim()
        if (_url && _url.length > 2) {
            let _e = _url.split('?')
            let pagetype = undefined;
            if (_e.length > 1) {
                pagetype = _e[0].split('/').pop()
                _e = _e.splice(1).join('?');
            } else {
                _e = _e[0]
            }

            getNewContent(['_h'],[], `/${(pagetype) ? pagetype : window.location.hash.substring(2).split('?')[0]}?${_e}`);
        } else {
            responseComplete = true
            $(".container-fluid").fadeTo(2000, 1)
            $.toast({
                type: 'error',
                title: 'Navigation Failed',
                subtitle: 'Now',
                content: `Enter Path or URI`,
                delay: 2000,
            });
        }
        setupReq(undefined, _url)
    } catch (e) {
        responseComplete = true
        $(".container-fluid").fadeTo(2000, 1)
        $.toast({
            type: 'error',
            title: 'Navigation Failed',
            subtitle: 'Now',
            content: `Incorrect Path or URI`,
            delay: 2000,
        });
        console.error(e);
    }
    return false;
}
function hideAddressInput() {
    document.getElementById("directURI").value = '';
    return false;
}
function showAddressInput() {
    let _uri = new URLSearchParams(document.location.hash.substring(1).split('?').pop());
    _uri.delete('_h')
    if (!_uri.has('folder') && document.getElementById("folderPath")) {
        _uri.delete('channel');
        _uri.set('folder', document.getElementById("folderPath").innerText)
    }
    document.getElementById("directURI").value = decodeURIComponent(_uri.toString());
    return false;
}
function feedContent(type) {
    document.getElementById('feedURLdiv').classList.remove('d-none');
    $.ajax({async: true,
        url: `https://${document.location.host}/discord/token?action=get`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (response && response === 'NO STATIC LOGIN TOKEN') {
                document.getElementById('feedURLdiv').classList.add('d-none');
                document.getElementById('feedNoKeydiv').classList.remove('d-none');
            } else if (response && response.length > 24) {
                document.getElementById('feedURLholder').value = 'https://' + document.location.host + params([], [['responseType', type],['key', response]]);
                document.getElementById('feedNoKeydiv').classList.add('d-none');
            } else {
                document.getElementById('feedURLholder').value = 'Server Error!'
                document.getElementById('feedNoKeydiv').classList.add('d-none');
            }
        },
        error: function (xhr) {
            document.getElementById('feedURLholder').value = 'Server Error!'
            document.getElementById('feedNoKeydiv').classList.add('d-none');
        }
    });
    return false;
}
function downloadSelectedItems() {
    try {
        pageType = $.history.url().split('?')[0].substring(1);
        downloadAllController = {
            ready: true,
            urls: [],
            fileids: [],
            about: new AbortController()
        };
        downloadAllController.urls = postsActions.filter(e => document.getElementById(`request-download-${e.messageid}`) && document.getElementById(`request-download-${e.messageid}`).href).map(e => document.getElementById(`request-download-${e.messageid}`).href)
        downloadAllController.fileids = postsActions.filter(e => document.getElementById(`message-${e.messageid}`) && document.getElementById(`message-${e.messageid}`).hasAttribute('data-msg-fileid')).map(e => document.getElementById(`message-${e.messageid}`).getAttribute('data-msg-fileid'))
        document.getElementById("downloadProgText").innerText = `Ready to download ${downloadAllController.urls.length + downloadAllController.fileids.length} items!`
        $('#downloadAll').modal('show');
        postsActions = [];
    } catch (e) {
        alert(`Error starting downloader: ${e.message}`)
    }
}
function downloadAllItems() {
    try {
        pageType = $.history.url().split('?')[0].substring(1);
        downloadAllController = {
            ready: true,
            urls: [],
            fileids: [],
            about: new AbortController()
        };
        $('a[id^=request-download]').each(function () {
            downloadAllController.urls.push($(this).attr('href'));
        });
        $('div[data-msg-fileid], tr[data-msg-fileid]').each(function () {
            downloadAllController.fileids.push($(this).attr('id').split('-')[1]);
        });
        document.getElementById("downloadProgText").innerText = `Ready to download ${downloadAllController.urls.length + downloadAllController.fileids.length} items!`
        $('#downloadAll').modal('show');
    } catch (e) {
        alert(`Error starting downloader: ${e.message}`)
    }
}
async function startDownloadingFiles() {
    const downloadModel = document.getElementById('downloadAll')
    console.log(`Downloading ${downloadAllController.urls.length} files...`)

    $('#downloadStartButton').addClass('hidden');
    $('#downloadStopButton').removeClass('hidden');
    downloadAllController.fileids.map(async (e) => await openUnpackingFiles(e))
    for (let i in downloadAllController.urls) {
        if (!downloadAllController.ready)
            break;
        const percentage = ((parseInt(i) + 1) / downloadAllController.urls.length) * 100
        downloadModel.querySelector("#downloadProgressBar").style.width = `${percentage}%`;
        downloadModel.querySelector("#downloadProgressBar").setAttribute( 'aria-valuenow',`${percentage}%`);
        downloadModel.querySelector("#downloadProgText").innerText = `Downloading "${downloadAllController.urls[i].split('/').pop()}"...`
        await new Promise(ok => {
            const url = (() => {
                if (downloadAllController.urls[i].includes('discordapp.com/')) {
                    return `${document.location.protocol}//${document.location.host}/attachments${downloadAllController.urls[i].split('attachments').pop()}`
                } else if (downloadAllController.urls[i].startsWith(`${document.location.protocol}//${document.location.host}/`)) {
                    return downloadAllController.urls[i]
                } else {
                    return undefined
                }
            })()
            if (url) {
                axios({
                    url,
                    method: 'GET',
                    signal: downloadAllController.about.signal,
                    responseType: 'blob'
                })
                    .then((response) => {
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', downloadAllController.urls[i].split('/').pop());
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        ok(true);
                    })
                    .catch(e => {
                        downloadModel.querySelector("#downloadProgText").innerText = e.message
                        console.error(e);
                        setTimeout(() => {
                            ok(false);
                        }, 1500);
                    })
            } else {
                console.error('Download not possible, not a valid url');
                ok(false);
            }
        }).then(r => {
            console.log('OK')
        })
    }
    $('#downloadAll').modal('hide');
    $('#downloadStartButton').removeClass('hidden');
    $('#downloadStopButton').addClass('hidden');
    downloadModel.querySelector("#downloadProgressBar").style.width = `0%`;
    downloadModel.querySelector("#downloadProgressBar").setAttribute( 'aria-valuenow',`0%`);
    downloadModel.querySelector("#downloadProgText").innerText = `Ready`
    disableGallerySelect();
}

async function cacheItems(urls) {
    caches.open('offline-content')
        .then(c => {
            c.addAll(urls)
        })
        .catch(e => {
            console.error(e);
        })
    return false;
}
const imageFiles = ['jpg','jpeg','jfif','png','webp','gif'];
const videoFiles = ['mp4','mov','m4v', 'webm'];
const audioFiles = ['mp3','m4a','wav', 'ogg', 'flac'];
let contentCache = null;

function replaceDiscordCDN(url) {
    return (url.includes('.discordapp.') && url.includes('attachments')) ? `/${(url.startsWith('https://media.discordapp') ? 'media_' : 'full_')}attachments${url.split('attachments').pop()}` : url;
}
function extractMetaFromElement(e) {
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
    const attribs = Array.from(e.attributes).map(f => f.nodeName + '="' + f.value.split('"').join('&quot;') + '"');

    let required_build = (postFilID && !postCached);
    let data_type = null;
    let fullItem = null;
    let previewItem = null;
    let extpreviewItem = null;

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

    return {
        full_url: fullItem,
        preview_url: previewItem,
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
        htmlAttributes: attribs,
    }
}
async function cacheFileURL(object, page_item, doc) {
    return new Promise(async (resolve) => {
        let fetchResults = {}
        if (object.full_url)
            fetchResults["full_url"] = (await fetch(object.full_url)).status
        if (object.preview_url)
            fetchResults["preview_url"] = (await fetch(object.preview_url)).status
        if (object.extpreview_url)
            fetchResults["extpreview_url"] = (await fetch(object.extpreview_url)).status
        if (object.required_build)
            openUnpackingFiles(object.id, undefined, true, true, doc);
        if (browserStorageAvailable) {
            try {
                const indexDBUpdate = offlineContent.transaction(["offline_items"], "readwrite").objectStore("offline_items").delete(object.eid);
                indexDBUpdate.onsuccess = deleteEvent => {
                    offlineContent.transaction([`offline_items`], "readwrite").objectStore('offline_items').add({
                        ...object,
                        page_item: (!!page_item),
                        fetchResults: fetchResults
                    }).onsuccess = event => {
                        resolve(fetchResults);
                    };
                };
            } catch (e) {
                console.error(`Failed to save record for ${object.eid}`);
                console.error(e)
                resolve(fetchResults)
            }
        } else {
            resolve(fetchResults)
        }
    })
}
async function cachePageOffline(type, _url) {
    const limit = (document.getElementById("maxCountOfflinePage")) ? document.getElementById("maxCountOfflinePage").value : undefined;
    let requestOpts = [['responseType', 'offline']];
    if (limit && limit.length > 0 && !isNaN(parseInt(limit))) {
        requestOpts.push(['num', limit]);
    }
    const url = params(['offset'], requestOpts, _url);
    const cache = await caches.open(`offline-content-${(type) ? type : 'pages'}`);
    await cache.delete(url);
    await cache.add(url);
    const _cacheItem = await cache.match(url);
    if (_cacheItem) {
        $('#cacheModal').modal('hide');
        const content = await (new DOMParser().parseFromString((await _cacheItem.text()).toString(), 'text/html'))
        contentCache = content;
        const title = content.querySelector('title').text

        const itemsToCache = Array.from(content.querySelectorAll('[data-msg-url-full]')).map(e => extractMetaFromElement(e)).filter(e => e.data_type);

        const totalFiles = itemsToCache.length;
        if (totalFiles === 0) {
            $.toast({
                type: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>No Items',
                subtitle: '',
                content: `<p>There are no media files on this page that can be made offline!</p>`,
                delay: 10000,
            });
            return false;
        }

        let downloadedFiles = 0;
        let status = {
            url: params(['offset', '_h', 'responseType', 'num'], [], url),
            title,
            downloaded: downloadedFiles,
            items: itemsToCache.map(e => e.eid),
            totalItems: totalFiles
        }
        offlineDownloadController.set(url, status);
        updateNotficationsPanel();
        notificationControler = setInterval(updateNotficationsPanel, 1000);

        for (let e of itemsToCache) {
            if (!offlineDownloadController.has(url))
                break;
            try {
                const fetchResult = await cacheFileURL(e, true, content)
                if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400)) {
                    offlineDownloadController.delete(url);
                    break;
                }
            } catch (err) {
                console.error(err);
                offlineDownloadController.delete(url);
                break;
            }
            downloadedFiles++;
            status = {
                ...status,
                downloaded: downloadedFiles
            }
            offlineDownloadController.set(url, status);
        }
        console.log(`Cached ${downloadedFiles} Items`);

        if (!offlineDownloadController.has(url)) {
            console.error('Offline download was canceled!')
            await cache.delete(url);
            const cachesList = await caches.keys();
            const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
            const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
            const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
            const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;
            if (cdnCache) {
                for (let e of itemsToCache) {
                    if (e.full_url)
                        cdnCache.remove(e.full_url);
                    if (e.preview_url)
                        cdnCache.remove(e.preview_url);
                    if (e.extpreview_url)
                        cdnCache.remove(e.extpreview_url);
                }
            }
            if (proxyCache) {
                for (let e of itemsToCache) {
                    if (e.full_url)
                        cdnCache.remove(e.full_url);
                    if (e.preview_url)
                        cdnCache.remove(e.preview_url);
                    if (e.extpreview_url)
                        cdnCache.remove(e.extpreview_url);
                }
            }
            $.snack('error', `<i class="fas fa-sd-card pr-2"></i>Page Download Canceled or Failed`, 5000);
        } else {
            if (browserStorageAvailable) {
                try {
                    const indexDBUpdate = offlineContent.transaction(["offline_pages"], "readwrite").objectStore("offline_pages").delete(url);
                    indexDBUpdate.onsuccess = deleteEvent => {
                        offlineContent.transaction([`offline_pages`], "readwrite").objectStore('offline_pages').add(status).onsuccess = event => {
                            $.snack('success', `<i class="fas fa-sd-card pr-2"></i>Page with ${totalFiles} files are available offline`, 5000);
                            console.log(`Page Saved Offline!`)
                        };
                    };
                } catch (e) {
                    $.toast({
                        type: 'error',
                        title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                        subtitle: '',
                        content: `<p>Failed to save offline storage record "${title}"!</p><p>${e.message}</p>`,
                        delay: 10000,
                    });
                    console.error(`Failed to save record for ${url}`);
                }
            } else {
                $.toast({
                    type: 'error',
                    title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                    subtitle: '',
                    content: `<p>Failed access offline storage databsae!</p>`,
                    delay: 10000,
                });
            }
            offlineDownloadController.delete(url);
        }
    } else {
        $.toast({
            type: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Failed to get offline page results, Try again later</p>`,
            delay: 10000,
        });
        console.error('Item did not hit cache. Please try again')
    }
    return false;
}
async function offlineSelectedItems() {
    try {
        disableGallerySelect();
        let downloadedFiles = 0;
        const _url = params(['offset', '_h', 'responseType'], [])
        let status = {
            url: _url,
            title: 'Selected Items',
            downloaded: downloadedFiles,
            totalItems: postsActions.length,
        }
        offlineDownloadController.set(_url, status);
        updateNotficationsPanel();
        notificationControler = setInterval(updateNotficationsPanel, 1000);
        await Promise.all(postsActions.map(async (e,i) => {
            await cacheFileOffline(e.messageid, !(i === postsActions.length - 1));
            downloadedFiles++;
            status = {
                ...status,
                downloaded: downloadedFiles
            }
            offlineDownloadController.set(_url, status);
        }))
        postsActions = [];
        offlineDownloadController.delete(_url);
    } catch (e) {
        alert(`Error starting downloader: ${e.message}`)
    }
}
async function cacheFileOffline(element, noConfirm) {
    if (element) {
        const _post = document.getElementById('message-' + element);
        const metdata = extractMetaFromElement(_post);
        const fetchResult = await cacheFileURL(metdata);
        if ((fetchResult.full_url !== undefined && fetchResult.full_url >= 400) || (fetchResult.preview_url !== undefined && fetchResult.preview_url >= 400) || (fetchResult.extpreview_url !== undefined && fetchResult.extpreview_url >= 400)) {
            $.toast({
                type: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Failed to save offline storage record "${element}"!</p><p>${e.message}</p>`,
                delay: 10000,
            });
            console.error(`Failed to save record for ${element}`);
            console.error(e)
        } else {
            if (!noConfirm)
                $.snack('success', `<i class="fas fa-sd-card pr-2"></i>File available offline`, 5000);
        }
    }
    return false;
}
/*async function offlineAllImages() {
    let cdnImage = {};
    let proxyImage = {};
    await Promise.all((await caches.keys()).filter(e => e.startsWith('offline-proxy-')).map(async e => {
        return await new Promise((resolve) => {
            caches.open(e).then(async cache => {
                resolve((await cache.keys()).filter(e => imageFiles.indexOf(e.url.split('?')[0].split('.').pop().toLowerCase()) !== -1).map(f => {
                    proxyImage[f.url.split('?')[0].split('attachments/').pop()] = f.url
                }))
            })
        })
    })).then(r => {});
    (await Promise.all((await caches.keys()).filter(e => e.startsWith('offline-cdn-')).map(async e => {
        return await new Promise((resolve) => {
            caches.open(e).then(async cache => {
                resolve((await cache.keys()).filter(e => imageFiles.indexOf(e.url.split('?')[0].split('.').pop().toLowerCase()) !== -1).map(f => f.url))
            })
        })
    }))).map(e => {
        e.map(f => {
            cdnImage[f] = (proxyImage[f.split('attachments/').pop()]) ? proxyImage[f.split('attachments/').pop()] : f
        })
    });

    document.getElementById('contentBlock').innerHTML = '<div class="tz-gallery"><div class="row">' + Object.keys(cdnImage).map(image => [
        '<div class="col-image col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3">',
        '<div class="internal-lightbox d-block"></div>',
        `<a class="lightbox" href="${image}">`,
        `<div id="postImage" class="square img img-responsive" style="background-image: url('${cdnImage[image]}');"></div>`,
        '<div id="postBackground" style="background-color: rgb(128, 128, 128);"></div>',
        '</a>',
        '</div>',
    ].join('')).join('') + '</div></div>'
    $("a.lightbox").fancybox(options);
}*/
async function getOfflinePages() {
    if (document.getElementById('offlinePageList')) {
        document.getElementById('offlinePages').classList.remove('hidden');
        $("#userMenu").collapse("hide");
        const pages = await getAllOfflinePages();
        document.getElementById('offlinePageList').innerHTML = pages.map(page => {
            let icon = 'fa-page';
            if (page.url.includes('#/gallery'))
                icon = 'fa-image'
            if (page.url.includes('#/files'))
                icon = 'fa-folder'
            if (page.url.includes('#/cards'))
                icon = 'fa-message'
            if (page.url.includes('album='))
                icon = 'fa-archive'

            return `<tr>
            <th class="py-2 text-right"><i class="fas ${icon} pr-2"></i></th>
            <td class="py-2 w-100"><a href="#${params(['responseType'],[],page.url)}"><span>${page.title}</span></a></td>
            <td class="py-2"><span>${page.totalItems}</span></td>
        </tr>`
        }).join('');
    }
}
async function getPageIfAvailable(_url) {
    return new Promise((resolve) => {
        try {
            const url = params(['limit', 'offset'], [['responseType', 'offline']], _url);
            if (url && browserStorageAvailable) {
                offlineContent.transaction("offline_pages").objectStore("offline_pages").get(url).onsuccess = event => {
                    if (event.target.result && event.target.result.files) {
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
async function deleteOfflinePage(_url, noupdate) {
    const url = params(['limit', 'offset'], [['responseType', 'offline']], _url);
    if (url) {
        const cachesList = await caches.keys();
        const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
        const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
        const pagesCache = await caches.open('offline-content-pages');
        const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
        const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;
        const page = await getPageIfAvailable(url);
        if (page) {
            if (cdnCache)
                page.files.map(f => cdnCache.delete(f))

            if (proxyCache)
                page.previews.map(f => proxyCache.delete(f))

            if (browserStorageAvailable) {
                const indexDBUpdate = offlineContent.transaction(["offline_pages"], "readwrite").objectStore("offline_pages").delete(url);
                indexDBUpdate.onsuccess = event => {
                    pagesCache.delete(url);
                    if (!noupdate)
                        updateNotficationsPanel();
                };
            } else {
                pagesCache.delete(url);
                if (!noupdate)
                    updateNotficationsPanel();
            }
        } else {
            pagesCache.delete(url);
        }
    }
}
async function deleteOfflineFile(eid, noupdate) {
    const file = await getFileIfAvailable(eid);
    if (file) {
        const cachesList = await caches.keys();
        const nameCDNCache = cachesList.filter(e => e.startsWith('offline-cdn-'))
        const nameProxyCache = cachesList.filter(e => e.startsWith('offline-proxy-'))
        const cdnCache = (nameCDNCache.length > 0) ? await caches.open(nameCDNCache[0]) : false;
        const proxyCache = (nameProxyCache.length > 0) ? await caches.open(nameProxyCache[0]) : false;

        if (cdnCache)
            cdnCache.delete(file.full_url);
        if (proxyCache)
            proxyCache.delete(file.preview_url);
        if (browserStorageAvailable) {
            const indexDBUpdate = offlineContent.transaction(["offline_items"], "readwrite").objectStore("offline_items").delete(eid);
            indexDBUpdate.onsuccess = event => {
                if (!noupdate)
                    updateNotficationsPanel();
            };
        } else {
            if (!noupdate)
                updateNotficationsPanel();
        }
    }
}
async function clearCache(list) {
    await caches.keys().then(cacheNames => {
        console.log(`Local Caches Stores:`);
        return Promise.all(
            cacheNames.filter(e => !list || (list && list.filter(f => e.includes(f)).length > 0)).map(cache => {
                console.log(cache)
                console.log('JulyOS Kernel: Deleteing Old Cache - ' + cache);
                return caches.delete(cache);
            })
        );
    })
}
async function clearKernelCache() {
    await clearCache(['generic', 'kernel', 'config']);
    window.location.reload();
}
async function clearAllOfflineData() {
    $('#cacheModal').modal('hide');
    (await getAllOfflinePages()).map(async e => await deleteOfflinePage(e.url, true));
    (await getAllOfflineFiles()).map(async e => await deleteOfflineFile(e.eid, true));
}
async function displayOfflineData() {
    let linkedEids = [];
    let linkedFileids = [];
    const pages = await getAllOfflinePages();
    const pageRows = pages.map((e,i) => {
        let icon = 'fa-page';
        if (e.url.includes('#/gallery'))
            icon = 'fa-image'
        if (e.url.includes('#/files'))
            icon = 'fa-folder'
        if (e.url.includes('#/cards'))
            icon = 'fa-message'
        if (e.url.includes('album='))
            icon = 'fa-archive'
        if (e.items)
            linkedEids.push(...e.items);

        return`<div class="d-flex py-1 align-items-center" id='cachePageItem-${i}'>
            <div class="px-2"><i class="fas ${icon}"></i></div>
            <div class="w-100"><span>${e.title}</span></div>
            <div class="d-flex">
                <a class="p-2" href="#_" onclick="cachePageOffline(undefined, '${e.url}'); return false">
                    <i class="fas fa-arrows-rotate"></i>
                </a>
                <a class="p-2" href="#_" onclick="deleteOfflinePage('${e.url}'); document.getElementById('cachePageItem-${i}').remove(); return false">
                    <i class="fas fa-trash"></i>
                </a>
            </div>
        </div>`
    });

    if (pageRows.length > 0) {
        document.getElementById('cachePagesManager').innerHTML = pageRows.join('')
    } else {
        document.getElementById('cachePagesManager').innerHTML = '<span>No Offline Pages</span>'
    }

    const files = await getAllOfflineFiles();
    linkedFileids.push(...files.filter(e => !!e.fileid).map((e) => e.fileid))
    const fileRows = files.filter(e => linkedEids.indexOf(e.eid) === -1).map((e,i) => {
        let icon = 'fa-file';
        if (e.data_type === 'image')
            icon = 'fa-image'
        if (e.data_type === 'video')
            icon = 'fa-film'
        if (e.data_type === 'audio')
            icon = 'fa-music'

        return`<div class="d-flex py-1 align-items-center" id='cacheItemItem-${i}'>
            <div class="px-2"><i class="fas ${icon}"></i></div>
            <div class="w-100"><span>${e.filename}</span></div>
            <div class="d-flex">
                <a class="p-2" href="#_" onclick="deleteOfflineFile('${e.eid}'); document.getElementById('cacheItemItem-${i}').remove(); return false">
                    <i class="fas fa-trash"></i>
                </a>
            </div>
        </div>`
    });

    if (fileRows.length > 0) {
        document.getElementById('cacheItemsManager').innerHTML = fileRows.join('')
    } else {
        document.getElementById('cacheItemsManager').innerHTML = '<span>No Offline Items</span>'
    }

    const offlineSpannedFiles = await getAllOfflineSpannedFiles();
    const spannedRows = offlineSpannedFiles.filter(e => linkedFileids.indexOf(e.id) === -1).map((e,i) => {
        return`<div class="d-flex py-1 align-items-center" id='cacheSpanItem-${i}'>
            <div class="px-2"><i class="fas fa-box-open"></i></div>
            <div class="w-100"><span>${e.filename}</span></div>
            <div class="d-flex">
                <a class="p-2" href="#_" onclick="removeCacheItem('${e.id}'); document.getElementById('cacheSpanItem-${i}').remove(); return false">
                    <i class="fas fa-trash"></i>
                </a>
            </div>
        </div>`
    });

    if (spannedRows.length > 0) {
        document.getElementById('cacheFilesManager').innerHTML = spannedRows.join('')
    } else {
        document.getElementById('cacheFilesManager').innerHTML = '<span>No Spanned Files</span>'
    }

    $('#cacheModal').modal('show');
}
async function generateGalleryHTML(url, eids) {
    $("#userMenu").collapse("hide");
    _originalURL = url;
    setupReq(undefined, _originalURL);
    const _params = new URLSearchParams('?' + url.split('#').pop().split('?').pop());
    $.when($(".container-fluid").fadeOut(250)).done(async () => {
        let resultRows = [];
        const files = await getAllOfflineFiles();
        const allResults = files.filter(e => (e.data_type === 'image' || e.data_type === 'video') && ((eids && eids.indexOf(e.eid) !== -1) || (!eids && !e.page_item)))
        let offset = (_params.has('offset')) ? parseInt(_params.getAll('offset')[0]) : 0
        if (allResults.length < offset)
            offset = 0;
        const shift = offset + 100;
        let pageButtons = [];
        if (allResults.length > 100) {
            if (offset > 0) {
                pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="getNewContent([], [['offset', '${(offset > 100) ? offset - 100 : 0}']]); return false;"><i class="fas fa-arrow-left"></i></a>`)
            }
            if (shift <= allResults.length) {
                pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="nextPage" title="Next Page" href="#_" role="button" accesskey="."  onclick="getNewContent([], [['offset', '${shift}']]); return false;"><i class="fa fa-arrow-right"></i></a>`)
            }
        }

        resultRows = await Promise.all(allResults.slice(offset, shift).map(async e => {
            const url = await (async () => {
                if (e.fileid) {
                    const possibleFileSaved = await getSpannedFileIfAvailable(e.fileid);
                    if (possibleFileSaved && possibleFileSaved.href)
                        return possibleFileSaved.href;
                }
                return e.full_url
            })()
            return `<div ${(e.htmlAttributes && e.htmlAttributes.length > 0) ? e.htmlAttributes.join(' ') : 'class="col-image col-dynamic col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3"'}><div class="overlay-icons">
    <div class="icon-container no-dynamic-tiny">
        <div class="status-icons left-links d-flex w-100">
            <div class="d-inline-flex size-indictor shadow-text"></div>
            <div class="d-inline-flex ratio-indictor shadow-text"></div>
            <div class="d-inline-flex ml-1 shadow-text"><i class="fas fa-cloud-check text-success"></i></div>
            <div class="d-inline-flex ml-auto shadow-text"><i class="fas ${(e.channel_icon) ? e.channel_icon : 'fa-question'} pr-1"></i></div>
        </div>
        ${(e.data_type === 'video') ? '<div class="status-icons left-links d-flex w-100 no-dynamic-tiny" style="padding-top: 1.4em;"><div class="d-flex shadow-text text-ellipsis"><span class="text-ellipsis" style="line-height: 1.1; text-weight: bold;">' + e.filename + '</span></div></div>' : ''}
    </div>
    <div class="links-container text-primary">
        <div class="links">
            <div class="left-links row-1"><a class="btn btn-links goto-link" data-placement="top" title="Search content related to this image" href="#_" onClick="showSearchOptions('${e.id}'); return false;"><i class="btn-links fas fa-info-circle"></i></a></div>
            <div class="right-links row-1"></div>
        </div>
    </div>
</div><div class="internal-lightbox d-block"></div><a class="lightbox" ${(e.data_type === 'video') ? 'data-fancybox="video" href="#_" onclick="PlayVideo(\'' + url + '\'); return false;"' : 'data-fancybox="gallery" href="' + url + '"'}><div id="postImage" class="square img img-responsive" style="background-image: url('${(e.extpreview_url) ? e.extpreview_url : e.preview_url}');"></div><div id="postBackground" style="background-color: rgb(${(e.color) ? e.color.slice(0,3).join(', ') : '128, 128, 128'});"></div></a></div>`
        }))

        if (resultRows.length > 0) {
            document.getElementById('contentBlock').innerHTML = '<div class="tz-gallery"><div class="row">' + resultRows.join(' ') + '</div></div>'
            window.history.replaceState({}, null, `/offline#${_originalURL}`);
            registerLazyLoader();
            registerURLHandlers();
            setImageLayout(setImageSize);
            $("#pageNav").html(pageButtons.join(''));
            $(".container-fluid").fadeTo(2000, 1);
        } else {
            $(".container-fluid").fadeTo(2000, 1)
            $.toast({
                type: 'error',
                title: 'No Results Found',
                subtitle: 'Error',
                content: `Nothing was found, Please try another option or search term`,
                delay: 10000,
            })
        }
        responseComplete = true;
    })
}
async function generateFilesHTML(url, eids) {
    _originalURL = url;
    setupReq(undefined, _originalURL);
    const _params = new URLSearchParams('?' + url.split('#').pop().split('?').pop());
    $.when($(".container-fluid").fadeOut(250)).done(async () => {
        let resultRows = [];
        const files = await getAllOfflineFiles();
        const allResults = files.filter(e => (e.data_type === 'audio' || e.data_type === 'generic') && ((eids && eids.indexOf(e.eid) !== -1) || (!eids && !e.page_item)))
        let offset = (_params.has('offset')) ? parseInt(_params.getAll('offset')[0]) : 0
        if (allResults.length < offset)
            offset = 0;
        const shift = offset + 100;
        let pageButtons = [];
        if (allResults.length > 100) {
            if (offset > 0) {
                pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="getNewContent([], [['offset', '${(offset > 100) ? offset - 100 : 0}']]); return false;"><i class="fas fa-arrow-left"></i></a>`)
            }
            if (shift <= allResults.length) {
                pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="nextPage" title="Next Page" href="#_" role="button" accesskey="."  onclick="getNewContent([], [['offset', '${shift}']]); return false;"><i class="fa fa-arrow-right"></i></a>`)
            }
        }

        resultRows = await Promise.all(allResults.slice(offset, shift).map(async e => {
            const url = await (async () => {
                if (e.fileid) {
                    const possibleFileSaved = await getSpannedFileIfAvailable(e.fileid);
                    if (possibleFileSaved && possibleFileSaved.href)
                        return possibleFileSaved.href;
                }
                return e.full_url
            })()
            return `<tr class="dense-table" ${(e.htmlAttributes && e.htmlAttributes.length > 0) ? e.htmlAttributes.join(' ') : ''}>
                <!--<td class="preview-holder">
                    <div class="preview-image align-content-start"><i class="fas fa-image fa-2x"></i></div>
                </td>-->
                <td class="preview-icon"><div class="table-icon"><i class="fas fa-music fa-2x"></i></div></td>
                <td><span class="align-middle">${e.filename}</span>
                    <div class="text-primary">
                        <div class="btn-group d-inline-block">
                        ${(audioFiles.indexOf(e.filename.split('.').pop().split('?')[0].toLowerCase().trim()) > -1) ? "<a class=\"btn btn-switchmode\" title=\"Play Audio\" href=\"#_\" onclick=\"PlayTrack('" + url + "'); return false;\"><i class=\"fas fa-play\"></i></a>" : ""}
                        <a class="btn btn-switchmode" title="Download" download="${e.filename}" href="${url}" target="_blank" rel="noopener noreferrer"><i class="fas fa-download"></i></a></div>
                        <div class="btn-group file-tools d-inline-block"><a class="btn btn-fav" data-placement="top" title="Search content related to this image" href="#_" onClick="showSearchOptions('${e.id}'); return false;"><i class="fas fa-info-circle"></i></a></div>
                    </div>
                </td>
                <td class="d-none d-sm-table-cell">${e.date}</td>
                <td class="d-none d-sm-table-cell">${e.file_size}</td>
            </tr>`
        }))
        if (resultRows.length > 0) {
            document.getElementById('contentBlock').innerHTML = `<div class="table-responsive p-lg-3 rounded bg-translucent-lg">
    <table class="table table-borderless" id="dataTable" width="100%" cellspacing="0">
        <thead class="table-header">
            <tr>
                <th style="width: 5%"></th>
                <th style="width: 70%">Filename</th>
                <th style="width: 15%">Date</th>
                <th style="width: 10%">Size</th>
            </tr>
        <tbody>` + resultRows.join(' ') + `</tbody>
        </thead>
    </table>
</div>`
            window.history.replaceState({}, null, `/offline#${_originalURL}`);
            registerLazyLoader();
            registerURLHandlers();
            $("#pageNav").html(pageButtons.join(''));
            $(".container-fluid").fadeTo(2000, 1);
        } else {
            $(".container-fluid").fadeTo(2000, 1)
            $.toast({
                type: 'error',
                title: 'No Results Found',
                subtitle: 'Error',
                content: `Nothing was found, Please try another option or search term`,
                delay: 10000,
            })
        }
        responseComplete = true;
    })
}

async function getSpannedFileIfAvailable(fileid) {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("spanned_files").objectStore("spanned_files").get(fileid).onsuccess = event => {
                    if (event.target.result && event.target.result.id && event.target.result.block) {
                        let url
                        if (!tempURLController.has(event.target.result.id)) {
                            url = window.URL.createObjectURL(event.target.result.block)
                            tempURLController.set(event.target.result.id, url);
                        } else {
                            url = tempURLController.get(event.target.result.id);
                        }
                        resolve({
                            ...event.target.result,
                            href: url
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
async function getAllOfflineSpannedFiles() {
    return new Promise((resolve) => {
        try {
            if (browserStorageAvailable) {
                offlineContent.transaction("spanned_files").objectStore("spanned_files").getAll().onsuccess = event => {
                    resolve(event.target.result.map(e => {
                        let url
                        if (!tempURLController.has(e.id)) {
                            url = window.URL.createObjectURL(e.block)
                            tempURLController.set(e.id, url);
                        } else {
                            url = tempURLController.get(e.id);
                        }
                        return {
                            ...e,
                            href: url
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
async function openUnpackingFiles(messageid, playThis, downloadPreemptive, offlineFile, doc) {
    const _post = (doc || document).getElementById(`message-${messageid}`);
    const fileid = _post.getAttribute('data-msg-fileid');
    const filename = _post.getAttribute('data-msg-filename');
    const filesize = _post.getAttribute('data-msg-filesize');
    const channelString = _post.getAttribute('data-msg-channel-string') === 'true';
    const fastAccess = (_post.getAttribute('data-msg-filecached') === 'true') ? _post.getAttribute('data-msg-download') : false;
    const videoModel = document.getElementById('videoBuilderModal');
    if (fileid && fileid.length > 0) {
        const element = document.getElementById(`fileData-${fileid}`);
        const memoryJobIndex = memorySpannedController.filter(e => e.id === fileid);
        const storedFile = (element && memoryJobIndex.length > 0) ? memoryJobIndex[0] : await getSpannedFileIfAvailable(fileid)

        if (fastAccess) {
            if (downloadPreemptive) {
                console.log(`File ${filename} is already available`)
            } else if (playThis === 'audio') {
                PlayTrack(fastAccess);
            } else if (playThis === 'video') {
                $('#videoBuilderModal').modal('hide');
                const videoPlayer = videoModel.querySelector('video')
                if (!videoPlayer.paused)
                    memoryVideoPositions.set(fileid, videoPlayer.currentTime);
                videoPlayer.pause();
                PlayVideo(fastAccess, `${channelString}/${filename} (${filesize})`, fileid);
            } else if (playThis === 'kms-video') {
                const kmsprogress = _post.getAttribute('data-kms-progress');
                kongouMediaVideoFull.src = fastAccess;
                try { await kongouMediaVideoFull.play(); } catch (err) { console.error(err); }
                kongouMediaVideoPreview.pause();
                kongouMediaVideoPreview.classList.add('hidden');
                kongouMediaVideoFull.classList.remove('hidden');
                if (memoryVideoPositions.has(fileid)) {
                    const time = memoryVideoPositions.get(fileid);
                    console.log((time / kongouMediaVideoFull.duration).toFixed(1))
                    if ((time / kongouMediaVideoFull.duration).toFixed(1) <= 0.9) {
                        kongouMediaVideoFull.currentTime = memoryVideoPositions.get(fileid);
                    } else {
                        console.log(`Video Progress was to to deep, Restarting from the beginning`);
                    }
                } else if (kmsprogress && !isNaN(parseFloat(kmsprogress)) && parseFloat(kmsprogress) > 0.05) {
                    if (parseFloat(kmsprogress) <= 0.9) {
                        kongouMediaVideoFull.currentTime = kongouMediaVideoFull.duration * parseFloat(kmsprogress);
                    } else {
                        console.log(`Video Progress was to to deep, Restarting from the beginning`);
                    }
                } else if (kmsPreviewLastPostion && kmsPreviewLastPostion < kongouMediaVideoFull.duration) {
                    if (kmsPreviewLastPostion - kongouMediaVideoPreview.currentTime < 5) {
                        kongouMediaVideoFull.currentTime = kongouMediaVideoPreview.currentTime;
                    } else {
                        kongouMediaVideoFull.currentTime = kmsPreviewLastPostion;
                    }
                }
                kmsPreviewLastPostion = null;
                clearInterval(kmsPreviewInterval)
                kmsPreviewInterval = null;
                kmsPreviewPrematureEnding = false;
                kongouControlsSeekUnavalible.classList.remove('no-seeking');
                kongouMediaPlayer.querySelector('.kms-status-bar > span').innerText = ``;
                kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('hidden')
                document.getElementById('kmsWarningProgress').classList.add('hidden');
                document.getElementById('kmsWarningQuality').classList.add('hidden');
            } else {
                if (element) {
                    element.click();
                } else {
                    const link = document.createElement('a');
                    link.id = `fileData-${fileid}`
                    link.classList = `hidden`
                    link.href = fastAccess;
                    link.setAttribute('download', filename);
                    link.click();
                }
            }
        } else if (storedFile) {
            const previousJob = storedFile;
            const href = (element) ? element.href : (storedFile.href) ? storedFile.href : false;
            if (downloadPreemptive) {
                console.log(`File ${filename} is ready`)
            } else if (previousJob.play === 'audio') {
                PlayTrack(href);
            } else if (previousJob.play === 'video') {
                $('#videoBuilderModal').modal('hide');
                const videoPlayer = videoModel.querySelector('video')
                if (!videoPlayer.paused)
                    memoryVideoPositions.set(previousJob.id, videoPlayer.currentTime);
                videoPlayer.pause();
                PlayVideo(href, `${previousJob.channel}/${previousJob.name} (${previousJob.size})`, fileid);
            } else if (previousJob.play === 'kms-video') {
                const kmsprogress = _post.getAttribute('data-kms-progress');
                kongouMediaVideoFull.src = href;
                try { await kongouMediaVideoFull.play(); } catch (err) { console.error(err); }
                kongouMediaVideoPreview.pause()
                kongouMediaVideoPreview.classList.add('hidden');
                kongouMediaVideoFull.classList.remove('hidden');
                if (memoryVideoPositions.has(previousJob.id)) {
                    const time = memoryVideoPositions.get(previousJob.id)
                    if ((time / kongouMediaVideoFull.duration).toFixed(1) <= 0.9) {
                        kongouMediaVideoFull.currentTime = memoryVideoPositions.get(previousJob.id)
                    } else {
                        console.log(`Video Progress was to to deep, Restarting from the beginning`);
                    }
                } else if (kmsprogress && !isNaN(parseFloat(kmsprogress)) && parseFloat(kmsprogress) > 0.05) {
                    if (parseFloat(kmsprogress) <= 0.9) {
                        kongouMediaVideoFull.currentTime = kongouMediaVideoFull.duration * parseFloat(kmsprogress)
                    } else {
                        console.log(`Video Progress was to to deep, Restarting from the beginning`);
                    }
                } else if (kmsPreviewLastPostion && kmsPreviewLastPostion < kongouMediaVideoFull.duration) {
                    if (kmsPreviewLastPostion - kongouMediaVideoPreview.currentTime < 5) {
                        kongouMediaVideoFull.currentTime = kongouMediaVideoPreview.currentTime;
                    } else {
                        kongouMediaVideoFull.currentTime = kmsPreviewLastPostion;
                    }
                }
                kmsPreviewLastPostion = null;
                clearInterval(kmsPreviewInterval)
                kmsPreviewInterval = null;
                kmsPreviewPrematureEnding = false;
                kongouControlsSeekUnavalible.classList.remove('no-seeking');
                kongouMediaPlayer.querySelector('.kms-status-bar > span').innerText = ``;
                kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('hidden')
                document.getElementById('kmsWarningProgress').classList.add('hidden');
                document.getElementById('kmsWarningQuality').classList.add('hidden');
            } else {
                if (element) {
                    element.click();
                } else {
                    const link = document.createElement('a');
                    link.id = `fileData-${previousJob.id}`
                    link.classList = `hidden`
                    link.href = href;
                    link.setAttribute('download', previousJob.filename);
                    link.click();
                }
            }
        } else if (downloadSpannedController.size === 0 && !activeSpannedJob) {
            downloadSpannedController.set(fileid, {
                id: fileid,
                name: filename,
                size: filesize,
                channel: channelString,
                preemptive: downloadPreemptive,
                offline: offlineFile,
                pending: true,
                ready: true,
                play: playThis
            })
            if (downloadPreemptive) {
                console.log(`Preemptive Download for ${filename}`);
            } else if (playThis === 'kms-video' && !downloadPreemptive) {
                const kmsprogress = _post.getAttribute('data-kms-progress');
                if (kmsprogress && !isNaN(parseFloat(kmsprogress)) && parseFloat(kmsprogress) > 0.05) {
                    document.getElementById('kmsWarningProgress').classList.remove('hidden');
                }
                document.getElementById('kmsWarningQuality').classList.remove('hidden');
            } else if (!playThis || playThis !== 'video') {
                $.toast({
                    type: 'success',
                    title: 'Unpack File',
                    subtitle: 'Now',
                    content: `File is unpacking, check active jobs for progress`,
                    delay: 5000,
                });
            }
            updateNotficationsPanel();
            notificationControler = setInterval(updateNotficationsPanel, 1000);
            while (downloadSpannedController.size !== 0) {
                const itemToGet = Array.from(downloadSpannedController.keys())[0]
                activeSpannedJob = downloadSpannedController.get(itemToGet)
                if (activeSpannedJob.ready && activeSpannedJob.pending) {
                    const download = await unpackFile();
                    if (download) {
                        if (downloadPreemptive && offlineFile) {
                            console.log(`File ${filename} is ready`)
                        } else {
                            memorySpannedController.push(activeSpannedJob);
                            const element = document.getElementById(`fileData-${activeSpannedJob.id}`);
                            if (element && !downloadPreemptive) {
                                if (activeSpannedJob.play) {
                                    console.log(`Launching File...`)
                                    if (activeSpannedJob.play === 'audio') {
                                        PlayTrack(element.href);
                                    } else if (activeSpannedJob.play === 'video') {
                                        $('#videoBuilderModal').modal('hide');
                                        const videoPlayer = videoModel.querySelector('video')
                                        videoPlayer.pause();
                                        memoryVideoPositions.set(activeSpannedJob.id, videoPlayer.currentTime);
                                        PlayVideo(element.href, `${activeSpannedJob.channel}/${activeSpannedJob.name} (${activeSpannedJob.size})`, activeSpannedJob.id);
                                    } else if (activeSpannedJob.play === 'kms-video') {
                                        const kmsprogress = _post.getAttribute('data-kms-progress');
                                        if (kongouMediaVideoPreview.currentTime !== kongouMediaVideoPreview.duration)
                                            memoryVideoPositions.set(activeSpannedJob.id, kongouMediaVideoPreview.currentTime);
                                        kongouMediaVideoFull.src = element.href;
                                        kongouMediaVideoFull.volume = 0;
                                        try {
                                            await kongouMediaVideoFull.play();
                                        } catch (err) {
                                            console.error(err)
                                        }
                                        ;

                                        if (kmsprogress && !isNaN(parseFloat(kmsprogress)) && parseFloat(kmsprogress) > 0.05 && parseFloat(kmsprogress) <= 0.9) {
                                            kongouMediaVideoFull.currentTime = (kongouMediaVideoFull.duration * parseFloat(kmsprogress));
                                        } else if (kmsPreviewLastPostion && kmsPreviewLastPostion < kongouMediaVideoFull.duration) {
                                            if (!kmsPreviewPrematureEnding && kongouMediaVideoPreview.currentTime && kmsPreviewLastPostion < 5) {
                                                kongouMediaVideoFull.currentTime = kongouMediaVideoPreview.currentTime;
                                            } else {
                                                kongouMediaVideoFull.currentTime = kmsPreviewLastPostion;
                                            }
                                        }
                                        setTimeout(async () => {
                                            if (kongouMediaVideoPreview.paused && !kmsPreviewPrematureEnding) {
                                                kongouMediaVideoFull.pause();
                                            } else if (kongouMediaVideoFull.paused) {
                                                try {
                                                    await kongouMediaVideoFull.play();
                                                } catch (err) {
                                                    console.error(err);
                                                }
                                            }
                                            kongouMediaVideoPreview.pause();
                                            kongouMediaVideoPreview.classList.add('hidden');
                                            kongouMediaVideoFull.volume = kongouMediaVideoPreview.volume
                                            kmsPreviewLastPostion = null;
                                            kmsPreviewPrematureEnding = false;
                                            clearInterval(kmsPreviewInterval)
                                            kmsPreviewInterval = null;
                                            kongouMediaVideoFull.classList.remove('hidden');
                                            kongouControlsSeekUnavalible.classList.remove('no-seeking');
                                            document.getElementById('kmsWarningProgress').classList.add('hidden');
                                            document.getElementById('kmsWarningQuality').classList.add('hidden');
                                        }, 100);
                                    } else {
                                        console.error('No Datatype was provided')
                                    }
                                } else {
                                    element.click();
                                }
                            } else {
                                console.error('Data lost!')
                            }
                        }
                    }
                }
                downloadSpannedController.delete(itemToGet);

                console.log(`Job Complete: ${downloadSpannedController.size} Jobs Left`)
            }
            activeSpannedJob = false;
        } else if (!downloadSpannedController.has(fileid)) {
            downloadSpannedController.set(fileid, {
                id: fileid,
                name: filename,
                size: filesize,
                channel: channelString,
                preemptive: downloadPreemptive,
                offline: offlineFile,
                pending: true,
                ready: true,
                play: playThis
            })
            if (!playThis || (playThis && playThis !== 'video' && !downloadPreemptive)) {
                $.toast({
                    type: 'success',
                    title: 'Unpack File',
                    subtitle: 'Now',
                    content: `File is added to unpack queue`,
                    delay: 5000,
                });
            }
        } else if (!downloadPreemptive) {
            $.toast({
                type: 'warning',
                title: 'Unpack File',
                subtitle: 'Now',
                content: `File is already added to queued`,
                delay: 5000,
            });
        }
    }
}
async function openPreviewUnpacking(messageid) {
    const _post = document.getElementById(`message-${messageid}`);
    const fileid = _post.getAttribute('data-msg-fileid');
    const filename = _post.getAttribute('data-msg-filename');
    const filesize = _post.getAttribute('data-msg-filesize');
    const channelString = _post.getAttribute('data-msg-channel-string');
    const previewURL = _post.getAttribute('data-msg-url-preview');
    const fullURL = _post.getAttribute('data-msg-url-full');

    const element = document.getElementById(`fileData-${fileid}`);
    const memoryJobIndex = memorySpannedController.filter(e => e.id === fileid)
    const storedFile = (element && memoryJobIndex.length > 0) ? memoryJobIndex[0] : await getSpannedFileIfAvailable(fileid)
    const href = (element) ? element.href : (storedFile.href) ? storedFile.href : false;
    if (element && memoryJobIndex.length > 0) {
        PlayVideo(element.href, `${activeSpannedJob.channel}/${activeSpannedJob.name} (${activeSpannedJob.size})`, fileid);
    } else if (storedFile) {
        PlayVideo(href, `${storedFile.channel}/${storedFile.name} (${storedFile.size})`, fileid);
    } else {
        const videoModel = document.getElementById('videoBuilderModal');
        videoModel.querySelector('span.status-text').innerText = `${filename} (${filesize})`;
        videoModel.querySelector('.progress > .progress-bar').style.width = "0%";
        videoModel.querySelector('.progress > .progress-bar').classList.add('bg-success');
        videoModel.querySelector('.progress > .progress-bar').classList.remove('bg-danger');
        videoModel.querySelector('.modal-footer button').classList.add('btn-secondary');
        videoModel.querySelector('.modal-footer button').classList.remove('btn-danger');
        videoModel.querySelector('.modal-footer a').classList.remove('disabled');
        videoModel.setAttribute('pendingMessage', messageid);
        const videoPlayer = videoModel.querySelector('video')
        const imagePreview = videoModel.querySelector('img')

        if (fullURL && fullURL.endsWith('.mp4')) {
            videoPlayer.src = fullURL;
            try {
                videoPlayer.play();
            } catch (err) { console.error(err); }
            videoPlayer.classList.remove('hidden');
            imagePreview.classList.add('hidden');
        } else if (previewURL && previewURL.endsWith('.mp4')) {
            videoPlayer.src = previewURL;
            try {
                videoPlayer.play();
            } catch (err) { console.error(err); }
            videoPlayer.classList.remove('hidden');
            imagePreview.classList.add('hidden');
        } else if (fullURL) {
            imagePreview.src = fullURL;
            videoPlayer.classList.add('hidden');
            imagePreview.classList.remove('hidden');
        } else if (previewURL) {
            imagePreview.src = previewURL;
            videoPlayer.classList.add('hidden');
            imagePreview.classList.remove('hidden');
        } else {
            imagePreview.classList.add('hidden');
            videoPlayer.classList.add('hidden');
            console.log('No Preview');
        }
        $('#videoBuilderModal').modal('show');
    }
}
async function openKMSPlayer(messageid, seriesId) {
    $('#userMenu').collapse('hide');
    kongouControlsSeek.classList.add('hidden');
    kongouControlsSeekUnavalible.classList.add('no-seeking');
    const _post = document.getElementById(`message-${messageid}`);
    const fileid = _post.getAttribute('data-msg-fileid');
    const filename = _post.getAttribute('data-msg-filename');
    const filesize = _post.getAttribute('data-msg-filesize');
    const channelString = _post.getAttribute('data-msg-channel-string');
    const previewURL = _post.getAttribute('data-msg-url-preview');
    const fullURL = _post.getAttribute('data-msg-url-full');
    const active = kongouMediaPlayer.getAttribute('activePlayback');
    const show = (seriesId) ? seriesId : kongouMediaPlayer.getAttribute('showId')
    const nextEpisodeGroup = document.getElementById('kongouMediaPlayerNext')
    const prevEpisodeGroup = document.getElementById('kongouMediaPlayerPrev')
    const currentEpisode = document.getElementById('kongouMediaPlayerCurrent')
    const playerOpen = document.querySelector('body').classList.contains('kms-play-open');

    if (show && document.getElementById(`seasonsAccordion-${show}`)) {
        try {
            const allEpisodes = Array.from(document.getElementById(`seasonsAccordion-${show}`).querySelectorAll('.episode-row'));
            const index = allEpisodes.map(e => e.id).indexOf(`message-${messageid}`)
            const nextEpisode = allEpisodes.slice(index + 1);

            if (allEpisodes[index]) {
                currentEpisode.innerText = allEpisodes[index].querySelector('.episode-name > span').innerText;
            } else {
                currentEpisode.innerText = filename.split('.')[0];
            }

            if (nextEpisode.length > 0) {
                nextEpisodeGroup.querySelector('span').innerText = nextEpisode[0].querySelector('.episode-name > span').innerText;
                nextEpisodeGroup.classList.remove('hidden');
                kongouMediaPlayer.setAttribute('nextPlayback', nextEpisode[0].id.split('-').pop());
            } else {
                nextEpisodeGroup.querySelector('span').innerText = '';
                nextEpisodeGroup.classList.add('hidden')
                kongouMediaPlayer.removeAttribute('nextPlayback');
            }

            if (index > 0) {
                const prevEpisode = allEpisodes.slice(0, index);
                if (prevEpisode.length > 0) {
                    prevEpisodeGroup.querySelector('span').innerText = prevEpisode.slice().pop().querySelector('.episode-name > span').innerText;
                    prevEpisodeGroup.classList.remove('hidden')
                    kongouMediaPlayer.setAttribute('prevPlayback', prevEpisode.slice().pop().id.split('-').pop());
                } else {
                    prevEpisodeGroup.querySelector('span').innerText = '';
                    prevEpisodeGroup.classList.add('hidden')
                    kongouMediaPlayer.removeAttribute('prevPlayback');
                }
            } else {
                prevEpisodeGroup.querySelector('span').innerText = '';
                prevEpisodeGroup.classList.add('hidden')
                kongouMediaPlayer.removeAttribute('prevPlayback');
            }
        } catch (e) {
            nextEpisodeGroup.querySelector('span').innerText = '';
            nextEpisodeGroup.classList.add('hidden')
            kongouMediaPlayer.removeAttribute('nextPlayback');
            prevEpisodeGroup.querySelector('span').innerText = '';
            prevEpisodeGroup.classList.add('hidden')
            kongouMediaPlayer.removeAttribute('prevPlayback');
            console.error("Could not get the rest of the episode list");
            console.error(e);
        }
    } else {
        nextEpisodeGroup.querySelector('span').innerText = '';
        nextEpisodeGroup.classList.add('hidden')
        kongouMediaPlayer.removeAttribute('nextPlayback');
        prevEpisodeGroup.querySelector('span').innerText = '';
        prevEpisodeGroup.classList.add('hidden')
        kongouMediaPlayer.removeAttribute('prevPlayback');
        currentEpisode.innerText = filename.split('.')[0];
    }

    if (!playerOpen) {
        //window.resizeTo(window.outerWidth, (window.outerHeight - window.innerHeight) + findHeight('16:9', window.outerWidth) - 8)
        document.querySelector('body').classList.add('kms-play-open');
        const mediaRule = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
        const mediaRule2 = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
        if (mediaRule)
            mediaRule.content = "#000"
        if (mediaRule2)
            mediaRule2.content = "#000"
    }
    kongouMediaPlayer.querySelector('.kms-status-bar > span').innerText = ''

    kongouMediaVideoPreview.classList.add('hidden');
    kongouMediaVideoFull.classList.add('hidden');

    kongouMediaPlayer.querySelector('.kms-progress-bar').style.width = "0%";
    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('bg-success');
    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.remove('bg-danger');
    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.remove('hidden');

    if (fullURL && fullURL.endsWith('.mp4')) {
        kongouMediaVideoPreview.src = fullURL;
        try {
            kongouMediaVideoPreview.play();
        } catch (err) { console.error(err); }
        kongouMediaVideoPreview.classList.remove('hidden');
    } else if (previewURL && previewURL.endsWith('.mp4')) {
        kongouMediaVideoPreview.src = previewURL;
        try {
            kongouMediaVideoPreview.play();
        } catch (err) { console.error(err); }
        kongouMediaVideoPreview.classList.remove('hidden');
    }/* else if (fullURL) {
        imagePreview.src = fullURL;
        kongouMediaVideoPreview.classList.add('hidden');
        imagePreview.classList.remove('hidden');
    } else if (previewURL) {
        imagePreview.src = previewURL;
        kongouMediaVideoPreview.classList.add('hidden');
        imagePreview.classList.remove('hidden');
    } else {
        imagePreview.classList.add('hidden');
        kongouMediaVideoPreview.classList.add('hidden');
        console.log('No Preview');
    }*/
    if (kmsPreviewInterval !== null) {
        clearInterval(kmsPreviewInterval);
        kmsPreviewInterval = null;
    }
    kmsPreviewInterval = setInterval(() => { kmsPreviewWatchdog(); }, 3000);
    kongouMediaVideoFull.pause();
    kongouMediaVideoFull.classList.add('hidden');
    if (!debugMode) {
        openUnpackingFiles(messageid, 'kms-video');
        if (active) {
            const _activePost = document.getElementById(`message-${active}`);
            if (_activePost) {
                const activeFileid = _activePost.getAttribute('data-msg-fileid');
                const element = document.getElementById(`fileData-${activeFileid}`);
                if (activeFileid) {
                    if (!element) {
                        console.log(`Canceling Active Unpacking...`)
                        stopUnpackingFiles(activeFileid);
                    } else {
                        removeCacheItem(activeFileid);
                    }
                }
            }
        }
    }
    if (show) {
        kongouMediaPlayer.setAttribute('showId', show);
    }
    kongouMediaPlayer.setAttribute('activePlayback', messageid);
    kongouMediaPlayer.setAttribute('activeFilename', filename);
    kongouMediaPlayer.setAttribute('activeFilesize', filesize);
    kongouMediaPlayer.removeAttribute('nextVideoReady');
    kmsPopUpControls();
}
async function kmsPlayNext() {
    const messageid = kongouMediaPlayer.getAttribute('nextPlayback');
    await saveCurrentTimeKMS(true);
    if (messageid)
        openKMSPlayer(messageid);
}
async function kmsPlayPrev() {
    const messageid = kongouMediaPlayer.getAttribute('prevPlayback');
    await saveCurrentTimeKMS();
    if (messageid)
        openKMSPlayer(messageid);
}
let kmsPreviewInterval = null;
let kmsPreviewLastPostion = null;
let kmsPreviewPrematureEnding = false;
async function kmsPreviewWatchdog() {
    if (kmsPreviewInterval !== null && !kongouMediaVideoPreview.paused && kongouMediaVideoPreview.currentTime - kmsPreviewLastPostion < 6) {
        kmsPreviewLastPostion = kongouMediaVideoPreview.currentTime;
        console.log(kmsPreviewLastPostion)
        kmsPreviewPrematureEnding = false;
    } else {
        console.log('Preview Video timecode changed to a unexpected time! Possibly reached end of preview')
        clearInterval(kmsPreviewInterval);
        kmsPreviewInterval = null;
        kmsPreviewPrematureEnding = true;
    }
}
async function saveCurrentTimeKMS(wasNext) {
    const messageid = kongouMediaPlayer.getAttribute('activePlayback');
    if (messageid && !kongouMediaVideoFull.classList.contains('hidden')) {
        const _post = document.getElementById(`message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        const eid = _post.getAttribute('data-msg-eid');
        const percentage = (kongouMediaVideoFull.currentTime / kongouMediaVideoFull.duration).toFixed(3);
        console.log(percentage);
        if (percentage > 0.05 && percentage <= 0.9) {
            memoryVideoPositions.set(fileid, kongouMediaVideoFull.currentTime);
        } else {
            memoryVideoPositions.delete(fileid);
        }
        setWatchHistory(eid, (wasNext) ? 1 : percentage)
    }
}
async function kmsScreenshot() {
    const videoPlayer = document.getElementById('kongouMediaVideoFull');
    const screenshotCanvas = document.getElementById('kongouScreenshot');
    const screenshotImages = document.getElementById('kongouScreenShots');
    const filenameBase = (kongouMediaPlayer.hasAttribute('activeFilename')) ? kongouMediaPlayer.getAttribute('activeFilename') : 'untitled-videoframe'
    const ratio = videoPlayer.videoWidth / videoPlayer.videoHeight;
    const currentVideoWidth = videoPlayer.videoWidth;
    const currentVideoHeight = parseInt(currentVideoWidth / ratio,10);
    screenshotCanvas.width = currentVideoWidth;
    screenshotCanvas.height = currentVideoHeight;
    const canvasCtx = screenshotCanvas.getContext('2d')
    canvasCtx.fillRect(0, 0, currentVideoWidth, currentVideoHeight);
    canvasCtx.drawImage(document.getElementById('kongouMediaVideoFull'), 0, 0, currentVideoWidth, currentVideoHeight);
    screenshotCanvas.toBlob((data) => {
        const url = window.URL.createObjectURL(data);
        const screenshotImageItem = document.createElement('a');
        screenshotImageItem.href = '#_';
        const idSs = 'screenshot-' + screenshotImages.childElementCount + 1
        screenshotImageItem.id = idSs;
        const timecode = parseFloat(kongouMediaVideoFull.currentTime.toString())
        screenshotImageItem.onclick = function (e) {
            window.URL.revokeObjectURL(document.getElementById(idSs).querySelector('img').src);
            document.getElementById(idSs).remove();
            e.preventDefault();
            return false;
        }
        const screenshotImageResult = document.createElement('img');
        screenshotImageResult.src = url;
        screenshotImageResult.setAttribute('download', `${filenameBase} (${screenshotImages.childElementCount + 1}).png`);
        document.getElementById('kongouScreenshotContainer').classList.remove('hidden');
        screenshotImageItem.appendChild(screenshotImageResult);
        screenshotImages.prepend(screenshotImageItem);
    }, 'image/png');

}
async function kmsSeek(frameMode, seekTime) {
    if (frameMode) {
        kongouMediaVideoFull.currentTime = kongouMediaVideoFull.currentTime + (((1 / 23.976) * 3) * seekTime)
    } else {
        kongouMediaVideoFull.currentTime = kongouMediaVideoFull.currentTime + seekTime
    }
}
async function kmsClearScreenshots() {
    document.getElementById('kongouScreenshotContainer').classList.add('hidden');
    const parent = document.getElementById('kongouScreenShots');
    Array.from(parent.querySelectorAll('img')).map(e => {
        window.URL.revokeObjectURL(e.src);
    })
    parent.innerHTML = '';
}
async function kmsSaveScreenshots() {
    Array.from(document.getElementById("kongouScreenShots").querySelectorAll('img')).map(e => {
        console.log(e.src);
        const link = document.createElement('a');
        link.href = e.src;
        link.setAttribute('download', (e.hasAttribute('download') ? e.getAttribute('download') : 'video-capture.png'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    })
}
async function kmsUploadScreenshots() {
    let container = new DataTransfer();
    await Promise.all(Array.from(document.getElementById("kongouScreenShots").querySelectorAll('img')).map(async e => {
        let file = await fetch(e.src)
            .then(r => r.blob())
            .then(blobFile => new File([blobFile], (e.hasAttribute('download') ? e.getAttribute('download') : 'video-capture.png'), { type: "image/png", lastModified:new Date().getTime() }))
        container.items.add(file);
    }))
    document.getElementById('customFile').files = container.files;
    document.getElementById('customFile').dispatchEvent(new Event('change', { 'preset': true }))
    displayUploadModel();
}
async function getFrameRate(video_elem){
    return await new Promise((resolve) => {
        function getframerat() {
            setTimeout(function(){
                let getframerates = video_elem.getVideoPlaybackQuality().totalVideoFrames;
                setTimeout(function(){
                    getframerates = video_elem.getVideoPlaybackQuality().totalVideoFrames - getframerates;
                    //assuming frame rates are always even.
                    if(getframerates > 5) getframerat();
                    else resolve(getframerates);
                },1000)
            },1000)
        }
        getframerat();
    })
}
let kmsStageMouseTimeout = null;
async function kmsPopUpControls() {
    if (kongouTitleBar.style.opacity === '0' )
        kongouControlsJQ.fadeTo(500, 1)
    clearTimeout(kmsStageMouseTimeout);
    kmsStageMouseTimeout = setTimeout(() => {
        $('.kms-stage:not(.keep-active-controls) .kms-title-bar, .kms-stage:not(.keep-active-controls, .advanced-controls) .kms-bottom-bar').fadeTo(1000, 0);
    }, 5000);
    return false;
}
function toggleFullscreen() {
    const isFullscreen = document.webkitIsFullScreen || document.mozFullScreen || false;
    kongouMediaPlayer.requestFullScreen = kongouMediaPlayer.requestFullScreen || kongouMediaPlayer.webkitRequestFullScreen || kongouMediaPlayer.mozRequestFullScreen || function () { return false; };
    document.cancelFullScreen = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || function () { return false; };
    isFullscreen ? document.cancelFullScreen() : kongouMediaPlayer.requestFullScreen();
}
async function closeKMSPlayer() {
    document.cancelFullScreen = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || function () { return false; };
    if (document.webkitIsFullScreen || document.mozFullScreen)
        document.cancelFullScreen();
    const messageid = kongouMediaPlayer.getAttribute('activePlayback');
    const nextMessageid = kongouMediaPlayer.getAttribute('nextPlayback');
    await saveCurrentTimeKMS();
    if (messageid) {
        const _post = document.getElementById(`message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        stopUnpackingFiles(fileid);
    }
    if (nextMessageid) {
        const _post = document.getElementById(`message-${nextMessageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        stopUnpackingFiles(fileid);
    }
    kongouMediaVideoPreview.pause();
    kongouMediaVideoFull.pause();
    document.querySelector('body').classList.remove('kms-play-open');
    clearInterval(kmsVideoWatcher); kmsVideoWatcher = null;
    kongouMediaVideoPreview.classList.add('hidden');
    kongouMediaVideoFull.classList.add('hidden');
    kongouMediaPlayer.removeAttribute('activePlayback');
    kongouMediaPlayer.removeAttribute('nextVideoReady');
    kongouMediaPlayer.removeAttribute('nextPlayback');
    kongouMediaPlayer.removeAttribute('prevPlayback');
}
async function checkKMSTimecode() {
    const messageid = kongouMediaPlayer.getAttribute('nextPlayback');
    const isReady = kongouMediaPlayer.getAttribute('nextVideoReady');
    if (messageid && document.querySelector('body').classList.contains('kms-play-open') &&
    !kongouMediaVideoFull.classList.contains('hidden')) {
        await saveCurrentTimeKMS();
        if (!isReady && ((kongouMediaVideoFull.currentTime / kongouMediaVideoFull.duration) >= 0.55)) {
            kongouMediaPlayer.setAttribute('nextVideoReady', 'true');
            openUnpackingFiles(messageid, 'kms-video', true);
        }
    }
}
async function searchSeriesList(obj) {
    const _q = obj.value.toLowerCase().trim();
    if (_q.length > 2) {
        search_list.forEach(e => {
            if (e.includes(_q)) {
                document.getElementById(e.split(' -- ')[0].trim()).classList.remove('hidden');
            } else {
                document.getElementById(e.split(' -- ')[0].trim()).classList.add('hidden');
            }
        })
    } else {
        element_list.forEach(e => e.classList.remove('hidden'))
    }
}

async function startPendingUnpack() {
    const videoModel = document.getElementById('videoBuilderModal');
    const messageid = videoModel.getAttribute('pendingMessage');
    videoModel.querySelector('.modal-footer button').classList.remove('btn-secondary');
    videoModel.querySelector('.modal-footer button').classList.add('btn-danger');
    videoModel.querySelector('.modal-footer a').classList.add('disabled');

    openUnpackingFiles(messageid, 'video');
}
async function cancelPendingUnpack() {
    const videoModel = document.getElementById('videoBuilderModal');
    const messageid = videoModel.getAttribute('pendingMessage');
    const fileid = document.getElementById(`message-${messageid}`).getAttribute('data-msg-fileid');
    videoModel.querySelector('video').pause();
    stopUnpackingFiles(fileid);
    $('#videoBuilderModal').modal('hide');
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
async function unpackFile() {
    if (activeSpannedJob && activeSpannedJob.id && activeSpannedJob.pending && activeSpannedJob.ready) {
        console.log(`Downloading File ${activeSpannedJob.id}...`)
        activeSpannedJob.pending = false;
        const videoModel = document.getElementById('videoBuilderModal');
        const videoStatus = videoModel.querySelector('span.status-text');
        const videoProgress = videoModel.querySelector('.progress > .progress-bar');
        const kmsStatus = kongouMediaPlayer.querySelector('.kms-status-bar > span');
        const kmsProgress = kongouMediaPlayer.querySelector('.kms-progress-bar');

        videoStatus.innerText = 'Getting Parity Metadata...';
        return await new Promise(async (job) => {
            $.ajax({
                async: true,
                url: `/parity/${activeSpannedJob.id}`,
                type: "GET",
                data: '',
                processData: false,
                contentType: false,
                headers: {
                    'X-Requested-With': 'SequenziaXHR',
                    'x-Requested-Page': 'SeqClientUnpacker'
                },
                success: async function (response, textStatus, xhr) {
                    if (xhr.status < 400) {
                        try {
                            activeSpannedJob = {
                                ...response,
                                ...activeSpannedJob,
                                progress: '0%',
                                abort: new AbortController(),
                                blobs: []
                            };

                            console.log(activeSpannedJob)
                            if (activeSpannedJob.parts && activeSpannedJob.parts.length > 0 && activeSpannedJob.expected_parts) {
                                if (activeSpannedJob.parts.length === activeSpannedJob.expected_parts) {
                                    videoStatus.innerText = `Expecting ${activeSpannedJob.expected_parts} Parts`;
                                    let pendingBlobs = {}
                                    activeSpannedJob.parts.map((e,i) => {
                                        pendingBlobs[i] = e;
                                    })
                                    function calculatePercent() {
                                        const percentage = (Math.abs((Object.keys(pendingBlobs).length - activeSpannedJob.parts.length) / activeSpannedJob.parts.length)) * 100
                                        activeSpannedJob.progress = `${percentage.toFixed(0)}%`;
                                        if (activeSpannedJob.play === 'video') {
                                            videoStatus.innerText = `Downloaded ${activeSpannedJob.blobs.length} Blocks, ${activeSpannedJob.parts.length - activeSpannedJob.blobs.length} Pending`;
                                            videoProgress.style.width = activeSpannedJob.progress;
                                        } else if (activeSpannedJob.play === 'kms-video') {
                                            kmsStatus.innerText = `Downloaded ${activeSpannedJob.blobs.length}/${activeSpannedJob.parts.length - activeSpannedJob.blobs.length} Blocks`;
                                            kmsProgress.style.width = activeSpannedJob.progress;
                                        }
                                    }
                                    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.remove('hidden');
                                    while (Object.keys(pendingBlobs).length !== 0) {
                                        if (!activeSpannedJob.ready)
                                            break;
                                        let downloadKeys = Object.keys(pendingBlobs).slice(0,8)
                                        const results = await Promise.all(downloadKeys.map(async item => {
                                            return new Promise(ok => {
                                                axios({
                                                    url: pendingBlobs[item],
                                                    method: 'GET',
                                                    signal: activeSpannedJob.abort.signal,
                                                    responseType: 'blob'
                                                })
                                                    .then((block) => {
                                                        console.log(`Downloaded Parity ${item}`)
                                                        activeSpannedJob.blobs[item] = block.data;
                                                        calculatePercent();
                                                        delete pendingBlobs[item];
                                                        ok(true);
                                                    })
                                                    .catch(e => {
                                                        console.error(`Failed Parity ${item} - ${e.message}`)
                                                        if (activeSpannedJob)
                                                            activeSpannedJob.ready = false;
                                                        ok(false);
                                                    })
                                            })
                                        }))
                                        if (results.filter(e => !e).length > 0)
                                            break;
                                    }

                                    if (activeSpannedJob && activeSpannedJob.blobs.length === activeSpannedJob.expected_parts) {
                                        activeSpannedJob.progress = `100%`;
                                        let blobType = {}
                                        if (activeSpannedJob.play === 'video' || activeSpannedJob.play === 'kms-video' || videoFiles.indexOf(activeSpannedJob.filename.split('.').pop().toLowerCase().trim()) > -1)
                                            blobType.type = 'video/' + activeSpannedJob.filename.split('.').pop().toLowerCase().trim();
                                        if (activeSpannedJob.play === 'audio' || audioFiles.indexOf(activeSpannedJob.filename.split('.').pop().toLowerCase().trim()) > -1)
                                            blobType.type = 'audio/' + activeSpannedJob.filename.split('.').pop().toLowerCase().trim();

                                        const finalBlock = new Blob(activeSpannedJob.blobs, blobType);
                                        if (browserStorageAvailable && activeSpannedJob.offline) {
                                            try {
                                                offlineContent.transaction([`spanned_files`], "readwrite").objectStore('spanned_files').add({
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
                                                    console.log(event);
                                                    console.log(`File Saved Offline!`);
                                                };
                                            } catch (e) {
                                                console.error(`Failed to save block ${activeSpannedJob.id}`);
                                                console.error(e);
                                            }
                                        }
                                        if (!(activeSpannedJob.offline && activeSpannedJob.preemptive)) {
                                            const finalUrl = window.URL.createObjectURL(finalBlock)
                                            tempURLController.set(activeSpannedJob.id, finalUrl);
                                            const downloadedFile = finalUrl;
                                            const link = document.createElement('a');
                                            link.id = `fileData-${activeSpannedJob.id}`
                                            link.classList = `hidden`
                                            link.href = downloadedFile;
                                            link.setAttribute('download', activeSpannedJob.filename);
                                            document.body.appendChild(link);
                                        }

                                        if (activeSpannedJob && activeSpannedJob.play === 'video') {
                                            videoStatus.innerText = `All Blocks Downloaded! Processing Blocks...`;
                                        } else if (activeSpannedJob && activeSpannedJob.play === 'kms-video') {
                                            kmsStatus.innerText = ``;
                                            kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('hidden')
                                        } else if (!activeSpannedJob.preemptive) {
                                            $.toast({
                                                type: 'success',
                                                title: 'Unpack File',
                                                subtitle: 'Now',
                                                content: `File was unpacked successfully<br/>${activeSpannedJob.filename}`,
                                                delay: 15000,
                                            });
                                        }
                                        job(true);
                                    } else {
                                        if (activeSpannedJob && activeSpannedJob.play === 'video') {
                                            videoStatus.innerText = `Failed, Not all blocks where downloaded`;
                                            videoProgress.classList.remove('bg-success');
                                            videoProgress.classList.add('bg-danger');
                                        } else if (activeSpannedJob && activeSpannedJob.play === 'kms-video') {
                                            kmsStatus.innerText = `Cannot Play Full Video: Not all blocks where downloaded!`;
                                            kmsProgress.classList.remove('bg-success');
                                            kmsProgress.classList.add('bg-danger');
                                        } else {
                                            $.toast({
                                                type: 'error',
                                                title: 'Unpack File',
                                                subtitle: 'Now',
                                                content: `Missing a downloaded parity file, Retry to download!`,
                                                delay: 15000,
                                            });
                                        }
                                        job(false);
                                    }
                                } else {
                                    if (activeSpannedJob.play === 'video') {
                                        videoStatus.innerText = `File is damaged or is missing parts, please report to the site administrator!`;
                                        videoProgress.classList.remove('bg-success');
                                        videoProgress.classList.add('bg-danger');
                                    } else if (activeSpannedJob.play === 'kms-video') {
                                        kmsStatus.innerText = `File is damaged or is missing blocks!`;
                                        kmsProgress.classList.remove('bg-success');
                                        kmsProgress.classList.add('bg-danger');
                                    } else  {
                                        $.toast({
                                            type: 'error',
                                            title: 'Unpack File',
                                            subtitle: 'Now',
                                            content: `File is damaged or is missing parts, please report to the site administrator!`,
                                            delay: 15000,
                                        });
                                    }
                                    job(false);
                                }
                            } else {
                                if (activeSpannedJob.play === 'video') {
                                    videoStatus.innerText = `Failed to read the metadata, please report to the site administrator!`;
                                    videoProgress.classList.remove('bg-success');
                                    videoProgress.classList.add('bg-danger');
                                } else if (activeSpannedJob.play === 'kms-video') {
                                    kmsStatus.innerText = `Cannot to read the metadata, please report to the site administrator!`;
                                    kmsProgress.classList.remove('bg-success');
                                    kmsProgress.classList.add('bg-danger');
                                } else {
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `Failed to read the parity metadata response!`,
                                        delay: 15000,
                                    });
                                }
                                job(false);
                            }
                        } catch (e) {
                            console.error(e);
                            if (activeSpannedJob.play === 'video') {
                                videoStatus.innerText = `Handler Failure: ${e.message}`;
                                videoProgress.classList.remove('bg-success');
                                videoProgress.classList.add('bg-danger');
                            } else if (activeSpannedJob.play === 'kms-video') {
                                kmsStatus.innerText = `Handler Failure: ${e.message}`;
                                kmsProgress.classList.remove('bg-success');
                                kmsProgress.classList.add('bg-danger');
                            } else  {
                                $.toast({
                                    type: 'error',
                                    title: 'Unpack File',
                                    subtitle: 'Now',
                                    content: `File Handeler Fault!<br/>${e.message}`,
                                    delay: 15000,
                                });
                            }
                            job(false);
                        }
                    } else {
                        if (activeSpannedJob.play === 'video') {
                            videoStatus.innerText = `Server Error: ${response}`;
                            videoProgress.classList.remove('bg-success');
                            videoProgress.classList.add('bg-danger');
                        } else if (activeSpannedJob.play === 'kms-video') {
                            kmsStatus.innerText = `Server Error: ${response}`;
                            kmsProgress.classList.remove('bg-success');
                            kmsProgress.classList.add('bg-danger');
                        } else  {
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `File failed to unpack!<br/>${response}`,
                                delay: 15000,
                            });
                        }
                        job(false);
                    }
                    if (activeSpannedJob) {
                        delete activeSpannedJob.blobs
                        delete activeSpannedJob.parts
                    }
                },
                error: function (xhr) {
                    if (activeSpannedJob.play === 'video') {
                        videoStatus.innerText = `Server Error: ${xhr.responseText}`;
                        videoProgress.classList.remove('bg-success');
                        videoProgress.classList.add('bg-danger');
                    } else if (activeSpannedJob.play === 'kms-video') {
                        kmsStatus.innerText = `Server Error: ${xhr.responseText}`;
                        kmsProgress.classList.remove('bg-success');
                        kmsProgress.classList.add('bg-danger');
                    } else  {
                        $.toast({
                            type: 'error',
                            title: 'Unpack File',
                            subtitle: 'Now',
                            content: `File failed to unpack!<br/>${xhr.responseText}`,
                            delay: 15000,
                        });
                    }
                    delete activeSpannedJob.blobs
                    delete activeSpannedJob.parts
                    console.error(xhr.responseText);
                    job(false);
                }
            });
        })
    } else {
        return false
    }
}

async function updateNotficationsPanel() {
    if (downloadSpannedController.size !== 0 || offlineDownloadController.size !== 0 || memorySpannedController.length > 0) {
        const keys = Array.from(downloadSpannedController.keys()).map(e => {
            const item = downloadSpannedController.get(e);
            if (item.ready) {
                let results = [`<a class="dropdown-item text-ellipsis" style="max-width: 80vw;" title="Stop Extraction of this job" href='#_' onclick="stopUnpackingFiles('${e}'); return false;" role='button')>`]
                if (!item.pending) {
                    results.push(`<i class="fas fa-spinner text-success pr-2"></i>`);
                    results.push(`<span>${item.name} (${item.size})</span>`);
                    if (activeSpannedJob && activeSpannedJob.progress) {
                        results.push(`<span class="pl-2 text-success">${activeSpannedJob.progress}</span>`);
                    }
                } else {
                    results.push(`<span>${item.name} (${item.size})</span>`)
                }
                results.push(`</a>`);
                return results.join('\n');
            } else {
                return `<span>${item.name} (${item.size})</span>`
            }
        })
        const offlineKeys = Array.from(offlineDownloadController.keys()).map(e => {
            const item = offlineDownloadController.get(e);
            let results = [`<a class="dropdown-item text-ellipsis" style="max-width: 80vw;" title="Stop Extraction of this job" href='#_' role='button' onclick="offlineDownloadController.delete('${e}'); return false;")>`]
            results.push(`<i class="fas fa-cloud-download text-success pr-2"></i>`);
            results.push(`<span>${(item.title) ? item.title : e} (${item.totalItems})</span>`);
            results.push(`<span class="pl-2 text-success">${((item.downloaded / item.totalItems) * 100).toFixed(0)}%</span>`);
            results.push(`</a>`);
            return results.join('\n');
        })
        let completedKeys = [];
        if (memorySpannedController.length > 0) {
            if (keys.length > 0)
                completedKeys.push(`<div class="dropdown-divider"></div>`);
            completedKeys.push(...memorySpannedController.map(item => {
                let results = [];
                const element = document.getElementById(`fileData-${item.id}`);
                results.push(`<div style="padding: 0.5em 1.25em; display: flex; max-width: 87vw;">`)
                if (item.play) {
                    let clickAction = undefined;
                    if (item.play === 'video' || item.play === 'kms-video') {
                        clickAction = `PlayVideo('${element.href}', '${item.channel}/${item.name} (${item.size})', '${item.id}');`
                    } else if (item.play === 'audio') {
                        clickAction = `PlayTrack('${element.href}');`
                        clickAction = `PlayTrack('${element.href}');`
                    }
                    results.push(`<a class="text-ellipsis mr-auto" style="max-width: 80vw;"  title="Play File" href='#_' onclick="${clickAction} return false;" role='button')>`);
                } else {
                    results.push(`<a class="text-ellipsis mr-auto" style="max-width: 80vw;"  title="Save File" href="${element.href}" role='button')>`);
                }
                if (item.play) {
                    if (item.play === 'video' || item.play === 'kms-video') {
                        results.push(`<i class="fas fa-film mr-1"></i>`)
                    } else if (item.play === 'audio') {
                        results.push(`<i class="fas fa-music mr-1"></i>`)
                    } else {
                        results.push(`<i class="fas fa-file mr-1"></i>`)
                    }
                }
                results.push(`<span>${item.name} (${item.size})</span>`)
                if (item.play) {
                    results.push(`</a>`);
                    results.push(`<a title="Save File" href='#_' onclick="document.getElementById('fileData-${item.id}').click(); return false;">`);
                    results.push(`<i class="fas fa-download px-2"></i>`)
                    results.push(`</a>`);
                }
                results.push(`</a>`);
                results.push(`<a title="Remove File from Memory" href='#_' onclick="removeCacheItem('${item.id}'); return false;">`);
                results.push(`<i class="fas fa-trash-alt px-2"></i>`)
                results.push(`</a>`);
                results.push(`</div>`)
                return results.join('\n');
            }))
        }
        /*if (offlineFiles.length > 0) {
            if (keys.length > 0)
                completedKeys.push(`<div class="dropdown-divider"></div>`);
            completedKeys.push(...offlineFiles.map(item => {
                let results = [];
                const element = document.getElementById(`fileData-${item.id}`);
                results.push(`<div style="padding: 0.5em 1.25em; display: flex; max-width: 87vw;">`)
                if (item.play) {
                    let clickAction = undefined;
                    if (item.play === 'video' || item.play === 'kms-video') {
                        clickAction = `PlayVideo('${item.href}', '${item.channel}/${item.name} (${item.size})', '${item.id}');`
                    } else if (item.play === 'audio') {
                        clickAction = `PlayTrack('${item.href}');`
                        clickAction = `PlayTrack('${item.href}');`
                    }
                    results.push(`<a class="text-ellipsis mr-auto" style="max-width: 80vw;"  title="Play File" href='#_' onclick="${clickAction} return false;" role='button')>`);
                } else {
                    results.push(`<a class="text-ellipsis mr-auto" style="max-width: 80vw;"  title="Save File" href="${item.href}" role='button')>`);
                }
                if (item.play) {
                    if (item.play === 'video' || item.play === 'kms-video') {
                        results.push(`<i class="fas fa-film mr-1"></i>`)
                    } else if (item.play === 'audio') {
                        results.push(`<i class="fas fa-music mr-1"></i>`)
                    } else {
                        results.push(`<i class="fas fa-file mr-1"></i>`)
                    }
                }
                results.push(`<span>${item.name} (${item.size})</span>`)
                if (item.play) {
                    results.push(`</a>`);
                    results.push(`<a title="Save File" href='#_' onclick="document.getElementById('fileData-${item.id}').click(); return false;">`);
                    results.push(`<i class="fas fa-download px-2"></i>`)
                    results.push(`</a>`);
                }
                results.push(`</a>`);
                results.push(`<a title="Remove File from Offline Storage" href='#_' onclick="removeCacheItem('${item.id}'); return false;">`);
                results.push(`<i class="fas fa-trash-alt px-2"></i>`)
                results.push(`</a>`);
                results.push(`</div>`)
                return results.join('\n');
            }))
        }*/
        if (document.getElementById('statusPanel')) {
            $('#statusPanel').removeClass('hidden');
            if (keys.length > 0 || offlineKeys.length > 0 || completedKeys.length > 0) {
                $('#statusPanel > .dropdown > .dropdown-menu').html($([...keys, ...offlineKeys, ...completedKeys].join('\n')));
                //$('#statusMenuProgress').html($(activeProgress.join('\n')));
                if (keys.length <= 9 && keys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-' + keys.length;
                } else if (keys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-ellipsis';
                } else if (offlineKeys.length <= 9 && offlineKeys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-' + offlineKeys.length;
                } else if (offlineKeys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-ellipsis';
                } else if (completedKeys.length <= 9 && completedKeys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-' + completedKeys.length;
                } else if (completedKeys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-ellipsis';
                }
            } else {
                $('#statusPanel > .dropdown > .dropdown-menu').html('<span class="dropdown-header">No Active Jobs</span>');
                document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-0';
            }
        }
        if (activeSpannedJob && activeSpannedJob.progress) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-laptop-arrow-down fa-fade';
        } else if (downloadSpannedController.size !== 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-cog fa-spin';
        } else if (offlineKeys.length > 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-cloud-download fa-fade';
        } else if (memorySpannedController.length !== 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-memory';
            clearInterval(notificationControler);
            notificationControler = null;
        }
    } else {
        clearInterval(notificationControler);
        notificationControler = null;
        if (document.getElementById('statusPanel')) {
            $('#statusPanel').addClass('hidden');
            $('#statusPanel > .dropdown > .dropdown-menu').html('<span class="dropdown-header">No Active Jobs</span>');
            $('#statusMenuProgress').html('');
        }
    }
}
async function removeCacheItem(id, noupdate) {
    const file = await getSpannedFileIfAvailable(id);
    memorySpannedController = memorySpannedController.filter(e => e.id !== id);
    const link = document.getElementById('fileData-' + id);
    if (link) {
        window.URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
    } else if (file) {
        window.URL.revokeObjectURL(file.href);
    }
    if (file) {
        if (browserStorageAvailable) {
            const indexDBUpdate = offlineContent.transaction(["spanned_files"], "readwrite").objectStore("spanned_files").delete(id);
            indexDBUpdate.onsuccess = event => {
                if (!noupdate)
                    updateNotficationsPanel();
            };
        } else {
            $.toast({
                type: 'error',
                title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
                subtitle: '',
                content: `<p>Failed access offline storage databsae!</p>`,
                delay: 10000,
            });
        }
    } else if (!noupdate) {
        updateNotficationsPanel();
    }
}

async function showSearchOptions(post) {
    pageType = $.history.url().split('?')[0].substring(1);
    pageType = (pageType === 'tvTheater' || pageType === 'listTheater') ? 'files' : pageType;
    const _post = document.getElementById(`message-${post}`);
    const _model = document.getElementById('searchModal')
    const postChannel = _post.getAttribute('data-msg-channel');
    const postServer = _post.getAttribute('data-msg-server');
    const postChannelString = _post.getAttribute('data-msg-channel-string');
    const postChannelIcon = _post.getAttribute('data-msg-channel-icon');
    const postDisplayName = _post.getAttribute('data-msg-displayname');
    const postDownload = _post.getAttribute('data-msg-download');
    const postFilename = _post.getAttribute('data-msg-filename');
    const postFilID = _post.getAttribute('data-msg-fileid');
    const postCached = _post.getAttribute('data-msg-filecached') === 'true';
    const postEID = _post.getAttribute('data-msg-eid');
    const postID = _post.getAttribute('data-msg-id');
    const postDate = _post.getAttribute('data-msg-date');
    const postAuthorName = _post.getAttribute('data-msg-author');
    const postPreviewImage = _post.getAttribute('data-msg-url-preview');
    const postFullImage = _post.getAttribute('data-msg-url-full');
    const postAuthorImage = _post.getAttribute('data-msg-author-img');
    let postBody = _post.getAttribute('data-msg-bodyraw') + '';
    const postFlagged = _post.getAttribute('data-msg-flagged') + '' === 'true';
    const postIsVideo = _post.getAttribute('data-msg-isvideo') + '' === 'true';
    const postIsAudio = _post.getAttribute('data-msg-isaudio') + '' === 'true';
    const nsfwString = _post.getAttribute('data-nsfw-string');
    const manageAllowed = _post.getAttribute('data-msg-manage') + '' === 'true';

    const searchUser = _post.getAttribute('data-search-user');
    const searchParent = _post.getAttribute('data-search-parent');
    const searchColor = _post.getAttribute('data-search-color');
    const searchSource = _post.getAttribute('data-search-source');
    const resolutionRatio = _post.getAttribute('data-msg-res');
    const fileSize = _post.getAttribute('data-msg-filesize');

    const modalGoToPostLocation = document.getElementById(`goToPostLocation`);
    const modalSearchSelectedText = document.getElementById(`searchSelectedText`);
    const modalGoToHistoryDisplay = document.getElementById(`goToHistoryDisplay`);
    const modalDownloadButton = document.getElementById(`goToDownload`);
    const modalOfflineThisButton = document.getElementById(`makeOffline`);
    const modalPlayButton = document.getElementById(`goToPlay`);
    const modalGoToPostSource = document.getElementById(`goToPostSource`);
    const modalSearchByUser = document.getElementById(`searchByUser`);
    const modalSearchByParent = document.getElementById(`searchByParent`);
    const modalSearchByColor = document.getElementById(`searchByColor`);
    const modalSearchByID = document.getElementById(`searchByID`);
    const modalBodyRaw = document.getElementById(`rawBodyContent`);
    const modalInfoRaw = document.getElementById(`rawInfoContent`);
    const modalAuthorData = document.getElementById(`authorData`);
    const modalAdvRaw = document.getElementById(`advancedInfoBlock`);
    const modalToggleFav = document.getElementById(`toggleFavoritePost`);
    const modalAddFlag = document.getElementById(`addFlagPost`);
    const modalToggleAlbum = document.getElementById(`manageAlbumPost`);
    const modalFilename = document.getElementById(`infoFilename`);
    const modalMove = document.getElementById(`infoMove`);
    const modalDelete = document.getElementById(`infoDelete`);
    const modalRename = document.getElementById(`infoRename`);
    const modalEditText = document.getElementById(`infoEditText`);
    const modalCompile = document.getElementById(`infoCompile`);
    const modalDecompile = document.getElementById(`infoDecompile`);
    const modalRotate = document.getElementById(`infoRotae`);
    const modalReport = document.getElementById(`infoReport`);
    const modalRepair = document.getElementById(`infoRepair`);

    let normalInfo = [];
    let advancedInfo = [];

    document.getElementById('searchFilterCurrent').setAttribute('data-search-location', `${params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'cached', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount'], [])}`)
    document.getElementById('searchFilterPost').setAttribute('data-search-location', `${params([], [['channel', postChannel]], "/" + pageType)}`)
    document.getElementById('searchFilterEverywhere').setAttribute('data-search-location', `${params([], [], "/" + pageType)}`)

    advancedInfo.push(`<div><i class="fa fa-barcode pr-1"></i><span class="text-monospace" title="Kanmi/Sequenzia Unique Entity ID">${postEID}</span></div>`);
    advancedInfo.push(`<div><i class="fa fa-folder-tree pr-1"></i><span title="Sequenzia Folder Path">${postChannelString}/${postEID}</span></div>`);

    if (postPreviewImage) {
        if (postPreviewImage.split('?')[0].endsWith('.jpg') ||
            postPreviewImage.split('?')[0].endsWith('.jpeg') ||
            postPreviewImage.split('?')[0].endsWith('.jfif') ||
            postPreviewImage.split('?')[0].endsWith('.png') ||
            postPreviewImage.split('?')[0].endsWith('.gif') ||
            postPreviewImage.split('?')[0].endsWith('.webm')) {
            _model.querySelector('.modal-background').style.backgroundImage = `url("${postPreviewImage}")`
        } else {
            _model.querySelector('.modal-background').style.backgroundImage = undefined;
        }
    } else {
        _model.querySelector('.modal-background').style.backgroundImage = undefined;
    }

    if (resolutionRatio && resolutionRatio.length > 0) {
        normalInfo.push('<div class="badge badge-light mx-1">')
        const ratio = parseFloat(resolutionRatio.split(':')[1])
        if (!isNaN(ratio)) {
            if (ratio > 1.15) {
                normalInfo.push(`<i class="fa fa-image-portrait pr-1"></i>`)
            } else if (ratio >= 0.9 && ratio <= 1.15) {
                normalInfo.push(`<i class="fa fa-image pr-1"></i>`)
            } else {
                normalInfo.push(`<i class="fa fa-image-landscape pr-1"></i>`)
            }
        }
        normalInfo.push(`<i class="fa fa-ruler-triangle pr-1"></i><span>${resolutionRatio.split(':')[0]}</span>`)
        normalInfo.push('</div>')
    }
    if (fileSize && fileSize.length > 0) {
        normalInfo.push('<div class="badge badge-light mx-1 ">')
        normalInfo.push(`<i class="fa fa-floppy-disk pr-1"></i><span>${fileSize}</span>`)
        normalInfo.push('</div>')
    }
    if (postFilename && postFilename.length > 0) {
        normalInfo.push('<div class="badge badge-light text-dark mx-1 ">')
        if (postIsVideo) {
            normalInfo.push(`<i class="fa fa-file-video pr-1"></i><span>${postFilename.split('.').pop().toUpperCase()}</span>`)
        } else if (postIsAudio) {
            normalInfo.push(`<i class="fa fa-file-audio pr-1"></i><span>${postFilename.split('.').pop().toUpperCase()}</span>`)
        } else {
            normalInfo.push(`<i class="fa fa-file pr-1"></i><span>${postFilename.split('.').pop().toUpperCase()}</span>`)
        }
        normalInfo.push('</div>')
        advancedInfo.push(`<div><i class="fa fa-input-text pr-1"></i><span class="text-monospace" title="Kanmi/Sequenzia Real File Name">${postFilename}</span></div>`);
        modalFilename.innerText = postFilename.split('.')[0];
        modalFilename.classList.remove('hidden');
        modalOfflineThisButton.onclick = function() {
            cacheFileOffline(postID, false);
            $('#searchModal').modal('hide');
            return false;
        }
        modalOfflineThisButton.classList.remove('hidden');
    } else {
        modalFilename.innerText = "Unknown";
        modalFilename.classList.add('hidden');
        modalOfflineThisButton.onclick = null;
        modalOfflineThisButton.classList.add('hidden');
    }
    if (postDate && postDate.length > 0) {
        normalInfo.push('<div class="badge badge-light mx-1 ">')
        normalInfo.push(`<i class="fa fa-clock pr-1"></i><span>${postDate}</span>`)
        normalInfo.push('</div>')
    }
    if (postIsVideo) {
        modalPlayButton.title = `Play Video`
        if ((!postFilID && postDownload && postDownload.length > 0) || (postFilID && postFilID.length > 0 && postCached && postDownload && postDownload.length > 0)) {
            modalPlayButton.onclick = function () {
                PlayVideo(postDownload, `${postChannelString}/${postFilename} (${fileSize}`);
                $('#searchModal').modal('hide');
                return false;
            }
        } else if (postFilID && postFilID.length > 0) {
            modalPlayButton.onclick = function () {
                openPreviewUnpacking(postID);
                $('#searchModal').modal('hide');
                return false;
            }
        }
        modalPlayButton.classList.remove('hidden')
    } else if (postIsAudio) {
        modalPlayButton.title = `Play Audio`
        if ((!postFilID && postDownload && postDownload.length > 0) || (postFilID && postFilID.length > 0 && postCached && postDownload && postDownload.length > 0)) {
            modalPlayButton.onclick = function () {
                PlayTrack(postDownload);
                $('#searchModal').modal('hide');
                return false;
            }
        } else if (postFilID && postFilID.length > 0) {
            modalPlayButton.onclick = function () {
                openUnpackingFiles(postID, 'audio');
                $('#searchModal').modal('hide');
                return false;
            }
        }
        modalPlayButton.classList.remove('hidden')
    } else {
        modalPlayButton.title = `Play`
        modalDownloadButton.onclick = null;
        modalPlayButton.classList.add('hidden')
    }
    if (postFilID && postFilID.length > 0) {
        normalInfo.push('<div class="badge badge-warning text-dark mx-1 ">')
        normalInfo.push(`<i class="fa fa-box pr-1"></i><span>Packed File</span>`)
        normalInfo.push('</div>')
        if (postCached) {
            normalInfo.push('<div class="badge text-light mx-1" style="background: #00b14f;">')
            normalInfo.push(`<i class="fa fa-cloud-check pr-1"></i><span>Fast Access</span>`)
            normalInfo.push('</div>')
            modalDownloadButton.title = `Fast Access Download`
            modalDownloadButton.href = postDownload
            if (postFilename && postFilename.length > 0) {
                modalDownloadButton.download = postFilename
            } else {
                modalDownloadButton.download = undefined
            }
            modalDownloadButton.onclick = null;
        } else {
            modalDownloadButton.title = `Unpack Download`
            modalDownloadButton.href = '#_'
            modalDownloadButton.download = undefined
            modalDownloadButton.onclick = function () {
                openUnpackingFiles(postID, 'video');
                $('#searchModal').modal('hide');
                return false;
            }
        }

        modalDownloadButton.classList.remove('hidden')
        advancedInfo.push(`<div><i class="fa fa-layer-group pr-1"></i><span class="text-monospace" title="Kanmi/Sequenzia Unique Entity Parity ID">${postFilID}</span></div>`);
    } else if (postDownload && postDownload.length > 0) {
        modalDownloadButton.title = `Direct Download`
        modalDownloadButton.href = postDownload
        modalDownloadButton.onclick = null;
        if (postFilename && postFilename.length > 0) {
            modalDownloadButton.download = postFilename
        } else {
            modalDownloadButton.download = ''
        }
        modalDownloadButton.classList.remove('hidden')
    } else {
        modalDownloadButton.href = '#_'
        modalDownloadButton.download = undefined
        modalDownloadButton.onclick = null;
        modalDownloadButton.title = 'Direct Download'
        modalDownloadButton.classList.add('hidden')
    }
    if (postFlagged) {
        normalInfo.push('<div class="badge badge-danger mx-1 ">')
        normalInfo.push(`<i class="fa fa-flag pr-1"></i><span>Flagged</span>`)
        normalInfo.push('</div>')
    }
    if (postAuthorName && postAuthorName.length > 0) {
        modalAuthorData.querySelector('span').innerText = postAuthorName;
    } else {
        modalAuthorData.querySelector('span').innerText = 'Framework';
        normalInfo.push('<div class="badge badge-light mx-1 ">')
        normalInfo.push(`<i class="fa fa-cog pr-1"></i><span>Automated</span>`)
        normalInfo.push('</div>')
    }
    normalInfo.push(`<div class="badge badge-light text-dark mx-1"><i class="fas ${(postChannelIcon && postChannelIcon.length > 0) ? postChannelIcon : 'fa-folder-tree'} pr-1"></i><span>${postChannelString}</span></div>`);
    if (postAuthorImage && postAuthorImage.length > 0) {
        let imageURL = postAuthorImage
        if (imageURL.includes('?size='))
            imageURL = imageURL.split('?size=')[0] + '?size=64'
        modalAuthorData.querySelector('img').src = imageURL
    }

    modalSearchSelectedText.onclick = function() {
        const text = window.getSelection().toString()
        if (text && text.length > 0 && text.trim().length > 0) {
            $('#searchModal').modal('hide');
            window.getSelection().toString()
            window.location.assign(`#${getLocation()}search=${encodeURIComponent('text:' + text)}${(nsfwString) ? nsfwString : ''}`);
        } else {
            alert(`You must select text above first before you can search selected text!`)
        }
        return false;
    }
    modalGoToPostLocation.onclick = function() {
        $('#searchModal').modal('hide');
        window.location.assign("#" + params([], [['channel', `${postChannel}`], ['nsfw', 'true']], `/${pageType}`));
        return false;
    }
    modalGoToHistoryDisplay.onclick = function() {
        $('#searchModal').modal('hide');
        window.location.assign("#" + params([], [['sort', 'history'], ['history', 'only'], ['displayname', `${postDisplayName}`], ['nsfw', 'true']], '/gallery'));
        return false;
    }
    modalToggleFav.onclick = function() {
        toggleFavorite(`${postChannel}`, `${postEID}`);
        return false;
    }
    modalToggleAlbum.onclick = function() {
        refreshAlbumsList(`${postEID}`);
        return false;
    }
    modalAddFlag.onclick = function() {
        sendBasic(postChannel, postID, "Report", true);
        return false;
    }
    if (postChannelString && postChannelString.length > 0) {
        modalGoToPostLocation.title = `Go To "${postChannelString}"`
    } else {
        modalGoToPostLocation.title = 'Go To Channel'
    }
    if (manageAllowed && !($('.select-panel').hasClass('show'))) {
        modalReport.classList.remove('hidden');
        modalReport.onclick = function() {
            $('#searchModal').modal('hide');
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu("RemoveReport");
        }
        modalRepair.classList.remove('hidden');
        modalRepair.onclick = function() {
            $('#searchModal').modal('hide');
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu((postIsVideo) ? "VideoThumbnail" : "Thumbnail");
        }

        modalMove.classList.remove('hidden');
        modalMove.onclick = function() {
            $('#searchModal').modal('hide');
            postsActions = [];
            updateRecentPostDestinations();
            selectPostToMode(postID, false);
            selectedActionMenu("MovePost");
        }

        modalDelete.classList.remove('hidden');
        modalDelete.onclick = function() {
            $('#searchModal').modal('hide');
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu("ArchivePost");
        }

        modalEditText.classList.remove('hidden');
        modalEditText.onclick = function() {
            $('#searchModal').modal('hide');
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu("EditTextPost");
        }

        if (pageType.includes('gallery') && !postIsAudio && !postIsVideo) {
            modalRotate.classList.remove('hidden');
            modalRotate.onclick = function() {
                $('#searchModal').modal('hide');
                postsActions = [];
                selectPostToMode(postID, false);
                selectedActionMenu("RotatePost");
            }
        } else {
            modalRotate.classList.add('hidden');
            modalRotate.onclick = null;
        }
        if (postFilID && postFilID.length > 0) {
            modalRename.classList.remove('hidden');
            modalRename.onclick = function() {
                $('#searchModal').modal('hide');
                postsActions = [];
                selectPostToMode(postID, false);
                selectedActionMenu("RenamePost");
            }
            if (postCached) {
                modalCompile.classList.add('hidden');
                modalDecompile.classList.remove('hidden');
                modalDecompile.onclick = function () {
                    $('#searchModal').modal('hide');
                    postsActions = [];
                    selectPostToMode(postID, false);
                    selectedActionMenu("DecompileSF");
                }
            } else {
                modalDecompile.classList.add('hidden');
                modalCompile.classList.remove('hidden');
                modalCompile.onclick = function () {
                    $('#searchModal').modal('hide');
                    postsActions = [];
                    selectPostToMode(postID, false);
                    selectedActionMenu("CompileSF");
                }
            }
        } else {
            modalRename.classList.add('hidden');
            modalRename.onclick = null;
            modalCompile.classList.add('hidden');
            modalCompile.onclick = null;
            modalDecompile.classList.add('hidden');
            modalDecompile.onclick = null;
        }
    } else {
        modalReport.classList.add('hidden');
        modalReport.onclick = null;
        modalRepair.classList.add('hidden');
        modalRepair.onclick = null;
        modalMove.classList.add('hidden');
        modalMove.onclick = null;
        modalDelete.classList.add('hidden');
        modalDelete.onclick = null;
        modalRename.classList.add('hidden');
        modalRename.onclick = null;
        modalRotate.classList.add('hidden');
        modalRotate.onclick = null;
        modalCompile.classList.add('hidden');
        modalCompile.onclick = null;
        modalDecompile.classList.add('hidden');
        modalDecompile.onclick = null;
        modalEditText.classList.add('hidden');
        modalEditText.onclick = null;
    }
    if (searchSource && searchSource.length > 0) {
        modalGoToPostSource.title = `Go To "${searchSource}"`
        modalGoToPostSource.onclick = function() {
            $('#searchModal').modal('hide');
            $(`<a href="${searchSource}" target="_blank" rel="noopener noreferrer"></a>`)[0].click();
            return false;
        }
        modalGoToPostSource.classList.remove('hidden')
    } else {
        modalGoToPostSource.title = 'Go To Source'
        modalGoToPostSource.onclick = function() { return false; };
        modalGoToPostSource.classList.add('hidden')
    }
    if (postDisplayName && postDisplayName.length > 0) {
        modalGoToHistoryDisplay.title = `View "${postDisplayName}"`
        modalGoToHistoryDisplay.onclick = function() {
            $('#searchModal').modal('hide');
            $(`<a href="${searchSource}" target="_blank" rel="noopener noreferrer"></a>`)[0].click();
            return false;
        }
        modalGoToHistoryDisplay.classList.remove('hidden')
    } else {
        modalGoToHistoryDisplay.title = 'View History'
        modalGoToHistoryDisplay.onclick = function() { return false; };
        modalGoToHistoryDisplay.classList.add('hidden')
    }
    if (searchUser && searchUser.length > 0) {
        modalSearchByUser.onclick = function() {
            $('#searchModal').modal('hide');
            window.location.assign(`#${getLocation()}search=${encodeURIComponent('text:' + searchUser)}${(nsfwString) ? nsfwString : ''}`);
            return false;
        }
        modalSearchByUser.classList.remove('hidden')
    } else {
        modalSearchByUser.onclick = function() { return false; };
        modalSearchByUser.classList.add('hidden')
    }
    if (searchParent && searchParent.length > 0) {
        modalSearchByParent.onclick = function() {
            $('#searchModal').modal('hide');
            window.location.assign(`#${getLocation()}search=${encodeURIComponent('text:' + searchParent)}${(nsfwString) ? nsfwString : ''}`);
            return false;
        }
        modalSearchByParent.classList.remove('hidden')
    } else {
        modalSearchByParent.onclick = function() { return false; };
        modalSearchByParent.classList.add('hidden')
    }
    if (searchColor && searchColor.length > 0) {
        modalSearchByColor.onclick = function() {
            $('#searchModal').modal('hide');
            window.location.assign(`#${getLocation()}color=${searchColor}${(nsfwString) ? nsfwString : ''}`);
            return false;
        }
        modalSearchByColor.classList.remove('hidden')
    } else {
        modalSearchByColor.onclick = function() { return false; };
        modalSearchByColor.classList.add('hidden')
    }
    if (postID && postID.length > 0) {
        modalSearchByID.onclick = function() {
            $('#searchModal').modal('hide');
            window.location.assign(`#${getLocation()}search=${encodeURIComponent("id:st:" + postID.substring(0, 6))}${(nsfwString) ? nsfwString : ''}`);
            return false;
        }
        modalSearchByID.classList.remove('hidden')
    } else {
        modalSearchByID.onclick = function() { return false; };
        modalSearchByID.classList.add('hidden')
    }
    if (postBody && postBody.length > 0) {
        postBody = postBody.split('<br/>')
        if (postBody[0].includes('🧩 File'))
            postBody = postBody.slice(2)
        postBody = postBody.join('<br/>')
    }
    if (postBody && postBody.length > 0) {
        try {
            const regexItalic = /\*\*\*(.*?)\*\*\*/g;
            while (postBody.includes('***')) {
                let matched = regexItalic.exec(postBody);
                let wrap = "<i>" + matched[1] + "</i>";
                postBody = postBody.replace(`***${matched[1]}***`, wrap);
            }
            const regexBold = /\*\*(.*?)\*\*/g;
            while (postBody.includes('**')) {
                let matched = regexBold.exec(postBody);
                let wrap = "<b>" + matched[1] + "</b>";
                postBody = postBody.replace(`**${matched[1]}**`, wrap);
            }
        } catch (e) {
            console.error(`Failed to prettyfy the post body!`)
            console.error(e)
        }

        modalBodyRaw.querySelector('div').innerHTML = postBody
        modalBodyRaw.classList.remove('hidden')
    } else {
        modalBodyRaw.querySelector('div').innerHTML = ''
        modalBodyRaw.classList.add('hidden')
    }

    advancedInfo.push(`<div><i class="fa fa-file pr-1"></i><span class="text-monospace" title="Discord Message ID">${postID}</span></div>`);
    advancedInfo.push(`<div><i class="fa fa-folder pr-1"></i><span class="text-monospace" title="Discord Channel ID">${postChannel}</span></div>`);
    advancedInfo.push(`<div><i class="fa fa-server pr-1"></i><span class="text-monospace" title="Discord Server ID">${postServer}</span></div>`);

    modalInfoRaw.innerHTML = normalInfo.join('');
    modalAdvRaw.innerHTML = advancedInfo.join('');
    $('#searchModal').modal('show');
    return false;
}
function getLocation(url) {
    const l = document.getElementById('searchLocationSelection').querySelector('.active').getAttribute('data-search-location')
    return (l.split('?').pop().length > 0) ? l + '&' : l
}

function showAuthManager() {
    $('#authenticationModel').modal('show');
    $.ajax({async: true,
        url: `https://${document.location.host}/discord/token?action=get`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            console.log(response)
            document.getElementById('staticKeyHolder').value = response;
        },
        error: function (xhr) {
            document.getElementById('staticKeyHolder').value = 'Server Error!'
        }
    });
}
function authwareManager(action) {
    $('#authenticationModel').modal('show');
    $.ajax({async: true,
        url: `https://${document.location.host}/discord/token?action=${action}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            console.log(response)
            document.getElementById('staticKeyHolder').value = response;
        },
        error: function (xhr) {
            document.getElementById('staticKeyHolder').value = 'Server Error!'
        }
    });
}
function authwareLogin() {
    try {
        const code = document.getElementById('expressLoginCode').value.trim();
        $.ajax({
            async: true,
            url: `/transfer?code=${code}`,
            type: "GET", data: '',
            processData: false,
            contentType: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response, textStatus, xhr) {
                $.toast({
                    type: 'success',
                    title: 'Express Login',
                    subtitle: 'Now',
                    content: `${response}`,
                    delay: 5000,
                });
                document.getElementById('expressLoginCode').value = '';
            },
            error: function (xhr) {
                $.toast({
                    type: 'error',
                    title: 'Express Login Error',
                    subtitle: 'Now',
                    content: `${xhr.responseText}`,
                    delay: 5000,
                });
            }
        });
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Express Login Error',
            subtitle: 'Now',
            content: `Client Script Error - ${e.message}`,
            delay: 5000,
        });
    }
}
function saveAccountSettings() {
    const accountName = document.getElementById('authenticationModel').querySelector('#nameOveride').value.trim()
    if (accountName && accountName.length > 1) {
        const _results = {
            nice_name: accountName
        }
        $.ajax({async: true,
            url: `https://${document.location.host}/discord/update`,
            type: 'post',
            contentType: 'application/json',
            data: JSON.stringify(_results),
            dataType: 'json',
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response, textStatus, xhr) {
                window.location.href = '/discord/refresh';
            },
            error: function (xhr) {
                console.error(xhr)
                window.location.href = '/discord/refresh';
            }
        });
    }
}
function generateShortcutURI(e, s) {
    document.getElementById(e).value = params(["offset", "sort"],[['setscreen', `${(s) ? s : 0}`]]).split('?').pop();
}
function loadADSDisplays() {
    $.ajax({async: true,
        url: `/ambient-history?command=getAllNames&json=true`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400 && response && response.displays) {
                $('#sendADSForm').removeClass('d-none');
                $('#sendADSStatus').addClass('d-none');
                let displayList = ['<option value="Homepage" selected>Homepage</option>', '<option value="Untitled">Default</option>'];
                response.displays.filter(e => !e.startsWith('ADSMobile-') && !e.startsWith('ADSMicro-') && !e.startsWith('WebExtension') && !e.startsWith('Untitled') && !e.startsWith('Homepage')).forEach(e => {
                    displayList.push(`<option value="${e}">${(e === 'Untitled') ? 'Default' : e}</option>`);
                })

                $('#sendADSList').html(displayList.join('\n'));
            } else {
                $('#sendADSForm').addClass('d-none')
                $('#sendADSStatus').html('<span>Failed to get valid history via AJAX</span>');
            }
        },
        error: function (xhr) {
            $('#sendADSStatus').html('<span>Failed to get history via AJAX</span>');
        }
    });
    $('#adsModal').modal('show');
}
function saveDisplaySettings() {
    const displayName = document.getElementById('sendADSList').value
    if (displayName && displayName.length > 0) {
        let results = {name: displayName};
        let _url = new URLSearchParams($.history.url().split('?').pop());
        _url.delete('sort');
        _url.delete('offset');
        _url.delete('limit');
        if (_url.toString().length > 0) {
            results.requestOptions = _url.toString()
        } else {
            results.requestOptions = null;
        }
        const _results = JSON.stringify(results);
        $('#sendADSForm').addClass('d-none');
        $('#sendADSStatus').removeClass('d-none');
        $('#sendADSStatus').html('<span>Saved Configuration!<br\>Use the Ambient Display Settings to configure additional options.</span>');
        $.ajax({async: true,
            url: `/ambient-history?command=setConfig&displayname=${displayName}&update=true`,
            type: 'post',
            contentType: 'application/json',
            data: _results,
            dataType: 'json',
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
        });
        console.log(_results);
    } else {
        $('#sendADSStatus').removeClass('d-none');
        $('#sendADSStatus').html('<span>Invalid Display Name</span>');
    }
}

function setAccordion(parent, child){
    if (last) {
        if (last.parent && last.parent !== '' && last.parent !== null) {
            $(`#${last.parent}`).removeClass('active')
        }
        if (last.child && last.child !== '' && last.child !== null) {
            $(`#${last.child}`).removeClass('active')
        }
    }
    if (parent && parent !== '' && parent !== null) {
        $(`#${parent}`).addClass('active')
    }
    if (child && child !== '' && child !== null) {
        $(`#${child}`).addClass('active')
    }
    last = {
        parent: parent,
        child: child
    }
    return false;
}
function setPageLayout(toggle) {
    const pageResultsContainer = $('#content-wrapper .container-fluid')
    if (toggle) {
        if (pageResultsContainer[0].classList.contains('max-resize')) {
            pageResultsContainer.removeClass('max-resize')
            widePageResults = '1';
        } else {
            pageResultsContainer.addClass('max-resize')
            widePageResults = '0';
        }
        try {
            setCookie("widePageResults", widePageResults);
        } catch (e) {
            console.error("Failed to save cookie for widescreen results");
            console.error(e)
        }
    } else {
        if (widePageResults === '1') {
            pageResultsContainer.removeClass('max-resize')
        } else {
            pageResultsContainer.addClass('max-resize')
        }
    }
    return false;
}
function setImageLayout(size, _html) {
    let html = document;
    if (html.location.hash.startsWith('#/tvTheater')) {
        if (_html) {
            html = _html;
        }
        let classList = ''
        switch (`${size}`) {
            case '1':
                classList = 'col-12 col-sm-12 col-md-6 col-lg-4 col-xl-3 col-dynamic-large';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '1';
                break;
            case '2':
                classList = 'col-4 col-sm-4 col-md-3 col-lg-2 col-xl-1 col-dynamic-small';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '2';
                break;
            case '3':
                classList = 'col-3 col-sm-3 col-md-2 col-lg-1 col-xl-1 col-dynamic-tiny';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.add('dynamic-hide'));
                setImageSize = '3';
                break;
            default:
                classList = 'col-6 col-sm-6 col-md-4 col-lg-3 col-xl-2';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '0';
                break;
        }
        try {
            setCookie("imageSizes", setImageSize);
        } catch (e) {
            console.error("Failed to save cookie for imageSizes");
            console.error(e);
        }
        html.querySelectorAll('.col-dynamic').forEach(c => c.classList = 'col-image col-dynamic ' + classList);
        html.querySelectorAll('.col-button').forEach(c => c.classList = 'col-button ' + classList);
        if (_html) {
            return html;
        } else {
            return false;
        }
    } else if (html.location.hash.startsWith('#/allImages') || html.location.hash.startsWith('#/gallery')) {
        if (_html) {
            html = _html;
        }
        let classList = ''
        switch (`${size}`) {
            case '1':
                classList = 'col-12 col-sm-12 col-md-12 col-lg-6 col-xl-6 col-dynamic-large';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '1';
                break;
            case '2':
                classList = 'col-6 col-sm-4 col-md-3 col-lg-2 col-xl-2 col-dynamic-small';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '2';
                break;
            case '3':
                classList = 'col-3 col-sm-2 col-md-2 col-lg-2 col-xl-1 col-dynamic-tiny';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.add('dynamic-hide'));
                setImageSize = '3';
                break;
            default:
                classList = 'col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.no-dynamic-tiny').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '0';
                break;
        }
        try {
            setCookie("imageSizes", setImageSize);
        } catch (e) {
            console.error("Failed to save cookie for imageSizes");
            console.error(e)
        }
        html.querySelectorAll('.col-dynamic').forEach(c => c.classList = 'col-image col-dynamic ' + classList);
        html.querySelectorAll('.col-button').forEach(c => c.classList = 'col-button ' + classList);
        if (_html) {
            return html;
        } else {
            return false;
        }
    }
    return false;
}
function setMenuBarLocation() {
    switch (menuBarLocation) {
        case 'bottom':
            menuBarLocation = 'top';
            $('body').removeClass('bottom-bar');
            break;
        default:
            menuBarLocation = 'bottom';
            $('body').addClass('bottom-bar');
            break;
    }
    try {
        setCookie("menuBarLocation", menuBarLocation);
    } catch (e) {
        console.error("Failed to save cookie for menubar preference");
        console.error(e)
    }
}

// Send Action
function toggleFavorite(channelid, eid) {
    const star = document.querySelector(`#fav-${eid} > i.fas.fa-star`)
    let isFavorite = false;
    if (star)
        isFavorite = star.classList.contains('favorited');

    sendBasic(channelid, eid, (isFavorite) ? `Unpin${(channelid === null) ? 'User' : ''}`: `Pin${(channelid === null) ? 'User' : ''}`, true);

    return false;
}
async function setSeasonHistory(index, viewed) {
    console.log(`Set Season ${index} History to ${viewed}`)
    Array.from(document.querySelectorAll(`#seasonBody${index} .episode-row`)).map(e => {
        const eid = e.getAttribute('data-msg-eid');
        if (eid) {
            $.ajax({async: true,
                type: "post",
                url: "/actions/v1",
                data: {
                    'action': 'SetWatchHistory',
                    'eid': eid,
                    'viewed': viewed
                },
                cache: false,
                headers: {
                    'X-Requested-With': 'SequenziaXHR'
                },
                success: function (res, txt, xhr) {
                    if (xhr.status < 400) {
                        console.log(res);
                        e.querySelector('.watched-precent').style.width = (viewed * 100) + '%'
                        if (viewed > 0.8)
                            e.classList.add('watched-episode')
                        const icon = e.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check, [data-msg-eid="${eid}"] .episode-controls i.fas.fa-eye-slash`)
                        if (viewed > 0) {
                            icon.classList.add('fa-eye-slash')
                            icon.classList.remove('fa-check')
                        } else {
                            icon.classList.remove('fa-eye-slash')
                            icon.classList.add('fa-check')
                        }
                    } else {
                        $.snack('error', `Failed to update watch history`, 3000)
                        console.log(res.responseText);
                    }
                },
                error: function (xhr) {
                    $.snack('error', `Failed to update watch history`, 3000)
                }
            });
        }
        return false;
    })
}
async function setShowHistory(viewed) {
    console.log(`Set Show History to ${viewed}`)
    Array.from(document.querySelectorAll('.episode-row')).map(e => {
        const eid = e.getAttribute('data-msg-eid');
        if (eid) {
            $.ajax({async: true,
                type: "post",
                url: "/actions/v1",
                data: {
                    'action': 'SetWatchHistory',
                    'eid': eid,
                    'viewed': viewed
                },
                cache: false,
                headers: {
                    'X-Requested-With': 'SequenziaXHR'
                },
                success: function (res, txt, xhr) {
                    if (xhr.status < 400) {
                        console.log(res);
                        e.querySelector('.watched-precent').style.width = (viewed * 100) + '%'
                        if (viewed > 0.8)
                            e.classList.add('watched-episode')
                        const icon = e.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check, [data-msg-eid="${eid}"] .episode-controls i.fas.fa-eye-slash`)
                        if (viewed > 0) {
                            icon.classList.add('fa-eye-slash')
                            icon.classList.remove('fa-check')
                        } else {
                            icon.classList.remove('fa-eye-slash')
                            icon.classList.add('fa-check')
                        }
                    } else {
                        $.snack('error', `Failed to update watch history`, 3000)
                        console.log(res.responseText);
                    }
                },
                error: function (xhr) {
                    $.snack('error', `Failed to update watch history`, 3000)
                }
            });
        }
        return false;
    })
}
async function toggleWatchHistory(eid) {
    return setWatchHistory(eid, (document.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check`)) ? 1 : 0);
}
async function setWatchHistory(eid, viewed) {
    const percentage = (!isNaN(viewed) && viewed > 0.05) ? (viewed <= 0.80) ? viewed : 1 : 0
    console.log(`Set History to ${percentage}`)
    $.ajax({async: true,
        type: "post",
        url: "/actions/v1",
        data: {
            'action': 'SetWatchHistory',
            'eid': eid,
            'viewed': percentage
        },
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (res, txt, xhr) {
            if (xhr.status < 400) {
                console.log(res);
                const e = document.querySelector(`[data-msg-eid="${eid}"]`)
                if (e) {
                    e.querySelector('.watched-precent').style.width = (viewed * 100) + '%'
                    if (viewed > 0.8) {
                        e.classList.add('watched-episode')
                    } else {
                        e.classList.remove('watched-episode')
                    }
                    const icon = e.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check, [data-msg-eid="${eid}"] .episode-controls i.fas.fa-eye-slash`)
                    if (viewed > 0) {
                        icon.classList.add('fa-eye-slash')
                        icon.classList.remove('fa-check')
                    } else {
                        icon.classList.remove('fa-eye-slash')
                        icon.classList.add('fa-check')
                    }
                }
            } else {
                $.snack('error', `Failed to update watch history`, 3000)
                console.log(res.responseText);
            }
        },
        error: function (xhr) {
            $.snack('error', `Failed to update watch history`, 3000)
        }
    });
    return false;
}
function toggleStarHistoryItem(index) {
    const star = document.querySelector(`#favHistory-${index} > i.fas.fa-star`)
    let isFavorite = false;
    if (star)
        isFavorite = star.classList.contains('favorited');

    sendBasic(undefined, index, (isFavorite) ? `UnpinHistory`: `PinHistory`, true);

    return false;
}
function removeHistoryItem(index) {
    sendBasic(undefined, index, 'RemoveHistory', true);

    return false;
}
function removeAllHistory() {
    sendBasic(undefined, undefined, 'RemoveHistoryAll', true);

    return false;
}
function queueAction(serverid, channelid, messageid, action, data, isReviewAction, noUndo) {
    let preview = undefined
/*    const _post = document.getElementById(`message-${messageid}`)
    if (pageType.includes('gallery')) {
        preview = _post.querySelector('#postImage').style.backgroundImage.split('"')[1];
    } else if (pageType.includes('file')) {
        if (_post.querySelector('.preview-holder a div') !== null && _post.querySelector('.preview-holder a div').style) {
            preview = _post.querySelector('.preview-holder a div').style.backgroundImage.split('"')[1]
        }
    } else if (pageType.includes('card')) {
        if (_post.querySelector('.card-img') !== null && _post.querySelector('.card-img').src) {
            preview = _post.querySelector('.card-img').src
        }
    }*/
    apiActions[messageid] = {serverid, channelid, messageid, action, data, preview, isReviewAction: (isReviewAction)};
    if (!noUndo)
        undoActions.push(messageid);
    updateActionsPanel();
}
function commitPendingActions() {
    $.ajax({async: true,
        type: "post",
        url: "/actions/v2",
        data: {
            batch: Object.values(apiActions)
        },
        json: true,
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (res, txt, xhr) {
            if (xhr.status === 202) {
                $.toast({
                    type: 'success',
                    title: 'Completed Actions',
                    subtitle: 'Now',
                    content: `${res.status}`,
                    delay: 5000,
                });
                console.log(res);
                if (res.status.includes('Actions Failed')) {
                    Object.keys(res.results).map((response) => {
                        if (res.results[response] === 200 || res.results[response] === 404) {
                            delete apiActions[response];
                            const request = apiActions[response];
                            afterAction(request.action, request.data, request.messageid);
                        } else {
                            const message = document.getElementById(`message-${response}`)
                            if (message) {
                                message.classList.remove('hidden')
                            }
                            console.log(`${response} Failed on the server`)
                        }
                    })
                } else {
                    Object.values(apiActions).map((request) => {
                        afterAction(request.action, request.data, request.messageid);
                    });
                    apiActions = {};
                }
                updateActionsPanel();
            } else {
                $.toast({
                    type: 'error',
                    title: 'Failed Actions',
                    subtitle: 'Now',
                    content: `${res.responseText}`,
                    delay: 15000,
                });
                console.log(res.responseText);
                Object.values(apiActions).map((request) => {
                    const message = document.getElementById(`message-${request.messageid}`)
                    if (message) {
                        message.classList.remove('hidden')
                    }
                })
            }
        },
        error: function (xhr) {
            $.toast({
                type: 'error',
                title: 'Failed to complete action',
                subtitle: 'Now',
                content: `${xhr.responseText}`,
                delay: 5000,
            });
            Object.values(apiActions).map((request) => {
                const message = document.getElementById(`message-${request.messageid}`)
                if (message) {
                    message.classList.remove('hidden')
                }
            })
        }
    });
    return false;
}
function cancelPendingAction(messageid) {
    if (messageid === -1) {
        Object.values(apiActions).map((request) => {
            const message = document.getElementById(`message-${request.messageid}`)
            if (message) {
                message.classList.remove('hidden')
            }
        })
        apiActions = {};
    } else {
        const message = document.getElementById(`message-${messageid}`)
        if (message) {
            message.classList.remove('hidden')
        }
        delete apiActions[messageid]
    }
    updateActionsPanel();
}
function undoPendingAction() {
    if (undoActions.length > 0) {
        const lastAction = undoActions.pop();
        if (typeof lastAction === 'string') {
            const post = document.getElementById(`message-${lastAction}`)
            if (post)
                post.classList.remove('hidden')
            delete apiActions[lastAction];
        } else {
            lastAction.map(e => {
                const post = document.getElementById(`message-${e}`)
                if (post)
                    post.classList.remove('hidden')
                delete apiActions[e];
            })
        }
    }
    updateActionsPanel();
}
function updateActionsPanel() {
    if (document.getElementById('actionPanel')) {
        if (Object.keys(apiActions).length > 0) {
            $('#actionPanel').removeClass('hidden')
        } else {
            $('#actionPanel').addClass('hidden')
        }
        document.getElementById('pendingActionsIndicator').innerText = Object.keys(apiActions).length
    }
    /*if (Object.keys(apiActions).length !== 0) {
        const keys = Object.values(apiActions).reverse().map((item) => {
            let results = [`<a class="action-item" href='#_' onclick="cancelPendingAction(${item.messageid}); return false;" role='button')>`]
            if (item.preview) {
                results.push(`<div style="background-image: url('${item.preview}');"></div>`)
            } else {
                results.push(`<span>${item.messageid}</span>`)
            }
            switch (item.action) {
                case 'RemoveReport':
                    results.push(`<i style="color: #6bff64;" class="fas fa-flag"></i>`);
                    break;
                case 'Report':
                    results.push(`<i style="color: #ff6464;" class="fas fa-flag"></i>`);
                    break;
                case 'MovePost':
                    if (item.isReviewAction) {
                        results.push(`<i style="color: #6bff64;" class="fas fa-check"></i>`);
                    } else {
                        results.push(`<i style="color: #71cdff;" class="fas fa-paste"></i>`);
                    }
                    break;
                case 'RenamePost':
                    results.push(`<i style="color: #71CDFFFF;" class="fas fa-pen-alt"></i>`);
                    break;
                case 'RotatePost':
                    results.push(`<i style="color: #71CDFFFF;" class="fas fa-rotate-90"></i>`);
                    break;
                case 'RemovePost':
                case 'ArchivePost':
                    results.push(`<i style="color: #ff6464;" class="fas fa-trash-alt"></i>`);
                    break;
                case 'RequestFile':
                    results.push(`<i style="color: #6bff64;" class="fas fa-box-open"></i>`);
                    break;
                default:
                    results.push(`<i class="fas fa-question"></i>`);
                    break;
            }
            results.push(`</a>`)
            return results.join('\n')
        })
        if (document.getElementById('actionPanel')) {
            $('#actionPanel').removeClass('hidden')
            if (keys.length > 0) {
                const newMenu = [
                    '<a class="dropdown-item" onclick="commitPendingActions(); return false;">',
                        '<i class="fas fa-inbox-out pr-2"></i>',
                        '<span>Commit</span>',
                    '</a>',
                    '<div class="action-container">',
                        ...keys,
                    '</div>',
                    '<a class="dropdown-item" onclick="cancelPendingAction(-1); return false;">',
                        '<i class="fas fa-trash-alt pr-2"></i>',
                        '<span>Cancel</span>',
                    '</a>',
                ]
                $('#actionPanel > .dropdown > .dropdown-menu').html($(newMenu.join('\n')))
                document.getElementById('pendingActionsIndicator').innerText = keys.length
            } else {
                $('#actionPanel > .dropdown > .dropdown-menu').html('<span class="dropdown-header">No Pending Actions</span>')
                document.getElementById('pendingActionsIndicator').innerText = "0"
            }
        }
    } else {
        if (document.getElementById('statusPanel')) {
            $('#actionPanel').addClass('hidden')
            $('#actionPanel > .dropdown > .dropdown-menu').html('<span class="dropdown-header">No Pending Actions</span>')
        }
    }*/
}
function sendAction(serverid, channelid, messageid, action, data, confirm) {
    if (inReviewMode) {
        queueAction(serverid, channelid, messageid, action, data);
        document.getElementById(`message-${messageid}`).classList.add('hidden');
    } else {
        $.ajax({
            async: true,
            type: "post",
            url: "/actions/v2",
            data: {
                'serverid': serverid,
                'channelid': channelid,
                'messageid': messageid,
                'action': action,
                'data': data
            },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (res, txt, xhr) {
                if (xhr.status < 400) {
                    console.log(res);
                    if (confirm) {
                        $.snack('success', `${res}`, 5000)
                    }
                    ;
                    afterAction(action, data, messageid, confirm);
                } else {
                    console.log(res.responseText);
                    document.getElementById(`message-${messageid}`).classList.remove('hidden')
                }
            },
            error: function (xhr) {
                $.toast({
                    type: 'error',
                    title: 'Failed to complete action',
                    subtitle: 'Now',
                    content: `${xhr.responseText}`,
                    delay: 5000,
                });
                document.getElementById(`message-${messageid}`).classList.remove('hidden')
            }
        });
    }
    return false;
}
function sendBasic(channelid, messageid, action, confirm) {
    $.ajax({async: true,
        type: "post",
        url: "/actions/v1",
        data: { 'channelid': channelid,
            'messageid': messageid,
            'action': action },
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (res, txt, xhr) {
            if (xhr.status < 400) {
                console.log(res);
                if (confirm) { $.snack('success', `${res}`, 5000) };
                afterAction(action, undefined, messageid, confirm);
            } else {
                console.log(res.responseText);
            }
        },
        error: function (xhr) {
            $.toast({
                type: 'error',
                title: 'Failed to complete action',
                subtitle: 'Now',
                content: `${xhr.responseText}`,
                delay: 5000,
            });
        }
    });
    return false;
}
function afterAction(action, data, id, confirm) {
    const message = document.getElementById(`message-${id}`);
    if (message || (action === 'Pin' || action === 'Unpin' || action === 'PinUser' || action === 'UnpinUser')) {
        console.log('Message Request Sent!')
        if (action === 'Pin' || action === 'Unpin') {
            [].forEach.call(document.querySelectorAll(`#fav-${id} > i.fas.fa-star`), function (el) {
                if (action.startsWith('Un')) {
                    el.classList.remove('favorited')
                } else {
                    el.classList.add('favorited')
                }
            });
        } else if (action === 'PinUser' || action === 'UnpinUser') {
            [].forEach.call(document.querySelectorAll(`#fav-${id} > i.fas.fa-star`), function (el) {
                if (action.startsWith('Un')) {
                    el.classList.remove('favorited')
                } else {
                    el.classList.add('favorited')
                }
            });
        } else if (action === 'MovePost' || action === 'RemovePost' || action === 'ArchivePost') {
            itemsRemoved++;
            try {
                message.remove();
            } catch (e) {
                console.log(e);
            }
        } else if (action === 'RotatePost') {
            try {
                message.querySelector('div#postImage').style.transform = 'rotate(' + imageRotate + 'deg)';
            } catch (e) {
                console.log(e);
            }
        } else if (action === 'RenamePost') {
            document.getElementById(`message-${id}`).setAttribute('data-msg-filename', newFileName);
            if (pageType.includes('file')) {
                try {
                    message.querySelector('.align-middle').innerText = newFileName;
                } catch (e) {
                    console.log(e);
                }
            }
        } else if (action === 'EditTextPost') {
            document.getElementById(`message-${id}`).setAttribute('data-msg-bodyraw', newContents.split('\n').join('<br/>'));
        }
        if (confirm) {
            postsActions = [];
        }
    }
    return false;
}

function isTouchDevice(){
    return true == ("ontouchstart" in window || window.DocumentTouch && document instanceof DocumentTouch);
}
function registerLazyLoader() {
    if ("IntersectionObserver" in window) {
        lazyloadImages = document.querySelectorAll("div.lazy");
        let imageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.style.backgroundImage = `url(${entry.target.dataset.src})`;
                    entry.target.classList.remove("lazy");
                    imageObserver.unobserve(entry.target);
                }
            });
        }, {
            root: document.querySelector("#container"),
            rootMargin: "0px 0px 500px 0px"
        });

        lazyloadImages.forEach(function (image) {
            imageObserver.observe(image);
        });
    }
}
function registerURLHandlers(){
    toggleLightbox = false;
    $('.popover').popover('dispose');
    $('[data-toggle="popover"]').popover()
    if(isTouchDevice()===false) {
        $('[data-tooltip="tooltip"]').tooltip()
        $('[data-tooltip="tooltip"]').tooltip('hide')
    }
    $('a[href="#_"], a[href="#"] ').click(function(e){
        window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
        e.preventDefault();
    });
    $('a[data-fancybox="video"]').click(function(e){
        e.preventDefault();
    });
    $("[data-fancybox=gallery]").fancybox(options);
    $('.tz-gallery .col-image[data-msg-url-extpreview], .episode-row[data-msg-url-extpreview]')
        .mouseover(function() {
            const el = this.querySelector('div#postImage');
            el.style.backgroundImage = 'url("' + this.getAttribute('data-msg-url-preview') + '")';
        })
        .mouseout(function() {
            const el = this.querySelector('div#postImage');
            el.style.backgroundImage = 'url("' + this.getAttribute('data-msg-url-extpreview') + '")';
        });
}
function registerUserMenuHandlers() {
    $('#userMenu').on('show.bs.collapse', function () {
        if (document.getElementById('menuItemMain').classList.contains('kms-main-menu')) {
            $('#topbarKmsIcon').removeClass('d-none');
            $('#topbarIcon').addClass('d-none');
        } else {
            $('#topbarIcon').removeClass('d-none');
            $('#topbarKmsIcon').addClass('d-none');
        }
        $('#mainMenuBar').removeClass('top-padding-safety');
        $('.show-menu-open').removeClass('hidden');
        $('#topbarBackground').fadeIn();
        $('#topbar').addClass('shadow').addClass('menu-open');
        $('body').addClass('menu-open');
        const bottombar = document.querySelector('body').classList.contains('bottom-bar')
        const mediaRule = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
        if (mediaRule)
            mediaRule.content = (bottombar) ? "#000" : "#d07300"
        const mediaRule2 = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
        if (mediaRule2)
            mediaRule2.content = (bottombar) ? "#000" : "#4e1e06"
    })
    $('#userMenu').on('hidden.bs.collapse', function () {
        if (!($('#userMenu').hasClass('show'))) {
            $('.show-menu-open').addClass('hidden');
            $('#menuItemMain').collapse('show');
            $('#mainMenuBar').addClass('top-padding-safety');
            $('#topbar').removeClass('menu-open')
            if ($('html').scrollTop() <= 50) {
                $('#topbarBackground').fadeOut();
                $('#topbar').removeClass('shadow');
            }
            $('body').removeClass('menu-open');
            const bottombar = document.querySelector('body').classList.contains('bottom-bar')
            const mediaRule = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
            if (mediaRule) {
                if ($(document).scrollTop() > 50) {
                    mediaRule.content = (bottombar) ? "#000" : "#d07300"
                } else {
                    mediaRule.content = "#000"
                }
            }
            const mediaRule2 = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
            if (mediaRule2)
                mediaRule2.content = "#000"
        }
    })
}
function registerDateHandlers() {
    let start = undefined;
    let end = undefined;
    if (window.location.hash.substring(1).includes('datestart=') && window.location.hash.substring(1).includes('dateend=')) {
        start = moment(/datestart=([^&]+)/.exec(window.location.hash.substring(1))[1], "YYYY-MM-DD");
        end = moment(/dateend=([^&]+)/.exec(window.location.hash.substring(1))[1], "YYYY-MM-DD");
        if (start === moment().add(1, 'days') && end === moment().add(1, 'days')) {
            $('#dateText').html('Select Range');
        } else {
            $('#dateText').html(start.format('MMMM D, YYYY') + '<br>' + end.format('MMMM D, YYYY'));
        }
    } else if (window.location.hash.substring(1).includes('numdays=')) {
        const days = parseInt(/numdays=([^&]+)/.exec(window.location.hash.substring(1))[1]) - 1;
        start = moment().subtract(days, 'days').endOf('day');
        end = moment();
        $('#dateText').html(`${days} Days`);
    } else {
        start = moment().add(1, 'days').startOf('day');
        end = moment().add(1, 'days').endOf('day');
        $('#dateText').html('Select Range');
    }



    function applyDate(start, end) {
        if (start && end) {
            const startDate = start.format('YYYY-MM-DD');
            const endDate = end.format('YYYY-MM-DD');
            if (startDate === moment().add(1, 'days').format('YYYY-MM-DD') && endDate === moment().add(1, 'days').format('YYYY-MM-DD') ) {
                getNewContent(['datestart', 'dateend', 'numdays', 'offset'], []);
            } else {
                getNewContent(['datestart', 'dateend', 'numdays', 'offset'], [['datestart', startDate], ['dateend', endDate]]);
            }
        } else {
            getNewContent([], []);
        }
    }

    $('#postRange').daterangepicker({
        startDate: start,
        endDate: end,
        minDate: "04/01/1995",
        maxDate: moment().add(1, 'year').endOf('year'),
        opens: 'left',
        showDropdowns: true
    }, applyDate);
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.onmessage = function (e) {
        console.log('e.data', e.data);
    };
}
