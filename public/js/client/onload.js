
function isTouchDevice(){
    return true == ("ontouchstart" in window || window.DocumentTouch && document instanceof DocumentTouch);
}

_originalURL = (() => {
    try {
        if ($.history) { return $.history.url() }
        if (window.location.hash.substring(1).length > 0) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
        return undefined
    } catch (e) {
        if (window.location.hash.substring(1).length > 0) { return window.location.hash.substring(1).split('://' + window.location.host).pop() }
        return undefined
    }
})()
$(document).ready(function () {
    $('.popover').popover('dispose');
    $('[data-toggle="popover"]').popover()
    if(isTouchDevice()===false) {
        $('[data-tooltip="tooltip"]').tooltip()
        $('[data-tooltip="tooltip"]').tooltip('hide')
    }
    $('a[href="#_"], a[href="#"] ').click(function(e){
        window.history.replaceState({}, null, `/juneOS#${_originalURL}`);
        e.preventDefault();
    });
})
//$('.popover-dismiss').popover({
//    trigger: 'focus'
//})

var lazyloadImages;
if ("IntersectionObserver" in window) {
    lazyloadImages = document.querySelectorAll("div.lazy");
    var imageObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.style.backgroundImage = `url(${entry.target.dataset.src})`;
                entry.target.classList.remove("lazy");
                imageObserver.unobserve(entry.target);
            }
        });
    }, {
        root: document.querySelector("#container"),
        rootMargin: "0px 0px 500px 0px"
    });

    lazyloadImages.forEach(function (image) {
        imageObserver.observe(image);
    });
}

$(function () {
    let start = undefined;
    let end = undefined;
    if (window.location.hash.substring(1).includes('datestart=') && window.location.hash.substring(1).includes('dateend=')) {
        start = moment(/datestart=([^&]+)/.exec(window.location.hash.substring(1))[1], "YYYY-MM-DD");
        end = moment(/dateend=([^&]+)/.exec(window.location.hash.substring(1))[1], "YYYY-MM-DD");
        if (start === moment().add(1, 'days') && end === moment().add(1, 'days')) {
            $('#dateText').html('Select Range');
        } else {
            $('#dateText').html(start.format('MMMM D, YYYY') + '<br>' + end.format('MMMM D, YYYY'));
        }
    } else if (window.location.hash.substring(1).includes('numdays=')) {
        const days = parseInt(/numdays=([^&]+)/.exec(window.location.hash.substring(1))[1]) - 1;
        start = moment().subtract(days, 'days').endOf('day');
        end = moment();
        $('#dateText').html(`${days} Days`);
    } else {
        start = moment().add(1, 'days').startOf('day');
        end = moment().add(1, 'days').endOf('day');
        $('#dateText').html('Select Range');
    }



    function applyDate(start, end) {
        if (start && end) {
            const startDate = start.format('YYYY-MM-DD');
            const endDate = end.format('YYYY-MM-DD');
            if (startDate === moment().add(1, 'days').format('YYYY-MM-DD') && endDate === moment().add(1, 'days').format('YYYY-MM-DD') ) {
                getNewContent(['datestart', 'dateend', 'numdays', 'offset'], []);
            } else {
                getNewContent(['datestart', 'dateend', 'numdays', 'offset'], [['datestart', startDate], ['dateend', endDate]]);
            }
        } else {
            getNewContent([], []);
        }
    }

    $('#postRange').daterangepicker({
        startDate: start,
        endDate: end,
        minDate: "04/01/1995",
        maxDate: moment().add(1, 'year').endOf('year'),
        opens: 'left',
        showDropdowns: true
    }, applyDate);
});

if (initalPageLoad) {
    IPHL = history.length
    initalPageLoad = false;
    console.log(`Registering inital page history (IPHL) as ${IPHL}`)
}