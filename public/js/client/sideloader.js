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

try {
    window.addEventListener("load", () => {
        // CHROME
        if (!(navigator.userAgent.indexOf("Chrome") !== -1 || navigator.userAgent.indexOf("Firefox") !== -1 || navigator.userAgent.indexOf("Safari") !== -1)) {
            console.log("Unsupported browser");
        }
    });
} catch (err) {
    console.error(err)
}

$(function() {
    // JuneOS Browser Manager
    $.history.on('load change push pushed replace replaced', function(event, url, type) {
        if (event.type === 'change') {
            if (offlinePage && url === '') {
                getOfflinePages();
            }
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
let initialLoad = true;
let serviceWorkerReady = false;
let offlineEntities = [];
let offlineMessages = [];
let expiresEntities = [];
let expiresMessages = [];
let expiresTimes = [];
let kongouMediaCache = null;
let kongouMediaActiveURL = null;
let currentMediaMetadata = {};

let postsActions = [];
let apiActions = {};
let menuBarLocation = (getCookie("menuBarLocation") !== null) ? getCookie("menuBarLocation") : '';
let performaceMode = (getCookie("performaceMode") !== null) ? getCookie("performaceMode") === 'true' : false;
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
let undoActions = [];
let notificationControler = null;
let recoverable
let requestInprogress
let paginatorInprogress
let downloadAllController = null;
let unpackingJobs = new Map();
let offlineDownloadSignals = new Map();
let offlineDownloadController = new Map();
let downloadSpannedController = new Map();
let tempURLController = new Map();
let memoryVideoPositions = new Map();
let kmsVideoWatcher = null;
let search_list = [];
let element_list = [];
let lazyloadImages;
let extratitlewidth = 0
const networkKernelChannel = new MessageChannel();
let unpackerWorker = null;

const imageFiles = ['jpg','jpeg','jfif','png','webp','gif'];
const videoFiles = ['mp4','mov','m4v', 'webm'];
const audioFiles = ['mp3','m4a','wav', 'ogg', 'flac'];

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
function calculateTitleWidthPage() {
    if (document.getElementById('titleExtra') && $(window).width() >= 768) {
        document.getElementById('titleExtra').style['min-width'] = `fit-content`
        setTimeout(() => {
            extratitlewidth = $('#titleExtra').width() + 10
            if (extratitlewidth > 20) {
                $('#titleExtraStyleAdjustment').html(`<style>@keyframes slidetextextraout { from {max-width: 0;} to {max-width: ${extratitlewidth}px;} }; @keyframes slidetextextrain { from {max-width: ${extratitlewidth}px; to {max-width: 0;}} };</style>`);
            }
            document.getElementById('titleExtra').style['min-width'] = ``
        }, 3000);
    }
}

function togglePerformanceMode() {
    if (performaceMode) {
        disablePerformanceMode();
    } else {
        enablePerformanceMode();
    }
}
function enablePerformanceMode() {
    performaceMode = true;
    document.querySelector('body').classList.add('performance-mode');
    setCookie("performaceMode", "true");
    $.toast({
        type: 'warning',
        title: '<i class="fas fa-bolt pr-2"></i>Performance Mode',
        subtitle: '',
        content: `<p>Performance Mode is enabled, No effects, animations, or shadows are enabled</p>Some elements may be hard to read or my not look as intended!`,
        delay: 10000,
    });
}
function disablePerformanceMode() {
    performaceMode = false;
    document.querySelector('body').classList.remove('performance-mode');
    setCookie("performaceMode", "false");
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
        if (currentContext) {
            if (nextContext === 'seq' || nextContext === 'browser') {
                if (!initialLoad) {
                    document.getElementById('bootStatusIcons').classList.add('d-none');
                }
                await new Promise((animationCompleted) => { $.when($('#bootUpDisplay').fadeIn(250)).done(() => animationCompleted(true)); })
            } else if (nextContext === 'ticket') {
                await new Promise((animationCompleted) => { $.when($('#kmsBootDisplay').fadeIn(250)).done(() => animationCompleted(true)); })
            }
        }
    }

    if (offlinePage) {
        document.getElementById('offlinePages').classList.add('hidden');
    }
    if (initialLoad) {
        document.getElementById('bootLoaderStatus').innerText = 'Starting Handler...';
        document.getElementById('bootStatusIcons').children[0].style.opacity = 1;
    }
    responseComplete = false;
    $('#loadingSpinner').fadeIn();
    $(".container-fluid").fadeTo(500, 0.4);
    $(".container-fluid").addClass('disabled-pointer');
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
        $(".container-fluid").fadeTo(2000, 1);
        $(".container-fluid").removeClass('disabled-pointer');
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
            if (initialLoad) {
                document.getElementById('bootLoaderStatus').innerText = 'Rendering Application...';
                document.getElementById('bootStatusIcons').children[2].style.opacity = 1;
            }
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
            await new Promise((pageReady) => {
                $.when($(".container-fluid").fadeTo(250, 0.5)).done(async () => {
                    recoverable = response
                    let contentPage = $(response);
                    if (initialLoad)
                        document.getElementById('bootLoaderStatus').innerText = 'Injecting Static...';
                    if ($("#appStatic").children().length === 0 && contentPage.find('#appStatic').length > 0) {
                        $("#appStatic").html(contentPage.find('#appStatic').children());
                    }
                    contentPage.find('#topbar').addClass('no-ani').addClass('ready-to-scroll');
                    contentPage.find('a[href="#_"], a[href="#"] ').click(function(e){
                        if (_originalURL && _originalURL !== 'undefined')
                            window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
                        e.preventDefault();
                    });
                    if (initialLoad)
                        document.getElementById('bootLoaderStatus').innerText = 'Injecting Navigator...';
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
                    if (initialLoad)
                        document.getElementById('bootLoaderStatus').innerText = 'Injecting Content...';
                    $("#appContainer").html(contentPage.find('#appContent').children());
                    if ($("#appStaticPost").children().length === 0 && contentPage.find('#appStaticPost').length > 0) {
                        $("#appStaticPost").html(contentPage.find('#appStaticPost').children());
                    }
                    if (initialLoad)
                        document.getElementById('bootLoaderStatus').innerText = 'Welcome';
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                    scrollToTop(true);
                    if (_originalURL && _originalURL !== 'undefined' )
                        window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
                    pageReady(true);
                    responseComplete = true
                })
            })
        } else {
            if (push === true && !offlinePage) {
                $('#LoadNextPage').remove();
                let contentPage = $(response).find('#content-wrapper').children();
                Array.from(contentPage.find('[data-msg-eid]')).filter(e => e.id && offlineEntities.indexOf(e.getAttribute('data-msg-eid')) !== -1).map(async (e) => {
                    contentPage.find(`#${e.id} .hide-offline`).addClass('hidden');
                    contentPage.find(`#${e.id} #offlineReady`).removeClass('hidden');
                    contentPage.find(`#${e.id} .toggleOffline i`).addClass('text-success');
                    const expireIndex = expiresMessages.indexOf(e.id.split('-').pop())
                    if (expireIndex !== -1) {
                        contentPage.find(`#${e.id} #offlineExpiring`).removeClass('hidden');
                        contentPage.find(`#${e.id} #offlineExpiring > span`).text((() => {
                            if (expiresTimes[expireIndex] > 60)
                                return (expiresTimes[expireIndex] / 60).toFixed(1) + ' Hour(s)';
                            return expiresTimes[expireIndex].toFixed(0) + ' Min(s)';
                        })())
                    }
                });
                $("#contentBlock > .tz-gallery > .row").append(contentPage.find('.tz-gallery > .row').contents());
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
                $(".container-fluid").fadeTo(500, 1);
                $(".container-fluid").removeClass('disabled-pointer');
                responseComplete = true
            } else {
                if (initialLoad) {
                    document.getElementById('bootStatusIcons').children[2].style.opacity = 1;
                    document.getElementById('bootLoaderStatus').innerText = 'Rendering Page...';
                }
                await new Promise((pageReady) => {
                    $.when($(".container-fluid").fadeTo(250, 0.5)).done(async () => {
                        let contentPage = $(response).find('#content-wrapper').children();
                        contentPage.find('#topbar').addClass('no-ani').addClass('ready-to-scroll');
                        contentPage.find('a[href="#_"], a[href="#"] ').click(function (e) {
                            if (_originalURL && _originalURL !== 'undefined')
                                window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
                            e.preventDefault();
                        });
                        contentPage.find(".container-fluid").fadeTo(0, 0.5);
                        if (!offlinePage) {
                            Array.from(contentPage.find('[data-msg-eid]')).filter(e => e.id && offlineEntities.indexOf(e.getAttribute('data-msg-eid')) !== -1).map(async (e) => {
                                contentPage.find(`#${e.id} .hide-offline`).addClass('hidden');
                                contentPage.find(`#${e.id} #offlineReady`).removeClass('hidden');
                                contentPage.find(`#${e.id} .toggleOffline i`).addClass('text-success');
                                const expireIndex = expiresMessages.indexOf(e.id.split('-').pop())
                                if (expireIndex !== -1) {
                                    contentPage.find(`#${e.id} #offlineExpiring`).removeClass('hidden');
                                    contentPage.find(`#${e.id} #offlineExpiring > span`).text((() => {
                                        const time = ((expiresTimes[expireIndex] - Date.now()) / 60000)
                                        if (time > 60)
                                            return (time / 60).toFixed(1) + ' Hour(s)';
                                        if (time <= 0)
                                            return 'Soon'
                                        return time.toFixed(0) + ' Min(s)';
                                    })())
                                }
                            });
                            if (initialLoad)
                                document.getElementById('bootLoaderStatus').innerText = 'Injecting Results...';
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
                                } else {
                                    pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="history.go(-1); return false;"><i class="fas fa-arrow-left"></i></a>`)
                                }
                                if (shift <= resultsTotal) {
                                    pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="nextPage" title="Next Page" href="#_" role="button" accesskey="."  onclick="getNewContent([], [['offset', '${shift}']]); return false;"><i class="fa fa-arrow-right"></i></a>`)
                                }
                            }
                            $("#pageNav").html(pageButtons.join(''));
                        }
                        if (initialLoad)
                            document.getElementById('bootLoaderStatus').innerText = 'Setting Layout...';
                        setImageLayout(setImageSize);
                        setPageLayout(false);
                        if (initialLoad)
                            document.getElementById('bootLoaderStatus').innerText = 'Requesting Paginator...';
                        if (!pageTitle.includes(' - Item Details') && !offlinePage) {
                            getPaginator(url);
                        }
                        scrollToTop(true);
                        if (!offlinePage) {
                            if (initialLoad)
                                document.getElementById('bootLoaderStatus').innerText = 'Restoring Panels...';
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
                        }
                        undoActions = [];
                        pageReady(true);
                        responseComplete = true
                    })
                })
            }
            (async () => {
                const checkUrl = params(['responseType', 'nsfwEnable', 'pageinatorEnable', 'offset', 'limit', '_h'], [], url);
                const isAvailable = await kernelRequestData({type: 'GET_STORAGE_PAGE', url: checkUrl}, true);
                if (isAvailable) {
                    $('#pageIsOffline').removeClass('d-none').addClass('d-flex')
                } else {
                    $('#pageIsOffline').addClass('d-none').removeClass('d-flex')
                }
            })()
            $("title").text(pageTitle);
            let addOptions = [];
            if (url.includes('offset=') && !initialLoad) {
                let _h = (url.includes('_h=')) ? parseInt(/_h=([^&]+)/.exec(url)[1]) : 0;
                addOptions.push(['_h', `${(!isNaN(_h)) ? _h + 1 : 0}`]);
            }
            const _url = params(['responseType', 'nsfwEnable', 'pageinatorEnable', 'limit'], addOptions, url);
            $.history.push(_url, (_url.includes('offset=')));
            $(".container-fluid").fadeTo(500, 1);
            $(".container-fluid").removeClass('disabled-pointer');
            responseComplete = true
        }
        pageType = url.split('/')[0];
        if (initialLoad) {
            document.getElementById('bootStatusIcons').children[3].style.opacity = 1;
            document.getElementById('bootLoaderStatus').innerText = 'Welcome!';
            $('#bootBackdrop').fadeOut(500);
        }
        initialLoad = false
        if(!isTouchDevice()) {
            $('[data-tooltip="tooltip"]').tooltip()
            $('[data-tooltip="tooltip"]').tooltip('hide')
        }
    }
    if (nextContext !== currentContext) {
        setTimeout(() => {
            $.when($('#bootUpDisplay, #kmsBootDisplay').fadeOut(500)).done(() => {
                document.getElementById('bootUpDisplay').querySelector('.boot-status-holder').innerText = "JuneOS Platform v20"
                document.getElementById('kmsBootDisplay').querySelector('.boot-status-holder').innerText = "Kongou Media Project v9"
            });
        }, 2000);
    }
    currentContext = nextContext;

    return false;
}

