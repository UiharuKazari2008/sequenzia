let _Size = null;
let _Color = null;

$(window).on('hashchange', () => {
    if (location.hash.length > 1 && location.hash.substring(1).startsWith('/')) {
        getNewContent([], [], location.hash.substring(1))
    }
});

function decodeURLRecursively(uri) {
    while (uri !== decodeURIComponent(uri || '')){
        uri = decodeURIComponent(uri);
    }
    return uri;
}
function params(_removeParams, _addParams, _url) {
    let _URL = new URL(window.location.href);
    let _params = new URLSearchParams(_URL.search);
    if (_url) {
        _URL = new URL(window.location.origin + _url);
        _params = new URLSearchParams(_URL.search);
    }
    _removeParams.forEach(param => {
        if (_params.has(param)) {
            _params.delete(param);
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

function dct() {
    const d = new Date();
    let h = d.getHours()
    let m = d.getMinutes();
    if (h < 10) { h = `0${h}` }
    if (m < 10) { m = `0${m}` }
    document.getElementById('time').innerHTML = `${h}:${m}`;
    dc();
}
function ddt() {
    const d = new Date();
    let mth = month[d.getMonth()];
    let dy = d.getDate();
    document.getElementById('date').innerHTML = ` ${mth} ${dy}`;
    dd();
}
function ddwt() {
    const d = new Date();
    let dow = days[d.getDay()];
    document.getElementById('day').innerHTML = `${dow}day`;
    ddw();
}

// Time
function dc(){
    setTimeout(dct,1000)
}
// Date
function dd(){
    setTimeout(ddt,5000)
}
// Day
function ddw(){
    setTimeout(ddwt,5000)
}

function getNewContent(remove, add, url) {
    if (url.startsWith('/tvTheater') || url.startsWith('/listTheater')) {
        document.getElementById('kmsBootDisplay').classList.remove('d-none');
    } else {
        document.getElementById('bootUpDisplay').classList.remove('d-none');
    }
    $.when($('#bootBackdrop').fadeIn(1000)).done(() => {
        let _url = (() => {
            try {
                if (url) { return url.split('://' + window.location.host).pop() }
                if (window.location.hash.substring(1).length > 4) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
                return null
            } catch (e) {
                console.error("Failed to access URL data, falling back")
                console.error(e)
                return null
            }
        })()
        if (_url && _url.startsWith('/') && _url.substring(1).length > 0 && _url.substring(1).split('?')[0].length < 0) {
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
                _url = `${_pathname}?${_params.toString()}`
            }
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
        window.location.href = `/juneOS#${_url}`;
    })
}
$.toastDefaults = {
    position: 'top-right', /** top-left/top-right/top-center/bottom-left/bottom-right/bottom-center - Where the toast will show up **/
    dismissible: true,
    stackable: true,
    pauseDelayOnHover: true,
    style: {
        toast: '', /** Classes you want to apply separated my a space to each created toast element (.toast) **/
        info: '',  /** Classes you want to apply separated my a space to modify the "info" type style  **/
        success: '', /** Classes you want to apply separated my a space to modify the "success" type style  **/
        warning: '', /** Classes you want to apply separated my a space to modify the "warning" type style  **/
        error: '', /** Classes you want to apply separated my a space to modify the "error" type style  **/
    }
};
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
            $("#accordionSidebar").html(_sb);
            if(isTouchDevice()===false) {
                $('[data-tooltip="tooltip"]').tooltip()
                $('[data-tooltip="tooltip"]').tooltip('hide')
            }
        },
        error: function (xhr) {
            if (xhr.status >= 403) {
                $.toast({
                    type: 'error',
                    title: 'Page Failed',
                    subtitle: 'Now',
                    content: `Failed to load sidebar, Try Again!`,
                    delay: 5000,
                });
            }
        }
    });
}

function toggleFavorite(channelid, eid) {
    const star = document.querySelector(`#fav-${eid} > i.fas.fa-star`)
    let isFavorite = false;
    if (star)
        isFavorite = star.classList.contains('favorited');

    sendBasic(channelid, eid, (isFavorite) ? `Unpin${(channelid === null) ? 'User' : ''}`: `Pin${(channelid === null) ? 'User' : ''}`, true);

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
                content: ``,
                delay: 5000,
            });
        }
    });
    return false;
}
function afterAction(action, data, id, confirm) {
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
    }
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
                    content: ``,
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
function isTouchDevice(){
    return true === ("ontouchstart" in window || window.DocumentTouch && document instanceof DocumentTouch);
}

