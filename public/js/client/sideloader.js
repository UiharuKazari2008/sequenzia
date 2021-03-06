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

let last = undefined;
let responseComplete = false;
let itemsRemoved = 0;
let initialLoad = true;
let postsActions = [];
let postsDestination = (getCookie("postsDestination") !== null) ? getCookie("postsDestination") : '';
let _lastChannelSelection = '';
let fileWorking = false;
let uploadDestination = (getCookie("UploadChannelSelection") !== null) ? getCookie("UploadChannelSelection") : '';
let uploadServer = (getCookie("UploadServerSelection") !== null) ? getCookie("UploadServerSelection") : '';
let _lastUploadChannelSelection = '';
let _lastUploadServerSelection = '';
let setImageSize = (getCookie("imageSizes") !== null) ? getCookie("imageSizes") : '0';
let widePageResults = (getCookie("widePageResults") !== null) ? getCookie("widePageResults") : '0';
let downloadURLs = [];

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

    if ($(window).width() < 1700) {
        $("body").addClass("sidebar-toggled");
        $(".sidebar").addClass("toggled");
        $('.sidebar .collapse').collapse('hide');
        $(".music-player").removeClass("toggled");
    }
    writeLoadingBar();
    return false;
}
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
        } else {
            $.when($(".container-fluid").fadeOut(250)).done(() => {
                let contentPage = $(response).find('#content-wrapper').children();
                contentPage.find('#topbar').addClass('no-ani').addClass('ready-to-scroll');
                contentPage.find('a[href="#_"], a[href="#"] ').click(function(e){
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
            })
        }
        $("title").text(pageTitle);
        let addOptions = [];
        if (url.includes('offset=') && !initialLoad) {
            let _h = (url.includes('_h=')) ? parseInt(/_h=([^&]+)/.exec(url)[1]) : 0;
            addOptions.push(['_h', `${(!isNaN(_h)) ? _h + 1 : 0 }` ]);
        }
        const _url = params(['nsfwEnable', 'pageinatorEnable', 'limit'], addOptions, url);
        $.history.push(_url, (_url.includes('offset=')));
        pageType = url.split('/')[0];
        initialLoad = false
        if(isTouchDevice()===false) {
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
    $('#topAddressBarInfo').removeClass('hidden');
    $('#innerAddressBarInfo').removeClass('hidden');
    $('#topAddressBarInput').addClass('hidden')
    $('#innerAddressBarInput').addClass('hidden')
    document.getElementById("directURI").value = '';
    document.getElementById("directURIInner").value = '';
    return false;
}
function showAddressInput() {
    $('#topAddressBarInfo').addClass('hidden');
    $('#innerAddressBarInfo').addClass('hidden');
    $('#topAddressBarInput').removeClass('hidden')
    $('#innerAddressBarInput').removeClass('hidden')
    let _uri = new URLSearchParams(document.location.hash.substring(1).split('?').pop());
    _uri.delete('_h')
    if (!_uri.has('folder') && document.getElementById("folderPath")) {
        _uri.delete('channel');
        _uri.set('folder', document.getElementById("folderPath").innerText)
    }
    document.getElementById("directURI").value = decodeURIComponent(_uri.toString());
    document.getElementById("directURIInner").value = decodeURIComponent(_uri.toString());
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
                html.querySelectorAll('.internal-lightbox').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.overlay-icons').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '1';
                break;
            case '2':
                classList = 'col-6 col-sm-4 col-md-3 col-lg-2 col-xl-2 col-dynamic-small';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.internal-lightbox').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.overlay-icons').forEach(c => c.classList.remove('dynamic-hide'));
                setImageSize = '2';
                break;
            case '3':
                classList = 'col-3 col-sm-2 col-md-2 col-lg-2 col-xl-1 col-dynamic-small';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.internal-lightbox').forEach(c => c.classList.add('dynamic-hide'));
                html.querySelectorAll('.overlay-icons').forEach(c => c.classList.add('dynamic-hide'));
                setImageSize = '3';
                break;
            default:
                classList = 'col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3';
                html.querySelectorAll('.no-dynamic-small').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.internal-lightbox').forEach(c => c.classList.remove('dynamic-hide'));
                html.querySelectorAll('.overlay-icons').forEach(c => c.classList.remove('dynamic-hide'));
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
    console.log('Message Request Sent!')
    if (action === 'Pin' || action === 'PinUser') {
        let icon = document.getElementById('fav-' + id)
        icon.querySelector("#button").classList.add('favorited')
        icon.setAttribute('onClick', 'return false;');
    } else if (action === 'Unpin' || action === 'UnpinUser') {
        let icon = document.getElementById('fav-' + id)
        icon.querySelector("#button").classList.remove('favorited')
        icon.setAttribute('onClick', 'return false;');
    } else if (action === 'MovePost' || action === 'RemovePost' || action === 'ArchivePost') {
        itemsRemoved++;
        try {
            document.getElementById('message-' + id).remove();
            postsActions = [];
        } catch (e) {
            console.log(e);
        }
    } else if (action === 'RotatePost') {
        try {
            document.getElementById('message-' + id).querySelector('div#postImage').style.transform = 'rotate(' + imageRotate + 'deg)';
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
                document.getElementById('message-' + id).querySelector('.align-middle').innerText = newFileName;
            } catch (e) {
                console.log(e);
            }
        }
    } else if (action === 'Report') {
        if (confirm) {
            postsActions = [];
            try {
                document.getElementById('message-' + id).querySelector('.report-link > i').classList.add('reported');
            } catch (e) {
                console.log(e);
            }
        }
    } else if (action === 'RemoveReport') {
        if (confirm) {
            postsActions = [];
            try {
                document.getElementById('message-' + id).querySelector('.report-link > i').classList.remove('reported');
            } catch (e) {
                console.log(e);
            }
        }
    }
    return false;
}