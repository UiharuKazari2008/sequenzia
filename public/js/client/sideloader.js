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
});

let pageType = ''
let last = undefined;
let responseComplete = false;
let itemsRemoved = 0;
let itemsRemovedIds = [];
let initialLoad = true;
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

function isTouchDevice(){
    return true == ("ontouchstart" in window || window.DocumentTouch && document instanceof DocumentTouch);
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
            return 'clapperboard-play'
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
let recoverable
let contextFadeDelay = null
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
            $.when($(".container-fluid").fadeOut(250)).done(() => {
                recoverable = response
                let contentPage = $(response);
                if ($("#appStatic").children().length === 0 && contentPage.find('#appStatic').length > 0) {
                    $("#appStatic").html(contentPage.find('#appStatic').children());
                }
                contentPage.find('#topbar').addClass('no-ani').addClass('ready-to-scroll');
                contentPage.find('a[href="#_"], a[href="#"] ').click(function(e){
                    window.history.replaceState({}, null, `/juneOS#${_originalURL}`);
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
                window.history.replaceState({}, null, `/juneOS#${_originalURL}`);
                responseComplete = true
            })
        } else {
            if (push === true) {
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
                        window.history.replaceState({}, null, `/juneOS#${_originalURL}`);
                        e.preventDefault();
                    });
                    $("#content-wrapper").html(contentPage);
                    setImageLayout(setImageSize);
                    setPageLayout(false);
                    if (!pageTitle.includes(' - Item Details')) {
                        getPaginator(url);
                    }
                    scrollToTop(true);
                    if (inReviewMode)
                        enableReviewMode();
                    updateActionsPanel();
                    updateNotficationsPanel();
                    undoActions = [];
                    if (Object.values(apiActions).length > 0) {
                        const removedItems = Object.values(apiActions).filter(e => e.action === "RemovePost" || e.action === "MovePost" || e.action === "ArchivePost").map(e => e.messageid);
                        $(Array.from($("#content-wrapper").find('[data-msg-id].col-image:not(.hidden)')).filter(e => removedItems.indexOf(e.id.substring(8)) !== -1)).addClass('hidden')
                        if ($("#content-wrapper").find('[data-msg-id].col-image.hidden').length > 0) {
                            $('#hiddenItemsAlert').removeClass('hidden')
                        }
                    }
                    responseComplete = true
                })
            }
            $("title").text(pageTitle);
            let addOptions = [];
            if (url.includes('offset=') && !initialLoad) {
                let _h = (url.includes('_h=')) ? parseInt(/_h=([^&]+)/.exec(url)[1]) : 0;
                addOptions.push(['_h', `${(!isNaN(_h)) ? _h + 1 : 0}`]);
            }
            const _url = params(['nsfwEnable', 'pageinatorEnable', 'limit'], addOptions, url);
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