async function getNewContent(remove, add, url, keep) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    if (initialLoad)
        document.getElementById('bootLoaderStatus').innerText = 'Checking Path...';
    let _url = (() => {
            try {
                if (url) { return url.split('://' + window.location.host).pop() }
                if ($.history) { return $.history.url() }
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            } catch (e) {
                console.error("Failed to access URL data, falling back")
                if (initialLoad)
                    document.getElementById('bootLoaderStatus').innerText = 'Path Data Invalid!';
                console.error(e)
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            }
        })()
    if (_url === null) { transitionToOOBPage('/'); return false; };
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
    if (initialLoad)
        document.getElementById('bootLoaderStatus').innerText = 'Sanitizing Path...';

    console.log(_url);
    if (offlinePage) {
        if ((_url.startsWith('/gallery') || _url.startsWith('/files') || _url.startsWith('/tvTheater') || _url.startsWith('/listTheater'))) {
            let titleBarHTML;
            const eids = await (async () => {
                const revisedUrl = params(['limit', 'offset', '_h'], [], _url)
                if (revisedUrl.split('?').pop().length === 0)
                    return false;
                const isFoundPage = await kernelRequestData({type: 'GET_STORAGE_PAGE_ITEMS', url: revisedUrl})
                if (isFoundPage) {
                    titleBarHTML = ((isFoundPage && isFoundPage.titleBarHTML) ? isFoundPage.titleBarHTML : undefined)
                    return isFoundPage.items
                }
            })();
            if (_url.startsWith('/gallery')) {
                await generateGalleryHTML(_url, eids, titleBarHTML);
            } else if (_url.startsWith('/files')) {
                await generateFilesHTML(_url, eids, titleBarHTML);
            } else if (_url.startsWith('/tvTheater')) {
                await generateShowsHTML(_url);
            } else if (_url.startsWith('/listTheater')) {
                await generateEpisodeHTML(_url);
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
        if (initialLoad) {
            document.getElementById('bootLoaderStatus').innerText = 'Welcome!';
            $('#bootBackdrop').fadeOut(500);
        }
        if (nextContext !== currentContext) {
            setTimeout(() => {
                $('#bootUpDisplay, #kmsBootDisplay').fadeOut(500);
            }, 2000);
        }
        currentContext = nextContext;
        responseComplete = true;
        initialLoad = false;
        return true;
    }
    if (initialLoad) {
        document.getElementById('bootStatusIcons').children[1].style.opacity = 1;
        document.getElementById('bootLoaderStatus').innerText = 'Connecting...';
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
            if (initialLoad)
                document.getElementById('bootLoaderStatus').innerText = 'Processing Data...';
            requestCompleted(response, _url)
        },
        error: function (xhr) {
            if (initialLoad) {
                window.location.href = '/offline';
            } else {
                responseComplete = true
                $(".container-fluid").fadeTo(2000, 1);
                $(".container-fluid").removeClass('disabled-pointer');
                $.toast({
                    type: 'error',
                    title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                    subtitle: '',
                    content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/offline'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
                    delay: 10000,
                });
            }
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
    if (_url === null) { transitionToOOBPage('/'); return false; };
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
                content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/offline'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
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
        if (_url === null) { transitionToOOBPage('/'); return false; };
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
                $(".container-fluid").fadeTo(2000, 1);
                $(".container-fluid").removeClass('disabled-pointer');
                $.toast({
                    type: 'error',
                    title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                    subtitle: '',
                    content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/offline'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
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
                $(".container-fluid").fadeTo(2000, 1);
                $(".container-fluid").removeClass('disabled-pointer');
                $.toast({
                    type: 'error',
                    title: '<i class="fas fa-server pr-2"></i>Navigation Error',
                    subtitle: '',
                    content: `<p>Failed to navigate to the resource or page!</p><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/offline'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a><p>${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}</p>`,
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
            $(".container-fluid").fadeTo(2000, 1);
            $(".container-fluid").removeClass('disabled-pointer');
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
        $(".container-fluid").fadeTo(2000, 1);
        $(".container-fluid").removeClass('disabled-pointer');
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
            local: true
        }
        offlineDownloadController.set(_url, status);
        offlineDownloadSignals.set(_url, true);
        updateNotficationsPanel();
        notificationControler = setInterval(updateNotficationsPanel, 1000);

        for (let i in postsActions) {
            if (!offlineDownloadSignals.has(_url))
                break;
            const element = document.getElementById('message-' + postsActions[i].messageid);
            if (element) {
                cacheFileOffline(element, !(i === postsActions.length - 1), undefined, true)
                downloadedFiles++;
            }
            status = {
                ...status,
                downloaded: downloadedFiles
            }
            offlineDownloadController.set(_url, status);
        }
        postsActions = [];
        offlineDownloadController.delete(_url);
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
async function transitionToOOBPage(pageUrl) {
    if (pageUrl === '/offline')
        $('#bootUpDisplay').fadeIn(250);
    try {
        document.getElementById('bootBackdropSunrise').classList.add('hidden');
        $.when($('#bootBackdrop').fadeIn(500)).done(() => { location.href = pageUrl })
    } catch (e) {
        console.error('Failed to make fancy transition animation to home page');
        console.error(e);
        location.href = pageUrl
    }
}
async function requestSyncPages() {
    $.snack('success', `Requested Offline Pages Sync`, 5000)
    const results = await kernelRequestData({type: 'SYNC_PAGES_NEW_ONLY'});
    if (results && results.didActions) {
        if (results.itemsGot && results.itemsGot > 0) {
            $.snack('success', `Sync ${results.itemsGot} Items`, 5000)
        } else {
            $.snack('success', `There are no new new items to sync!`, 5000)
        }
    } else {
        $.snack('error', `There are no offline pages to sync!`, 5000)
    }
}

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
async function cacheFileOffline(element, noConfirm, preemptive, noDialog) {
    if (element) {
        const eid = element.getAttribute('data-msg-eid');
        const fileExists = (eid) ? await kernelRequestData({type: 'GET_STORAGE_FILE', eid}) : false;
        const meta = extractMetaFromElement(element, (preemptive && !fileExists));
        if (!noDialog)
            $('#offlineFileStartedModal').modal('show')
        kernelRequestData({
            type: 'SAVE_STORAGE_FILE',
            meta,
            noconfirm: noConfirm
        })
    }
}
async function cacheEpisodeOffline(element, noConfirm, preemptive, noDialog) {
    if (element) {
        const eid = element.getAttribute('data-msg-eid');
        const fileExists = await kernelRequestData({type: 'GET_STORAGE_FILE', eid: eid});
        const meta = extractMetaFromElement(element, (preemptive && !fileExists));
        if (!noDialog)
            $('#offlineFileStartedModal').modal('show')
        kernelRequestData({
            type: 'SAVE_STORAGE_KMS_EPISODE',
            meta,
            noconfirm: noConfirm
        })
    }
}
async function toggleEpisodeOffline(id) {
    const element = document.getElementById('message-' + id);
    if (element) {
        if (offlineMessages.indexOf(id) !== -1) {
            const postEID = element.getAttribute('data-msg-eid');
            deleteOfflineFile(postEID)
        } else {
            cacheEpisodeOffline(element)
        }
    }
}
async function toggleFileOffline(id) {
    const element = document.getElementById('message-' + id);
    if (element) {
        if (offlineMessages.indexOf(id) !== -1) {
            const postEID = element.getAttribute('data-msg-eid');
            deleteOfflineFile(postEID)
        } else {
            cacheFileOffline(element);
        }
    }
}
async function cachePageOffline(_url) {
    const limit = (document.getElementById("maxCountOfflinePage")) ? document.getElementById("maxCountOfflinePage").value : undefined;
    let requestOpts = [['responseType', 'offline']];
    if (limit && limit.length > 0 && !isNaN(parseInt(limit)))
        requestOpts.push(['num', limit]);
    const url = params(['offset', 'limit', '_h'], requestOpts, _url);
    $('#cachePageModal').modal('hide');
    await kernelRequestData({type: 'SAVE_STORAGE_PAGE', url, limit});
}
async function getSpannedFileIfAvailable(fileid) {
    const offlineSpannedFiles = await kernelRequestData({type: 'GET_STORAGE_SPANNED_FILE', fileid});
    if (offlineSpannedFiles) {
        let url
        if (!tempURLController.has(fileid)) {
            url = window.URL.createObjectURL(offlineSpannedFiles.block)
            tempURLController.set(fileid, url);
        } else {
            url = tempURLController.get(fileid);
        }
        return {
            ...offlineSpannedFiles,
            href: url
        }
    } else {
        return false;
    }
}
async function getAllOfflineSpannedFiles() {
    const offlineSpannedFiles = await kernelRequestData({type: 'GET_STORAGE_ALL_SPANNED_FILES'});
    if (offlineSpannedFiles) {
        return offlineSpannedFiles.map(e => {
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
        })
    } else {
        return false;
    }
}
async function getAllExpirableSpannedFiles() {
    const offlineSpannedFiles = await kernelRequestData({type: 'GET_STORAGE_ALL_SPANNED_FILES'});
    if (offlineSpannedFiles) {
        return offlineSpannedFiles.filter(e => e.expires).map(e => {
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
        })
    } else {
        return false;
    }
}
async function deleteOfflinePage(_url, noupdate) {
    const url = params(['limit', 'offset', 'num', '_h'], [], _url);
    if (url) {
        return await kernelRequestData({type: 'REMOVE_STORAGE_PAGE', url: url, noupdate: noupdate})
    } else {
        console.log('URL not validated')
    }
}
async function deleteOfflineFile(eid, noupdate, preemptive) {
    return await kernelRequestData({type: 'REMOVE_STORAGE_FILE', eid, noupdate, preemptive})
}
async function expireOfflineFile(eid, noupdate, hours) {
    return await kernelRequestData({type: 'EXPIRE_STORAGE_FILE', eid, noupdate, hours})
}
async function keepExpireOfflineFile(eid, noupdate) {
    return await kernelRequestData({type: 'KEEP_EXPIRE_STORAGE_FILE', eid, noupdate})
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
    await clearCache(['generic', 'kernel', 'config', 'temp-']);
    await kernelRequestData({type: 'INSTALL_KERNEL'})
    window.location.reload();
}
async function clearAllOfflineData() {
    $('#cacheModal').modal('hide');
    return await kernelRequestData({type: 'CLEAR_ALL_STORAGE'})
}
async function clearCDNCache() {
    return await kernelRequestData({type: 'CLEAN_TEMP_CACHE'})
}

async function generateGalleryHTML(url, eids, topText) {
    $("#userMenu").collapse("hide");
    try {
        setupReq(undefined, url);
        const _params = new URLSearchParams('?' + url.split('#').pop().split('?').pop());
        await new Promise((pageReady) => {
            $.when($(".container-fluid").fadeTo(250, 0.5)).done(async () => {
                let resultRows = [];
                const files = await kernelRequestData({type: 'GET_STORAGE_ALL_FILES'});
                const allResults = files.filter(e => (e.data_type === 'image' || e.data_type === 'video') && ((eids && eids.indexOf(e.eid) !== -1) || (!eids && !e.page_item))).sort(function (a, b) {
                    if (eids)
                        return eids.indexOf(a.eid) - eids.indexOf(b.eid);
                    return parseFloat(b.eid) - parseFloat(a.eid);
                });
                let offset = (_params.has('offset')) ? parseInt(_params.getAll('offset')[0]) : 0
                if (allResults.length < offset)
                    offset = 0;
                const shift = offset + 100;
                let pageButtons = [];
                if (allResults.length > 100) {
                    if (offset > 0) {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="getNewContent([], [['offset', '${(offset > 100) ? offset - 100 : 0}']]); return false;"><i class="fas fa-arrow-left"></i></a>`)
                    } else {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="history.go(-1); return false;"><i class="fas fa-arrow-left"></i></a>`)
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
                    return `<div class="col-image col-dynamic col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3" ${(e.htmlAttributes && e.htmlAttributes.length > 0) ? e.htmlAttributes.filter(j => !j.startsWith('class=')).join(' ') : ''}><div class="overlay-icons">
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
</div><div class="internal-lightbox d-block"></div><a class="lightbox" ${(e.data_type === 'video') ? 'data-fancybox="video" href="#_" onclick="PlayVideo(\'' + url + '\'); return false;"' : 'data-fancybox="gallery" href="' + url + '"'}><div id="postImage" class="square img img-responsive" style="background-image: url('${(e.extpreview_url) ? e.extpreview_url : e.preview_url}');"></div><div id="postBackground" style="background-color: rgb(${(e.color) ? e.color.slice(0, 3).join(', ') : '128, 128, 128'});"></div></a></div>`
                }))

                if (resultRows.length > 0) {
                    const randomImage = allResults[Math.floor(Math.random() * allResults.length)]
                    document.getElementById('contentBlock').innerHTML = `<style>
.background-image:not(.overlay) {
    background-image: url("${(randomImage.extpreview_url) ? randomImage.extpreview_url : randomImage.preview_url}");
}

.background-image.overlay {
    background-image: linear-gradient(180deg, #000000b8, #00000000);
    z-index: -99;
    opacity: 1;
}
</style><div class="tz-gallery"><div class="row">${resultRows.join(' ')}</div></div>`
                    if (topText) {
                        document.getElementById('titleBarContents').innerHTML = topText;
                    } else {
                        document.getElementById('titleBarContents').innerHTML = '<ul class="navbar-nav text-primary text-ellipsis"><li class="nav-item text-right page-title text-primary mr-1" id="topAddressBarInfo"><i class="far mr-2 fa-photo-film"></i><span class="text-uppercase">Gallery</span></li></ul>'
                    }
                    
                    registerLazyLoader();
                    registerURLHandlers();
                    extratitlewidth = 0;
                    calculateTitleWidthPage();
                    setImageLayout(setImageSize);
                    window.history.replaceState({}, null, `/offline#${_originalURL}`);
                    $("#pageNav").html(pageButtons.join(''));
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                } else {
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                    $.toast({
                        type: 'error',
                        title: 'No Results Found',
                        subtitle: 'Error',
                        content: `Nothing was found, Please try another option or search term`,
                        delay: 10000,
                    })
                }
                pageReady(true);
                responseComplete = true;
            })
        })
    } catch (err) {
        responseComplete = true;
        $(".container-fluid").fadeTo(2000, 1);
        $(".container-fluid").removeClass('disabled-pointer');
        console.error(`Uncaught Item HTML Generator Error`);
        console.error(err)
        $.toast({
            type: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not render page!</p><p>Internal Application Error: ${err.message}</p>`,
            delay: 10000,
        });
    }
}
async function generateFilesHTML(url, eids, topText) {
    $("#userMenu").collapse("hide");
    try {
        setupReq(undefined, url);
        const _params = new URLSearchParams('?' + url.split('#').pop().split('?').pop());
        await new Promise((pageReady) => {
            $.when($(".container-fluid").fadeTo(250, 0.5)).done(async () => {
                let resultRows = [];
                const files = await kernelRequestData({type: 'GET_STORAGE_ALL_FILES'});
                const allResults = files.filter(e => (e.data_type === 'audio' || e.data_type === 'generic') && ((eids && eids.indexOf(e.eid) !== -1) || (!eids && !e.page_item))).sort(function (a, b) {
                    if (eids)
                        return eids.indexOf(a.eid) - eids.indexOf(b.eid);
                    return parseFloat(b.eid) - parseFloat(a.eid);
                });
                let offset = (_params.has('offset')) ? parseInt(_params.getAll('offset')[0]) : 0
                if (allResults.length < offset)
                    offset = 0;
                const shift = offset + 100;
                let pageButtons = [];
                if (allResults.length > 100) {
                    if (offset > 0) {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="getNewContent([], [['offset', '${(offset > 100) ? offset - 100 : 0}']]); return false;"><i class="fas fa-arrow-left"></i></a>`)
                    } else {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="history.go(-1); return false;"><i class="fas fa-arrow-left"></i></a>`)
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
                    if (topText) {
                        document.getElementById('titleBarContents').innerHTML = topText;
                    } else {
                        document.getElementById('titleBarContents').innerHTML = '<ul class="navbar-nav text-primary text-ellipsis"><li class="nav-item text-right page-title text-primary mr-1" id="topAddressBarInfo"><i class="far mr-2 fa-music"></i><span class="text-uppercase">Music</span></li></ul>'
                    }
                    registerLazyLoader();
                    calculateTitleWidthPage();
                    registerURLHandlers();
                    window.history.replaceState({}, null, `/offline#${_originalURL}`);
                    $("#pageNav").html(pageButtons.join(''));
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                } else {
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                    $.toast({
                        type: 'error',
                        title: 'No Results Found',
                        subtitle: 'Error',
                        content: `Nothing was found, Please try another option or search term`,
                        delay: 10000,
                    })
                }
                responseComplete = true;
                pageReady(true);
            })
        })
    } catch (err) {
        responseComplete = true;
        $(".container-fluid").fadeTo(2000, 1);
        $(".container-fluid").removeClass('disabled-pointer');
        console.error(`Uncaught Item HTML Generator Error`);
        console.error(err)
        $.toast({
            type: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not render page!</p><p>Internal Application Error: ${err.message}</p>`,
            delay: 10000,
        });
    }
}
async function generateShowsHTML(url) {
    $("#userMenu").collapse("hide");
    try {
        setupReq(undefined, url);
        const _params = new URLSearchParams('?' + url.split('#').pop().split('?').pop());
        await new Promise((pageReady) => {
            $.when($(".container-fluid").fadeTo(250, 0.5)).done(async () => {
                let resultRows = [];
                const shows = await kernelRequestData({type: 'GET_STORAGE_ALL_KMS_SHOW'})
                const allResults = shows.sort(function (a, b) {
                    return b.name - a.name;
                });
                let offset = (_params.has('offset')) ? parseInt(_params.getAll('offset')[0]) : 0
                if (allResults.length < offset)
                    offset = 0;
                const shift = offset + 100;
                let pageButtons = [];
                if (allResults.length > 100) {
                    if (offset > 0) {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="getNewContent([], [['offset', '${(offset > 100) ? offset - 100 : 0}']]); return false;"><i class="fas fa-arrow-left"></i></a>`)
                    } else {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="prevPage" title="Go Back" href="#_" role="button" accesskey="," onClick="history.go(-1); return false;"><i class="fas fa-arrow-left"></i></a>`)
                    }
                    if (shift <= allResults.length) {
                        pageButtons.push(`<a class="bottomBtn btn btn-lg btn-circle red" id="nextPage" title="Next Page" href="#_" role="button" accesskey="."  onclick="getNewContent([], [['offset', '${shift}']]); return false;"><i class="fa fa-arrow-right"></i></a>`)
                    }
                }

                // noinspection CssUnknownTarget
                resultRows = await Promise.all(allResults.slice(offset, shift).map(async e => {
                    return `<div class="col-image col-dynamic col-6 col-sm-6 col-md-4 col-lg-3 col-xl-2" id="series-" data-search="${e.name}; ${e.meta.originalName}; ${e.meta.genres};">
<div class="show-overlay-items position-absolute">
    <div class="show-controls px-2 py-1">
        <div class="show-banners">
            ${(e.subtitled) ? '<div class="badge bg-darker mr-1"><i class="fas fa-closed-captioning"></i></div>' : ''}
            ${(e.nsfw) ? '<div class="badge badge-danger mr-1"><i class="fas fa-octagon-minus"></i><span class="pl-1 no-dynamic-small d-none d-sm-inline">UNCENSORED</span></div>' : ''}
            <div class="ml-auto"></div>
        </div>
        <div class="show-buttons"></div>
    </div>
</div><a href="#/listTheater?show_id=${e.showId}">
    <div class="tv-poster img img-responsive no-hover" id="postImage" style="background-image : url('/media_attachments${e.poster}?height=580&width=384'); background-size: cover!important;"></div>
    <div class="episode-background"></div>
</a>
</div>`
                }))
                if (resultRows.length > 0) {
                    document.getElementById('contentBlock').innerHTML = `<div class="mb-2">
<form class="col form-inline navbar-search top-menu-search-bar" onsubmit="return false;" method="get" style="width: 100%;">
    <div class="input-group w-100">
        <div class="input-group-prepend"><i class="far fa-search align-self-center"></i></div><input class="text-white form-control top-menu-search-bar border-0" id="seriesSearch" type="text" placeholder="Search Shelf..." aria-label="Search Shelf..." onchange="searchSeriesList(this);" onkeyup="searchSeriesList(this);" onpaste="searchSeriesList(this);" oninput="searchSeriesList(this);" />
    </div>
</form>
</div><div class="tz-gallery"><div class="row">${resultRows.join(' ')}</div></div>`
                    document.getElementById('titleBarContents').innerHTML = '<ul class="navbar-nav text-primary text-ellipsis"><li class="nav-item text-right page-title text-primary mr-1" id="topAddressBarInfo"><i class="far mr-2 fa-ticket"></i><span class="text-uppercase">Theater</span></li></ul>'
                    registerLazyLoader();
                    registerURLHandlers();
                    setImageLayout(setImageSize);
                    window.history.replaceState({}, null, `/offline#${_originalURL}`);
                    $("#pageNav").html(pageButtons.join(''));
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                    element_list = Array.from(document.querySelectorAll('[data-search]'))
                    search_list = element_list.map(e => e.id + ' -- ' + e.getAttribute('data-search').toLowerCase())
                } else {
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                    $.toast({
                        type: 'error',
                        title: 'No Results Found',
                        subtitle: 'Error',
                        content: `Nothing was found, Please try another option or search term`,
                        delay: 10000,
                    })
                }
                pageReady(true);
                responseComplete = true;
            })
        })
    } catch (err) {
        responseComplete = true;
        $(".container-fluid").fadeTo(2000, 1);
        $(".container-fluid").removeClass('disabled-pointer');
        console.error(`Uncaught Item HTML Generator Error`);
        console.error(err)
        $.toast({
            type: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not render page!</p><p>Internal Application Error: ${err.message}</p>`,
            delay: 10000,
        });
    }
}
async function generateEpisodeHTML(url) {
    $("#userMenu").collapse("hide");
    try {
        setupReq(undefined, url);
        const _params = new URLSearchParams('?' + url.split('#').pop().split('?').pop());
        await new Promise((pageReady) => {
            $.when($(".container-fluid").fadeTo(250, 0.5)).done(async () => {
                let resultRows = [];
                const showId = _params.getAll('show_id')[0];
                const episodes = await kernelRequestData({type: 'GET_STORAGE_KMS_SHOW', id: showId});

                if (episodes && episodes.episodes && episodes.show) {
                    resultRows = await Promise.all(episodes.episodes.sort(function (a, b) {
                        return (((b.season || 0) + 1) * (b.episode || 0)) - (((a.season || 0) + 1) * (a.episode || 0));
                    }).map(async e => {
                        return `<div class="col-12 col-sm-6 col-md-4 m-0 flex-nowrap episode-row p-1" ${(e.htmlAttributes && e.htmlAttributes.length > 0) ? e.htmlAttributes.filter(j => !j.startsWith('class=')).join(' ') : 'id="message-' + e.id + '"'}>
    <div class="episode-preview-grid">
        <div class="preview-watched d-flex pr-2">
            <div class="watched-precent mt-auto" style="width: 0%"></div>
        </div>
        <div class="position-absolute pr-2 pb-2" style="height: 100%; width: inherit;">
            <div class="position-relative w-100 h-100 d-flex flex-column" style="background-image: linear-gradient(129deg, #000000bd, transparent);">
                <div class="d-flex w-100">
                    <div class="episode-name-grid p-2 text-ellipsis"><span>${(e.media && e.media.meta && e.media.meta.name) ? e.media.meta.name : e.filename.split(' - ').slice(1).join(' - ').split('.')[0].trim()}</span></div>
                </div>
                <div class="preview-controls-grid d-flex" onclick="openKMSPlayer('${e.id}', '${episodes.show.id}'); return false;" style="z-index: 1;">
                    <div class="d-flex position-absolute">
                        <div class="badge badge-success" id="offlineReady" title="Saved Locally"><i class="fas fa-cloud-check"></i><span class="d-none d-md-inline pl-1">Offline</span></div>
                    </div>
                    <div class="play-icon mt-auto mb-auto mr-auto ml-auto shadow-text"><i class="fas fa-play"></i></div>
                </div>
                <div class="p-1 d-flex">
                    <a class="btn btn-links goto-link" data-placement="top" title="Search content related to this image" href="#_" onClick="showSearchOptions('${e.id}'); return false;"><i class="btn-links fas fa-info-circle"></i></a>
                </div>
            </div>
        </div>
        <div class="episode-number position-absolute"><span>${(e.media && e.media.season) ? e.media.season + 'x' : ''}${(e.media && e.media.episode) ? e.media.episode : ''}</span></div>
        <div class="episode-preview-image-grid h-100" id="postImage" style="background-image : url('${(e.extpreview_url) ? e.extpreview_url : e.preview_url}')"></div>
    </div>
</div>`
                    }))
                }



                if (episodes && episodes.episodes && episodes.show && resultRows.length > 0) {
                    document.getElementById('contentBlock').innerHTML = `<style>
.background-image:not(.overlay) {
    background-image: url("https://media.discordapp.net/attachments${episodes.show.background}");
}

.background-image.overlay {
    background-image: none;
    z-index: -99;
    opacity: 1;
}

.background-image.bg-blur {
    -webkit-filter: none;
    filter: none;
}

@media (min-width: 576px) {
    #contentBlock {
        box-shadow: 0 0 30px 0 black;
    }

    .show-background {
        background: #0000005c;
        border: 1px solid #872b007a;
        border-top: none;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
}

@media (max-width: 575px) {
    .background-image.overlay {
        background-image: linear-gradient(180deg, #000000b8, #00000000);
    }
}
</style><div class="show-header p-3">
<div class="show-preview" style="background-image : url('${episodes.episodes[0].preview_url}');"></div>
<div class="show-preview-overlay"></div>
<div class="d-none d-sm-block show-poster mr-1"><img src="/media_attachments${episodes.show.poster}" /></div>
<div class="show-info px-2 w-100">
    <div class="show-title"><a class="text-white" href="https://themoviedb.org/${(episodes.show.meta.seasons) ? 'tv' : 'movie'}/${episodes.show.id}" target="_blank" rel="noopener noreferrer"><span>${episodes.show.original_name}</span></a></div>
    <div class="show-og-title"><span>${episodes.show.name}</span></div>
    <div class="show-info-top d-flex flex-row">
        <div class="show-tags mr-auto">
            ${(episodes.show.nsfw) ? '<div class="badge badge-danger mr-1"><i class="fas fa-octagon-minus"></i><span class="pl-1">UNCENSORED</span></div>' : ''}
            ${(episodes.show.subtitled) ? '<div class="badge badge-light mr-1"><i class="fas fa-closed-captioning"></i><span class="pl-1">Subtitled</span></div>' : ''}
            ${episodes.show.meta.genres.map(f => '<span class="badge badge-light mr-1">' + f + '</span>').join('')}
        </div>
        <div class="show-date mt-2"><span>${(episodes.show.meta.date) ? episodes.show.meta.date.split('-')[0] : ''}</span></div>
    </div>
    <div class="show-description"><span>${episodes.show.meta.description}</span></div>
</div>
</div><div class="show accordion accordion-flush show-background pt-4 p-sm-4 " id="seasonsAccordion-${episodes.show.id}"><div class="accordion-body d-flex row m-0">${resultRows.join(' ')}</div></div>`
                    document.getElementById('titleBarContents').innerHTML = `<ul class="navbar-nav text-primary text-ellipsis"><li class="nav-item text-right page-title text-primary mr-1" id="topAddressBarInfo"><div class="d-inline-flex" id="titleIcon"><i class="far mr-2 fa-tv"></i></div><div class="d-inline-flex" id="titleExtraStyleAdjustment"></div><div class="d-none d-md-inline-flex" id="titleExtra"><span class="pr-1 align-self-baseline text-uppercase">Theater</span><i class="far fa-chevron-right pr-1 align-self-baseline"></i></div><div class="d-inline" id="titleMain"><span class="align-self-baseline text-uppercase">${episodes.show.name}</span></div>`
                    registerLazyLoader();
                    registerURLHandlers();
                    calculateTitleWidthPage();
                    setImageLayout(setImageSize);
                    window.history.replaceState({}, null, `/offline#${_originalURL}`);
                    $("#pageNav").html('');
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                } else {
                    $(".container-fluid").fadeTo(2000, 1);
                    $(".container-fluid").removeClass('disabled-pointer');
                    $.toast({
                        type: 'error',
                        title: 'No Results Found',
                        subtitle: 'Error',
                        content: `Nothing was found, Please try another option or search term`,
                        delay: 10000,
                    })
                }
                pageReady(true);
                responseComplete = true;
            })
        })
    } catch (err) {
        responseComplete = true;
        $(".container-fluid").fadeTo(2000, 1);
        $(".container-fluid").removeClass('disabled-pointer');
        console.error(`Uncaught Item HTML Generator Error`);
        console.error(err)
        $.toast({
            type: 'error',
            title: '<i class="fas fa-sd-card pr-2"></i>Application Error',
            subtitle: '',
            content: `<p>Could not render page!</p><p>Internal Application Error: ${err.message}</p>`,
            delay: 10000,
        });
    }
}
async function getOfflinePages() {
    if (document.getElementById('offlinePageList')) {
        scrollToTop();
        document.getElementById('offlinePages').classList.remove('hidden');
        $("#userMenu").collapse("hide")
        const pages = await kernelRequestData({type: 'GET_STORAGE_ALL_PAGES'});
        document.getElementById('offlinePageList').innerHTML = pages.map(page => {
            let icon = 'fa-page';
            if (page.url.includes('/gallery'))
                icon = 'fa-image'
            if (page.url.includes('/files'))
                icon = 'fa-music'
            if (page.url.includes('/cards'))
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
async function displayOfflineData() {
    try {
        let linkedEids = [];
        let linkedFileids = [];
        const pages = await kernelRequestData({type: 'GET_STORAGE_ALL_PAGES'});
        const pageRows = pages.map((e,i) => {
            let icon = 'fa-page';
            if (e.url.includes('/gallery'))
                icon = 'fa-image'
            if (e.url.includes('/files'))
                icon = 'fa-folder'
            if (e.url.includes('/cards'))
                icon = 'fa-message'
            if (e.url.includes('album='))
                icon = 'fa-archive'
            if (e.items)
                linkedEids.push(...e.items);

            return`<div class="d-flex py-1 align-items-center" id='cachePageItem-${i}'>
            <div class="px-2"><i class="fas ${icon}"></i></div>
            <div class="w-100"><span>${e.title}</span></div>
            <div class="d-flex">
                <a class="p-2" href="#_" onclick="kernelRequestData({ type: 'SAVE_STORAGE_PAGE', url: '${e.url}' }); return false">
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

        const files = await kernelRequestData({type: 'GET_STORAGE_ALL_FILES'});
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

        const usedDBStorage = document.getElementById('storageDBUsed');
        const usedCacheStorage = document.getElementById('storageCacheUsed');
        const usedOtherStorage = document.getElementById('storageOtherUsed');
        const freeStorage = document.getElementById('storageFreeText');

        try {
            const usedSpace = await navigator.storage.estimate();
            const freeSpace = (usedSpace.quota - usedSpace.usage);
            const freeSpaceText = (() => {
                if (freeSpace > 1000000000000) {
                    return (freeSpace / 1000000000000).toFixed(2) + ' TB'
                } else if (freeSpace > 1000000000) {
                    return (freeSpace / 1000000000).toFixed(2) + ' GB'
                } else if (freeSpace > 1000000) {
                    return (freeSpace / 1000000).toFixed(2) + ' MB'
                } else {
                    return (freeSpace / 1000).toFixed(2) + ' KB'
                }
            })();


            usedDBStorage.style.width = `${(usedSpace.usageDetails.indexedDB / usedSpace.quota) * 100}%`;
            usedCacheStorage.style.width = `${((usedSpace.usageDetails.caches + usedSpace.usageDetails.serviceWorkerRegistrations) / usedSpace.quota) * 100}%`;
            usedOtherStorage.style.width = `${((usedSpace.usage - (usedSpace.usageDetails.indexedDB + usedSpace.usageDetails.caches + usedSpace.usageDetails.serviceWorkerRegistrations)) / usedSpace.quota) * 100}%`;
            freeStorage.innerText = `${freeSpaceText} Free`;
        } catch (e) {
            freeStorage.innerText = `Not Available`;
            console.error(e);
            console.error(`Failed to get usage information`);
        }


        $('#cacheModal').modal('show');
    } catch (e) {
        $.toast({
            type: 'error',
            title: '<i class="fas fa-server pr-2"></i>Kernel Failure',
            subtitle: '',
            content: `<p>Unable to communicate with the application kernel</p><a class="btn btn-danger w-100" href="#_" onclick="clearKernelCache(); return false;"><i class="fas fa-microchip pr-2"></i>Reinstall Kernel</a>`,
            delay: 10000,
        });
    }
}

async function openUnpackingFiles(messageid, playThis, downloadPreemptive, offlineFile, doc) {
    const _post = (doc) ? doc.querySelector(`#message-${messageid}`) : document.getElementById(`message-${messageid}`);
    const fileid = _post.getAttribute('data-msg-fileid');
    const filename = _post.getAttribute('data-msg-filename');
    const filesize = _post.getAttribute('data-msg-filesize');
    const channelString = _post.getAttribute('data-msg-channel-string') === 'true';
    const fastAccess = (_post.getAttribute('data-msg-filecached') === 'true') ? _post.getAttribute('data-msg-download') : false;
    const videoModel = document.getElementById('videoBuilderModal');
    if (fileid && fileid.length > 0) {
        const element = document.getElementById(`fileData-${fileid}`);
        const storedFile = await getSpannedFileIfAvailable(fileid);

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
            } else if (playThis === 'audio') {
                PlayTrack(href);
            } else if (playThis === 'video') {
                $('#videoBuilderModal').modal('hide');
                const videoPlayer = videoModel.querySelector('video')
                if (!videoPlayer.paused)
                    memoryVideoPositions.set(previousJob.id, videoPlayer.currentTime);
                videoPlayer.pause();
                PlayVideo(href, `${previousJob.channel}/${previousJob.name} (${previousJob.size})`, fileid);
            } else if (playThis === 'kms-video') {
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
        } else {
            const responseMessage = await unpackRequestData({type: 'UNPACK_FILE', object: {
                    id: fileid,
                    messageid,
                    name: filename,
                    size: filesize,
                    channel: channelString,
                    preemptive: downloadPreemptive,
                    offline: true,
                    expires: (!offlineFile) ? (new Date().getTime()) + (4 * 3600000): false,
                    play: playThis
                }})
            if (responseMessage && responseMessage.type && responseMessage.fileid) {
                switch (responseMessage.type) {
                    case 'STATUS_UNPACK_STARTED':
                        if (downloadPreemptive) {
                            console.log(`Preemptive Download for ${filename}`);
                        } else if (playThis === 'kms-video' && !downloadPreemptive) {
                            // TODO: Check if unpacking applys to active video
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
                        break;
                    case 'STATUS_UNPACK_QUEUED':
                        if (!playThis || (playThis && playThis !== 'video' && !downloadPreemptive)) {
                            $.toast({
                                type: 'success',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `File is added to unpack queue`,
                                delay: 5000,
                            });
                        }
                        break;
                    case 'STATUS_UNPACK_DUPLICATE':
                        break;
                    case 'STATUS_UNPACK_FAILED':
                        $.toast({
                            type: 'error',
                            title: 'Unpack Failed',
                            subtitle: 'Now',
                            content: `File failed to start unpacking`,
                            delay: 5000,
                        });
                        break;
                    default:
                        break;
                }
            }
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

    const storedFile = await getSpannedFileIfAvailable(fileid);
    const href = (storedFile.href) ? storedFile.href : false;
    if (storedFile) {
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
    unpackingJobs.delete(fileid)
    unpackerWorker.postMessage({ type: 'CANCEL_UNPACK_FILE', fileid });
    kernelRequestData({type: 'CANCEL_UNPACK_FILE', fileid});
}
async function removeCacheItem(id) {
    const file = await getSpannedFileIfAvailable(id);
    const link = document.getElementById('fileData-' + id);
    if (link) {
        window.URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
    } else if (file) {
        window.URL.revokeObjectURL(file.href);
    }
    if (file) {
        await kernelRequestData({type: 'REMOVE_STORAGE_SPANNED_FILE', fileid: id});
    }
}

let kmsPreviewInterval = null;
let kmsPreviewLastPostion = null;
let kmsPreviewPrematureEnding = false;
async function openKMSPlayer(messageid, seriesId) {
    const activeDoc = (kongouMediaCache && kongouMediaActiveURL !== _originalURL) ? kongouMediaCache : document;
    $('#userMenu').collapse('hide');
    kongouControlsSeek.classList.add('hidden');
    kongouControlsSeekUnavalible.classList.add('no-seeking');
    const _post = activeDoc.querySelector(`#message-${messageid}`);
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
    const postKMSJSON = (() => {
        const _data = _post.getAttribute('data-kms-json');
        if (_data && _data.length > 2) {
            try {
                const data = JSON.parse(_data);
                if (data && data.meta)
                    return data
            } catch (e) {
                console.error(`Failed to parse Kongou Media Data`);
                console.error(e);
                return false
            }
        }
        return false
    })();
    let actionHandlers = [
        ['play', () => {
            if (document.querySelector('body').classList.contains('kms-play-open')) {
                kmsTogglePlay();
            } else {
                openKMSPlayer(messageid, show);
            }
        }],
        ['pause', kmsTogglePlay],
        ['stop', closeKMSPlayer],
        ['seekbackward', (time) => { kmsSeek(false, ((time.seekOffset || 10) * -1)) }],
        ['seekforward', (time) => { kmsSeek(false, (time.seekOffset || 10)) }],
        ['seekto',        (time) => { if (!kongouMediaVideoFull.classList.contains('hidden')) {
            if ('fastSeek' in kongouMediaVideoFull) {
                kongouMediaVideoFull.fastSeek(time.seekTime);
            } else {
                kongouMediaVideoFull.currentTime = time.seekTime
            }
        } }]
    ]
    if (postKMSJSON) {
        // = (postKMSJSON.show.poster) ? `https://media.discordapp.net/attachments${postKMSJSON.show.poster}` : '';
        currentMediaMetadata.artist = postKMSJSON.show.name || 'Unknown Series';
        currentMediaMetadata.title = (postKMSJSON.meta.name || 'No Title') + ((postKMSJSON.season && postKMSJSON.episode) ? ' (' + postKMSJSON.season + 'x' + postKMSJSON.episode + ')' : '');
        currentMediaMetadata.album = "Sequenzia x Kongou";
        if (postKMSJSON.show.poster) {
            currentMediaMetadata.artwork = [ { src: `https://media.discordapp.net/attachments${postKMSJSON.show.poster}?height=580&width=384`, type: 'image/jpeg' } ];
        } else {
            currentMediaMetadata.artwork = [];
        }
        // = postKMSJSON.meta.description || 'No Episode Description';
    } else {
        currentMediaMetadata.artist = 'Unknown Series';
        currentMediaMetadata.title = filename.split('.')[0];
        currentMediaMetadata.album = "Sequenzia x Kongou";
        currentMediaMetadata.artwork = [];
    }

    if (show && activeDoc.querySelector(`#seasonsAccordion-${show}`)) {
        try {
            const allEpisodes = Array.from(activeDoc.querySelector(`#seasonsAccordion-${show}`).querySelectorAll('.episode-row'));
            const index = allEpisodes.map(e => e.id).indexOf(`message-${messageid}`)
            const nextEpisode = allEpisodes.slice(index + 1);

            if (allEpisodes[index]) {
                currentEpisode.innerText = allEpisodes[index].querySelector('.episode-name > span').innerText;
            } else {
                currentEpisode.innerText = filename.split('.')[0];
            }

            if (nextEpisode.length > 0) {
                nextEpisodeGroup.classList.remove('hidden');
                kongouMediaPlayer.setAttribute('nextPlayback', nextEpisode[0].id.split('-').pop());
                actionHandlers.push(['nexttrack', kmsPlayNext])
            } else {
                nextEpisodeGroup.classList.add('hidden')
                kongouMediaPlayer.removeAttribute('nextPlayback');
                actionHandlers.push(['nexttrack', null])
            }

            if (index > 0) {
                const prevEpisode = allEpisodes.slice(0, index);
                if (prevEpisode.length > 0) {
                    prevEpisodeGroup.classList.remove('hidden')
                    kongouMediaPlayer.setAttribute('prevPlayback', prevEpisode.slice().pop().id.split('-').pop());
                    actionHandlers.push(['previoustrack', kmsPlayPrev])
                } else {
                    prevEpisodeGroup.classList.add('hidden')
                    kongouMediaPlayer.removeAttribute('prevPlayback');
                    actionHandlers.push(['previoustrack', null])
                }
            } else {
                prevEpisodeGroup.classList.add('hidden')
                kongouMediaPlayer.removeAttribute('prevPlayback');
                actionHandlers.push(['previoustrack', null])
            }
        } catch (e) {
            nextEpisodeGroup.classList.add('hidden')
            kongouMediaPlayer.removeAttribute('nextPlayback');
            actionHandlers.push(['nexttrack', null])
            prevEpisodeGroup.classList.add('hidden')
            kongouMediaPlayer.removeAttribute('prevPlayback');
            actionHandlers.push(['previoustrack', null])
            console.error("Could not get the rest of the episode list");
            console.error(e);
        }
    } else {
        nextEpisodeGroup.querySelector('span').innerText = '';
        nextEpisodeGroup.classList.add('hidden')
        actionHandlers.push(['nexttrack', null])
        kongouMediaPlayer.removeAttribute('nextPlayback');
        prevEpisodeGroup.querySelector('span').innerText = '';
        prevEpisodeGroup.classList.add('hidden')
        kongouMediaPlayer.removeAttribute('prevPlayback');
        actionHandlers.push(['previoustrack', null])
        currentEpisode.innerText = filename.split('.')[0];
    }

    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata(currentMediaMetadata);
        for (const [action, handler] of actionHandlers) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                console.log(`The media session action "${action}" is not supported yet.`);
            }
        }
    }

    if (!playerOpen) {
        //window.resizeTo(window.outerWidth, (window.outerHeight - window.innerHeight) + findHeight('16:9', window.outerWidth) - 8)
        document.querySelector('body').classList.add('kms-play-open');
        document.querySelector('body').classList.remove('kms-play-pip');
        const mediaRule = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
        const mediaRule2 = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
        if (mediaRule)
            mediaRule.content = "#000"
        if (mediaRule2)
            mediaRule2.content = "#000"
        kongouMediaCache = document.querySelector('#contentBlock')
        kongouMediaActiveURL = _originalURL + '';
    }
    kongouMediaPlayer.querySelector('.kms-status-bar > span').innerText = ''

    kongouMediaVideoPreview.classList.add('hidden');
    kongouMediaVideoFull.classList.add('hidden');

    kongouMediaPlayer.querySelector('.kms-progress-bar').style.width = "0%";
    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('bg-success');
    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.remove('bg-danger');
    kongouMediaPlayer.querySelector('.kms-progress-bar').classList.remove('hidden');

    if (fullURL && fullURL.endsWith('.mp4')) {
        kongouMediaVideoPreview.src = fullURL
        try {
            kongouMediaVideoPreview.play();
        } catch (err) { console.error(err); }
        kongouMediaVideoPreview.classList.remove('hidden');
    } else if (previewURL && previewURL.endsWith('.mp4')) {
        kongouMediaVideoPreview.src = previewURL
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
        await keepExpireOfflineFile(_post.getAttribute('data-msg-eid'))
        openUnpackingFiles(messageid, 'kms-video', undefined, undefined, activeDoc);
        if (active) {
            const _activePost = activeDoc.querySelector(`#message-${active}`);
            if (_activePost) {
                const activeFileid = _activePost.getAttribute('data-msg-fileid');
                const activeEid = _activePost.getAttribute('data-msg-eid');
                if (activeEid)
                    expireOfflineFile(activeEid, false, true);
                if (activeFileid)
                    stopUnpackingFiles(activeFileid);
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
async function kmsPreviewWatchdog() {
    if (kmsPreviewInterval !== null && !kongouMediaVideoPreview.paused && kongouMediaVideoPreview.currentTime - kmsPreviewLastPostion < 6) {
        kmsPreviewLastPostion = kongouMediaVideoPreview.currentTime;
        console.log(kmsPreviewLastPostion);
        kmsPreviewPrematureEnding = false;
    } else {
        console.log('Preview Video timecode changed to a unexpected time! Possibly reached end of preview');
        clearInterval(kmsPreviewInterval);
        kmsPreviewInterval = null;
        kmsPreviewPrematureEnding = true;
    }
}
async function saveCurrentTimeKMS(wasNext) {
    const activeDoc = (kongouMediaCache && kongouMediaActiveURL !== _originalURL) ? kongouMediaCache : document;
    const messageid = kongouMediaPlayer.getAttribute('activePlayback');
    if (messageid && !kongouMediaVideoFull.classList.contains('hidden')) {
        const _post = activeDoc.querySelector(`#message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        const eid = _post.getAttribute('data-msg-eid');
        const percentage = (kongouMediaVideoFull.currentTime / kongouMediaVideoFull.duration).toFixed(3);
        if (percentage > 0.05 && percentage <= 0.9) {
            memoryVideoPositions.set(fileid, kongouMediaVideoFull.currentTime);
        } else {
            memoryVideoPositions.delete(fileid);
        }
        if (!offlinePage)
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
        if ('fastSeek' in kongouMediaVideoFull) {
            // Only use fast seek if supported.
            kongouMediaVideoFull.fastSeek(kongouMediaVideoFull.currentTime + (((1 / 23.976) * 3) * seekTime));
        } else {
            kongouMediaVideoFull.currentTime = kongouMediaVideoFull.currentTime + (((1 / 23.976) * 3) * seekTime)
        }
    } else {
        if ('fastSeek' in kongouMediaVideoFull) {
            // Only use fast seek if supported.
            kongouMediaVideoFull.fastSeek(kongouMediaVideoFull.currentTime + seekTime);
        } else {
            kongouMediaVideoFull.currentTime = kongouMediaVideoFull.currentTime + seekTime
        }
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
    if (offlinePage) {
        $.snack('error', `Not possible Offline, Save screenshots localy`, 1500);
        return false;
    }
    let container = new DataTransfer();
    await Promise.all(Array.from(document.getElementById("kongouScreenShots").querySelectorAll('img')).map(async e => {
        let file = await fetch(e.src)
            .then(r => r.blob())
            .then(blobFile => new File([blobFile], (e.hasAttribute('download') ? e.getAttribute('download') : 'video-capture.png'), { type: "image/png", lastModified:new Date().getTime() }))
        container.items.add(file);
    }))
    document.getElementById('customFile').files = container.files;
    document.getElementById('customFile').dispatchEvent(new Event('change', { 'preset': true }))
    if (document.webkitIsFullScreen || document.mozFullScreen)
        document.cancelFullScreen();
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
function checkTabFocused() {
    if (document.querySelector('body').classList.contains('kms-play-open')) {
        if (document.visibilityState === 'visible') {
            if (document.querySelector('body').classList.contains('kms-play-pip') && !manualOpenPIP) {
                if (document.pictureInPictureElement)
                    document.exitPictureInPicture();
            }
        } else {
            if (!(document.webkitIsFullScreen || document.mozFullScreen))
                kongouMediaVideoFull.requestPictureInPicture()
        }
    }
}
document.addEventListener('visibilitychange', checkTabFocused);

let kmsStageMouseTimeout = null;
async function kmsPopUpControls() {
    if (kongouTitleBar.style.opacity === '0' )
        kongouControlsJQ.fadeTo(500, 1)
    clearTimeout(kmsStageMouseTimeout);
    kmsStageMouseTimeout = setTimeout(() => {
        $('.kms-stage:not(.keep-active-controls) .kms-title-bar, .kms-stage:not(.keep-active-controls) .kms-center-bar, .kms-stage:not(.keep-active-controls, .advanced-controls) .kms-bottom-bar').fadeTo(1000, 0);
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
    const activeDoc = (kongouMediaCache && kongouMediaActiveURL !== _originalURL) ? kongouMediaCache : document;
    document.cancelFullScreen = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || function () { return false; };
    if (document.webkitIsFullScreen || document.mozFullScreen)
        document.cancelFullScreen();
    const messageid = kongouMediaPlayer.getAttribute('activePlayback');
    const nextMessageid = kongouMediaPlayer.getAttribute('nextPlayback');
    await saveCurrentTimeKMS();
    if (messageid) {
        const _post = activeDoc.querySelector(`#message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        const eid = _post.getAttribute('data-msg-eid');
        if (eid && (kongouMediaVideoFull.currentTime / kongouMediaVideoFull.duration).toFixed(3) >= 0.9) {
            deleteOfflineFile(eid, true, true);
        }
        stopUnpackingFiles(fileid);
    }
    if (nextMessageid) {
        const _post = activeDoc.querySelector(`#message-${nextMessageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        stopUnpackingFiles(fileid);
    }
    kongouMediaVideoPreview.pause();
    kongouMediaVideoFull.pause();
    document.querySelector('body').classList.remove('kms-play-open');
    document.querySelector('body').classList.remove('kms-play-pip');
    kongouMediaActiveURL = null;
    clearInterval(kmsVideoWatcher); kmsVideoWatcher = null;
    kongouMediaVideoPreview.classList.add('hidden');
    kongouMediaVideoFull.classList.add('hidden');
    kongouMediaPlayer.removeAttribute('activePlayback');
    kongouMediaPlayer.removeAttribute('nextVideoReady');
    kongouMediaPlayer.removeAttribute('nextPlayback');
    kongouMediaPlayer.removeAttribute('prevPlayback');
    /*const actionHandlers = [ 'play', 'pause', 'stop', 'seekbackward', 'seekforward','seekto', 'nexttrack', 'previoustrack' ]
    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setPositionState(null)
        for (const action of actionHandlers) {
            try {
                navigator.mediaSession.setActionHandler(action, null);
            } catch (error) {
                console.log(`The media session action "${action}" is not supported yet.`);
            }
        }
    }*/
}
async function checkKMSTimecode() {
    const activeDoc = (kongouMediaCache && kongouMediaActiveURL !== _originalURL) ? kongouMediaCache : document;
    const messageid = kongouMediaPlayer.getAttribute('nextPlayback');
    const isReady = kongouMediaPlayer.getAttribute('nextVideoReady');
    if (messageid && document.querySelector('body').classList.contains('kms-play-open') &&
    !kongouMediaVideoFull.classList.contains('hidden')) {
        await saveCurrentTimeKMS();
        if (!isReady && ((kongouMediaVideoFull.currentTime / kongouMediaVideoFull.duration) >= 0.45)) {
            kongouMediaPlayer.setAttribute('nextVideoReady', 'true');
            const element = activeDoc.querySelector('#message-' + messageid);
            if (element) {
                cacheEpisodeOffline(element, true, true, true)
            }
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

async function updateNotficationsPanel() {
    const tempSpannedFiles = await getAllExpirableSpannedFiles();
    if (unpackingJobs.size !== 0 || offlineDownloadController.size !== 0 || tempSpannedFiles.length > 0) {
        let activeSpannedJob = false;
        let completedKeys = [];
        const keys = Array.from(unpackingJobs.keys()).map(e => {
            const item = unpackingJobs.get(e);
            let results = [`<a class="dropdown-item text-ellipsis d-flex align-items-baseline" style="max-width: 80vw;" title="Stop Extraction of this job" href='#_' onclick="stopUnpackingFiles('${e}'); return false;" role='button')>`]
            if (item.active) {
                results.push(`<i class="fas fa-spinner fa-spin-pulse"></i>`);
                if (item.swHandeler)
                    results.push(`<i class="fas fa-rectangle-code ${(item.active) ? ' pl-1' : ''}"></i>`);
                results.push(`<span class="text-ellipsis${(item.active || item.swHandeler) ? ' pl-1' : ''}">${item.name} (${item.size})</span>`);
                if (item.progress) {
                    activeSpannedJob = true;
                    results.push(`<span class="pl-2 text-success">${item.progress}%</span>`);
                }
            } else {
                results.push(`<i class="fas fa-hourglass-start pr-1"></i>`);
                if (item.swHandeler)
                    results.push(`<i class="fas fa-rectangle-code pr-1"></i>`);
                results.push(`<span class="text-ellipsis">${item.name} (${item.size})</span>`);
            }
            results.push(`</a>`);
            return results.join('\n');
        });
        const offlineKeys = Array.from(offlineDownloadController.keys()).map(e => {
            if (keys.length > 0)
                completedKeys.push(`<div class="dropdown-divider"></div>`);
            const item = offlineDownloadController.get(e);
            let results = [`<a class="dropdown-item text-ellipsis d-flex align-items-baseline" style="max-width: 80vw;" title="Stop Extraction of this job" href='#_' role='button' onclick="cancelPendingCache('${e}'); return false;")>`]
            results.push(`<i class="fas fa-cloud-download pr-2"></i>`);
            results.push(`<span class="text-ellipsis">${(item.title) ? item.title : e} (${item.totalItems})</span>`);
            results.push(`<span class="pl-2 text-success">${((item.downloaded / item.totalItems) * 100).toFixed(0)}%</span>`);
            results.push(`</a>`);
            return results.join('\n');
        });
        if (tempSpannedFiles.length > 0) {
            if (keys.length > 0 || offlineKeys.length > 0)
                completedKeys.push(`<div class="dropdown-divider"></div>`);
            completedKeys.push(...tempSpannedFiles.map(item => {
                let results = [];
                results.push(`<div style="padding: 0.5em 1.25em; display: flex; max-width: 87vw;">`)
                let clickAction = undefined;
                if (videoFiles.indexOf(item.name.split('.').pop().split('?')[0].toLowerCase().trim()) > -1) {
                    clickAction = `PlayVideo('${item.href}', '${item.channel}/${item.name} (${item.size})', '${item.id}');`
                } else if (audioFiles.indexOf(item.name.split('.').pop().split('?')[0].toLowerCase().trim()) > -1) {
                    clickAction = `PlayTrack('${item.href}');`
                }
                if (clickAction) {
                    results.push(`<a class="text-ellipsis mr-auto d-flex align-items-baseline" style="max-width: 80vw;"  title="Play File" href='#_' onclick="${clickAction} return false;" role='button')>`);
                } else {
                    results.push(`<a class="text-ellipsis mr-auto d-flex align-items-baseline" style="max-width: 80vw;"  title="Save File" href="${item.href}" role='button')>`);
                }
                results.push(`<i class="fas fa-clock mr-1"></i>`)
                if (item.play) {
                    if (item.play === 'video' || item.play === 'kms-video') {
                        results.push(`<i class="fas fa-film mr-1"></i>`)
                    } else if (item.play === 'audio') {
                        results.push(`<i class="fas fa-music mr-1"></i>`)
                    } else {
                        results.push(`<i class="fas fa-file mr-1"></i>`)
                    }
                }
                results.push(`<span class="text-ellipsis">${item.name} (${item.size})</span>`)
                if (clickAction) {
                    results.push(`</a>`);
                    results.push(`<a title="Save File" href='#_' onclick="openUnpackingFiles('${item.id}'); return false;">`);
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
        if (activeSpannedJob) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-laptop-arrow-down fa-fade';
        } else if (unpackingJobs.size !== 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-cog fa-spin';
        } else if (offlineKeys.length > 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-sync fa-spin';
        } else if (tempSpannedFiles.length !== 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-sd-card';
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
    const postOffline = (postID && offlineMessages.indexOf(postID) !== -1);
    const postDate = _post.getAttribute('data-msg-date');
    const postAuthorName = _post.getAttribute('data-msg-author');
    const postPreviewImage = _post.getAttribute('data-msg-url-preview');
    const postFullImage = _post.getAttribute('data-msg-url-full');
    const postAuthorImage = _post.getAttribute('data-msg-author-img');
    const postKMSJSON = (() => {
        const _data = _post.getAttribute('data-kms-json');
        if (_data && _data.length > 2) {
            try {
                const data = JSON.parse(_data);
                if (data && data.meta)
                    return data
            } catch (e) {
                console.error(`Failed to parse Kongou Media Data`);
                console.error(e);
                return false
            }
        }
        return false
    })();
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
    const modalKeepExpireingSection = document.getElementById(`keepExpireingFile`);
    const modalKeepExpireingButton = modalKeepExpireingSection.querySelector('a');
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

    const modelKMSRow = document.getElementById(`kmsContent`);
    const modelKMSPoster = document.getElementById(`kmsInfoPoster`);
    const modelKMSBaseName = document.getElementById(`kmsInfoShowName`);
    const modelKMSEpisodeName = document.getElementById(`kmsInfoEpisodeName`);
    const modelKMSEpisodeNumber = document.getElementById(`kmsInfoNumber`);
    const modelKMSEpisodeDescription = document.getElementById(`kmsInfoEpisodeDescription`);

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
        if (postOffline) {
            modalOfflineThisButton.querySelector('i').classList.remove('fa-cloud-download')
            modalOfflineThisButton.querySelector('i').classList.add('fa-cloud-xmark')
            modalOfflineThisButton.onclick = function () {
                deleteOfflineFile(postEID)
                $('#searchModal').modal('hide');
                return false;
            }
        } else {
            modalOfflineThisButton.querySelector('i').classList.add('fa-cloud-download')
            modalOfflineThisButton.querySelector('i').classList.remove('fa-cloud-xmark')
            if (postKMSJSON) {
                modalOfflineThisButton.onclick = function () {
                    const element = document.getElementById('message-' + postID);
                    if (element) {
                        cacheEpisodeOffline(element)
                    }
                    $('#searchModal').modal('hide');
                    return false;
                }
            } else {
                modalOfflineThisButton.onclick = function () {
                    const element = document.getElementById('message-' + postID);
                    if (element) {
                        cacheFileOffline(element);
                    }
                    $('#searchModal').modal('hide');
                    return false;
                }
            }
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
    if (postKMSJSON) {
        modelKMSRow.classList.remove('hidden');
        modelKMSPoster.src = (postKMSJSON.show.poster) ? `https://media.discordapp.net/attachments${postKMSJSON.show.poster}` : ''
        modelKMSBaseName.innerText = postKMSJSON.show.name || 'Unknown Series'
        modelKMSEpisodeName.innerText = postKMSJSON.meta.name || 'Unknown Episode'
        modelKMSEpisodeNumber.innerText = (postKMSJSON.season && postKMSJSON.episode) ? postKMSJSON.season + 'x' + postKMSJSON.episode : ''
        modelKMSEpisodeDescription.innerText = postKMSJSON.meta.description || 'No Episode Description'
        normalInfo.push(`<div class="badge badge-light text-dark mx-1"><i class="fas fa-tv pr-1"></i><span>Kongou Media Meta</span></div>`);
    } else {
        modelKMSRow.classList.add('hidden');
    }
    if (postFilID && postFilID.length > 0) {
        if (postOffline) {
            normalInfo.push('<div class="badge text-light mx-1" style="background: #00b14f;">')
            normalInfo.push(`<i class="fa fa-cloud-check pr-1"></i><span>Offline</span>`)
            normalInfo.push('</div>')
            const expireIndex = expiresMessages.indexOf(postID)
            if (expireIndex !== -1) {
                normalInfo.push('<div class="badge badge-warning text-dark mx-1">')
                normalInfo.push(`<i class="fa fa-clock pr-1"></i><span>Expires in ${(() => {
                    const time = ((expiresTimes[expireIndex] - Date.now()) / 60000)
                    if (time > 60)
                        return (time / 60).toFixed(1) + ' Hour(s)';
                    if (time <= 0)
                        return 'Soon'
                    return time.toFixed(0) + ' Min(s)';
                })()}</span>`)
                normalInfo.push('</div>')
                modalKeepExpireingSection.classList.remove('hidden');
                modalKeepExpireingButton.onclick = function () {
                    keepExpireOfflineFile(postEID);
                    $('#searchModal').modal('hide');
                    return false;
                }
                //keepExpireOfflineFile
            } else {
                modalKeepExpireingSection.classList.add('hidden');
                modalKeepExpireingButton.onclick = null;
            }
            modalDownloadButton.title = 'Local Download'
            modalDownloadButton.href = '#_'
            modalDownloadButton.download = undefined
            modalDownloadButton.onclick = function () {
                openUnpackingFiles(postID);
                $('#searchModal').modal('hide');
                return false;
            }
        } else {
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
                    openUnpackingFiles(postID);
                    $('#searchModal').modal('hide');
                    return false;
                }
            }
            modalKeepExpireingSection.classList.add('hidden');
            modalKeepExpireingButton.onclick = null;
        }

        modalDownloadButton.classList.remove('hidden')
        advancedInfo.push(`<div><i class="fa fa-layer-group pr-1"></i><span class="text-monospace" title="Kanmi/Sequenzia Unique Entity Parity ID">${postFilID}</span></div>`);
    } else if (postDownload && postDownload.length > 0) {
        if (postOffline) {
            normalInfo.push('<div class="badge text-light mx-1" style="background: #00b14f;">')
            normalInfo.push(`<i class="fa fa-cloud-check pr-1"></i><span>Offline</span>`)
            normalInfo.push('</div>')
        }
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
                classList = 'col-4 col-sm-4 col-md-3 col-lg-2 col-xl-2 col-dynamic-small';
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
async function toggleFavorite(channelid, eid) {
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
                        if (e.querySelector('.watched-precent'))
                            e.querySelector('.watched-precent').style.width = (viewed * 100) + '%'
                        if (viewed > 0.8)
                            e.classList.add('watched-episode')
                        const icon = e.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check, [data-msg-eid="${eid}"] .episode-controls i.fas.fa-eye-slash`)
                        if (icon) {
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
                        if (e.querySelector('.watched-precent'))
                            e.querySelector('.watched-precent').style.width = (viewed * 100) + '%'
                        if (viewed > 0.8)
                            e.classList.add('watched-episode')
                        const icon = e.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check, [data-msg-eid="${eid}"] .episode-controls i.fas.fa-eye-slash`)
                        if (icon) {
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
        }
        return false;
    })
}
async function toggleWatchHistory(eid) {
    return setWatchHistory(eid, (document.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check`)) ? 1 : 0);
}
async function setWatchHistory(eid, viewed) {
    const percentage = (!isNaN(viewed) && viewed > 0.05) ? (viewed <= 0.9) ? viewed : 1 : 0
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
                    if (e.querySelector('.watched-precent'))
                        e.querySelector('.watched-precent').style.width = (viewed * 100) + '%'
                    if (viewed > 0.8) {
                        e.classList.add('watched-episode')
                    } else {
                        e.classList.remove('watched-episode')
                    }
                    const icon = e.querySelector(`[data-msg-eid="${eid}"] .episode-controls i.fas.fa-check, [data-msg-eid="${eid}"] .episode-controls i.fas.fa-eye-slash`)
                    if (icon) {
                        if (viewed > 0) {
                            icon.classList.add('fa-eye-slash')
                            icon.classList.remove('fa-check')
                        } else {
                            icon.classList.remove('fa-eye-slash')
                            icon.classList.add('fa-check')
                        }
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
async function toggleStarHistoryItem(index) {
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
async function queueAction(serverid, channelid, messageid, action, data, isReviewAction, noUndo) {
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
async function commitPendingActions() {
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
async function cancelPendingAction(messageid) {
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
async function cancelPendingCache(url) {
    await kernelRequestData({type: 'CANCEL_STORAGE_PAGE', url});
    offlineDownloadSignals.delete(url);
}
async function undoPendingAction() {
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
async function updateActionsPanel() {
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
async function sendBasic(channelid, messageid, action, confirm) {
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
async function afterAction(action, data, id, confirm) {
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
    _originalURL = (() => {
        try {
            if ($.history) { return $.history.url() }
            if (window.location.hash.substring(1).length > 0) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
            return undefined
        } catch (e) {
            if (window.location.hash.substring(1).length > 0) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
            return undefined
        }
    })()
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

function kernelRequestData(message) {
    return new Promise(function(resolve, reject) {
        try {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = function(event) {
                if (event.data && event.data.error) {
                    console.error(event.data.error);
                    reject(false);
                } else {
                    resolve(event.data);
                }
            };
            navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
        } catch (err) {
            $.toast({
                type: 'error',
                title: '<i class="fas fa-microchip pr-2"></i>Kernel Error',
                subtitle: '',
                content: `<p>Could not complete "${message.type}" due to communication failure with the network kernel!</p><p>${err.message}</p>`,
                delay: 5000,
            });
        }
    });
}
function unpackRequestData(message) {
    return new Promise(resolve => {
        unpackingJobs.set(message.object.id, message.object);
        unpackerWorker.postMessage(message);
        function setTimer() {
            setTimeout(() => {
                if (!unpackingJobs.has(message.fileid)) {
                    resolve((downloadSpannedController.has(message.fileid)) ? downloadSpannedController.get(message.fileid) : false);
                    downloadSpannedController.delete(message.fileid);
                } else {
                    setTimer();
                }
            }, 1000)
        }
        setTimer();
    })
}

if ('serviceWorker' in navigator) {
    let swRegistation
    navigator.serviceWorker.ready.then(async (registration) => {
        setTimeout(() => {
            document.getElementById('serviceWorkerStatus').classList.add('badge-success');
            document.getElementById('serviceWorkerStatus').classList.remove('badge-danger');
        }, 5000)
        try {
            Notification.requestPermission().then(r => {
                swRegistation = registration
            })
        } catch (err) {
            console.error(err);
        }
        try {
            if (registration.periodicSync) {
                const status = await navigator.permissions.query({name: 'periodic-background-sync'});
                if (status.state === 'granted') {
                    await registration.periodicSync.register('SYNC_PAGES_NEW_ONLY', {
                        minInterval: 1 * 60 * 60 * 1000
                    });
                    setTimeout(() => {
                        document.getElementById('serviceWorkerSync').classList.add('badge-success');
                        document.getElementById('serviceWorkerSync').classList.remove('badge-danger');
                    }, 5000)
                } else {
                    // Periodic background sync cannot be used.
                }
            } else {
                // Periodic Background Sync isn't supported.
            }
        } catch (err) {
            console.error(err);
        }
        console.log(`Service Worker is ready!`);
        serviceWorkerReady = true;
        if (await kernelRequestData({ type: 'PING' })) {
            console.log('Service Worker Comms are OK');
            setTimeout(() => {
                document.getElementById('serviceWorkerComms').classList.add('badge-success');
                document.getElementById('serviceWorkerComms').classList.remove('badge-danger');
            }, 5000)
        }
        if (await kernelRequestData({ type: 'PING_STORAGE' })) {
            setTimeout(() => {
                document.getElementById('storageStatus').classList.add('badge-success');
                document.getElementById('storageStatus').classList.remove('badge-danger');
            }, 5000)
        }
        if (!offlinePage) {
            try {
                await registration.sync.register('SYNC_PAGES_NEW_ONLY');
            } catch (e) {
                console.error(e);
                await kernelRequestData({type: 'SYNC_PAGES_NEW_ONLY'});
            }
        }
    });
    // Global Channel
    navigator.serviceWorker.onmessage = async function (event) {
        switch (event.data.type) {
            case 'STATUS_STORAGE_CACHE_LIST':
                console.log('Status Storage Cache Update Got')
                offlineEntities = event.data.entities;
                offlineMessages = event.data.messages;
                expiresEntities = event.data.expires_entities;
                expiresMessages = event.data.expires_messages;
                expiresTimes = event.data.expires_time;
                updateNotficationsPanel();
                break;
            case 'STATUS_STORAGE_CACHE_UNMARK':
                $(`#message-${event.data.id} .hide-offline`).removeClass('hidden');
                $(`#message-${event.data.id} .toggleOffline i`).removeClass('text-success');
                $(`#message-${event.data.id} #offlineReady`).addClass('hidden');
                break;
            case 'STATUS_STORAGE_CACHE_MARK':
                $(`#message-${event.data.id} .hide-offline`).addClass('hidden');
                $(`#message-${event.data.id} .toggleOffline i`).addClass('text-success');
                $(`#message-${event.data.id} #offlineReady`).removeClass('hidden');
                break;
            case 'STATUS_STORAGE_CACHE_COMPLETE':
                $('#offlineFileStartedModal').modal('hide');
                break;
            case 'STATUS_UNPACKER_NOTIFY':
                unpackingJobs.set(event.data.object.id, event.data.object);
                break;
            case 'STATUS_STORAGE_CACHE_PAGE_ACTIVE':
                offlineDownloadController.set(event.data.url, event.data.status);
                updateNotficationsPanel();
                break;
            case 'STATUS_STORAGE_CACHE_PAGE_COMPLETE':
                offlineDownloadController.delete(event.data.url);
                updateNotficationsPanel();
                break;
            case 'STATUS_UNPACK_STARTED':
            case 'STATUS_UNPACK_QUEUED':
            case 'STATUS_UNPACK_DUPLICATE':
                if (unpackingJobs.has(event.data.fileid)) {
                    downloadSpannedController.set(event.data.fileid, event.data);
                    updateNotficationsPanel();
                }
                break;
            case 'STATUS_UNPACK_COMPLETED':
                setTimeout(() => {
                    unpackingJobs.delete(event.data.fileid);
                    updateNotficationsPanel();
                }, 1000);
                break;
            case 'STATUS_UNPACK_FAILED':
                if (unpackingJobs.has(event.data.fileid)) {
                    console.error(`Failed to unpack file ${event.data.fileid}`)
                    downloadSpannedController.set(event.data.fileid, event.data);
                    updateNotficationsPanel();
                }
                setTimeout(() => {
                    unpackingJobs.delete(event.data.fileid);
                    updateNotficationsPanel();
                }, 1000);
                break;
            case 'STATUS_UNPACKER_ACTIVE':
                if (unpackingJobs.has(event.data.fileid)) {
                    const dataJob = unpackingJobs.get(event.data.fileid);
                    switch (event.data.action) {
                        case 'GET_METADATA':
                            console.log(`Downloading File ${event.data.fileid}...`);
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                kmsStatus.innerText = 'Getting Parity Metadata...';
                            }
                            if (!dataJob.active) {
                                unpackingJobs.set(event.data.fileid, {
                                    ...dataJob,
                                    active: true
                                })
                            }
                            break;
                        case 'EXPECTED_PARTS':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                videoStatus.innerText = `Expecting ${event.data.expected_parts} Parts`;
                            }
                            if (!dataJob.active) {
                                unpackingJobs.set(event.data.fileid, {
                                    ...dataJob,
                                    active: true
                                })
                            }
                            break;
                        case 'FETCH_PARTS_PROGRESS':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                videoStatus.innerText = `Downloaded ${event.data.fetchedBlocks} Blocks, ${event.data.pendingBlocks} Pending`;
                                videoProgress.style.width = event.data.percentage + '%';
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === dataJob.messageid) {
                                kmsStatus.innerText = `Downloaded ${event.data.fetchedBlocks}/${event.data.pendingBlocks} Blocks`;
                                kmsProgress.style.width = event.data.percentage + '%';
                            }
                            unpackingJobs.set(event.data.fileid, {
                                ...dataJob,
                                active: true,
                                progress: event.data.percentage
                            })
                            break;
                        case 'BLOCKS_ACQUIRED':
                            console.log(dataJob)
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                videoStatus.innerText = `All Blocks Downloaded! Processing Blocks...`;
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === dataJob.messageid) {
                                kmsStatus.innerText = ``;
                                kmsProgress.style.width = '0%';
                                kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('hidden');
                            }
                            if (!dataJob.preemptive && !kongouMediaPlayer.getAttribute('activePlayback') === dataJob.messageid) {
                                $.toast({
                                    type: 'success',
                                    title: 'Unpack File',
                                    subtitle: 'Now',
                                    content: `File was unpacked successfully<br/>${dataJob.name}`,
                                    delay: 15000,
                                });
                            }
                            if (!(dataJob.offline && dataJob.preemptive)) {
                                const fileData = await getSpannedFileIfAvailable(event.data.fileid);
                                if (fileData) {
                                    const element = document.createElement('a');
                                    element.id = `fileData-${event.data.fileid}`
                                    element.classList = `hidden`
                                    element.href = fileData.href;
                                    element.setAttribute('download', dataJob.name);
                                    document.body.appendChild(element);

                                    if (element && !dataJob.preemptive) {
                                        if (dataJob.play) {
                                            console.log(`Launching File...`)
                                            if (dataJob.play === 'audio') {
                                                PlayTrack(element.href);
                                            } else if (dataJob.play === 'video') {
                                                $('#videoBuilderModal').modal('hide');
                                                const videoPlayer = videoModel.querySelector('video')
                                                videoPlayer.pause();
                                                memoryVideoPositions.set(dataJob.id, videoPlayer.currentTime);
                                                PlayVideo(element.href, `${dataJob.channel}/${dataJob.name} (${dataJob.size})`, event.data.id);
                                            } else if (dataJob.play === 'kms-video') {
                                                const activeDoc = (kongouMediaCache && kongouMediaActiveURL !== _originalURL) ? kongouMediaCache : document;
                                                const _post = (activeDoc) ? activeDoc.querySelector(`#message-${dataJob.messageid}`) : document.getElementById(`message-${dataJob.messageid}`);
                                                const kmsprogress = _post.getAttribute('data-kms-progress');

                                                if (kongouMediaVideoPreview.currentTime !== kongouMediaVideoPreview.duration)
                                                    memoryVideoPositions.set(event.data.id, kongouMediaVideoPreview.currentTime);
                                                kongouMediaVideoFull.src = element.href;
                                                kongouMediaVideoFull.volume = 0;
                                                try {
                                                    await kongouMediaVideoFull.play();
                                                } catch (err) {
                                                    console.error(err)
                                                }

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
                                    }
                                } else {
                                    console.error('File data was not found')
                                }
                            } else {
                                console.log(`File ${dataJob.name} is ready`)
                            }
                            break;
                        default:
                            console.error('Unknown Unpacker Status');
                            console.error(event.data);
                            break;
                    }
                    updateNotficationsPanel();
                }
                break;
            case 'STATUS_UNPACKER_UPDATE':
                updateNotficationsPanel();
                break;
            case 'STATUS_UNPACKER_FAILED':
                if (unpackingJobs.has(event.data.fileid)) {
                    switch (event.data.action) {
                        case 'GET_METADATA':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                videoStatus.innerText = `Server Error: ${xhr.responseText}`;
                                videoProgress.classList.remove('badge-success');
                                videoProgress.classList.add('badge-danger');
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                kmsStatus.innerText = `Server Error: ${xhr.responseText}`;
                                kmsProgress.classList.remove('badge-success');
                                kmsProgress.classList.add('badge-danger');
                                kmsProgress.style.width = '100%';
                            }
                            console.error(event.data.message);
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `File failed to unpack!<br/>${event.data.message}`,
                                delay: 15000,
                            });
                            break;
                        case 'READ_METADATA':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                videoStatus.innerText = `Failed to read the metadata, please report to the site administrator!`;
                                videoProgress.classList.remove('badge-success');
                                videoProgress.classList.add('badge-danger');
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                kmsStatus.innerText = `Cannot to read the metadata, please report to the site administrator!`;
                                kmsProgress.classList.remove('badge-success');
                                kmsProgress.classList.add('badge-danger');
                                kmsProgress.style.width = '100%';
                            }
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `Failed to read the parity metadata response!`,
                                delay: 15000,
                            });
                            break;
                        case 'EXPECTED_PARTS':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                videoStatus.innerText = `File is damaged or is missing parts, please report to the site administrator!`;
                                videoProgress.classList.remove('badge-success');
                                videoProgress.classList.add('badge-danger');
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                kmsStatus.innerText = `File is damaged or is missing blocks!`;
                                kmsProgress.classList.remove('badge-success');
                                kmsProgress.classList.add('badge-danger');
                                kmsProgress.style.width = '100%';
                            }
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `File is damaged or is missing parts, please report to the site administrator!`,
                                delay: 15000,
                            });
                            break;
                        case 'EXPECTED_FETCH_PARTS':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                videoStatus.innerText = `Failed, Not all blocks where downloaded`;
                                videoProgress.classList.remove('badge-success');
                                videoProgress.classList.add('badge-danger');
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                kmsStatus.innerText = `Cannot Play Full Video: Not all blocks where downloaded!`;
                                kmsProgress.classList.remove('badge-success');
                                kmsProgress.classList.add('badge-danger');
                                kmsProgress.style.width = '100%';
                            }
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `Missing a downloaded parity file, Retry to download!`,
                                delay: 15000,
                            });
                            break;
                        case 'UNCAUGHT_ERROR':
                            if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                videoStatus.innerText = `Handler Failure: ${e.message}`;
                                videoProgress.classList.remove('badge-success');
                                videoProgress.classList.add('badge-danger');
                            } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                kmsStatus.innerText = `Handler Failure: ${e.message}`;
                                kmsProgress.classList.remove('badge-success');
                                kmsProgress.classList.add('badge-danger');
                                kmsProgress.style.width = '100%';
                            }
                            console.error(event.data.message);
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `File Handeler Fault!<br/>${event.data.message}`,
                                delay: 15000,
                            });
                            break;
                        default:
                            console.error('Unknown Unpacker Error');
                            console.error(event.data);
                            break;
                    }
                    updateNotficationsPanel();
                }
                break;
            case 'MAKE_SNACK':
                $.snack((event.data.level || 'info'), (event.data.text || 'No Data'), (event.data.timeout || undefined))
                break;
            case 'MAKE_TOAST':
                $.toast({
                    type: (event.data.level || 'info'),
                    title: (event.data.title || ''),
                    subtitle: (event.data.subtitle || ''),
                    content: (event.data.content || 'No Data'),
                    delay: (event.data.timeout || undefined),
                });
                break;
            case 'NOTIFY_OFFLINE_READY':
            case 'PING_STORAGE':
                console.log('Service Worker Storage Ready');
                break;
            case 'PONG':
                break;
            case 'UNPACK_FILE':
                unpackingJobs.set(event.data.object.id, event.data.object);
                updateNotficationsPanel();
                unpackerWorker.postMessage(event.data);
                break;
            default:
                console.error('Service Worker Message Unknown', event.data.type);
                break;
        }
    };
    // Page Channel
    networkKernelChannel.onmessage = function (event) {
        switch (event.data.type) {
            case 'PONG':
                console.log('Service Worker Comms are OK');
                break;
            default:
                console.error('Service Worker Message Unknown', event.data.type);
                break;
        }
    }
}

