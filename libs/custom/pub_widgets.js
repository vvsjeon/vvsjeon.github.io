// Interactive publication thumbnails: drag-to-reveal comparisons, plus
// stacks of clips switched by a range slider or a segmented control.
// Adapted from Seunghyun Shin's homepage (github.com/seunghyuns98/Website).
// Widgets are built only when they scroll into view, so hidden tab panes
// never download their videos.
(function () {
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function mkVideo(src, cls) {
    var v = document.createElement("video");
    // iOS and in-app browsers only autoplay muted inline video, and check
    // the attributes as well as the properties
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("autoplay", "");
    v.loop = true;
    v.preload = "auto";
    v.src = src;
    if (cls) v.className = cls;
    return v;
  }

  function tag(text, side) {
    var s = document.createElement("span");
    s.className = "cmp-tag cmp-" + side;
    s.textContent = text;
    return s;
  }

  // Start every clip right away (iOS and in-app browsers do not buffer
  // until play() is called), rewind them together once all are playing,
  // then nudge them back if they drift.
  function sync(vids) {
    if (!vids.length) return;
    var aligned = false;
    function playAll() {
      vids.forEach(function (v) { v.play().catch(function () {}); });
    }
    function align() {
      if (aligned) return;
      aligned = true;
      vids.forEach(function (v) { try { v.currentTime = 0; } catch (e) {} });
      playAll();
    }
    vids.forEach(function (v) {
      v.addEventListener("playing", function () {
        for (var i = 0; i < vids.length; i++) if (vids[i].paused) return;
        align();
      });
    });
    vids[0].addEventListener("timeupdate", function () {
      for (var i = 1; i < vids.length; i++) {
        if (Math.abs(vids[i].currentTime - vids[0].currentTime) > 0.15) {
          try { vids[i].currentTime = vids[0].currentTime; } catch (e) {}
        }
      }
    });
    playAll();
    // if autoplay is blocked (e.g. Low Power Mode), start on the first touch
    document.addEventListener("touchstart", playAll, { once: true, passive: true });
  }

  // wire a segmented control to a show(index) callback
  function wireSegments(scope, show) {
    var btns = scope.querySelectorAll(".seg-btn");
    each(btns, function (b, i) {
      b.addEventListener("click", function () {
        show(i);
        each(btns, function (x, k) {
          x.classList.toggle("is-on", k === i);
          x.setAttribute("aria-selected", k === i ? "true" : "false");
        });
      });
    });
  }

  // ---- drag-to-reveal comparison ----
  function initCompare(el) {
    var baseSrc = el.getAttribute("data-base") || "";
    var clips = [];
    var base;

    if (baseSrc.indexOf("text:") === 0) {
      base = document.createElement("div");
      base.className = "cmp-text";
      base.textContent = baseSrc.slice(5);
    } else if (/\.(png|jpe?g|webp|gif)$/i.test(baseSrc)) {
      base = document.createElement("img");
      base.className = "cmp-base";
      base.src = baseSrc;
      base.alt = "";
    } else {
      base = mkVideo(baseSrc, "cmp-base");
      clips.push(base);
    }
    var ours = mkVideo(el.getAttribute("data-ours"), "cmp-ours");
    clips.push(ours);

    var handle = document.createElement("span");
    handle.className = "cmp-handle";
    el.appendChild(base);
    el.appendChild(ours);
    if (el.getAttribute("data-left")) el.appendChild(tag(el.getAttribute("data-left"), "l"));
    if (el.getAttribute("data-right")) el.appendChild(tag(el.getAttribute("data-right"), "r"));
    el.appendChild(handle);

    var pct = 50;
    function set(p) {
      pct = Math.max(0, Math.min(100, p));
      handle.style.left = pct + "%";
      ours.style.webkitClipPath = ours.style.clipPath = "inset(0 0 0 " + pct + "%)";
      el.setAttribute("aria-valuenow", Math.round(pct));
    }
    function fromX(x) {
      var r = el.getBoundingClientRect();
      if (r.width) set(((x - r.left) / r.width) * 100);
    }

    var dragging = false;
    el.addEventListener("pointerdown", function (e) {
      dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      fromX(e.clientX);
      e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) {
      if (dragging) fromX(e.clientX);
    });
    function stop(e) {
      dragging = false;
      if (e && e.pointerId !== undefined) {
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { set(pct - 5); e.preventDefault(); }
      else if (e.key === "ArrowRight") { set(pct + 5); e.preventDefault(); }
    });

    sync(clips);
  }

  // ---- stacked clips driven by a range slider ----
  function initStack(el) {
    var vids = (el.getAttribute("data-videos") || "").split(",").map(function (src, i) {
      var v = mkVideo(src.trim(), i === 0 ? "is-on" : "");
      el.appendChild(v);
      return v;
    });
    function show(i) {
      vids.forEach(function (v, k) { v.classList.toggle("is-on", k === i); });
    }
    var range = el.parentNode.querySelector(".stack-range");
    if (range) {
      range.max = String(vids.length - 1);
      range.addEventListener("input", function () {
        show(parseInt(range.value, 10) || 0);
      });
    }
    wireSegments(el.parentNode, show);
    sync(vids);
  }

  function initWidget(w) {
    each(w.querySelectorAll(".compare"), initCompare);
    each(w.querySelectorAll(".stack"), initStack);

    // several comparisons, one shown at a time
    each(w.querySelectorAll(".swap"), function (el) {
      var panes = el.querySelectorAll(".compare");
      wireSegments(el.parentNode, function (i) {
        each(panes, function (p, k) { p.classList.toggle("is-on", k === i); });
      });
    });

    // flip between the comparison and the continuous control
    each(w.querySelectorAll(".flip-btn"), function (b) {
      b.addEventListener("click", function () {
        var t = w.querySelector(".flip");
        if (t) t.classList.toggle("flipped");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var widgets = document.querySelectorAll(".widget");
    if (!("IntersectionObserver" in window)) {
      each(widgets, initWidget);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        initWidget(e.target);
      });
    }, { rootMargin: "200px" });
    each(widgets, function (w) { io.observe(w); });
  });
})();
