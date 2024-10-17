// DO NOT FUCKING EDIT THE INFO DIALOG CONTENTS WITHOUT EDITING THE LAYOUT.PUG FILE YOU RETARD!!!
// EDIT THERE AND COMPILE THE PUG TO HTML ====> https://pughtml.com/
const infodialog = '<div class="info-dialog-container" data-simplebar>\n' +
    '    <div class="row px-3">\n' +
    '        <div class="mt-1 w-100 d-flex flex-row align-items-start" id="infoDialogauthorData"><img class="rounded-circle pr-2 shadow-blk" style="height: 48px;" /><span class="text-ellipsis align-self-center shadow-text" style="font-size: 1.5em;"></span></div>\n' +
    '    </div>\n' +
    '    <div class="row px-2 flex-nowrap mb-1 mt-2" style="display: flex; justify-content: space-evenly; align-content: center; flex-direction: row; align-items: center;"><a class="btn text-white" id="infoDialogtoggleFavoritePost" role="button" href="#__"><i class="infoDialog-icon fas fa-star shadow-text"></i></a><a class="btn text-white" id="infoDialogaddFlagPost" role="button" href="#__"><i class="infoDialog-icon fas fa-flag shadow-text"></i></a>\n' +
    '        <a\n' +
    '            class="btn text-white" id="infoDialoggoToPostLocation" href="#__" role="button"><i class="infoDialog-icon fas fa-directions shadow-text"></i></a><a class="btn text-white hidden" id="infoDialoggoToPostSource" href="#__" role="button"><i class="infoDialog-icon fas fa-link shadow-text"></i></a><a class="btn text-white" id="infoDialoggoToHistoryDisplay"\n' +
    '                href="#__" role="button"><i class="infoDialog-icon fas fa-history shadow-text"></i></a><a class="btn text-white" id="infoDialoggoToPlay" href="#__" role="button"><i class="infoDialog-icon fas fa-play shadow-text"></i></a><a class="btn text-white"\n' +
    '                id="infoDialoggoToDownload" href="#__" role="button" target="_blank" rel="noopener noreferrer"><i class="infoDialog-icon fas fa-download shadow-text"></i></a><a class="btn text-white" id="infoDialogmakeOffline" href="#__" role="button"><i class="infoDialog-icon fas fa-folder-bookmark shadow-text"></i></a></div>\n' +
    '    <div\n' +
    '        class="row pl-3 pr-3 hidden" id="infoDialogkeepExpireingFile"><a class="btn btn-primary mb-2 w-100" data-toggle="collapse" href="#__" role="button"><i class="fas fa-clock pr-2"></i><span>Keep Offline File</span></a></div>\n' +
    '<div class="row px-3"><span class="text-center w-100 font-italic text-lg shadow-text" id="infoDialoginfoFilename"></span></div>\n' +
    '<div class="row px-3">\n' +
    '    <div class="mt-2 text-center w-100" id="infoDialograwInfoContent"></div>\n' +
    '</div>\n' +
    '<div class="row px-3">\n' +
    '    <div class="mt-1 text-center w-100 p-1" id="infoDialograwBodyContent">\n' +
    '        <div class="card-ui" style="max-height: 600px; overflow-x: hidden; overflow-y: auto; overflow-wrap: anywhere"></div>\n' +
    '    </div>\n' +
    '</div>\n' +
    '<div class="row px-3 mb-2">\n' +
    '    <div class="pt-3 hidden" id="infoDialogtagCollapse">\n' +
    '        <div>\n' +
    '            <div class="d-flex flex-wrap justify-content-center" id="infoDialogtagsStaticHolder" style="font-size: 1.2em;"></div>\n' +
    '            <div class="d-flex flex-wrap justify-content-center" id="infoDialogtagsHolder" style="font-size: 1.2em;"></div>\n' +
    '            <div><span class="text-success text-xs">Powered by Mugino MIITS</span></div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
    '<div class="row px-3 mb-2">\n' +
    '    <div class="mt-1 infoGrid"><a class="btn btn-primary hidden" id="infoDialogsearchUseChannel" href="#_" role="button" data-tooltip="tooltip" data-trigger="hover" data-placement="right" title="Use this folder"><i class="fas fa-folder"></i></a><a class="btn btn-primary hidden"\n' +
    '            id="infoDialogsausenaoRequest" href="#__" target="_blank" rel="noopener noreferrer" role="button" data-tooltip="tooltip" data-trigger="hover" data-placement="right" title="Search SauseNAO (External)"><i class="fas fa-telescope"></i></a><a class="btn btn-primary hidden"\n' +
    '            id="infoDialogsearchByParent" href="#_" role="button" data-tooltip="tooltip" data-trigger="hover" data-placement="right" title="Search the parent post"><i class="fas fa-level-up-alt"></i></a><a class="btn btn-primary hidden" id="infoDialogsearchByUser"\n' +
    '            href="#_" role="button" data-tooltip="tooltip" data-trigger="hover" data-placement="right" title="Search this user"><i class="fas fa-user"></i></a><a class="btn btn-primary hidden" id="infoDialogsearchByColor" href="#_" role="button" data-trigger="hover"\n' +
    '            data-placement="right" title="Search by color"><i class="fas fa-swatchbook"></i></a><a class="btn btn-primary hidden" id="infoDialogsearchByID" href="#_" role="button" data-trigger="hover" data-placement="right" title="Search by related IDs"><i class="fas fa-asterisk"></i></a>\n' +
    '        <a\n' +
    '            class="btn btn-primary hidden" id="infoDialogsearchByContents" href="#_" role="button" data-trigger="hover" data-placement="right" title="Search by post text"><i class="fas fa-font-case"></i></a><a class="btn btn-primary" id="infoDialogsearchSelectedText" href="#_" role="button" data-trigger="hover" data-placement="right" title="Search by selected text"><i class="fas fa-i-cursor"></i></a></div>\n' +
    '</div>\n' +
    '<div class="row px-3 mb-2">\n' +
    '    <div class="btn-group btn-group-toggle mt-2 w-100" id="infoDialogtagLocationSelection" data-toggle="buttons"><label class="btn btn-sm btn-info w-100" id="infoDialogtagFilterPost"><input type="radio" name="options" autocomplete="off" data-search-location="" checked=""/><span> Post</span></label><label class="btn btn-sm btn-info w-100 active" id="infoDialogtagFilterCurrent"><input type="radio" name="options" autocomplete="off" data-search-location=""/><span> Session</span></label>\n' +
    '        <label\n' +
    '            class="btn btn-sm btn-info w-100" id="infoDialogtagFilterEverywhere"><input type="radio" name="options" autocomplete="off" data-search-location="" /><span> Everywhere</span></label>\n' +
    '    </div>\n' +
    '</div>\n' +
    '<div class="accordion row pl-3 pr-3 mt-2" id="infoDialogfindMenus">\n' +
    '    <div class="w-100">\n' +
    '        <div id="infoDialogalbumHeader">\n' +
    '            <h3 class="mb-0"><button class="btn btn-link" type="button" data-toggle="collapse" data-target="#infoDialogalbumCollapse"><i class="fas pr-2 fa-archive"></i>Albums<i class="fas fa-chevron-right pl-2"></i></button></h3>\n' +
    '        </div>\n' +
    '        <div class="collapse w-100" id="infoDialogalbumCollapse" data-parent="#infoDialogfindMenus">\n' +
    '            <div class="mt-1 d-flex">\n' +
    '                <div class="ml-auto mr-auto flex-row"><i class="fa-duotone fa-loader fa-spin-pulse"></i><span class="ml-1">Please Wait...</span></div>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '    <div class="w-100">\n' +
    '        <div id="infoDialogfunctionsHeader">\n' +
    '            <h3 class="mb-0"><button class="btn btn-link" type="button" data-toggle="collapse" data-target="#infoDialogfunctionsCollapse"><i class="fas pr-2 fa-function"></i>Functions<i class="fas fa-chevron-right pl-2"></i></button></h3>\n' +
    '        </div>\n' +
    '        <div class="collapse w-100" id="infoDialogfunctionsCollapse" data-parent="#infoDialogfindMenus">\n' +
    '            <div class="mt-1" id="infoDialognoFunctions">\n' +
    '                <div class="my-2 d-flex flex-row justify-content-center"><i class="fas fa-empty-set pr-2"></i><span>No Functions Available!</span></div>\n' +
    '            </div>\n' +
    '            <div class="mt-1 hidden" id="infoDialogfunctionsList">\n' +
    '                <div class="d-flex flex-column">\n' +
    '                    <div class="d-inline-flex flex-row hidden" id="infoDialogtwitterInteract"><a class="btn btn-primary disabled mb-2 w-100" id="infoDialogtwitterLike" href="#_" role="button"><i class="fas fa-heart"></i></a><a class="btn btn-primary disabled mb-2 w-100 mx-2" id="infoDialogtwitterRT" href="#_" role="button"><i class="fas fa-retweet"></i></a>\n' +
    '                        <a\n' +
    '                            class="btn btn-primary disabled mb-2 w-100" id="infoDialogtwitterLikeRT" href="#_" role="button"><i class="pr-2 fas fa-heart"></i><i class="fas fa-retweet"></i></a>\n' +
    '                    </div>\n' +
    '                    <div class="d-inline-flex flex-row hidden" id="infoDialogtwitterListCtrl"><a class="btn btn-primary disabled mb-2 w-100" id="infoDialogtwitterLAdd" href="#_" role="button"><i class="pr-2 fas fa-user-plus"></i><span>Add</span></a><a class="btn btn-primary disabled mb-2 w-100 mx-2" id="infoDialogtwitterLRm"\n' +
    '                            href="#_" role="button"><i class="pr-2 fas fa-user-xmark"></i><span>Remove</span></a><a class="btn btn-primary disabled mb-2 w-100" id="infoDialogtwitterUserBlock" href="#_" role="button"><i class="pr-2 fas fa-user-slash"></i><span>Block</span></a></div>\n' +
    '                    <a\n' +
    '                        class="btn btn-primary mb-2 w-100 hidden" id="infoDialogtwitterDownloadUser" href="#_" role="button"><i class="pr-2 fas fa-download"></i><span>Download User</span></a><a class="btn btn-primary mb-2 w-100 hidden" id="infoDialogopenPixiv" href="#__" target="_blank" rel="noopener noreferrer" role="button"><i class="pr-2 fas fa-arrow-up-right-from-square"></i><span>Open Illustration</span></a>\n' +
    '                        <a\n' +
    '                            class="btn btn-primary mb-2 w-100 hidden" id="infoDialogpixivFollow" href="#_" role="button"><i class="pr-2 fas fa-user-plus"></i><span>Follow User</span></a><a class="btn btn-primary mb-2 w-100 hidden" id="infoDialogpixivExpand" href="#_" role="button"><i class="pr-2 fas fa-sparkles"></i><span>Expand Search</span></a>\n' +
    '                            <a\n' +
    '                                class="btn btn-primary mb-2 w-100 hidden" id="infoDialogpixivDownloadUser" href="#_" role="button"><i class="pr-2 fas fa-download"></i><span>Download User</span></a>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '    <div class="w-100">\n' +
    '        <div id="infoDialogcustomizeHeader">\n' +
    '            <h3 class="mb-0"><button class="btn btn-link" type="button" data-toggle="collapse" data-target="#infoDialogcustomizeCollapse"><i class="fas pr-2 fa-swatchbook"></i>Services<i class="fas fa-chevron-right pl-2"></i></button></h3>\n' +
    '        </div>\n' +
    '        <div class="collapse w-100" id="infoDialogcustomizeCollapse" data-parent="#infoDialogfindMenus">\n' +
    '            <div class="mt-1">\n' +
    '                <div class="mb-2 d-flex flex-row"><a class="btn btn-success w-100 mr-1" id="infoDialoggetAsWallpaper" href="#__" role="button" target="_blank" rel="noopener noreferrer"><i class="fas fa-download pr-2"></i><span>Download Wallpaper</span></a></div>\n' +
    '                <div class="mb-2 d-flex flex-row">\n' +
    '                    <div class="w-100 mr-1 d-inline-flex"><a class="btn btn-primary w-100 mr-1" id="infoDialogsetPhoneCrop" href="#_" role="button"><i class="fas fa-crop pr-2"></i><span>Portrait</span></a><a class="btn btn-danger" id="infoDialogremovePhoneCrop" href="#_" role="button"><i class="fas fa-trash"></i></a></div>\n' +
    '                    <div\n' +
    '                        class="w-100 ml-1 d-inline-flex"><a class="btn btn-primary w-100 mr-1" id="infoDialogsetWallpaperCrop" href="#_" role="button"><i class="fas fa-crop pr-2"></i><span>Landscape</span></a><a class="btn btn-danger" id="infoDialogremoveWallpaperCrop" href="#_" role="button"><i class="fas fa-trash"></i></a></div>\n' +
    '            </div>\n' +
    '            <div class="mb-2 d-flex flex-row"><a class="btn btn-primary w-100 mr-1" id="infoDialogsetAsAvatar" href="#_" role="button"><i class="fas fa-address-card pr-2"></i><span>Set Avatar</span></a><a class="btn btn-primary w-100 ml-1" id="infoDialogsetAsBanner" href="#_" role="button"><i class="fas fa-address-card pr-2"></i><span>Set Banner</span></a></div>\n' +
    '            <div\n' +
    '                class="d-flex flex-row mb-2"><a class="btn btn-primary w-100" id="infoDialogupscaleRequest" href="#_" role="button"><i class="fas fa-high-definition pr-2"></i><span>Upscale Image</span></a></div>\n' +
    '        <div class="d-flex flex-row"></div>\n' +
    '    </div>\n' +
    '</div>\n' +
    '</div>\n' +
    '<div class="w-100" id="infoDialogmanageButtons">\n' +
    '    <div id="infoDialogtoolboxHeader">\n' +
    '        <h3 class="mb-0"><button class="btn btn-link" type="button" data-toggle="collapse" data-target="#infoDialogtoolboxCollapse"><i class="fas pr-2 fa-toolbox"></i>Manage<i class="fas fa-chevron-right pl-2"></i></button></h3>\n' +
    '    </div>\n' +
    '    <div class="collapse w-100 px-2" id="infoDialogtoolboxCollapse" data-parent="#infoDialogfindMenus">\n' +
    '        <div class="row flex-nowrap mt-1"><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoMove" title="Move Item" href="#_"><i class="fas fa-cut pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Move</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis"\n' +
    '                id="infoDialoginfoEditText" title="Edit Item Contents" href="#_"><i class="fas fa-square-quote pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Edit</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoRename"\n' +
    '                title="Rename Item" href="#_"><i class="fas fa-input-text pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Rename</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoRotae" title="Rotate Image" href="#_"><i class="fas fa-undo pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Rotate</span></a></div>\n' +
    '        <div\n' +
    '            class="row flex-nowrap"><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoRepair" title="Repair Thumbnail" href="#_"><i class="fas fa-image-slash pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Thumb</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis"\n' +
    '                id="infoDialoginfoCompile" title="Compile Spanned File" href="#_"><i class="fas fa-cloud-check pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Cache</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoDecompile"\n' +
    '                title="Remove Cached Spanned File" href="#_"><i class="fas fa-cloud-xmark pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">DeCache</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoDelete" title="Archive or Delete Item(s)"\n' +
    '                href="#_"><i class="fas fa-trash pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Delete</span></a><a class="btn btn-danger mx-1 mb-2 w-100 text-ellipsis" id="infoDialoginfoReport" title="Clear Reported Item(s)" href="#_"><i class="fas fa-flag pr-0 pr-sm-2"></i><span class="d-none d-sm-inline">Clear</span></a></div>\n' +
    '</div>\n' +
    '</div>\n' +
    '<div class="w-100">\n' +
    '    <div id="infoDialogdebugHeader">\n' +
    '        <h3 class="mb-0"><button class="btn btn-link" type="button" data-toggle="collapse" data-target="#infoDialogdebugCollapse"><i class="fas pr-2 fa-info-circle"></i>Debug<i class="fas fa-chevron-right pl-2"></i></button></h3>\n' +
    '    </div>\n' +
    '    <div class="collapse w-100" id="infoDialogdebugCollapse" data-parent="#infoDialogfindMenus">\n' +
    '        <div class="mt-1">\n' +
    '            <div class="text-center w-100 d-flex flex-column flex-wrap align-items-start" id="infoDialogadvancedInfoBlock"></div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
    '</div>\n' +
    '</div>\n' +
    '<div class="modal-background"></div>\n' +
    '<div class="modal-background-overlay "></div>\n' +
    '<div class="modal-color-bg"></div>\n'
    // DO NOT FUCKING EDIT THE INFO DIALOG CONTENTS WITHOUT EDITING THE LAYOUT.PUG FILE YOU RETARD!!!
    // EDIT THERE AND COMPILE THE PUG TO HTML ====> https://pughtml.com/

