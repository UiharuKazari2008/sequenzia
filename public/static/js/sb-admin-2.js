const sidebar = $(".sidebar")
const body = $("body")

function toggleMenu() {
  body.toggleClass("sidebar-toggled");
  sidebar.toggleClass("toggled");
  $(".music-player").toggleClass("toggled");
  if (sidebar.hasClass("toggled")) {
    $('.sidebar .collapse').collapse('hide');
  }
}

let toggleLightbox = false
function toggleLightboxOverlay() {
  if (toggleLightbox) {
    [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
      el.removeAttribute("style", 'display')
    });
    toggleLightbox = false
  } else {
    [].forEach.call(document.getElementsByClassName('internal-lightbox'), function (el) {
      el.style.display = "block";
    });
    toggleLightbox = true
  }

}

(function($) {
  "use strict"; // Start of use strict
  // Toggle the side navigation
  $( ".content-wrapper" ).on( "swiperight", toggleMenu );

  let cachedWidth = $(window).width();

  // Close any open menu accordions when window is resized below 768px
  $(document).ready(function () {
    if ($(window).width() >= 1700) {
      body.removeClass("sidebar-toggled");
      sidebar.removeClass("toggled");
      $(".music-player").removeClass("toggled");
    }
  });
  $(window).resize(function() {
    const newWidth = $(window).width();
    const tw = $('#titleExtra').width() + 10
    if (tw > 20) {
      $('#titleExtraStyleAdjustment').html(`<style>@keyframes slidetextextraout { from {max-width: 0;} to {max-width: ${tw}px;} }; @keyframes slidetextextrain { from {max-width: ${tw}px; to {max-width: 0;}} };</style>`);
    }
    if(newWidth !== cachedWidth){
      if ($(window).width() >= 1700) {
        body.removeClass("sidebar-toggled");
        sidebar.removeClass("toggled");
        $(".music-player").removeClass("toggled");
      } else if ($(window).width() <= 769) {
        if (cachedWidth >= 1700) {
          body.addClass("sidebar-toggled");
          sidebar.addClass("toggled");
        }
        $('.sidebar .collapse').collapse('hide');
      } else if (cachedWidth >= 1700) {
        body.addClass("sidebar-toggled");
        sidebar.addClass("toggled");
      }

      // Toggle the side navigation when window is resized below 480px
      if ($(window).width() < 800 && !$(".sidebar").hasClass("toggled")) {
        body.addClass("sidebar-toggled");
        sidebar.addClass("toggled");
        $('.sidebar .collapse').collapse('hide');
        $(".music-player").removeClass("toggled");
      }
      cachedWidth = newWidth;
    }

  });

  // Prevent the content wrapper from scrolling when the fixed side navigation hovered over
  $('body.fixed-nav .sidebar').on('mousewheel DOMMouseScroll wheel', function(e) {
    if ($(window).width() > 768 && $(window).width() < 1700) {
      var e0 = e.originalEvent,
        delta = e0.wheelDelta || -e0.detail;
      this.scrollTop += (delta < 0 ? 1 : -1) * 30;
      e.preventDefault();
    }
  });

})(jQuery); // End of use strict
