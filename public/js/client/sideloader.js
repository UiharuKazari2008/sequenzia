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
        $('#loadingLogo').fadeOut(500)
    }
    return false;
}
async function setupReq (push) {
    responseComplete = false;
    $('#loadingLogo').fadeIn();
    if (push !== true)
        $(".container-fluid").fadeTo(500, 0.4);


    if (!initalPageLoad)
        $("#userMenu").collapse("hide");
    $(".sidebar").removeClass('open');
    $("body").addClass("sidebar-toggled");
    $(".sidebar").addClass("toggled");
    $('.sidebar .collapse').collapse('hide');
    if ($(window).width() < 1700) {
        $(".music-player").removeClass("toggled");
    }
    writeLoadingBar();
    return false;
}
let recoverable
async function requestCompleted (response, url, lastURL, push) {
    responseComplete = true
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
            })
        } else {
            if (push === true) {
                $('#LoadNextPage').remove();
                $("#contentBlock > .tz-gallery > .row").append($(response).find('#contentBlock > .tz-gallery > .row').contents());
                setImageLayout(setImageSize);
                setPageLayout(false);
                $("#contentBlock > style").html($(response).find('#contentBlock > style'));
                $("#finalLoad").html($(response).find('#finalLoad'));
                if (!pageTitle.includes(' - Item Details')) {
                    getPaginator(url);
                }
                if (inReviewMode)
                    enableReviewMode();
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
        }
        pageType = url.split('/')[0];
        initialLoad = false
        if(!isTouchDevice()) {
            $('[data-tooltip="tooltip"]').tooltip()
            $('[data-tooltip="tooltip"]').tooltip('hide')
        }
    }
    return false;
}

