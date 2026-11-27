/* ==========================================================================
   Toqa Mostafa — interactions
   - Opening gate → reveals experience, starts music on user gesture
   - Music player with graceful error handling
   - Canvas dust/particle field (paused when hidden, respects reduced motion)
   - Scroll reveals, sticky masthead, reading progress
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;

  var gate = document.getElementById("gate");
  var gateHint = document.getElementById("gate-hint");
  var openBtn = document.getElementById("openGift");
  var experience = document.getElementById("main");
  var masthead = document.getElementById("masthead");
  var progressBar = document.getElementById("progressBar");

  var audio = document.getElementById("bg-music");
  var player = document.getElementById("player");
  var musicBtn = document.getElementById("musicToggle");
  var musicState = document.getElementById("musicState");
  var musicStatus = document.getElementById("musicStatus");
  var toastEl = document.getElementById("toast");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var prefersReduced = reduceMotion.matches;

  var TARGET_VOLUME = 0.55;
  var hasOpened = false;
  var audioFailed = false;
  var toastTimer = null;
  var volumeRamp = null;

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function setPlayerState(state, label, announce) {
    player.dataset.state = state;
    musicState.textContent = label;
    if (announce) musicStatus.textContent = announce;
  }

  function showToast(message, duration) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, duration || 5200);
  }

  /* ── Audio ───────────────────────────────────────────────────────────── */
  function fadeTo(target, ms) {
    if (volumeRamp) window.clearInterval(volumeRamp);
    var start = audio.volume;
    var steps = Math.max(1, Math.round(ms / 60));
    var i = 0;
    audio.volume = start;

    volumeRamp = window.setInterval(function () {
      i += 1;
      var t = i / steps;
      var eased = 1 - Math.pow(1 - t, 3);
      var v = start + (target - start) * eased;
      audio.volume = Math.min(1, Math.max(0, v));
      if (i >= steps) {
        window.clearInterval(volumeRamp);
        volumeRamp = null;
        audio.volume = target;
      }
    }, 60);
  }

  function describeAudioError() {
    if (!audio || !audio.error) return "لم نتمكن من تشغيل الموسيقى الآن.";
    switch (audio.error.code) {
      case 1:
        return "تم إيقاف تحميل الموسيقى.";
      case 2:
        return "انقطع الاتصال أثناء تحميل الموسيقى.";
      case 3:
        return "تعذّر فك تشفير ملف الموسيقى.";
      case 4:
        return "ملف الموسيقى غير متاح أو صيغته غير مدعومة.";
      default:
        return "لم نتمكن من تشغيل الموسيقى الآن.";
    }
  }

  function markAudioFailed(error) {
    audioFailed = true;
    setPlayerState("error", "غير متاحة", "الموسيقى غير متاحة الآن. بقية الصفحة تعمل.");
    if (gateHint) gateHint.textContent = "الموسيقى غير متاحة الآن — يمكنك متابعة التصفح بهدوء";
    showToast(describeAudioError() + " بقية الصفحة تعمل بشكل طبيعي.", 7000);
    // Do not block the experience on audio failures.
    if (error && typeof console !== "undefined" && console.info) {
      console.info("[music] playback unavailable:", error);
    }
  }

  function playMusic(announce) {
    if (!audio || audioFailed) return;
    var attempt;
    try {
      audio.volume = 0;
      attempt = audio.play();
    } catch (err) {
      markAudioFailed(err);
      return;
    }
    if (attempt && typeof attempt.then === "function") {
      attempt.then(function () {
        fadeTo(TARGET_VOLUME, 1600);
        setPlayerState("playing", "تُعزف الآن", announce ? "الموسيقى تُعزف الآن" : "");
        musicBtn.setAttribute("aria-pressed", "true");
        musicBtn.setAttribute("aria-label", "إيقاف الموسيقى مؤقتًا");
      }).catch(function (err) {
        // Autoplay rejection is not a broken file: stay silent, keep control usable.
        if (err && err.name === "NotAllowedError") {
          setPlayerState("paused", "اضغطي للتشغيل", "الموسيقى بانتظار الضغط على زر التشغيل");
          musicBtn.setAttribute("aria-pressed", "false");
          return;
        }
        markAudioFailed(err);
      });
    } else {
      fadeTo(TARGET_VOLUME, 1600);
      setPlayerState("playing", "تُعزف الآن", announce ? "الموسيقى تُعزف الآن" : "");
      musicBtn.setAttribute("aria-pressed", "true");
    }
  }

  function pauseMusic(announce) {
    if (!audio || audioFailed) return;
    audio.pause();
    setPlayerState("paused", "متوقفة", announce ? "الموسيقى متوقفة" : "");
    musicBtn.setAttribute("aria-pressed", "false");
    musicBtn.setAttribute("aria-label", "تشغيل الموسيقى");
  }

  function toggleMusic() {
    if (!audio) return;
    if (audioFailed) {
      showToast(describeAudioError() + " يمكنك متابعة الصفحة، الموسيقى اختيارية.", 6000);
      return;
    }
    if (audio.paused) {
      playMusic(true);
    } else {
      pauseMusic(true);
    }
  }

  if (audio) {
    audio.volume = 0;
    audio.addEventListener("error", function () {
      if (!audioFailed) markAudioFailed(audio.error);
    });
    // If the source cannot even load metadata, surface it quietly.
    audio.addEventListener("stalled", function () {
      if (hasOpened && audio.paused && !audioFailed) {
        setPlayerState("paused", "جارٍ التحميل", "");
      }
    });
    audio.addEventListener("playing", function () {
      setPlayerState("playing", "تُعزف الآن", "");
      musicBtn.setAttribute("aria-pressed", "true");
    });
    audio.addEventListener("pause", function () {
      if (!audioFailed) {
        setPlayerState("paused", "متوقفة", "");
        musicBtn.setAttribute("aria-pressed", "false");
      }
    });
  }

  if (musicBtn) musicBtn.addEventListener("click", toggleMusic);

  /* Space / K on the player is native; keep page keys untouched. */

  /* ── Opening gate ────────────────────────────────────────────────────── */
  function unlockExperience() {
    body.classList.remove("is-locked");
    gate.classList.add("is-leaving");
    experience.removeAttribute("inert");
    experience.setAttribute("aria-hidden", "false");
    experience.classList.add("is-ready");

    window.setTimeout(function () {
      gate.classList.add("is-gone");
      gate.setAttribute("aria-hidden", "true");
      var heroTitle = document.getElementById("hero-title");
      if (heroTitle) heroTitle.focus({ preventScroll: true });
    }, 1150);

    hasOpened = true;
    playMusic(true);
    observeExperience();
    startDust();
    revealVisible();
  }

  function openGift() {
    if (gate.classList.contains("is-leaving")) return;
    openBtn.disabled = true;
    unlockExperience();
    window.setTimeout(function () { openBtn.disabled = false; }, 1200);
  }

  if (openBtn) {
    openBtn.addEventListener("click", openGift);
    openBtn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGift();
      }
    });
  }

  /* ── Reveals ─────────────────────────────────────────────────────────── */
  var allRevealables = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var gateRevealables = gate
    ? allRevealables.filter(function (el) { return gate.contains(el); })
    : [];
  var stageRevealables = allRevealables.filter(function (el) {
    return gateRevealables.indexOf(el) === -1;
  });
  var revealObserver = null;

  function revealVisible() {
    if (!revealObserver) {
      stageRevealables.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    stageRevealables.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add("is-in");
      }
    });
  }

  // The opening screen animates in on load, independently of the scroll observer,
  // so it is never left at opacity 0.
  function revealGate() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        gateRevealables.forEach(function (el) { el.classList.add("is-in"); });
      });
    });
  }

  function observeExperience() {
    if (!("IntersectionObserver" in window)) {
      stageRevealables.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });

    stageRevealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ── Masthead + progress ─────────────────────────────────────────────── */
  var lastScroll = 0;
  var ticking = false;

  function onScrollFrame() {
    var y = window.pageYOffset || root.scrollTop;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = docH > 0 ? y / docH : 0;

    if (progressBar) {
      progressBar.style.transform = "scaleX(" + Math.min(1, Math.max(0, ratio)) + ")";
    }
    if (masthead) {
      masthead.classList.toggle("is-stuck", y > 18);
      if (!prefersReduced) {
        masthead.style.transform = y > 140 && y > lastScroll
          ? "translateY(-102%)"
          : "translateY(0)";
      }
    }
    lastScroll = y;
    ticking = false;
  }

  function onScroll() {
    if (!hasOpened) return;
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScrollFrame);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    if (hasOpened) window.requestAnimationFrame(onScrollFrame);
  }, { passive: true });

  /* ── Smooth in-page navigation ───────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", id);
    });
  });

  /* ── Dust field (canvas) ─────────────────────────────────────────────── */
  var canvas = document.getElementById("dust");
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  var particles = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var rafId = null;
  var canvasReady = false;
  var VISIBLE = true;

  var PALETTE = [
    "rgba(192, 138, 110,",   // rose gold
    "rgba(169, 139, 152,",   // mauve
    "rgba(221, 214, 232,",   // lavender
    "rgba(236, 202, 195,"    // blush
  ];

  function sizeCanvas() {
    if (!canvas) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function particleCount() {
    var w = window.innerWidth;
    if (prefersReduced) return 0;
    if (w < 560) return 16;
    if (w < 980) return 26;
    return 40;
  }

  function makeParticle(w, h, fresh) {
    var isHeart = Math.random() < 0.12;
    return {
      x: Math.random() * w,
      y: fresh ? h + Math.random() * h * 0.4 : Math.random() * h,
      r: 0.7 + Math.random() * 2.1,
      vy: -(0.08 + Math.random() * 0.26),
      vx: (Math.random() - 0.5) * 0.18,
      a: 0.1 + Math.random() * 0.38,
      tw: Math.random() * Math.PI * 2,
      tws: 0.004 + Math.random() * 0.011,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      heart: isHeart,
      size: 3.4 + Math.random() * 2.6
    };
  }

  function seedParticles() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var n = particleCount();
    particles = [];
    for (var i = 0; i < n; i += 1) particles.push(makeParticle(w, h, false));
  }

  function drawHeart(x, y, s, alpha, color) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.32);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.62, x, y + s * 0.82, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.82, x + s * 0.5, y + s * 0.62, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.32);
    ctx.fillStyle = color + alpha + ")";
    ctx.fill();
  }

  function frame() {
    if (!ctx) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < particles.length; i += 1) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.tw += p.tws;

      if (p.y < -30) {
        particles[i] = makeParticle(w, h, true);
        continue;
      }
      if (p.x < -30) p.x = w + 20;
      if (p.x > w + 30) p.x = -20;

      var flicker = 0.55 + Math.sin(p.tw) * 0.45;
      var alpha = Math.max(0, p.a * flicker);

      if (p.heart) {
        drawHeart(p.x, p.y, p.size, alpha * 0.85, p.color);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + alpha + ")";
        ctx.fill();
      }
    }

    if (VISIBLE && !prefersReduced) rafId = window.requestAnimationFrame(frame);
    else rafId = null;
  }

  function startDust() {
    if (!canvas || !ctx) return;
    if (prefersReduced) return;
    if (!canvasReady) {
      sizeCanvas();
      seedParticles();
      canvasReady = true;
    }
    if (rafId === null) rafId = window.requestAnimationFrame(frame);
  }

  function stopDust() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  if (canvas && ctx) {
    window.addEventListener("resize", function () {
      if (!canvasReady) return;
      sizeCanvas();
      seedParticles();
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      VISIBLE = !document.hidden;
      if (VISIBLE && canvasReady && hasOpened) {
        startDust();
      } else {
        stopDust();
      }
    });
  }

  if (reduceMotion && reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", function (e) {
      prefersReduced = e.matches;
      if (prefersReduced) stopDust();
      else if (hasOpened) startDust();
      revealVisible();
    });
  }

  /* If the visitor lands mid-page (hash or refresh), skip the gate. */
  function bypassGate() {
    if (!gate) return;
    gate.classList.add("is-gone");
    gate.setAttribute("aria-hidden", "true");
    body.classList.remove("is-locked");
    experience.removeAttribute("inert");
    experience.setAttribute("aria-hidden", "false");
    experience.classList.add("is-ready");
    hasOpened = true;
    allRevealables.forEach(function (el) { el.classList.add("is-in"); });
    startDust();
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  if (prefersReduced) {
    allRevealables.forEach(function (el) { el.classList.add("is-in"); });
  } else if (gate) {
    revealGate();
  }

  if (body.classList.contains("is-locked") && !gate) {
    body.classList.remove("is-locked");
  }

  // Deep link: allow direct section access without the opening screen.
  if (window.location.hash && window.location.hash !== "#" && gate) {
    bypassGate();
  }
})();
