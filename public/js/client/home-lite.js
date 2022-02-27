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

function getNewContent(remove, add, url) {
    $('#loadingLogo').fadeIn();
    let _url = (() => {
        try {
            if (url) { return url.split('://' + window.location.host).pop() }
            if (window.location.hash.substring(1).length > 4) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
            return null
        } catch (e) {
            console.error("Failed to access URL data, falling back")
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
}
$.toastDefaults = {
    position: 'top-center', /** top-left/top-right/top-center/bottom-left/bottom-right/bottom-center - Where the toast will show up **/
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
            $.toast({
                type: 'error',
                title: 'Page Failed',
                subtitle: 'Now',
                content: `Failed to load sidebar, Try Again!: ${xhr.responseText}`,
                delay: 5000,
            });
        }
    });
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
    }
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
function isTouchDevice(){
    return true === ("ontouchstart" in window || window.DocumentTouch && document instanceof DocumentTouch);
}

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
                if ((ratio <= 0.88 && _Size[2] < 0.97) || (ratio >= 1.2 && ratio <= 2.5 && _Size[2] >= 1)) {
                    document.getElementById('fullBG').style.display = 'initial';
                    document.getElementById('previewBG').style.display = 'none';
                    document.getElementById('portraitBG').style.display = 'none';
                    document.getElementById('landscapeBG').style.display = 'none';
                    document.getElementById('midSearch').classList.remove('pushUp');
                } else {
                    document.getElementById('fullBG').style.display = 'none';
                    document.getElementById('midSearch').classList.add('pushUp');
                    if (_Size[2] < 0.97) {
                        // Widescreen Image
                        document.getElementById('portraitBG').style.display = 'none';
                        document.getElementById('landscapeBG').style.display = 'initial';
                    } else {
                        // Portrait Image
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
            url: location.href,
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
                } else {
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
                $.toast({
                    type: 'error',
                    title: 'Random Image Error',
                    subtitle: 'Now',
                    content: `${xhr.responseText}`,
                    delay: 5000,
                });
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
                    content: `${xhr.responseText}`,
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
                        content: `Server Error: ${xhr.responseText}`,
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
let bypassSidebarRefresh=false;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/serviceWorker.js')
            .then(reg => console.log('Service Worker: Registered'))
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}

$(document).ready(function () {
    $('.popover').popover('hide');
    $('[data-toggle="popover"]').popover()
    if(isTouchDevice()===false) {
        $('[data-tooltip="tooltip"]').tooltip()
        $('[data-tooltip="tooltip"]').tooltip('hide')
    }
    getRandomImage();
    document.addEventListener("scroll", refreshLayout);
    window.addEventListener("resize", refreshLayout);
    window.addEventListener("orientationChange", refreshLayout);
})