let noAmbientTimer = false;
let pageReady = false
let refreshLayoutThrottleTimeout
function refreshLayout() {
    if (pageReady) {
        if (refreshLayoutThrottleTimeout) {
            clearTimeout(refreshLayoutThrottleTimeout);
        }

        refreshLayoutThrottleTimeout = setTimeout(function () {
            if (window.innerHeight && window.innerWidth) {
                const ratio = (window.innerHeight / window.innerWidth);
                console.log(_Size[2])
                console.log(ratio)
                document.getElementById('midSearch').classList.remove('backdrop-wide');
                document.getElementById('midSearch').classList.remove('backdrop-neutral');
                document.getElementById('midSearch').classList.remove('backdrop-portait');
                if ((ratio <= 0.88 && _Size[2] < 0.97) || (ratio >= 1.2 && ratio <= 2.5 && _Size[2] >= 1)) {
                    document.getElementById('fullBG').style.display = 'initial';
                    document.getElementById('previewBG').style.display = 'none';
                    document.getElementById('portraitBG').style.display = 'none';
                    document.getElementById('landscapeBG').style.display = 'none';
                    document.getElementById('midSearch').classList.add('backdrop-neutral');
                } else {
                    document.getElementById('fullBG').style.display = 'none';
                    if (_Size[2] < 0.97) {
                        // Widescreen Image
                        document.getElementById('portraitBG').style.display = 'none';
                        document.getElementById('landscapeBG').style.display = 'initial';
                        document.getElementById('midSearch').classList.add('backdrop-wide');
                    } else {
                        // Portrait Image
                        document.getElementById('midSearch').classList.add('backdrop-portait');
                        document.getElementById('portraitBG').style.display = 'initial';
                        document.getElementById('landscapeBG').style.display = 'none';
                    }
                    document.getElementById('previewBG').style.display = 'initial';
                }
                document.getElementById('cover').classList.add('fadeOut')
            }
        }, 1000);
    }
}
function getRandomImage() {
    //try {
        $.ajax({
            async: true,
            url: `/homeImage${(window.location.search && window.location.search.startsWith('?')) ? window.location.search : ''}`,
            type: "GET", data: '',
            processData: false,
            contentType: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR',
                'X-Requested-Page': 'SeqContent'
            },
            success: function (json, textStatus, xhr) {
                if (json.randomImagev2 && json.randomImagev2.length > 0) {
                    const previewImage = json.randomImagev2[0].previewImage;
                    const fullImage = json.randomImagev2[0].fullImage;
                    _Size = [ json.randomImagev2[0].sizeH, json.randomImagev2[0].sizeW, json.randomImagev2[0].sizeR ];
                    _Color = [ json.randomImagev2[0].colorR, json.randomImagev2[0].colorG, json.randomImagev2[0].colorB ];

                    $('#previewBG')[0].style.backgroundImage = `url('${previewImage}')`;
                    $('#fullBG')[0].style.backgroundImage = `url('${fullImage}')`;
                    $('.full-image-holder').attr('src', fullImage);
                    $('.ajax-downloadLink').attr("href", fullImage);
                    $('.ajax-imageLink').attr("onClick", `getNewContent([], [], "${json.randomImagev2[0].jumpLink}"); return false;`);
                    $('.ajax-imageLocation').text(`${json.randomImagev2[0].className} / ${json.randomImagev2[0].channelName}`);
                    $('.ajax-imageDate').text(json.randomImagev2[0].date);
                    $('.middle-indicator').removeClass('d-none');
                    if (json.randomImagev2[0].pinned) {
                        $('.ajax-imageFav').removeClass('d-none');
                    } else {
                        $('.ajax-imageFav').addClass('d-none');
                    }
                    pageReady = true;
                    refreshLayout();
                } else if (xhr.status >= 403) {
                    $.toast({
                        type: 'error',
                        title: 'Random Image Error',
                        subtitle: 'Now',
                        content: `No Results Found`,
                        delay: 5000,
                    });
                }
            },
            error: function (xhr) {
                if (xhr.status  >= 403) {
                    $.toast({
                        type: 'error',
                        title: 'Random Image Error',
                        subtitle: 'Now',
                        content: ``,
                        delay: 5000,
                    });
                }
            }
        });
    // } catch (e) {
    //     $.toast({
    //         type: 'error',
    //         title: 'Random Image Error',
    //         subtitle: 'Now',
    //         content: `Client Script Error - ${e.message}`,
    //         delay: 5000,
    //     });
    // }
}
function verifyNetworkAccess() {
    $.ajax({async: true,
        url: '/ping?json=true',
        type: "GET", data: '',
        processData: false,
        contentType: false,
        json: true,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        timeout: 5000,
        success: function (res, txt, xhr) {
            if (xhr.status === 200 && !res.loggedin) {
                document.getElementById('loginUserButtons').classList.remove('hidden');
                document.getElementById('mainUserButtons').classList.add('hidden');
                document.getElementById('loginCodeDisplay').innerHTML = res.code || 'XXXXXX'
                noAmbientTimer = true;
                /*$.toast({
                    type: 'error',
                    title: 'Login Required',
                    subtitle: '',
                    content: `<p>You need to login to continue!</p>${(res.code) ? '<p>Express Login: <b>' + res.code + '</b></p>' : ''}<a class="btn btn-success w-100 mb-2" href="/"><i class="fas fa-sign-in-alt pr-2"></i>Login</a><br/><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/discord/login'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a>`
                });*/
            } else if (xhr.status !== 200) {
                $.toast({
                    type: 'error',
                    title: 'Network Error',
                    subtitle: '',
                    content: `<p>Failed to verify network access!</p><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/offline'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a>`,
                    delay: 30000,
                });
            }
        },
        error: function (error) {
            console.log(error);
            $.toast({
                type: 'error',
                title: 'Network Error',
                subtitle: '',
                content: `<p>Failed to verify network access!</p><a class="btn btn-danger w-100" href='#_' onclick="transitionToOOBPage('/offline'); return false;"><i class="fas fa-folder-bookmark pr-2"></i>Local Files</a>`,
                delay: 30000,
            });
        }
    });
}

