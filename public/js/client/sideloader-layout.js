let options = {
    hash: false,
    selector : '[data-fancybox=gallery]',
    infobar: true,
    smallBtn: "auto",
    toolbar: "auto",
    image: {
        preload: false
    },
    defaultType: "image",
    animationEffect: "zoom",
    transitionEffect: "slide",
    wheel: "auto",
    thumbs: {
        autoStart: true
    },
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
