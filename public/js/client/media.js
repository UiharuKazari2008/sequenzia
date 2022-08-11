var music = document.getElementById('audioplayerobject');
const kongouMediaPlayer = document.getElementById('kongouMediaPlayer');
const kongouMediaVideoFull = document.getElementById('kongouMediaVideoFull');
const kongouMediaVideoPreview = document.getElementById('kongouMediaVideoPreview');
const kongouControlsPlay = document.getElementById('kongouControlsPlay');
const kongouControlsPlayIcon = kongouControlsPlay.querySelector('i');
/*const kongouControlsCenterPlay = document.getElementById('kongouControlsCenterPlay'); // TODO: Create Center Mobile PLay/Pause
const kongouControlsCenterPlayIcon = kongouControlsCenterPlay.querySelector('i');
const kongouControlsCenterAdv30 = document.getElementById('kongouControlsCenterAdv'); // TODO: Create Center Mobile Forward 30s
const kongouControlsCenterRev30 = document.getElementById('kongouControlsCenterRev'); // TODO: Create Center Mobile Reverse 30s*/
const kongouControlsMiniFrame = document.getElementById('kongouControlsMiniFrame');
const kongouControlsMiniFrameSlider = new Slider("#kongouControlsMiniFrame", { tooltip: 'show', precision: 2, formatter: function(value) {
        return ((value * (3 * 60)) * 23.976).toFixed(0) + " frames";
    } });
const kongouControlsJogSeek = document.getElementById('kongouControlsJogSeek');
const kongouControlsJogSeekSlider = new Slider("#kongouControlsJogSeek", { tooltip: 'show', precision: 2, formatter: function(value) {
        return (value * 3).toFixed(2) + "min/s";
    } });
const kongouControlsSpeed = document.getElementById('kongouControlsSpeed');
const kongouControlsSpeedSlider = new Slider("#kongouControlsSpeed", { tooltip: 'show', precision: 2, formatter: function(value) {
        return (value * 100).toFixed(0) + "% Speed";
    } });
const kongouControlsSeek = document.getElementById('kongouControlsSeek');
const kongouControlsSeekSlider = new Slider("#kongouControlsSeek", { tooltip: 'hide', precision: 5 });
const kongouPIP = document.getElementById('kongouPIPButton');
const kongouTimeCode = document.getElementById('kongouTimeCode');
const videoElements = document.getElementById('videoElements');
const kongouControlsSeekUnavalible = document.getElementById('seekControls');
const kongouControlsVolume = new Slider("#kongouControlsVolume", {  });
const kongouControlsMute = document.getElementById('kongouControlsMute');
const kongouControlsVolumeIcon = kongouControlsMute.querySelector('i');
const kongouTitleBar = kongouMediaPlayer.querySelector('.kms-title-bar')
const kongouControlsJQ = $('.kms-title-bar, .kms-bottom-bar, .kms-center-bar')

const videoModel = document.getElementById('videoBuilderModal');
const videoStatus = videoModel.querySelector('span.status-text');
const videoProgress = videoModel.querySelector('.progress > .progress-bar');
const kmsStatus = kongouMediaPlayer.querySelector('.kms-status-bar > span');
const kmsProgress = kongouMediaPlayer.querySelector('.kms-progress-bar');

music.addEventListener('ended', CloseMusic);
music.volume = (getCookie("userVolume") !== null) ? parseFloat(getCookie("userVolume")) : 0.5