let lastMessageAlbum
function refreshAlbumsList(messageid) {
    lastMessageAlbum = messageid
    $(`#albumItemModal`).modal('show');
    $.ajax({async: true,
        url: `/albums?command=getAll${(lastMessageAlbum) ? '&messageid=' + lastMessageAlbum : '&manage=true'}`,
        type: "GET", data: '',
        processData: false,
        contentType: false,
        headers: {
            'X-Requested-With': 'SequenziaXHR'
        },
        success: function (response, textStatus, xhr) {
            if (xhr.status < 400) {
                $(`#albumItemBody`).html(response);
            } else {
                $(`#albumItemBody`).html('<span>Failed to get valid albums list via AJAX</span>');
            }
        },
        error: function (xhr) {
            $(`#albumItemBody`).html('<span>Failed to get albums list via AJAX</span>');
        }
    });
}
function createNewAlbum() {
    const newAlbumNameText = document.querySelector("#albumNameText");
    const newAlbumTypeSelect = document.querySelector("#albumTypeSelect");
    const newAlbumPrivacySelect = document.querySelector("#albumPrivacySelect");
    if (newAlbumNameText.value.length > 1 && newAlbumNameText.value.trim().length > 1) {
        $.ajax({async: true,
            url: `/actions/v1`,
            type: "post",
            data: {
                'album_name': newAlbumNameText.value.trim(),
                'album_uri': newAlbumTypeSelect.value,
                'album_privacy': newAlbumPrivacySelect.value,
                'action': 'CollCreate'
            },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response, textStatus, xhr) {
                if (xhr.status < 400) {
                    $(`#newAlbumForm`).collapse('hide');
                    refreshAlbumsList();
                    newAlbumNameText.value = '';
                } else {
                    $.toast({
                        type: 'error',
                        title: 'Failed to create album',
                        subtitle: 'Now',
                        content: `Server Error`,
                        delay: 5000,
                    });
                }
            },
            error: function (xhr) {
                $.toast({
                    type: 'error',
                    title: 'Failed to create album',
                    subtitle: 'Now',
                    content: ``,
                    delay: 5000,
                });
            }
        })
    } else {
        $.snack('error', `Album name must contain text`, 1500);
    }
}
function updateAlbum(aid) {
    try {
        const albumName = document.querySelector(`#album-${aid}-Text`).value;
        const albumType = document.querySelector(`#album-${aid}-Type`).value;
        const albumPrivacy = document.querySelector(`#album-${aid}-Privacy`).value;
        if (albumName.length > 1 && albumName.trim().length > 1) {
            $.ajax({async: true,
                url: `/actions/v1`,
                type: "post",
                data: {
                    'albumid': aid,
                    'album_name': albumName,
                    'album_uri': albumType,
                    'album_privacy': albumPrivacy,
                    'action': 'CollUpdate'
                },
                cache: false,
                headers: {
                    'X-Requested-With': 'SequenziaXHR'
                },
                success: function (response, textStatus, xhr) {
                    if (xhr.status < 400) {
                        refreshAlbumsList();
                    } else {
                        $.toast({
                            type: 'error',
                            title: 'Failed to update album',
                            subtitle: 'Now',
                            content: `Failed to update album due to an error`,
                            delay: 5000,
                        });
                    }
                },
                error: function (xhr) {
                    $.toast({
                        type: 'error',
                        title: 'Failed to update album',
                        subtitle: 'Now',
                        content: `Server Error`,
                        delay: 5000,
                    });
                }
            })
        } else {
            $.snack('error', `Album name must contain text`, 1500);
        }
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Failed update album',
            subtitle: 'Now',
            content: `Client Error: ${e.message}`,
            delay: 5000,
        });
    }
}
function deleteAlbum(aid) {
    try {
        $.ajax({async: true,
            url: `/actions/v1`,
            type: "post",
            data: {
                'albumid': aid,
                'action': 'CollDelete'
            },
            cache: false,
            headers: {
                'X-Requested-With': 'SequenziaXHR'
            },
            success: function (response, textStatus, xhr) {
                if (xhr.status < 400) {
                    refreshAlbumsList();
                } else {
                    $.toast({
                        type: 'error',
                        title: 'Failed to delete album',
                        subtitle: 'Now',
                        content: `Failed to delete album due to an error`,
                        delay: 5000,
                    });
                }
            },
            error: function (xhr) {
                $.toast({
                    type: 'error',
                    title: 'Failed to delete album',
                    subtitle: 'Now',
                    content: `Does not exist`,
                    delay: 5000,
                });
            }
        })
    } catch (e) {
        $.toast({
            type: 'error',
            title: 'Failed to delete album',
            subtitle: 'Now',
            content: `Client Error: ${e.message}`,
            delay: 5000,
        });
    }
}
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/serviceWorker.min.js')
            .then(async registration => {
                console.log('Service Worker: Registered')
            })
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}

