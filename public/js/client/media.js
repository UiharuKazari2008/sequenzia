var music = document.getElementById('audioplayerobject');
var video = document.getElementById('videoplayerobject');

music.addEventListener('ended', CloseMusic);
music.volume = 1

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
function PlayVideo(file) {
    video.setAttribute("src", file);
    video.play();

    $('#videoplayer').fadeIn(500);
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.add("videoActive");
    });
    $('footer')[0].classList.add("videoActive");
    $('#pageNav')[0].classList.add("videoActive");

}
function CloseMusic() {
    music.pause();
    $('#musicplayer').fadeOut(1500);
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.remove("musicActive");
    });
    $('footer')[0].classList.remove("musicActive");
    $('#pageNav')[0].classList.remove("musicActive");
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
    return null;
}
