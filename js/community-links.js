/**
 * 경영자 커뮤니티 - 더 알아보기 버튼 링크
 * admin에서 링크를 변경할 때 이 파일의 URL만 수정하면 됩니다.
 */
window.COMMUNITY_INTRO_LINKS = {
  conference: "https://gainge.com/contents/products/980",
  growthClub: "https://gainge.com/contents/products/1",
  ccClass: "https://gainge.com/contents/products/604"
};

/**
 * 캘린더 섹션 연간 캘린더 이미지 (admin에서 변경 가능)
 */
window.COMMUNITY_CALENDAR_IMAGE = "assets/연간 캘린더 샘플.jpg";

/**
 * 소개영상 섹션 - 썸네일·영상 URL (admin에서 추가/삭제·변경 가능)
 * url을 빈 문자열로 두면 해당 영상이 없는 것으로 처리됩니다.
 */
window.COMMUNITY_VIDEOS = {
  conference: {
    thumbnail: "assets/컨퍼런스 썸네일 샘플.jpg",
    url: "https://youtu.be/-Gp9yHmaKeE"
  },
  growthClub: {
    thumbnail: "assets/성장클럽 썸네일 샘플.jpg",
    url: "https://youtu.be/BFG_4S2g42I"
  },
  ccClass: {
    thumbnail: "assets/CC클래스 썸네일 샘플.jpg",
    url: "https://youtu.be/YADlfRbZ6R0"
  }
};

/**
 * 팝업 iframe용: youtu.be / watch → embed (main.js의 GaingeMedia가 있으면 동일 동작)
 */
function communityVideoEmbedUrl(url) {
  if (window.GaingeMedia && window.GaingeMedia.embedFriendlyVideoUrl) {
    return window.GaingeMedia.embedFriendlyVideoUrl(url);
  }
  var s = (url || "").trim();
  if (!s) return s;
  if (/^(https?:)?\/\/(www\.)?youtube\.com\/embed\//i.test(s)) return s.split("&")[0] || s;
  var m = s.match(/youtu\.be\/([^?&#]+)/i);
  if (m) return "https://www.youtube.com/embed/" + m[1] + "?rel=0&modestbranding=1&playsinline=1";
  m = s.match(/[?&]v=([^?&#]+)/i);
  if (m) return "https://www.youtube.com/embed/" + m[1] + "?rel=0&modestbranding=1&playsinline=1";
  return s;
}

(function () {
  var links = window.COMMUNITY_INTRO_LINKS;
  if (!links) return;
  ["conference", "growthClub", "ccClass"].forEach(function (key) {
    var url = links[key];
    if (!url) return;
    document.querySelectorAll('[data-community-link="' + key + '"]').forEach(function (el) {
      el.setAttribute("href", url);
    });
  });

  var winFeatures = "noopener,noreferrer,width=1200,height=800";
  var buttons = document.querySelectorAll('[data-community-link]');
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var url = btn.getAttribute("href");
      if (url) window.open(url, "_blank", winFeatures);
    });
  });

  var calendarImgSrc = window.COMMUNITY_CALENDAR_IMAGE;
  var calendarImg = document.querySelector("[data-community-calendar-image]");
  if (calendarImg && calendarImgSrc) calendarImg.setAttribute("src", calendarImgSrc);

  var videos = window.COMMUNITY_VIDEOS;
  if (videos) {
    ["conference", "growthClub", "ccClass"].forEach(function (key) {
      var item = videos[key];

      var legacyBlock = document.querySelector("[data-community-video=\"" + key + "\"]");
      var introBlock = document.querySelector("[data-community-intro=\"" + key + "\"]");

      var playButtons = [];
      if (legacyBlock) {
        var thumb = legacyBlock.querySelector("[data-community-video-thumb]");
        if (thumb && item && item.thumbnail) thumb.setAttribute("src", item.thumbnail);
        var legacyPlayBtn = legacyBlock.querySelector("[data-community-video-play]");
        if (legacyPlayBtn) playButtons.push(legacyPlayBtn);
      }
      if (introBlock) {
        var introPlayBtn = introBlock.querySelector("[data-community-intro-play]");
        if (introPlayBtn) playButtons.push(introPlayBtn);
      }

      playButtons.forEach(function (playBtn) {
        playBtn.addEventListener("click", function () {
          var popup = document.getElementById("community-video-popup");
          var iframe = popup && popup.querySelector(".community-video-popup-iframe");
          if (popup && iframe) {
            iframe.setAttribute(
              "src",
              item && item.url ? communityVideoEmbedUrl(item.url) : "about:blank"
            );
            popup.removeAttribute("hidden");
            document.body.style.overflow = "hidden";
          }
        });
      });
    });
  }

  var popup = document.getElementById("community-video-popup");
  if (popup) {
    var closePopup = function () {
      var iframe = popup.querySelector(".community-video-popup-iframe");
      popup.setAttribute("hidden", "");
      document.body.style.overflow = "";
      if (iframe) iframe.setAttribute("src", "");
    };
    popup.querySelector(".community-video-popup-backdrop").addEventListener("click", closePopup);
    popup.querySelector(".community-video-popup-close").addEventListener("click", closePopup);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      e.preventDefault();
      closePopup();
    });
  }

  var copyToggleButtons = document.querySelectorAll("[data-community-intro-copy-toggle]");
  copyToggleButtons.forEach(function (btn) {
    var targetKey = btn.getAttribute("data-community-intro-copy-target");
    if (!targetKey) return;
    var flipScene = document.querySelector("[data-community-intro-flip=\"" + targetKey + "\"]");
    var flipInner = flipScene && flipScene.querySelector(".community-intro-flip-inner");
    if (!flipInner) return;

    btn.addEventListener("click", function () {
      var isExpanded = btn.getAttribute("aria-expanded") === "true";
      var nextExpanded = !isExpanded;
      btn.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
      btn.textContent = nextExpanded ? "소개문구 닫기" : "소개문구 보기";
      flipInner.classList.toggle("is-flipped", nextExpanded);
    });
  });

})();