let ambientTimeout;
let ambientNextImageTimeout;
function setupAmbientTimers () {
    document.addEventListener("mousemove", resetAmbientTimer, false);
    document.addEventListener("mousedown", resetAmbientTimer, false);
    document.addEventListener("keypress", resetAmbientTimer, false);
    document.addEventListener("touchmove", resetAmbientTimer, false);
    dc();
    startAmbientTimer();
    setInterval(() => {
        if (!document.hidden)
            getRandomImage();
    }, 300000)
}
function startAmbientTimer() {
    if (!ambientTimeout) {
        $('.container, #homeBg').fadeIn(500);
        $('.ambient-items').fadeOut(500);
    }
    ambientTimeout = window.setTimeout(switchToAmbientMode, 30000)
}
function resetAmbientTimer() {
    window.clearTimeout(ambientTimeout);
    startAmbientTimer();
}
function switchToAmbientMode() {
    $('.container').fadeOut(500);
    $('#homeBg').fadeOut(1000);
    $('.ambient-items').fadeIn(500);
    window.clearTimeout(ambientTimeout);
    ambientTimeout = null;
}


$(document).ready(function () {
    verifyNetworkAccess();
    getRandomImage();
    getSidebar();
    $('.popover').popover('hide');
    $('[data-toggle="popover"]').popover()
    if(isTouchDevice()===false) {
        $('[data-tooltip="tooltip"]').tooltip()
        $('[data-tooltip="tooltip"]').tooltip('hide')
    }
    document.addEventListener("scroll", refreshLayout);
    window.addEventListener("resize", refreshLayout);
    window.addEventListener("orientationChange", refreshLayout);
    setTimeout(() => {
        if (!noAmbientTimer)
            setupAmbientTimers();
    }, 15000)
    //dd();
    //ddw();
})
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.onmessage = async function (event) {
        switch (event.data.type) {
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
            default:
                break;
        }
    };
}
async function transitionToOOBPage(pageUrl) {
    if (pageUrl === '/')
        return false;
    if (pageUrl.startsWith('/offline') || pageUrl.startsWith('/june')) {
        document.getElementById('bootUpDisplay').classList.remove('d-none');
    }
    try {
        document.getElementById('bootBackdropSunrise').classList.add('hidden');
        $.when($('#bootBackdrop').fadeIn(500)).done(() => { location.href = pageUrl })
    } catch (e) {
        console.error('Failed to make fancy transition animation to home page');
        console.error(e);
        location.href = pageUrl
    }
}
