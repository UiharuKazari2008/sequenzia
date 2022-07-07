var music = document.getElementById('audioplayerobject');
var video = document.getElementById('videoplayerobject');

music.addEventListener('ended', CloseMusic);
video.addEventListener('ended', CloseVideo);

music.volume = (getCookie("userVolume") !== null) ? parseFloat(getCookie("userVolume")) : 0.5
video.volume = (getCookie("userVolume") !== null) ? parseFloat(getCookie("userVolume")) : 0.5

const videobox = $().fancybox({
    hash: false,
    selector : '[data-fancybox=videos]',
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
    touch: false,
    buttons: [
        "slideShow",
        "fullScreen",
        "download",
        "thumbs",
        "close"
    ]
});

function PlayTrack(file) {
    music.setAttribute("src", file);
    music.play();

    $('#musicplayer').fadeIn(500);
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.add("musicActive");
    });
    $('footer')[0].classList.add("musicActive");
    $('#pageNav')[0].classList.add("musicActive");

}
function PlayVideo(file, caption, fileid) {
    $.fancybox.open([
        {
            src : file,
            type : "video",
            opts: {
                caption : caption,
                autoStart: true,
                volume: video.volume
            }
        }
    ], {
        touch: false,
        afterShow : function( instance, current ) {
            if (fileid && memoryVideoPositions.has(fileid)) {
                const player = $('.fancybox-container.fancybox-is-open .fancybox-video')[0]
                 if (player.currentTime !== player.duration) {
                     player.currentTime = memoryVideoPositions.get(fileid);
                 } else {
                     memoryVideoPositions.delete(fileid);
                 }
            }
            return true;
        },
        beforeClose: function () {
            if (fileid) {
                const player = $('.fancybox-container.fancybox-is-open .fancybox-video')[0]
                if (player.currentTime !== player.duration) {
                    memoryVideoPositions.set(fileid, player.currentTime)
                } else {
                    memoryVideoPositions.delete(fileid);
                }
            }
            return true;
        }
    });
}
function CloseMusic() {
    music.pause();
    $('#musicplayer').fadeOut(1500);
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.remove("musicActive");
    });
    $('footer')[0].classList.remove("musicActive");
    $('#pageNav')[0].classList.remove("musicActive");
    setCookie("userVolume", music.volume);
    return null;
}
function CloseVideo() {
    video.pause();
    $('#videoplayer').fadeOut(1500);
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.remove("videoActive");
    });
    $('footer')[0].classList.remove("videoActive");
    $('#pageNav')[0].classList.remove("videoActive");
    setCookie("userVolume", video.volume);
    return null;
}