let unpackerWorkerHeartBeat = null;
async function startUnpackerWorker() {
    if (unpackerWorker)
        await unpackerWorker.terminate();
    if (!initialLoad) {
        console.error('Web Worker has crashed or has for some reason missed heartbearts!')
        if (unpackingJobs.size > 0) {
            $.toast({
                type: 'error',
                title: '<i class="fas fa-microchip pr-2"></i>TLHWP Crashed',
                subtitle: '',
                content: `<p>The compliler has crashed, this could be due to low system memory. Jobs will be recovered shortly.</p>`,
                delay: 90000,
            });
        }
    }
    unpackerWorker = new Worker('/js/client/worker.unpacker.js');
    try {
        unpackerWorker.onmessage = async function(event) {
            try {
                switch (event.data.type) {
                    case 'STATUS_UNPACK_STARTED':
                    case 'STATUS_UNPACK_QUEUED':
                    case 'STATUS_UNPACK_DUPLICATE':
                        if (unpackingJobs.has(event.data.fileid)) {
                            downloadSpannedController.set(event.data.fileid, event.data);
                            updateNotficationsPanel();
                        }
                        break;
                    case 'STATUS_UNPACK_COMPLETED':
                        setTimeout(() => {
                            unpackingJobs.delete(event.data.fileid);
                            updateNotficationsPanel();
                        }, 1000);
                        break;
                    case 'STATUS_UNPACK_FAILED':
                        if (unpackingJobs.has(event.data.fileid)) {
                            console.error(`Failed to unpack file ${event.data.fileid}`)
                            setTimeout(() => {
                                unpackingJobs.delete(event.data.fileid);
                                updateNotficationsPanel();
                            }, 1000);
                            downloadSpannedController.set(event.data.fileid, event.data);
                            updateNotficationsPanel();
                        }
                        break;
                    case 'STATUS_UNPACKER_ACTIVE':
                        if (unpackingJobs.has(event.data.fileid)) {
                            const dataJob = unpackingJobs.get(event.data.fileid);
                            switch (event.data.action) {
                                case 'GET_METADATA':
                                    console.log(`Downloading File ${event.data.fileid}...`);
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                        kmsStatus.innerText = 'Getting Parity Metadata...';
                                    }
                                    if (!dataJob.active) {
                                        unpackingJobs.set(event.data.fileid, {
                                            ...dataJob,
                                            active: true
                                        })
                                    }
                                    break;
                                case 'EXPECTED_PARTS':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                        videoStatus.innerText = `Expecting ${event.data.expected_parts} Parts`;
                                    }
                                    if (!dataJob.active) {
                                        unpackingJobs.set(event.data.fileid, {
                                            ...dataJob,
                                            active: true
                                        })
                                    }
                                    break;
                                case 'FETCH_PARTS_PROGRESS':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                        videoStatus.innerText = `Downloaded ${event.data.fetchedBlocks} Blocks, ${event.data.pendingBlocks} Pending`;
                                        videoProgress.style.width = event.data.percentage + '%';
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === dataJob.messageid) {
                                        kmsStatus.innerText = `Downloaded ${event.data.fetchedBlocks}/${event.data.pendingBlocks} Blocks`;
                                        kmsProgress.style.width = event.data.percentage + '%';
                                    }
                                    unpackingJobs.set(event.data.fileid, {
                                        ...dataJob,
                                        active: true,
                                        progress: event.data.percentage
                                    })
                                    break;
                                case 'BLOCKS_ACQUIRED':
                                    console.log(dataJob)
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === dataJob.messageid) {
                                        videoStatus.innerText = `All Blocks Downloaded! Processing Blocks...`;
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === dataJob.messageid) {
                                        kmsStatus.innerText = ``;
                                        kmsProgress.style.width = '0%';
                                        kongouMediaPlayer.querySelector('.kms-progress-bar').classList.add('hidden');
                                    }
                                    if (!dataJob.preemptive && !kongouMediaPlayer.getAttribute('activePlayback') === dataJob.messageid) {
                                        $.toast({
                                            type: 'success',
                                            title: 'Unpack File',
                                            subtitle: 'Now',
                                            content: `File was unpacked successfully<br/>${dataJob.name}`,
                                            delay: 15000,
                                        });
                                    }
                                    if (!(dataJob.offline && dataJob.preemptive)) {
                                        const fileData = await getSpannedFileIfAvailable(event.data.fileid);
                                        if (fileData) {
                                            const element = document.createElement('a');
                                            element.id = `fileData-${event.data.fileid}`
                                            element.classList = `hidden`
                                            element.href = fileData.href;
                                            element.setAttribute('download', dataJob.name);
                                            document.body.appendChild(element);

                                            if (element && !dataJob.preemptive) {
                                                if (dataJob.play) {
                                                    console.log(`Launching File...`)
                                                    if (dataJob.play === 'audio') {
                                                        PlayTrack(element.href);
                                                    } else if (dataJob.play === 'video') {
                                                        $('#videoBuilderModal').modal('hide');
                                                        const videoPlayer = videoModel.querySelector('video')
                                                        videoPlayer.pause();
                                                        memoryVideoPositions.set(dataJob.id, videoPlayer.currentTime);
                                                        PlayVideo(element.href, `${dataJob.channel}/${dataJob.name} (${dataJob.size})`, event.data.id);
                                                    } else if (dataJob.play === 'kms-video') {
                                                        const activeDoc = (kongouMediaCache && kongouMediaActiveURL !== _originalURL) ? kongouMediaCache : document;
                                                        const _post = (activeDoc) ? activeDoc.querySelector(`#message-${dataJob.messageid}`) : document.getElementById(`message-${dataJob.messageid}`);
                                                        const kmsprogress = _post.getAttribute('data-kms-progress');

                                                        if (kongouMediaVideoPreview.currentTime !== kongouMediaVideoPreview.duration)
                                                            memoryVideoPositions.set(event.data.id, kongouMediaVideoPreview.currentTime);
                                                        kongouMediaVideoFull.src = element.href;
                                                        kongouMediaVideoFull.volume = 0;
                                                        try {
                                                            await kongouMediaVideoFull.play();
                                                        } catch (err) {
                                                            console.error(err)
                                                        }

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
                                            }
                                        } else {
                                            console.error('File data was not found')
                                        }
                                    } else {
                                        console.log(`File ${dataJob.name} is ready`)
                                    }
                                    break;
                                default:
                                    console.error('Unknown Unpacker Status');
                                    console.error(event.data);
                                    break;
                            }
                            updateNotficationsPanel();
                        }
                        break;
                    case 'STATUS_UNPACKER_UPDATE':
                        updateNotficationsPanel();
                        break;
                    case 'STATUS_UNPACKER_FAILED':
                        if (unpackingJobs.has(event.data.fileid)) {
                            switch (event.data.action) {
                                case 'GET_METADATA':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                        videoStatus.innerText = `Server Error: ${xhr.responseText}`;
                                        videoProgress.classList.remove('badge-success');
                                        videoProgress.classList.add('badge-danger');
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                        kmsStatus.innerText = `Server Error: ${xhr.responseText}`;
                                        kmsProgress.classList.remove('badge-success');
                                        kmsProgress.classList.add('badge-danger');
                                        kmsProgress.style.width = '100%';
                                    }
                                    console.error(event.data.message);
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `File failed to unpack!<br/>${event.data.message}`,
                                        delay: 15000,
                                    });
                                    break;
                                case 'READ_METADATA':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                        videoStatus.innerText = `Failed to read the metadata, please report to the site administrator!`;
                                        videoProgress.classList.remove('badge-success');
                                        videoProgress.classList.add('badge-danger');
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                        kmsStatus.innerText = `Cannot to read the metadata, please report to the site administrator!`;
                                        kmsProgress.classList.remove('badge-success');
                                        kmsProgress.classList.add('badge-danger');
                                        kmsProgress.style.width = '100%';
                                    }
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `Failed to read the parity metadata response!`,
                                        delay: 15000,
                                    });
                                    break;
                                case 'EXPECTED_PARTS':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                        videoStatus.innerText = `File is damaged or is missing parts, please report to the site administrator!`;
                                        videoProgress.classList.remove('badge-success');
                                        videoProgress.classList.add('badge-danger');
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                        kmsStatus.innerText = `File is damaged or is missing blocks!`;
                                        kmsProgress.classList.remove('badge-success');
                                        kmsProgress.classList.add('badge-danger');
                                        kmsProgress.style.width = '100%';
                                    }
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `File is damaged or is missing parts, please report to the site administrator!`,
                                        delay: 15000,
                                    });
                                    break;
                                case 'EXPECTED_FETCH_PARTS':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                        videoStatus.innerText = `Failed, Not all blocks where downloaded`;
                                        videoProgress.classList.remove('badge-success');
                                        videoProgress.classList.add('badge-danger');
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                        kmsStatus.innerText = `Cannot Play Full Video: Not all blocks where downloaded!`;
                                        kmsProgress.classList.remove('badge-success');
                                        kmsProgress.classList.add('badge-danger');
                                        kmsProgress.style.width = '100%';
                                    }
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `Missing a downloaded parity file, Retry to download!`,
                                        delay: 15000,
                                    });
                                    break;
                                case 'UNCAUGHT_ERROR':
                                    if (videoModel.hasAttribute('pendingMessage') && videoModel.getAttribute('pendingMessage') === unpackingJobs.get(event.data.fileid).messageid) {
                                        videoStatus.innerText = `Handler Failure: ${e.message}`;
                                        videoProgress.classList.remove('badge-success');
                                        videoProgress.classList.add('badge-danger');
                                    } else if (kongouMediaPlayer.hasAttribute('activePlayback') && kongouMediaPlayer.getAttribute('activePlayback') === unpackingJobs.get(event.data.fileid).messageid) {
                                        kmsStatus.innerText = `Handler Failure: ${e.message}`;
                                        kmsProgress.classList.remove('badge-success');
                                        kmsProgress.classList.add('badge-danger');
                                        kmsProgress.style.width = '100%';
                                    }
                                    console.error(event.data.message);
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `File Handeler Fault!<br/>${event.data.message}`,
                                        delay: 15000,
                                    });
                                    break;
                                default:
                                    console.error('Unknown Unpacker Error');
                                    console.error(event.data);
                                    break;
                            }
                            updateNotficationsPanel();
                        }
                        break;
                    case 'PONG':
                        setTimeout(() => {
                            document.getElementById('webWorkerComms').classList.add('badge-success');
                            document.getElementById('webWorkerComms').classList.remove('badge-danger');
                        }, 5000)
                        break;
                    case 'HEARTBEAT':
                        clearTimeout(unpackerWorkerHeartBeat);
                        unpackerWorkerHeartBeat = setTimeout(startUnpackerWorker, 60000);
                        break;
                    default:
                        break;
                }
            } catch (err) {
                console.error('Failed to proccess message from worker', err);
            }
            if (event.data.type !== 'HEARTBEAT' && event.data.type !== 'PONG') {
                try {
                    await kernelRequestData(event.data)
                } catch (err) {
                    console.error('Failed to mirror message to serviceWorker', err);
                }
            }
        }
        setTimeout(() => {
            document.getElementById('webWorkerStatus').classList.add('badge-success');
            document.getElementById('webWorkerStatus').classList.remove('badge-danger');
            setInterval(() => {
                if (unpackerWorker) {
                    unpackerWorker.postMessage({type: 'HEARTBEAT'});
                }
            }, 15000);
            unpackerWorkerHeartBeat = setTimeout(startUnpackerWorker, 60000);
            if (unpackingJobs.size > 0) {
                console.log('Restoring Incomplete Jobs')
                Array.from(unpackingJobs.values()).map(async e => {
                    await unpackerWorker.postMessage({type: 'UNPACK_FILE', object: e});
                })
            }
        }, 5000)
        unpackerWorker.postMessage({type: 'PING'});
    } catch (err) {
        console.error(err);
    }
}
startUnpackerWorker();

