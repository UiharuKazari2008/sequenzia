musicplayer = $('#musicplayer');
videoplayer = $('#videoplayer');
pageNav = $('#pageNav');
if (musicplayer && musicplayer[0] && musicplayer[0].style && musicplayer[0].style.display !== 'none') {
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.add("musicActive");
    });
    pageNav[0].classList.add("musicActive");
} else if (videoplayer && videoplayer[0] && videoplayer[0].style && videoplayer[0].style.display !== 'none') {
    [].forEach.call(document.getElementsByClassName('bottomBtn'), function (el) {
        el.classList.add("videoActive");
    });
    pageNav[0].classList.add("videoActive");
}