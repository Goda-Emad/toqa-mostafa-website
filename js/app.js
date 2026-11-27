/* ==========================================================================
   Toqa Mostafa — interactions
   - Cinematic opening: gift opens → heart burst → petal surge → message
     reveals → music starts on the user gesture → main experience fades in
   - Music player with progress ring, graceful error handling
   - Scroll reveals, sticky masthead, reading progress, parallax
   - Keyboard: Space toggles music, Escape closes the letter overlay
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var FX = window.ToqaFX;

  var gate = document.getElementById("gate");
  var gateHint = document.getElementById("gate-hint");
  var gateReveal = document.getElementById("gateReveal");
  var giftBox = document.getElementById("giftBox");
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


  var TARGET_VOLUME = 0.55;
  var hasOpened = false;
  var opening = false;
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
    audio.addEventListener("timeupdate", function () {
      if (!audio.duration) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      musicBtn.style.setProperty("--p", pct.toFixed(1));
    });
  }

  if (musicBtn) musicBtn.addEventListener("click", toggleMusic);

  /* ── Cinematic layers ────────────────────────────────────────────────── */
  var gateField = null;
  var mainField = null;
  var letterCtl = null;

  if (FX) {
    [function () { FX.initCards(); },
     function () { FX.initRose(); },
     function () { FX.initSecrets(FX.burstHearts, FX.burstSparkles); },
     function () { FX.initShare(showToast); },
     function () { FX.initTheme(); },
     function () { FX.initNotes(function () {
        return player && player.dataset.state === "playing";
     }); },
     function () { FX.initParallax(); },
     function () { FX.initMotion(); },
     function () { letterCtl = FX.initLetter(); }
    ].forEach(function (step) {
      try { step(); }
      catch (err) {
        if (window.console && console.warn) console.warn("[fx] step failed:", err);
      }
    });

    gateField = new FX.Field(document.getElementById("gateDust"), {
      fill: "element",
      counts: {
        small:  { petals: 5, hearts: 3, sparkles: 8, dust: 0 },
        medium: { petals: 8, hearts: 4, sparkles: 12, dust: 0 },
        large:  { petals: 11, hearts: 5, sparkles: 15, dust: 0 }
      }
    });
    FX.fields.push(gateField);

    mainField = new FX.Field(document.getElementById("dust"), {
      fill: "viewport",
      counts: {
        small:  { petals: 8, hearts: 5, sparkles: 10, dust: 16 },
        medium: { petals: 12, hearts: 7, sparkles: 14, dust: 26 },
        large:  { petals: 17, hearts: 9, sparkles: 19, dust: 40 }
      }
    });
    FX.fields.push(mainField);

    window.addEventListener("resize", function () {
      FX.fields.forEach(function (f) {
        if (f.ready) { f.resize(); f.seed(); }
      });
      FX.remeasureParallax();
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        FX.fields.forEach(function (f) { f.stop(); });
      } else {
        if (gate && !gate.classList.contains("is-gone")) gateField.start();
        if (hasOpened) mainField.start();
      }
    });

    // The gate is alive from the first paint.
    if (!FX.motionOff()) gateField.start();
  }

  /* ── Opening sequence ────────────────────────────────────────────────── */
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
    opening = false;
    observeExperience();
    revealVisible();
    if (mainField) mainField.start();
    if (gateField) gateField.stop();
    if (letterCtl) letterCtl.arm();
    if (FX) FX.remeasureParallax();
    window.requestAnimationFrame(onScrollFrame);
  }

  function openGift() {
    if (opening || gate.classList.contains("is-leaving")) return;
    opening = true;
    openBtn.disabled = true;

    // Music starts with the click: this handler is the user gesture.
    playMusic(true);

    if (FX.motionOff() || !FX) {
      window.setTimeout(unlockExperience, 160);
      return;
    }

    gate.classList.add("is-opening");

    window.setTimeout(function () {
      if (giftBox) giftBox.classList.add("is-open");
    }, 120);

    window.setTimeout(function () {
      var r = giftBox
        ? giftBox.getBoundingClientRect()
        : { left: window.innerWidth / 2 - 60, top: window.innerHeight / 2 - 60, width: 120, height: 90 };
      FX.burstHearts(r.left + r.width / 2, r.top + r.height * 0.42, 18);
      FX.burstSparkles(r.left + r.width / 2, r.top + r.height * 0.42, 12);
    }, 340);

    window.setTimeout(function () {
      FX.petalSurge(2800);
    }, 480);

    if (gateReveal) gateReveal.classList.add("is-in");

    window.setTimeout(unlockExperience, 3050);
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

  /* ── Masthead + progress + parallax ──────────────────────────────────── */
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
      if (!FX.motionOff()) {
        masthead.style.transform = y > 140 && y > lastScroll
          ? "translateY(-102%)"
          : "translateY(0)";
      }
    }
    if (FX && !FX.motionOff()) FX.runParallax();
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

  /* ── Keyboard shortcuts ──────────────────────────────────────────────── */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    var editable = t && (t.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");

    if ((e.key === " " || e.code === "Space") && hasOpened && !opening) {
      if (editable || tag === "BUTTON") return; // let focused buttons behave natively
      e.preventDefault();
      toggleMusic();
      return;
    }

    if (e.key === "Escape" && hasOpened && letterCtl && letterCtl.opened()) {
      letterCtl.close();
    }
  });

  /* ── Motion toggle ───────────────────────────────────────────────────── */
  var motionBtn = document.getElementById("motionBtn");
  if (motionBtn) {
    motionBtn.addEventListener("click", function () {
      var nowOff = FX.setMotion(!FX.motionOff());
      if (nowOff) {
        FX.fields.forEach(function (f) { f.stop(); });
      } else {
        if (gate && !gate.classList.contains("is-gone")) gateField.start();
        if (hasOpened) mainField.start();
        FX.remeasureParallax();
      }
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
    if (mainField) mainField.start();
    if (gateField) gateField.stop();
    if (letterCtl) letterCtl.arm();
    if (FX) FX.remeasureParallax();
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  if (FX.motionOff()) {
    allRevealables.forEach(function (el) { el.classList.add("is-in"); });
  } else if (gate) {
    revealGate();
  }

  if (body.classList.contains("is-locked") && !gate) {
    body.classList.remove("is-locked");
  }

  if (window.location.hash && window.location.hash !== "#" && gate) {
    bypassGate();
  }
})();