let requestInprogress
let paginatorInprogress
function getNewContent(remove, add, url, keep) {
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
            requestCompleted(response, _url)
        },
        error: function (xhr) {
            responseComplete = true
            $(".container-fluid").fadeTo(2000, 1)
            $.toast({
                type: 'error',
                title: 'Navigation Failure',
                subtitle: 'Now',
                content: `Failed to load page!${(xhr && xhr.responseText) ? '\n' + xhr.responseText : ''}`,
                delay: 5000,
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
            responseComplete = true
            $.toast({
                type: 'error',
                title: 'Page Failed',
                subtitle: 'Now',
                content: `Failed to load page, Try Again!: ${xhr.responseText}`,
                delay: 5000,
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
            _params.set('search', encodeURIComponent(searchText));
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
                responseComplete = true
                $(".container-fluid").fadeTo(2000, 1)
                $.toast({
                    type: 'error',
                    title: 'Page Failed',
                    subtitle: 'Now',
                    content: `Failed to get search response, Try Again!: ${xhr.responseText}`,
                    delay: 5000,
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
                responseComplete = true
                $(".container-fluid").fadeTo(2000, 1)
                $.toast({
                    type: 'error',
                    title: 'Page Failed',
                    subtitle: 'Now',
                    content: `Failed to load page, Try Again!: ${xhr.responseText}`,
                    delay: 5000,
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
let downloadAllController = null;
let downloadSpannedController = new Map();
let memorySpannedController = [];
let memoryVideoPositions = new Map();
let activeSpannedJob = null;
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
                        const url = window.URL
                            .createObjectURL(new Blob([response.data]));
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

let kmsVideoWatcher = null;
async function openUnpackingFiles(messageid, playThis) {
    const _post = document.getElementById(`message-${messageid}`);
    const fileid = _post.getAttribute('data-msg-fileid');
    const filename = _post.getAttribute('data-msg-filename');
    const filesize = _post.getAttribute('data-msg-filesize');
    const channelString = _post.getAttribute('data-msg-channel-string');
    const videoModel = document.getElementById('videoBuilderModal');
    if (fileid && fileid.length > 0) {
        const element = document.getElementById(`fileData-${fileid}`);
        const memoryJobIndex = memorySpannedController.filter(e => e.id === fileid)
        if (element && memoryJobIndex.length > 0) {
            const previousJob = memoryJobIndex[0];
            if (previousJob.play === 'audio') {
                PlayTrack(element.href);
            } else if (previousJob.play === 'video') {
                $('#videoBuilderModal').modal('hide');
                const videoPlayer = videoModel.querySelector('video')
                if (!videoPlayer.paused)
                    memoryVideoPositions.set(activeSpannedJob.id, videoPlayer.currentTime);
                videoPlayer.pause();
                PlayVideo(element.href, `${previousJob.channel}/${previousJob.name} (${previousJob.size})`, fileid);
            } else if (previousJob.play === 'kms-video') {
                const mediaPlayer = document.getElementById('kongouMediaPlayer');
                const videoPreviewPlayer = mediaPlayer.querySelector('#kongouMediaVideoPreview');
                const videoFullPlayer = mediaPlayer.querySelector('#kongouMediaVideoFull');
                videoPreviewPlayer.pause()
                videoFullPlayer.src = element.href;
                await videoFullPlayer.play();
                videoPreviewPlayer.classList.add('hidden');
                videoFullPlayer.classList.remove('hidden');
                if (memoryVideoPositions.has(previousJob.id))
                    videoFullPlayer.currentTime = memoryVideoPositions.get(previousJob.id)
                mediaPlayer.querySelector('.kms-status-bar > span').innerText = ``;
                mediaPlayer.querySelector('.kms-progress-bar').classList.add('hidden')
            } else {
                element.click();
            }
        } else if (downloadSpannedController.size === 0 && !activeSpannedJob) {
            downloadSpannedController.set(fileid, {
                id: fileid,
                name: filename,
                size: filesize,
                channel: channelString,
                pending: true,
                ready: true,
                play: playThis
            })
            if (!playThis || (playThis !== 'video' && playThis !== 'kms-video' && playThis !== 'kms-video-preemptive')) {
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
                        memorySpannedController.push(activeSpannedJob);
                        if (activeSpannedJob.play) {
                            console.log(`Launching File...`)
                            const element = document.getElementById(`fileData-${activeSpannedJob.id}`);
                            if (element) {
                                if (activeSpannedJob.play === 'audio') {
                                    PlayTrack(element.href);
                                } else if (activeSpannedJob.play === 'video') {
                                    $('#videoBuilderModal').modal('hide');
                                    const videoPlayer = videoModel.querySelector('video')
                                    videoPlayer.pause();
                                    memoryVideoPositions.set(activeSpannedJob.id, videoPlayer.currentTime);
                                    PlayVideo(element.href, `${activeSpannedJob.channel}/${activeSpannedJob.name} (${activeSpannedJob.size})`, activeSpannedJob.id);
                                } else if (activeSpannedJob.play === 'kms-video') {
                                    const mediaPlayer = document.getElementById('kongouMediaPlayer');
                                    const videoPreviewPlayer = mediaPlayer.querySelector('#kongouMediaVideoPreview');
                                    const videoFullPlayer = mediaPlayer.querySelector('#kongouMediaVideoFull');
                                    memoryVideoPositions.set(activeSpannedJob.id, videoPreviewPlayer.currentTime);
                                    videoFullPlayer.src = element.href;
                                    videoFullPlayer.volume = 0;
                                    if (!videoPreviewPlayer.paused)
                                        await videoFullPlayer.play();
                                    videoFullPlayer.currentTime = videoPreviewPlayer.currentTime;
                                    setTimeout(() => {
                                        if (videoPreviewPlayer.paused)
                                            videoFullPlayer.pause();
                                        videoFullPlayer.volume = videoPreviewPlayer.volume
                                        videoPreviewPlayer.pause()
                                        videoPreviewPlayer.classList.add('hidden');
                                        videoFullPlayer.classList.remove('hidden');
                                    }, 500);
                                } else if (activeSpannedJob.play === 'kms-video-preemptive') {
                                    console.log('Next Video is now ready!')
                                } else {
                                    console.error('No Datatype was provided')
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
                pending: true,
                ready: true,
                play: playThis
            })
            if (!playThis || playThis !== 'video') {
                $.toast({
                    type: 'success',
                    title: 'Unpack File',
                    subtitle: 'Now',
                    content: `File is added to queued`,
                    delay: 5000,
                });
            }
        } else {
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
    if (element && memoryJobIndex.length > 0) {
        PlayVideo(element.href, `${activeSpannedJob.channel}/${activeSpannedJob.name} (${activeSpannedJob.size})`, fileid);
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
            videoPlayer.play();
            videoPlayer.classList.remove('hidden');
            imagePreview.classList.add('hidden');
        } else if (previewURL && previewURL.endsWith('.mp4')) {
            videoPlayer.src = previewURL;
            videoPlayer.play();
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
async function openKMSPlayer(messageid) {
    const _post = document.getElementById(`message-${messageid}`);
    const fileid = _post.getAttribute('data-msg-fileid');
    const filename = _post.getAttribute('data-msg-filename');
    const filesize = _post.getAttribute('data-msg-filesize');
    const channelString = _post.getAttribute('data-msg-channel-string');
    const previewURL = _post.getAttribute('data-msg-url-preview');
    const fullURL = _post.getAttribute('data-msg-url-full');
    const mediaPlayer = document.getElementById('kongouMediaPlayer');
    const active = mediaPlayer.getAttribute('activePlayback');

    const allEpisodes = Array.from(document.getElementById('seasonsAccordion').querySelectorAll('.episode-row'));
    const index = allEpisodes.map(e => e.id).indexOf(`message-${messageid}`)
    const nextEpisode = allEpisodes.slice(index + 1);
    const nextEpisodeGroup = document.getElementById('kongouMediaPlayerNext')
    if (nextEpisode.length > 0) {
        const nextName = nextEpisode[0].querySelector('.episode-name > span').innerText
        nextEpisodeGroup.querySelector('span').innerText = nextName;
        nextEpisodeGroup.classList.remove('hidden');
        mediaPlayer.setAttribute('nextPlayback', nextEpisode[0].id.split('-').pop());
    } else {
        nextEpisodeGroup.querySelector('span').innerText = '';
        nextEpisodeGroup.classList.add('hidden')
        mediaPlayer.removeAttribute('nextPlayback');
    }
    const prevEpisodeGroup = document.getElementById('kongouMediaPlayerPrev')
    if (index > 0) {
        const prevEpisode = allEpisodes.slice(0,index);
        if (prevEpisode.length > 0) {
            const prevName = prevEpisode.slice().pop().querySelector('.episode-name > span').innerText
            prevEpisodeGroup.querySelector('span').innerText = prevName;
            prevEpisodeGroup.classList.remove('hidden')
            mediaPlayer.setAttribute('prevPlayback', prevEpisode.slice().pop().id.split('-').pop());
        } else {
            prevEpisodeGroup.querySelector('span').innerText = '';
            prevEpisodeGroup.classList.add('hidden')
            mediaPlayer.removeAttribute('prevPlayback');
        }
    } else {
        prevEpisodeGroup.querySelector('span').innerText = '';
        prevEpisodeGroup.classList.add('hidden')
        mediaPlayer.removeAttribute('prevPlayback');
    }

    mediaPlayer.classList.remove('d-none');
    mediaPlayer.querySelector('.kms-status-bar > span').innerText = 'Waiting'

    const videoPreviewPlayer = mediaPlayer.querySelector('#kongouMediaVideoPreview');
    const videoFullPlayer = mediaPlayer.querySelector('#kongouMediaVideoFull');
    videoPreviewPlayer.classList.add('hidden');
    videoFullPlayer.classList.add('hidden');

    const element = document.getElementById(`fileData-${fileid}`);

    if (element) {
        videoPreviewPlayer.pause();
        videoPreviewPlayer.classList.add('hidden');
        videoFullPlayer.src = element.href;
        videoFullPlayer.play();
        videoFullPlayer.classList.remove('hidden');
    } else {
        mediaPlayer.querySelector('.kms-progress-bar').style.width = "0%";
        mediaPlayer.querySelector('.kms-progress-bar').classList.add('bg-success');
        mediaPlayer.querySelector('.kms-progress-bar').classList.remove('bg-danger');
        mediaPlayer.querySelector('.kms-progress-bar').classList.remove('hidden');

        if (fullURL && fullURL.endsWith('.mp4')) {
            videoPreviewPlayer.src = fullURL;
            videoPreviewPlayer.play();
            videoPreviewPlayer.classList.remove('hidden');
        } else if (previewURL && previewURL.endsWith('.mp4')) {
            videoPreviewPlayer.src = previewURL;
            videoPreviewPlayer.play();
            videoPreviewPlayer.classList.remove('hidden');
        } else if (fullURL) {
            imagePreview.src = fullURL;
            videoPreviewPlayer.classList.add('hidden');
            imagePreview.classList.remove('hidden');
        } else if (previewURL) {
            imagePreview.src = previewURL;
            videoPreviewPlayer.classList.add('hidden');
            imagePreview.classList.remove('hidden');
        } else {
            imagePreview.classList.add('hidden');
            videoPreviewPlayer.classList.add('hidden');
            console.log('No Preview');
        }
        videoFullPlayer.pause();
        videoFullPlayer.classList.add('hidden');
    }
    openUnpackingFiles(messageid, 'kms-video');
    if (active) {
        const _activePost = document.getElementById(`message-${active}`);
        if (_activePost) {
            const activeFileid = _activePost.getAttribute('data-msg-fileid');
            const element = document.getElementById(`fileData-${activeFileid}`);
            if (activeFileid && !element) {
                console.log(`Canceling Active Unpacking...`)
                stopUnpackingFiles(activeFileid);
            }
        }
    }
    mediaPlayer.setAttribute('activePlayback', messageid);
    mediaPlayer.removeAttribute('nextVideoReady');
}
async function kmsPlayNext() {
    const videoModel = document.getElementById('kongouMediaPlayer');
    const messageid = videoModel.getAttribute('nextPlayback');
    await saveCurrentTimeKMS();
    if (messageid)
        openKMSPlayer(messageid);
}
async function kmsPlayPrev() {
    const videoModel = document.getElementById('kongouMediaPlayer');
    const messageid = videoModel.getAttribute('prevPlayback');
    await saveCurrentTimeKMS();
    if (messageid)
        openKMSPlayer(messageid);
}
async function saveCurrentTimeKMS() {
    const videoModel = document.getElementById('kongouMediaPlayer');
    const messageid = videoModel.getAttribute('activePlayback');
    const videoFullPlayer = videoModel.querySelector('#kongouMediaVideoFull');
    if (messageid && (videoFullPlayer.currentTime / videoFullPlayer.duration) < 0.8) {
        const _post = document.getElementById(`message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        memoryVideoPositions.set(fileid, videoFullPlayer.currentTime);
    }
}
async function cancelPendingKMSUnpack() {
    const videoModel = document.getElementById('kongouMediaPlayer');
    const messageid = videoModel.getAttribute('activePlayback');
    if (messageid) {
        const _post = document.getElementById(`message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        stopUnpackingFiles(fileid);
    }
}
async function closeKMSPlayer() {
    const videoModel = document.getElementById('kongouMediaPlayer');
    const messageid = videoModel.getAttribute('activePlayback');
    const videoPreviewPlayer = videoModel.querySelector('#kongouMediaVideoPreview');
    const videoFullPlayer = videoModel.querySelector('#kongouMediaVideoFull');
    await saveCurrentTimeKMS();
    if (messageid) {
        const _post = document.getElementById(`message-${messageid}`);
        const fileid = _post.getAttribute('data-msg-fileid');
        stopUnpackingFiles(fileid);
    }
    videoPreviewPlayer.pause();
    videoFullPlayer.pause();
    videoModel.classList.add('d-none')
}
async function checkKMSTimecode() {
    const mediaPlayer = document.getElementById('kongouMediaPlayer');
    const messageid = mediaPlayer.getAttribute('nextPlayback');
    const isReady = mediaPlayer.getAttribute('nextVideoReady') === 'true';
    const videoFullPlayer = mediaPlayer.querySelector('#kongouMediaVideoFull');

    if (messageid && !mediaPlayer.classList.contains('d-none') &&
        !isReady &&
        !videoFullPlayer.classList.contains('hidden') &&
        ((videoFullPlayer.currentTime / videoFullPlayer.duration) >= 0.75)) {
        mediaPlayer.setAttribute('nextVideoReady', 'true');
        openUnpackingFiles(messageid, 'kms-video-preemptive');
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
        const kmsPlayer = document.getElementById('kongouMediaPlayer');
        const videoStatus = videoModel.querySelector('span.status-text');
        const videoProgress = videoModel.querySelector('.progress > .progress-bar');
        const kmsStatus = kmsPlayer.querySelector('.kms-status-bar > span');
        const kmsProgress = kmsPlayer.querySelector('.kms-progress-bar');

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
                                        } else if (activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
                                            kmsStatus.innerText = `Downloaded ${activeSpannedJob.blobs.length}/${activeSpannedJob.parts.length - activeSpannedJob.blobs.length} Blocks`;
                                            kmsProgress.style.width = activeSpannedJob.progress;
                                        }
                                    }
                                    kmsPlayer.querySelector('.kms-progress-bar').classList.remove('hidden');
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
                                        const downloadedFile = window.URL.createObjectURL(new Blob(activeSpannedJob.blobs));
                                        const link = document.createElement('a');
                                        link.id = `fileData-${activeSpannedJob.id}`
                                        link.classList = `hidden`
                                        link.href = downloadedFile;
                                        link.setAttribute('download', activeSpannedJob.filename);
                                        document.body.appendChild(link);
                                        if (activeSpannedJob && !activeSpannedJob.play) {
                                            link.click();
                                        }

                                        if (activeSpannedJob && activeSpannedJob.play === 'video') {
                                            videoStatus.innerText = `All Blocks Downloaded! Processing Blocks...`;
                                        } else if (activeSpannedJob && activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
                                            kmsStatus.innerText = ``;
                                            kmsPlayer.querySelector('.kms-progress-bar').classList.add('hidden')
                                        } else {
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
                                        } else if (activeSpannedJob && activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
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
                                    } else if (activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
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
                                } else if (activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
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
                            } else if (activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
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
                        } else if (activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
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
                    } else if (activeSpannedJob.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
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
    if (downloadSpannedController.size !== 0 || memorySpannedController.length > 0) {
        let activeProgress = [];
        const keys = Array.from(downloadSpannedController.keys()).map(e => {
            const item = downloadSpannedController.get(e);
            if (item.ready) {
                let results = [`<a class="dropdown-item text-ellipsis" style="max-width: 80vw;" title="Stop Extraction of this job" href='#_' onclick="stopUnpackingFiles('${e}'); return false;" role='button')>`]
                if (!item.pending) {
                    results.push(`<i class="fas fa-spinner text-success pr-2"></i>`);
                    results.push(`<span>${item.name} (${item.size})</span>`);
                    if (activeSpannedJob && activeSpannedJob.progress) {
                        results.push(`<span class="pl-2 text-success">${activeSpannedJob.progress}</span>`);
                        /*activeProgress.push(`<div class="progress pl-2" style="height: 30px;">`);
                            activeProgress.push(`<div class="progress-bar progress-bar-striped bg-success" role="progressbar" style='width: ${activeSpannedJob.progress}%' aria-valuenow='${activeSpannedJob.progress}' aria-valuemin='0' aria-valuemax='100'></div>`);
                        activeProgress.push('</div>');*/
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
                    if (item.play === 'video' || item.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
                        clickAction = `PlayVideo('${element.href}', '${item.channel}/${item.name} (${item.size})', '${item.id}');`
                    } else if (item.play === 'audio') {
                        clickAction = `PlayTrack('${element.href}');`
                        clickAction = `PlayTrack('${element.href}');`
                    }
                    results.push(`<a class="text-ellipsis mr-auto" style="max-width: 80vw;"  title="Play File" href='#_' onclick="${clickAction} return false;" role='button')>`);
                } else {
                    results.push(`<a class="text-ellipsis mr-auto" style="max-width: 80vw;"  title="Save File" href="${element.href}" role='button')>`);
                }
                if (item.play === 'video' || item.play === 'kms-video' || activeSpannedJob.play === 'kms-video-preemptive') {
                    results.push(`<i class="fas fa-film mr-1"></i>`)
                } else if (item.play === 'audio') {
                    results.push(`<i class="fas fa-music mr-1"></i>`)
                } else {
                    results.push(`<i class="fas fa-file mr-1"></i>`)
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
        if (document.getElementById('statusPanel')) {
            $('#statusPanel').removeClass('hidden');
            if (keys.length > 0 || completedKeys.length > 0) {
                $('#statusPanel > .dropdown > .dropdown-menu').html($([...keys, ...completedKeys].join('\n')));
                $('#statusMenuProgress').html($(activeProgress.join('\n')));
                if (keys.length <= 9 && keys.length > 0) {
                    document.getElementById('statusMenuIndicator').classList = 'fas pl-1 fa-square-' + keys.length;
                } else if (keys.length > 0) {
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
        } else if (memorySpannedController.length !== 0) {
            document.getElementById('statusMenuIcon').classList = 'fas fa-usb-drive';
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
    const link = document.getElementById('fileData-' + id);
    if (link)
        document.body.removeChild(link);
    memorySpannedController = memorySpannedController.filter(e => e.id !== id);
    if (!noupdate)
        updateNotficationsPanel();
}
let notificationControler = null;

async function showSearchOptions(post) {
    pageType = $.history.url().split('?')[0].substring(1);
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
        advancedInfo.push(`<div><i class="fa fa-font pr-1"></i><span class="text-monospace" title="Kanmi/Sequenzia Real File Name">${postFilename}</span></div>`);
        modalFilename.innerText = postFilename.split('.')[0];
        modalFilename.classList.remove('hidden');
    } else {
        modalFilename.innerText = "Unknown";
        modalFilename.classList.add('hidden');
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
            let _url = `/${(pageType === 'tvTheater' || pageType === 'listTheater') ? 'gallery' :  pageType}`;
            window.getSelection().toString()
            window.location.assign(`#${_url}?search=${encodeURIComponent('text:' + text.trim())}${(nsfwString) ? nsfwString : ''}`);
        } else {
            alert(`You must select text above first before you can search selected text!`)
        }
        return false;
    }
    modalGoToPostLocation.onclick = function() {
        $('#searchModal').modal('hide');
        let _url = `/${(pageType === 'tvTheater' || pageType === 'listTheater') ? 'gallery' :  pageType}`;
        console.log(_url);
        window.location.assign("#" + params([], [['channel', `${postChannel}`], ['nsfw', 'true']], _url));
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
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu("RemoveReport");
        }
        modalRepair.classList.remove('hidden');
        modalRepair.onclick = function() {
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu((postIsVideo) ? "VideoThumbnail" : "Thumbnail");
        }

        modalMove.classList.remove('hidden');
        modalMove.onclick = function() {
            postsActions = [];
            updateRecentPostDestinations();
            selectPostToMode(postID, false);
            selectedActionMenu("MovePost");
        }

        modalDelete.classList.remove('hidden');
        modalDelete.onclick = function() {
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu("ArchivePost");
        }

        modalEditText.classList.remove('hidden');
        modalEditText.onclick = function() {
            postsActions = [];
            selectPostToMode(postID, false);
            selectedActionMenu("EditTextPost");
        }

        if (pageType.includes('gallery') && !postIsAudio && !postIsVideo) {
            modalRotate.classList.remove('hidden');
            modalRotate.onclick = function() {
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
                postsActions = [];
                selectPostToMode(postID, false);
                selectedActionMenu("RenamePost");
            }
            if (postCached) {
                modalCompile.classList.add('hidden');
                modalDecompile.classList.remove('hidden');
                modalDecompile.onclick = function () {
                    postsActions = [];
                    selectPostToMode(postID, false);
                    selectedActionMenu("DecompileSF");
                }
            } else {
                modalDecompile.classList.add('hidden');
                modalCompile.classList.remove('hidden');
                modalCompile.onclick = function () {
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
function getLocation() {
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
    if (html.location.hash.startsWith('#/gallery')) {
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