let loadImageData = null;
let options = {
    hash: false,
    selector : '[data-fancybox=gallery]',
    infobar: true,
    smallBtn: "auto",
    toolbar: "auto",
    image: {
        preload: false
    },
    thumbs: {
        autoStart: true
    },
    buttons: [
        "zoom",
        "slideShow",
        "thumbs",
        "close"
    ],
    preventCaptionOverlap: false,
    defaultType: "image",
    animationEffect: "zoom",
    animationDuration: 500,
    transitionEffect: "tube",
    wheel: "auto",
    // DO NOT FUCKING EDIT THE INFO DIALOG CONTENTS WITHOUT EDITING THE LAYOUT.PUG FILE YOU RETARD!!!
    // EDIT THERE AND COMPILE THE PUG TO HTML  ====> https://pughtml.com/
    baseTpl: '<div class="fancybox-container" role="dialog" tabindex="-1">' +
        '<div class="fancybox-bg"></div>' +
        '<div class="fancybox-inner">' +
        '<div class="fancybox-infobar"><span data-fancybox-index></span>&nbsp;/&nbsp;<span data-fancybox-count></span></div>' +
        '<div class="fancybox-toolbar">{{buttons}}</div>' +
        '<div class="fancybox-navigation">{{arrows}}</div>' +
        '<div class="fancybox-stage"></div>' +
        '<div class="fancybox-caption"><div class="fancybox-caption__body"></div></div>' +
        "</div>" +
        '<div id="fbInfo" class="info-container">' + infodialog+ '</div>' +
        "</div>",
    // DO NOT FUCKING EDIT THE INFO DIALOG CONTENTS WITHOUT EDITING THE LAYOUT.PUG FILE YOU RETARD!!!
    // EDIT THERE AND COMPILE THE PUG TO HTML  ====> https://pughtml.com/
    video: {
        tpl:
            '<video class="fancybox-video" autoplay controls controlsList="nodownload" poster="{{poster}}">' +
            '<source src="{{src}}" type="{{format}}" />' +
            'Sorry, your browser doesn\'t support embedded videos, <a href="{{src}}">download</a> and watch with your favorite video player!' +
            "</video>",
        autoStart: false
    },
    onInit: function () {
        $('#fbInfo a[href="#_"], #fbInfo a[href="#"] ').click(function(e){
            if (_originalURL && _originalURL !== 'undefined')
                window.history.replaceState({}, null, `/${(offlinePage) ? 'offline' : 'juneOS'}#${_originalURL}`);
            e.preventDefault();
        });
        return true;
    },
    beforeClose: function () {
        (async () => {
            $('#fbInfo').fadeOut(200);
        })()
        return true;
    },
    beforeShow: function(current, previous) {
        if (fancyboxpendingmenu) {
            $('[data-parent="#infoDialogfindMenus"].show').removeClass('show');
            $('#infoDialog' + fancyboxpendingmenu).addClass('show');
        }
        if (current.current && current.current.src) {
            const messageid = current.current.src.split('#').pop();
            const ele = document.getElementById('message-' + messageid);
            if (ele) {
                const colData = ele.getAttribute('data-search-color');
                if (!document.querySelector('#fbInfo.shown')) {
                    document.querySelector('.modal-color-bg').style.backgroundColor = (colData && colData.length > 3) ? `rgb(${decodeURIComponent(colData).split(':').slice(0, 3).join(',')})` : 'rgb(0,0,0)';
                    document.getElementById('fbInfo').classList.add('shown')
                    showSearchOptions(ele, true);
                } else {
                    $('.info-dialog-container').fadeTo(250, 0.25);
                    clearTimeout(loadImageData);
                    loadImageData = setTimeout(() => {
                        document.querySelector('.modal-color-bg').style.backgroundColor = (colData && colData.length > 3) ? `rgb(${decodeURIComponent(colData).split(':').slice(0, 3).join(',')})` : 'rgb(0,0,0)';
                        $('.info-dialog-container').fadeTo(250, 1);
                        showSearchOptions(ele, true);
                    }, 1000)
                }
            }
        }
        return true;
    }
};
if (window.navigator.standalone === true) {
    options.buttons = [
        "zoom",
        "slideShow",
        "fullScreen",
        "download",
        "thumbs",
        "close"
    ]
    console.log('This is standalone')
} else {
    options.buttons = [
        "zoom",
        "slideShow",
        "fullScreen",
        "download",
        "thumbs",
        "close"
    ]
}
function scrollToTop(sleep) {
    $('body,html').animate({
        scrollTop: 0
    }, 400);
    if (sleep) {
        setTimeout(() => {
            try {
                $('#topbar').addClass('ready-to-scroll');
                $('#topbar').removeClass('no-ani');
            } catch (e) {
                console.error("Failed to remove topbar animation lockout")
            }
        },800);
    }
    return false;
}
function decodeURLRecursively(uri) {
    while (uri !== decodeURIComponent(uri || '')){
        uri = decodeURIComponent(uri);
    }
    return uri;
}
function params(_removeParams, _addParams, _url, keep) {
    const truePath = window.location.hash.substring(1)
    let _URL = new URL(window.location.origin + truePath);
    let _params = new URLSearchParams(_URL.search);
    if (_url) {
        _URL = new URL(window.location.origin + _url);
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/serviceWorker.min.js')
            .then(reg => {
                console.log('JulyOS Kernel Registered Successfully')
            })
            .catch(err => console.log(`JulyOS Kernel Registation Error: ${err}`));
    });
}