let requestInprogress
let paginatorInprogress
function getNewContent(remove, add, url, keep) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    setupReq()
    let _url = (() => {
            try {
                if (url) { return url.split('://' + window.location.host).pop() }
                if ($.history) { return $.history.url() }
                if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            } catch (e) {
                console.error("Failed to access URL data, falling back")
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
    setupReq(true)
    let _url = (() => {
        try {
            if (url) { return url.split('://' + window.location.host).pop() }
            if ($.history) { return $.history.url() }
            if (window.location.hash.substring(1).length > 2) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
            return null
        } catch (e) {
            console.error("Failed to access URL data, falling back")
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
        setupReq()
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
function getLimitContent() {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    const requestLimit = document.getElementById('limitRequested').value;
    if (requestLimit !== null && requestLimit !== '') {
        const _url = params([], [['limit', requestLimit ]]);
        setupReq()
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
    setupReq()
    document.location.href = params(remove, add, url);
    return false;
}
function getNewURIContent(element, type) {
    if(requestInprogress) { requestInprogress.abort(); if(paginatorInprogress) { paginatorInprogress.abort(); } }
    setupReq()
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
let activeSpannedJob = null;
function downloadSelectedItems() {
    try {
        pageType = $.history.url().split('?')[0].substring(1);
        downloadAllController = {
            ready: true,
            urls: [],
            about: new AbortController()
        };
        downloadAllController.urls = postsActions.map(e => document.getElementById(`request-download-${e.messageid}`).href)
        document.getElementById("downloadProgText").innerText = `Ready to download ${downloadAllController.urls.length} items!`
        $('#downloadAll').modal('show');
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
            about: new AbortController()
        };
        $('a[id^=request-download]').each(function () {
            downloadAllController.urls.push($(this).attr('href'));
        });
        document.getElementById("downloadProgText").innerText = `Ready to download ${downloadAllController.urls.length} items!`
        $('#downloadAll').modal('show');
    } catch (e) {
        alert(`Error starting downloader: ${e.message}`)
    }
}
async function startDownloadingFiles() {
    const downloadModel = document.getElementById('downloadAll')
    console.log(`Downloading ${downloadAllController.urls.length} files`)

    $('#downloadStartButton').addClass('hidden');
    $('#downloadStopButton').removeClass('hidden');
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
                    return `${document.location.protocol}//${document.location.host}/pipe${downloadAllController.urls[i].split('attachments').pop()}`
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

async function openUnpackingFiles(fileid, playThis) {
    if (fileid) {
        if (downloadSpannedController.size === 0 && !activeSpannedJob) {
            downloadSpannedController.set(fileid, {
                id: fileid,
                pending: true,
                ready: true,
                play: playThis
            })
            $.toast({
                type: 'success',
                title: 'Unpack File',
                subtitle: 'Now',
                content: `File is unpacking, check active jobs for progress`,
                delay: 5000,
            });
            //$('#downloadSpannedFile').modal('show');
            updateNotficationsPanel();
            notificationControler = setInterval(updateNotficationsPanel, 1000);
            while (downloadSpannedController.size !== 0) {
                const itemToGet = Array.from(downloadSpannedController.keys())[0]
                activeSpannedJob = downloadSpannedController.get(itemToGet)
                if (activeSpannedJob.ready && activeSpannedJob.pending) {
                    await unpackFile();
                    if (activeSpannedJob.play) {
                        console.log(`Launching File...`)
                        const element = document.getElementById(`fileData-${activeSpannedJob.id}`);
                        if (element) {
                            if (activeSpannedJob.play === 'audio') {
                                PlayTrack(element.href);
                            } else if (activeSpannedJob.play === 'video') {
                                PlayVideo(element.href);
                            } else {
                                console.error('No Datatype was provided')
                            }
                        } else {
                            console.error('Data lost!')
                        }
                    }
                }
                downloadSpannedController.delete(itemToGet);
                console.log(`Job Complete: ${downloadSpannedController.size} Jobs Left`)
            }
            activeSpannedJob = null;
        } else if (!downloadSpannedController.has(fileid)) {
            downloadSpannedController.set(fileid, {
                id: fileid,
                pending: true,
                ready: true,
                play: playThis
            })
            $.toast({
                type: 'success',
                title: 'Unpack File',
                subtitle: 'Now',
                content: `File is added to queued`,
                delay: 5000,
            });
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
async function stopUnpackingFiles(fileid) {
    if (downloadSpannedController.has(fileid)) {
        const _controller = downloadSpannedController.get(fileid)
        if (_controller.pending === true) {
            _controller.pending = false;
            _controller.ready = false;
            downloadSpannedController.delete(fileid)
        } else {
            activeSpannedJob = false;
            _controller.ready = false;
            activeSpannedJob.abort.abort();
            _controller.abort.abort();
        }
    }
}
async function unpackFile() {
    if (activeSpannedJob && activeSpannedJob.id && activeSpannedJob.pending && activeSpannedJob.ready) {
        console.log(`Downloading File ${activeSpannedJob.id}...`)
        activeSpannedJob.pending = false;

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
                                    for (let i in activeSpannedJob.parts) {
                                        if (!activeSpannedJob.ready)
                                            break;
                                        const percentage = (parseInt(i) / activeSpannedJob.parts.length) * 100
                                        activeSpannedJob.progress = `${percentage.toFixed(0)}%`;

                                        await new Promise(ok => {
                                            axios({
                                                url: activeSpannedJob.parts[i],
                                                method: 'GET',
                                                signal: activeSpannedJob.abort.signal,
                                                responseType: 'blob'
                                            })
                                                .then((response) => {
                                                    console.log(`Downloaded Parity ${activeSpannedJob.parts[i]}`)
                                                    activeSpannedJob.blobs.push(response.data);
                                                    ok(true);
                                                })
                                                .catch(e => {
                                                    console.error(`Failed Parity ${activeSpannedJob.parts[i]} - ${e.message}`)
                                                    activeSpannedJob.ready = false;
                                                    ok(false);
                                                })
                                        })
                                    }

                                    if (activeSpannedJob.blobs.length === activeSpannedJob.expected_parts) {
                                        activeSpannedJob.progress = `100%`;
                                        const downloadedFile = window.URL.createObjectURL(new Blob(activeSpannedJob.blobs));
                                        const link = document.createElement('a');
                                        link.id = `fileData-${activeSpannedJob.id}`
                                        link.classList = `hidden`
                                        link.href = downloadedFile;
                                        link.setAttribute('download', activeSpannedJob.filename);
                                        document.body.appendChild(link);
                                        if (!activeSpannedJob.play) {
                                            link.click();
                                            document.body.removeChild(link);
                                        }

                                        $.toast({
                                            type: 'success',
                                            title: 'Unpack File',
                                            subtitle: 'Now',
                                            content: `File was unpacked successfully<br/>${activeSpannedJob.filename}`,
                                            delay: 15000,
                                        });
                                        job(true);
                                    } else {
                                        $.toast({
                                            type: 'error',
                                            title: 'Unpack File',
                                            subtitle: 'Now',
                                            content: `Missing a downloaded parity file, Retry to download!`,
                                            delay: 15000,
                                        });
                                        job(false);
                                    }
                                } else {
                                    $.toast({
                                        type: 'error',
                                        title: 'Unpack File',
                                        subtitle: 'Now',
                                        content: `File is damaged or is missing parts, please report to the site administrator!`,
                                        delay: 15000,
                                    });
                                    job(false);
                                }
                            } else {
                                $.toast({
                                    type: 'error',
                                    title: 'Unpack File',
                                    subtitle: 'Now',
                                    content: `Failed to read the parity metadata response!`,
                                    delay: 15000,
                                });
                                job(false);
                            }
                        } catch (e) {
                            console.error(e);
                            $.toast({
                                type: 'error',
                                title: 'Unpack File',
                                subtitle: 'Now',
                                content: `File Handeler Fault!<br/>${e.message}`,
                                delay: 15000,
                            });
                            job(false);
                        }
                    } else {
                        $.toast({
                            type: 'error',
                            title: 'Unpack File',
                            subtitle: 'Now',
                            content: `File failed to unpack!<br/>${response}`,
                            delay: 15000,
                        });
                        job(false);
                    }
                    activeSpannedJob.blobs = [];
                },
                error: function (xhr) {
                    $.toast({
                        type: 'error',
                        title: 'Unpack File',
                        subtitle: 'Now',
                        content: `File failed to unpack!<br/>${xhr.responseText}`,
                        delay: 15000,
                    });
                    activeSpannedJob.blobs = [];
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
    if (downloadSpannedController.size !== 0) {
        const keys = Array.from(downloadSpannedController.keys()).map(e => {
            const item = downloadSpannedController.get(e);
            if (item.ready) {
                let results = [`<a class="dropdown-item" title="Sort Descending" href='#_' onclick="stopUnpackingFiles('${e}'); return false;" role='button')>`]
                if (!item.pending) {
                    results.push(`<i class="fas fa-spinner text-success pr-2"></i>`)
                    results.push(`<span>${e}</span>`)
                    if (activeSpannedJob.progress) {
                        results.push(`<span class="pl-2 text-success">${activeSpannedJob.progress}</span>`)
                    }
                } else {
                    results.push(`<span>${e}</span>`)
                }
                results.push(`</a>`)
                return results.join('\n')
            } else {
                return ''
            }
        })
        if (document.getElementById('statusPanel')) {
            $('#statusPanel').removeClass('hidden')
            if (keys.length > 0) {
                $('#statusPanel > .dropdown > .dropdown-menu').html($(keys.join('\n')))
                if (keys.length <= 9) {
                    document.getElementById('statusMenuIndicator').classList = 'fas fa-square-' + keys.length
                } else {
                    document.getElementById('statusMenuIndicator').classList = 'fas fa-square-ellipsis'
                }
            } else {
                $('#statusPanel > .dropdown > .dropdown-menu').html('<span class="dropdown-header">No Active Jobs</span>')
                document.getElementById('statusMenuIndicator').classList = 'fas fa-square-0'
            }
        }
    } else {
        clearInterval(notificationControler);
        notificationControler = null;
        if (document.getElementById('statusPanel')) {
            $('#statusPanel').addClass('hidden')
            $('#statusPanel > .dropdown > .dropdown-menu').html('<span class="dropdown-header">No Active Jobs</span>')
        }
    }
}
let notificationControler = null;

async function showSearchOptions(post) {
    const _post = document.getElementById(`message-${post}`);
    console.log(_post);
    const postChannel = _post.getAttribute('data-msg-channel');
    const postServer = _post.getAttribute('data-msg-server');
    const postChannelString = _post.getAttribute('data-msg-channel-string');
    const postDisplayName = _post.getAttribute('data-msg-displayname');
    const postDownload = _post.getAttribute('data-msg-download');
    const postFilename = _post.getAttribute('data-msg-filename');
    const postEID = _post.getAttribute('data-msg-eid');
    const postID = _post.getAttribute('data-msg-id');
    let postBody = _post.getAttribute('data-msg-bodyraw') + '';
    const nsfwString = _post.getAttribute('data-nsfw-string');
    const manageAllowed = _post.getAttribute('data-msg-manage') + '' === 'true';

    const searchUser = _post.getAttribute('data-search-user');
    const searchParent = _post.getAttribute('data-search-parent');
    const searchColor = _post.getAttribute('data-search-color');
    const searchSource = _post.getAttribute('data-search-source');

    const modalGoToPostLocation = document.getElementById(`goToPostLocation`);
    const modalSearchSelectedText = document.getElementById(`searchSelectedText`);
    const modalGoToHistoryDisplay = document.getElementById(`goToHistoryDisplay`);
    const modalDownloadButton = document.getElementById(`goToDownload`);
    const modalGoToPostSource = document.getElementById(`goToPostSource`);
    const modalSearchByUser = document.getElementById(`searchByUser`);
    const modalSearchByParent = document.getElementById(`searchByParent`);
    const modalSearchByColor = document.getElementById(`searchByColor`);
    const modalSearchByID = document.getElementById(`searchByID`);
    const modalBodyRaw = document.getElementById(`rawBodyContent`);
    const modalToggleFav = document.getElementById(`toggleFavoritePost`);
    const modalToggleAlbum = document.getElementById(`manageAlbumPost`);
    const modalManagePost = document.getElementById(`managePost`);

    document.getElementById('searchFilterCurrent').setAttribute('data-search-location', `${params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount'], [])}`)
    document.getElementById('searchFilterPost').setAttribute('data-search-location', `${params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount', 'channel', 'folder', 'album', 'album_name'], [['channel', postChannel]])}`)
    document.getElementById('searchFilterEverywhere').setAttribute('data-search-location', `${params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount', 'channel', 'folder', 'album', 'album_name'], [])}`)

    modalSearchSelectedText.onclick = function() {
        const text = window.getSelection().toString()
        if (text && text.length > 0 && text.trim().length > 0) {
            $('#searchModal').modal('hide');
            window.getSelection().toString()
            window.location.assign(`#${getLocation()}search=text:${text.trim()}${(nsfwString) ? nsfwString : ''}`);
        } else {
            alert(`You must select text above first before you can search selected text!`)
        }
        return false;
    }
    modalGoToPostLocation.onclick = function() {
        $('#searchModal').modal('hide');
        window.location.assign("#" + params(['nsfwEnable', 'pageinatorEnable', 'limit', 'responseType', 'key', 'blind_key', 'nsfw', 'offset', 'sort', 'search', 'color', 'date', 'displayname', 'history', 'pins', 'history_screen', 'newest', 'displaySlave', 'flagged', 'datestart', 'dateend', 'history_numdays', 'fav_numdays', 'numdays', 'ratio', 'minres', 'dark', 'filesonly', 'nocds', 'setscreen', 'screen', 'nohistory', 'reqCount', 'channel', 'folder', 'album', 'album_name'], [['channel', `${postChannel}`], ['nsfw', 'true']]));
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
    if (postChannelString && postChannelString.length > 0) {
        modalGoToPostLocation.querySelector('span').textContent = `Go To "${postChannelString}"`
    } else {
        modalGoToPostLocation.querySelector('span').textContent = 'Go To Channel'
    }
    if (manageAllowed) {
        modalManagePost.onclick = function() {
            selectPostToMode(`${postServer}`, `${postChannel}`, `${postID}`, false);
            openActionMenu();
            return false;
        }
        modalManagePost.classList.remove('hidden')
    } else {
        modalManagePost.onclick = function() { return false; };
        modalManagePost.classList.add('hidden')
    }
    if (searchSource && searchSource.length > 0) {
        modalGoToPostSource.querySelector('span').textContent = `Go To "${searchSource}"`
        modalGoToPostSource.onclick = function() {
            $('#searchModal').modal('hide');
            $(`<a href="${searchSource}" target="_blank" rel="noopener noreferrer"></a>`)[0].click();
            return false;
        }
        modalGoToPostSource.classList.remove('hidden')
    } else {
        modalGoToPostSource.querySelector('span').textContent = 'Go To Source'
        modalGoToPostSource.onclick = function() { return false; };
        modalGoToPostSource.classList.add('hidden')
    }
    if (postDownload && postDownload.length > 0) {
        modalDownloadButton.querySelector('span').textContent = `Direct Download`
        modalDownloadButton.href = postDownload
        if (postFilename && postFilename.length > 0) {
            modalDownloadButton.download = postDownload
        } else {
            modalDownloadButton.download = ''
        }
        modalDownloadButton.classList.remove('hidden')
    } else {
        modalDownloadButton.href = '#_'
        modalDownloadButton.download = ''
        modalDownloadButton.querySelector('span').textContent = 'Direct Download'
        modalDownloadButton.classList.add('hidden')
    }
    if (postDisplayName && postDisplayName.length > 0) {
        modalGoToHistoryDisplay.querySelector('span').textContent = `View "${postDisplayName}"`
        modalGoToHistoryDisplay.onclick = function() {
            $('#searchModal').modal('hide');
            $(`<a href="${searchSource}" target="_blank" rel="noopener noreferrer"></a>`)[0].click();
            return false;
        }
        modalGoToHistoryDisplay.classList.remove('hidden')
    } else {
        modalGoToHistoryDisplay.querySelector('span').textContent = 'View History'
        modalGoToHistoryDisplay.onclick = function() { return false; };
        modalGoToHistoryDisplay.classList.add('hidden')
    }
    if (searchUser && searchUser.length > 0) {
        modalSearchByUser.onclick = function() {
            $('#searchModal').modal('hide');
            window.location.assign(`#${getLocation()}search=text:${searchUser}${(nsfwString) ? nsfwString : ''}`);
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
            window.location.assign(`#${getLocation()}search=text:${searchParent}${(nsfwString) ? nsfwString : ''}`);
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

        modalBodyRaw.querySelector('div').innerHTML = postBody
        modalBodyRaw.classList.remove('hidden')
    } else {
        modalBodyRaw.querySelector('div').innerHTML = ''
        modalBodyRaw.classList.add('hidden')
    }

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
            url: `https://${document.location.host}/transfer?code=${code}`,
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
function sendAction(serverid, channelid, messageid, action, data, confirm) {
    $.ajax({async: true,
        type: "post",
        url: "/actions/v2",
        data: { 'serverid': serverid,
            'channelid': channelid,
            'messageid': messageid,
            'action': action,
            'data': data },
        cache: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (res, txt, xhr) {
            if (xhr.status < 400) {
                console.log(res);
                if (confirm) { $.snack('success', `${res}`, 5000) };
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
            postsActions = [];
        } catch (e) {
            console.log(e);
        }
    } else if (action === 'RotatePost') {
        try {
            message.querySelector('div#postImage').style.transform = 'rotate(' + imageRotate + 'deg)';
            postsActions = [];
        } catch (e) {
            console.log(e);
        }
    } else if (action === 'RenamePost') {
        if (pageType.includes('file')) {
            if (confirm) {
                postsActions = [];
            }
            try {
                message.querySelector('.align-middle').innerText = newFileName;
            } catch (e) {
                console.log(e);
            }
        }
    } else if (action === 'Report') {
        if (confirm) {
            postsActions = [];
            try {
                message.querySelector('.report-link > i').classList.add('reported');
            } catch (e) {
                console.log(e);
            }
        }
    } else if (action === 'RemoveReport') {
        if (confirm) {
            postsActions = [];
            try {
                message.querySelector('.report-link > i').classList.remove('reported');
            } catch (e) {
                console.log(e);
            }
        }
    }
    return false;
}