let videoPosition = 0;
let frameRate = 24;
function genreateDigitalFont(text) {
    return text.split(':').map(g => g.split('.').map(f => `<span class="digital-font">${f}</span>`).join('<span>.</span>')).join('<span>:</span>');
}
let blinkInterval = null;
function blinkTimecode() {
    if (!blinkInterval) {
        blinkInterval = setInterval(() => {
            if (kongouTimeCode.style.opacity === '0.25') {
                kongouTimeCode.style.opacity = '1'
            } else {
                kongouTimeCode.style.opacity = '0.25'
            }
        }, 750)
    }
}
kongouMediaVideoFull.addEventListener('playing', async () => {
    kongouControlsPlayIcon.classList.remove('fa-play')
    kongouControlsPlayIcon.classList.add('fa-pause')
    clearInterval(kmsVideoWatcher); kmsVideoWatcher = null;
    kmsVideoWatcher = setInterval(checkKMSTimecode, 60000);
    document.getElementById('kongouStage').classList.remove('keep-active-controls');
    kmsPopUpControls();
    clearInterval(blinkInterval);
    blinkInterval = null;
    kongouTimeCode.style.opacity = '1';
})
kongouMediaVideoFull.addEventListener('pause', () => {
    videoPosition = kongouMediaVideoFull.currentTime
    kongouControlsPlayIcon.classList.add('fa-play')
    kongouControlsPlayIcon.classList.remove('fa-pause')
    saveCurrentTimeKMS();
    if (!kongouMediaVideoFull.classList.contains('hidden') &&
        (kongouMediaVideoFull.currentTime / kongouMediaVideoFull.duration) >= 0.98) {
        kmsPlayNext();
    }
    clearInterval(kmsVideoWatcher); kmsVideoWatcher = null;
    document.getElementById('kongouStage').classList.add('keep-active-controls');
    kmsPopUpControls();
    blinkTimecode();
})
async function kmsTogglePlay() {
    if ((!kongouMediaVideoPreview.classList.contains('hidden') || !kongouMediaVideoFull.classList.contains('hidden')) && !kongouPlayTimer) {
        kongouPlayTimer = setTimeout(() => {
            clearTimeout(kongouPlayTimer);
            kongouPlayTimer = null;
        }, 500)
        const _ap = ((!kongouMediaVideoFull.classList.contains('hidden')) ? kongouMediaVideoFull : kongouMediaVideoPreview)
        if (_ap.paused) {
            _ap.play();
            kongouControlsPlayIcon.classList.add('fa-pause')
            kongouControlsPlayIcon.classList.remove('fa-play')
        } else {
            _ap.pause();
            kongouControlsPlayIcon.classList.add('fa-play')
            kongouControlsPlayIcon.classList.remove('fa-pause')
        }
    }
}
async function kmsToggleTaporPlay() {
    if ((!kongouMediaVideoPreview.classList.contains('hidden') || !kongouMediaVideoFull.classList.contains('hidden')) && !kongouPlayTimer) {
        if (kongouTitleBar.style.opacity && kongouTitleBar.style.opacity !== '1' ) {
            kmsPopUpControls();
        } else {
            kongouPlayTimer = setTimeout(() => {
                clearTimeout(kongouPlayTimer);
                kongouPlayTimer = null;
            }, 500)
            const _ap = ((!kongouMediaVideoFull.classList.contains('hidden')) ? kongouMediaVideoFull : kongouMediaVideoPreview)
            if (_ap.paused) {
                _ap.play();
                kongouControlsPlayIcon.classList.add('fa-pause')
                kongouControlsPlayIcon.classList.remove('fa-play')
            } else {
                _ap.pause();
                kongouControlsPlayIcon.classList.add('fa-play')
                kongouControlsPlayIcon.classList.remove('fa-pause')
            }
        }
    }
}
let kongouPlayTimer = null;
videoElements.addEventListener('click', kmsToggleTaporPlay)
videoElements.addEventListener('touchstart', kmsToggleTaporPlay)
let kongouTimeCodeTimer = null;
kongouTimeCode.addEventListener('click', (e) => {
    if (!kongouMediaVideoFull.classList.contains('hidden') && !kongouTimeCodeTimer) {
        kongouTimeCodeTimer = setTimeout( () => { clearTimeout(kongouTimeCodeTimer); kongouTimeCodeTimer = null; }, 500)
        const controls = document.getElementById('kongouStage')
        if (controls.classList.contains('advanced-controls')) {
            controls.classList.remove('advanced-controls');
        } else {
            controls.classList.add('advanced-controls');
        }
        kongouTimeCode.innerHTML = genreateDigitalFont(msToTime(kongouMediaVideoFull.currentTime * 1000, (document.getElementById('kongouStage').classList.contains('advanced-controls'))))
    }
    return false;
})
kongouTimeCode.addEventListener('touchstart', (e) => {
    if (!kongouMediaVideoFull.classList.contains('hidden') && !kongouTimeCodeTimer) {
        kongouTimeCodeTimer = setTimeout( () => { clearTimeout(kongouTimeCodeTimer); kongouTimeCodeTimer = null; }, 500)
        const controls = document.getElementById('kongouStage')
        if (controls.classList.contains('advanced-controls')) {
            controls.classList.remove('advanced-controls');
        } else {
            controls.classList.add('advanced-controls');
        }
        kongouTimeCode.innerHTML = genreateDigitalFont(msToTime(kongouMediaVideoFull.currentTime * 1000, (document.getElementById('kongouStage').classList.contains('advanced-controls'))))
    }
    return false;
})
kongouMediaVideoFull.addEventListener("timeupdate", async () => {
    if (!kongouMediaVideoFull.classList.contains('hidden')) {
        if (document.querySelector('body').classList.contains('kms-play-open') && !document.querySelector('body').classList.contains('kms-play-pip')) {
            kongouControlsSeekSlider.setValue((1 / kongouMediaVideoFull.duration) * kongouMediaVideoFull.currentTime)
            kongouTimeCode.innerHTML = genreateDigitalFont(msToTime(kongouMediaVideoFull.currentTime * 1000, (document.getElementById('kongouStage').classList.contains('advanced-controls'))) + '')
        }
        if ('setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: kongouMediaVideoFull.duration,
                playbackRate: kongouMediaVideoFull.playbackRate,
                position: kongouMediaVideoFull.currentTime,
            });
        }
    }
});
kongouMediaVideoFull.addEventListener('enterpictureinpicture', (event) => {
    document.querySelector('body').classList.add('kms-play-pip');
});
kongouMediaVideoFull.addEventListener('leavepictureinpicture', (event) => {
    document.querySelector('body').classList.remove('kms-play-pip');
});
kongouMediaVideoPreview.addEventListener("timeupdate", async () => {
    if (!kongouMediaVideoPreview.classList.contains('hidden')) {
        if (document.querySelector('body').classList.contains('kms-play-open') && !document.querySelector('body').classList.contains('kms-play-pip')) {
            kongouTimeCode.innerHTML = genreateDigitalFont(msToTime(kongouMediaVideoPreview.currentTime * 1000));
        }
        if ('setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: 300,
                playbackRate: 1,
                position: 0,
            });
        }
    }
});
kongouControlsMute.addEventListener("click", function() {
    if (!kongouMediaVideoPreview.classList.contains('hidden') || !kongouMediaVideoFull.classList.contains('hidden')) {
        const _ap = ((!kongouMediaVideoFull.classList.contains('hidden')) ? kongouMediaVideoFull : kongouMediaVideoPreview)
        _ap.muted = (!_ap.muted);
        kongouControlsVolumeIcon.classList = ((_ap.muted) ? 'fas fa-volume-slash' : (kongouControlsVolume.value > 0.5) ? 'fas fa-volume-high' : (kongouControlsVolume.value > 0.25) ? 'fas fa-volume pr-1' : 'fas fa-volume-low pr-2').toString();
    }
});
let manualOpenPIP = false;
function kongouPIPVideo() {
    if (!kongouMediaVideoFull.classList.contains('hidden')) {
        if (kongouMediaVideoFull.webkitSupportsPresentationMode && typeof kongouMediaVideoFull.webkitSetPresentationMode === "function") {
            kongouMediaVideoFull.webkitSetPresentationMode(kongouMediaVideoFull.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
        }
        if (document.querySelector('body').classList.contains('kms-play-pip')) {
            document.querySelector('body').classList.remove('kms-play-pip');
            if (document.pictureInPictureElement)
                document.exitPictureInPicture();
            manualOpenPIP = false;
        } else {
            document.querySelector('body').classList.add('kms-play-pip');
            if (document.webkitIsFullScreen || document.mozFullScreen)
                document.cancelFullScreen();
            kongouMediaVideoFull.requestPictureInPicture()
            manualOpenPIP = true;
        }
    }
}
videoElements.addEventListener("mousemove", kmsPopUpControls);
videoElements.addEventListener("touchstart", kmsPopUpControls);
kongouControlsVolume.on('change', (e) => {
    ((!kongouMediaVideoFull.classList.contains('hidden')) ? kongouMediaVideoFull : kongouMediaVideoPreview).volume = e.newValue / 100;
    kongouControlsVolumeIcon.classList = ((e.newValue > 50) ? 'fas fa-volume-high' : (e.newValue > 25) ? 'fas fa-volume pr-1' : 'fas fa-volume-low pr-2').toString();
})
kongouControlsSeekSlider.on('change', (e) => {
    if (!kongouMediaVideoFull.classList.contains('hidden')) {
        if ('fastSeek' in kongouMediaVideoFull) {
            // Only use fast seek if supported.
            kongouMediaVideoFull.fastSeek(kongouMediaVideoFull.duration * e.newValue);
        } else {
            kongouMediaVideoFull.currentTime = kongouMediaVideoFull.duration * e.newValue
        }
    }
})
kongouControlsSpeedSlider.on("change", function(e) {
    if (!kongouMediaVideoFull.classList.contains('hidden')) {
        kongouMediaVideoFull.playbackRate = e.newValue
        kongouMediaVideoFull.muted = (e.newValue <= .75 || e.newValue >= 1.25);
        kongouControlsVolumeIcon.classList = (((e.newValue <= .75)) ? 'fas fa-volume-slash' : (kongouMediaVideoFull.volume > 0.5) ? 'fas fa-volume-high' : (kongouMediaVideoFull.volume > 0.25) ? 'fas fa-volume pr-1' : 'fas fa-volume-low pr-2').toString();
    }
});
let miniframeactive = false;
let miniframetimer = false;
kongouControlsMiniFrameSlider.on("slide", function(e) {
    if (!kongouMediaVideoFull.classList.contains('hidden') && miniframetimer === null) {
        if (!miniframeactive) {
            kongouMediaVideoFull.pause();
            if (!videoPosition || videoPosition > 1)
                videoPosition = kongouMediaVideoFull.currentTime
            miniframeactive = true;
        }
        if ('fastSeek' in kongouMediaVideoFull) {
            // Only use fast seek if supported.
            kongouMediaVideoFull.fastSeek(videoPosition + ((((1 / 23.976) * 3) * 60) * e));
        } else {
            kongouMediaVideoFull.currentTime = videoPosition + ((((1 / 23.976) * 3) * 60) * e);
        }
        miniframetimer = setTimeout(() => {
            clearTimeout(miniframetimer);
            miniframetimer = null;
        }, 150)
    }
});
kongouControlsMiniFrameSlider.on("slideStop", function() {
    miniframeactive = false;
    kongouControlsMiniFrameSlider.setValue(0);
    videoPosition = kongouMediaVideoFull.currentTime
    clearTimeout(miniframetimer);
    miniframetimer = null;
});
let jobDialTimeout = null;
function kmsJoger () {
    if ('fastSeek' in kongouMediaVideoFull) {
        // Only use fast seek if supported.
        kongouMediaVideoFull.fastSeek(kongouMediaVideoFull.currentTime + (kongouControlsJogSeekSlider.getValue() * 5));
    } else {
        kongouMediaVideoFull.currentTime = kongouMediaVideoFull.currentTime + (kongouControlsJogSeekSlider.getValue() * 5);
    }
    jobDialTimeout = setTimeout(kmsJoger, 250);
}
kongouControlsJogSeekSlider.on("slideStart", function(e) {
    if (!kongouMediaVideoFull.classList.contains('hidden') && !jobDialTimeout) {
        kongouMediaVideoFull.pause();
        kmsJoger();
    }
});
kongouControlsJogSeekSlider.on("slideStop", function(e) {
    kongouMediaVideoFull.play();
    kongouControlsJogSeekSlider.setValue(0);
    clearTimeout(jobDialTimeout);
    jobDialTimeout = null;
});

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
                autoStart: true
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