$(document).ready(function () {
    var lazyloadImages;
    if ("IntersectionObserver" in window) {
        console.log('IntersectionObserver is available')
    } else {
        var lazyloadThrottleTimeout;
        function lazyload () {
            if(lazyloadThrottleTimeout) {
                clearTimeout(lazyloadThrottleTimeout);
            }

            lazyloadThrottleTimeout = setTimeout(function() {
                const lazyloadImages = $("div.lazy");
                var scrollTop = $(window).scrollTop();
                lazyloadImages.each(function() {
                    var el = $(this);
                    if(el.offset().top < window.innerHeight + scrollTop + 500) {
                        var url = el.attr("data-src");
                        el.style.backgroundImage = `url(${url})`;
                        el.removeClass("lazy");
                    }
                });
                if(lazyloadImages.length == 0) {
                    $(document).off("scroll");
                    $(window).off("resize");
                }
            }, 200);
        }

        document.addEventListener("scroll", lazyload);
        window.addEventListener("resize", lazyload);
        window.addEventListener("orientationChange", lazyload);
    }

    $('#videoBuilderModal').on('hidden.bs.modal', cancelPendingUnpack);
    let scrollManagerThrottleTimeout;
    function scrollManager () {
        if(scrollManagerThrottleTimeout) { clearTimeout(scrollManagerThrottleTimeout); scrollManagerThrottleTimeout = null; }
        scrollManagerThrottleTimeout = setTimeout(function() {
            const topbar = document.getElementById('topbar');
            const menu = document.getElementById('userMenu');
            if ($(this).scrollTop() > 50) {
                $('.scrollBtn').fadeIn();
            } else {
                $('.scrollBtn').fadeOut();
            }
            if ($(this).scrollTop() > 50 || menu.classList.contains('show')) {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {}
                topbar.classList.add('shadow');
            } else {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {}
                topbar.classList.remove('shadow');
            }
            if (!topbar.classList.contains('no-ani')) {
                topbar.classList.remove('ready-to-scroll');
            };
            if (sidebar.hasClass("open")) {
                const sidebarTop = $("#accordionSidebar").offset().top; //gets offset of header
                const sidebarHeight = $("#accordionSidebar").outerHeight(); //gets height of header
                if ($(window).scrollTop() > (sidebarTop + sidebarHeight))
                    toggleMenu();
            }
            updateApplicationThemeColor();
        }, 250);
    }

    document.addEventListener("scroll", scrollManager);
    window.addEventListener("resize", scrollManager);
    window.addEventListener("orientationChange", scrollManager);

    console.log('Page Ready')
    //window.history.replaceState(null, "Sequenzia", '/juneOS');

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

});
