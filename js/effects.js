/* ==========================================================================
   Toqa Mostafa — cinematic effects layer
   - Canvas particle fields (rose petals, floating hearts, golden sparkles, dust)
   - One-shot heart/sparkle bursts
   - Gentle card float + pointer tilt (desktop only)
   - Blooming rose, interactive love-letter envelope
   - Share (Web Share API → clipboard fallback), light/dark theme
   - Music-note particles, parallax, keyboard-friendly interactions
   Everything respects prefers-reduced-motion and pauses when the tab hides.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var fineMQ = window.matchMedia("(hover: hover) and (pointer: fine)");
  var tabHidden = false;

  /* Motion is ON by default so the gift always plays; the visitor can calm it
     down with the motion toggle (saved in localStorage). The OS reduced-motion
     hint alone no longer switches the whole experience off. */
  function motionOff() {
    return root.getAttribute("data-motion") === "off";
  }

  document.addEventListener("visibilitychange", function () {
    tabHidden = document.hidden;
  });

  /* ── Sprite factory (pre-rendered once, drawn cheaply every frame) ───── */
  function sprite(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    return c;
  }

  function heartShape(x, cx, cy, s) {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.32);
    x.bezierCurveTo(cx, cy, cx - s * 0.5, cy, cx - s * 0.5, cy + s * 0.3);
    x.bezierCurveTo(cx - s * 0.5, cy + s * 0.62, cx, cy + s * 0.82, cx, cy + s);
    x.bezierCurveTo(cx, cy + s * 0.82, cx + s * 0.5, cy + s * 0.62, cx + s * 0.5, cy + s * 0.3);
    x.bezierCurveTo(cx + s * 0.5, cy, cx, cy, cx, cy + s * 0.32);
    x.closePath();
  }

  function petalSprite(base, mid, edge) {
    return sprite(40, 52, function (x, w, h) {
      x.translate(w / 2, h / 2);
      var g = x.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, edge);
      g.addColorStop(0.45, base);
      g.addColorStop(1, mid);
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, -h / 2 + 3);
      x.bezierCurveTo(w * 0.42, -h * 0.3, w * 0.46, h * 0.18, 0, h / 2 - 3);
      x.bezierCurveTo(-w * 0.46, h * 0.18, -w * 0.42, -h * 0.3, 0, -h / 2 + 3);
      x.closePath();
      x.fill();
      x.globalAlpha = 0.45;
      x.strokeStyle = "rgba(255,255,255,.55)";
      x.lineWidth = 1;
      x.stroke();
      x.globalAlpha = 0.22;
      x.strokeStyle = edge;
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(0, -h / 2 + 7);
      x.quadraticCurveTo(2, 0, 0, h / 2 - 7);
      x.stroke();
    });
  }

  function heartSprite(size, color) {
    return sprite(size, size, function (x, w) {
      var s = w * 0.5;
      x.translate(w / 2, w / 2);
      x.shadowColor = color;
      x.shadowBlur = w * 0.3;
      x.fillStyle = color;
      heartShape(x, 0, -s * 0.5, s);
      x.fill();
      x.shadowBlur = 0;
      x.globalAlpha = 0.3;
      x.fillStyle = "#ffffff";
      heartShape(x, -s * 0.1, -s * 0.44, s * 0.36);
      x.fill();
    });
  }

  function sparkleSprite(size, color) {
    return sprite(size, size, function (x, w) {
      var r = w / 2 - 1;
      x.translate(w / 2, w / 2);
      x.shadowColor = color;
      x.shadowBlur = r * 0.9;
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(0, -r);
      x.quadraticCurveTo(r * 0.16, -r * 0.16, r, 0);
      x.quadraticCurveTo(r * 0.16, r * 0.16, 0, r);
      x.quadraticCurveTo(-r * 0.16, r * 0.16, -r, 0);
      x.quadraticCurveTo(-r * 0.16, -r * 0.16, 0, -r);
      x.fill();
    });
  }

  var SPR = {
    petals: [
      petalSprite("#f6dade", "#e8bcc6", "#d9a3b1"),
      petalSprite("#eac3c7", "#d59aa8", "#b97c8f"),
      petalSprite("#cb8f9d", "#a86278", "#83455c")
    ],
    hearts: [
      heartSprite(34, "#eda9b0"),
      heartSprite(30, "#d97f92"),
      heartSprite(28, "#e8b896")
    ],
    sparkles: [
      sparkleSprite(26, "#f4dcab"),
      sparkleSprite(22, "#ecc098")
    ]
  };

  /* ── Particle field ──────────────────────────────────────────────────── */
  function Field(canvas, cfg) {
    this.c = canvas;
    this.x = canvas ? canvas.getContext("2d") : null;
    this.cfg = cfg || {};
    this.byType = { petal: [], heart: [], sparkle: [], dust: [] };
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.raf = 0;
    this.surgeUntil = 0;
    this.running = false;
    this.t = 0;
    this.ready = false;
  }

  Field.prototype.counts = function () {
    var w = this.w, c = this.cfg.counts;
    if (w < 560) return c.small;
    if (w < 980) return c.medium;
    return c.large;
  };

  Field.prototype.resize = function () {
    if (!this.c) return;
    var rect = this.cfg.fill === "element"
      ? this.c.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    this.c.style.width = this.w + "px";
    this.c.style.height = this.h + "px";
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Field.prototype.rand = function (a, b) { return a + Math.random() * (b - a); };
  Field.prototype.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };

  Field.prototype.makePetal = function (fresh) {
    return {
      type: "petal",
      x: this.rand(-20, this.w + 20),
      y: fresh ? this.rand(-90, -20) : this.rand(-60, this.h * 0.8),
      vy: this.rand(0.34, 0.82),
      drift: this.rand(0.35, 1.15),
      phase: this.rand(0, Math.PI * 2),
      sway: this.rand(0.5, 1.4),
      rot: this.rand(0, Math.PI * 2),
      vr: this.rand(-0.014, 0.014),
      s: this.rand(0.5, 1.08),
      a: this.rand(0.5, 0.92),
      sp: this.pick(SPR.petals)
    };
  };

  Field.prototype.makeHeart = function (fresh) {
    return {
      type: "heart",
      x: this.rand(this.w * 0.05, this.w * 0.95),
      y: fresh ? this.rand(this.h * 0.72, this.h + 30) : this.rand(0, this.h),
      vy: this.rand(0.16, 0.46),
      phase: this.rand(0, Math.PI * 2),
      sway: this.rand(0.18, 0.62),
      s: this.rand(0.32, 0.8),
      a: this.rand(0.22, 0.62),
      sp: this.pick(SPR.hearts)
    };
  };

  Field.prototype.makeSparkle = function () {
    return {
      type: "sparkle",
      x: this.rand(0, this.w),
      y: this.rand(0, this.h),
      tw: this.rand(0, Math.PI * 2),
      tws: this.rand(0.012, 0.04),
      s: this.rand(0.26, 0.7),
      sp: this.pick(SPR.sparkles)
    };
  };

  Field.prototype.makeDust = function (fresh) {
    return {
      type: "dust",
      x: this.rand(0, this.w),
      y: fresh ? this.rand(this.h * 0.6, this.h + 20) : this.rand(0, this.h),
      vy: -this.rand(0.05, 0.22),
      vx: this.rand(-0.12, 0.12),
      r: this.rand(0.7, 2.1),
      tw: this.rand(0, Math.PI * 2),
      tws: this.rand(0.004, 0.014),
      a: this.rand(0.08, 0.3),
      color: this.pick(["192,138,110", "169,139,152", "221,214,232", "236,202,195"])
    };
  };

  Field.prototype.seed = function () {
    var c = this.counts();
    this.byType = { petal: [], heart: [], sparkle: [], dust: [] };
    for (var i = 0; i < c.petals; i++) this.byType.petal.push(this.makePetal(false));
    for (var j = 0; j < c.hearts; j++) this.byType.heart.push(this.makeHeart(false));
    for (var k = 0; k < c.sparkles; k++) this.byType.sparkle.push(this.makeSparkle());
    for (var m = 0; m < c.dust; m++) this.byType.dust.push(this.makeDust(false));
  };

  Field.prototype.frame = function () {
    if (!this.x) return;
    var x = this.x, w = this.w, h = this.h;
    var c = this.counts();
    var surging = Date.now() < this.surgeUntil;
    this.t += 1;

    x.clearRect(0, 0, w, h);

    var petals = this.byType.petal, hearts = this.byType.heart;
    var sparks = this.byType.sparkle, dust = this.byType.dust;
    var i, p, cap;

    // ── petals: fall, sway, rotate ──
    cap = surging ? c.petals * 2 : c.petals;
    if (petals.length < cap) petals.push(this.makePetal(true));
    for (i = petals.length - 1; i >= 0; i--) {
      p = petals[i];
      p.phase += 0.008 + p.sway * 0.005;
      p.y += p.vy * (surging ? 1.25 : 1);
      p.x += Math.sin(p.phase) * p.drift;
      p.rot += p.vr;
      if (p.y > h + 60 || p.x < -60 || p.x > w + 60) {
        if (petals.length > cap) { petals.splice(i, 1); continue; }
        petals[i] = this.makePetal(true);
        continue;
      }
      x.save();
      x.globalAlpha = Math.max(0, p.a * (0.72 + 0.28 * Math.sin(p.phase * 1.7)));
      x.translate(p.x, p.y);
      x.rotate(p.rot);
      x.drawImage(p.sp, -p.sp.width * p.s / 2, -p.sp.height * p.s / 2, p.sp.width * p.s, p.sp.height * p.s);
      x.restore();
    }

    // ── hearts: float upward, fade ──
    if (hearts.length < c.hearts) hearts.push(this.makeHeart(true));
    for (i = hearts.length - 1; i >= 0; i--) {
      p = hearts[i];
      p.phase += 0.006;
      p.y -= p.vy;
      p.x += Math.sin(p.phase) * p.sway;
      if (p.y < -50) {
        hearts[i] = this.makeHeart(true);
        continue;
      }
      x.save();
      x.globalAlpha = Math.max(0, p.a * (0.6 + 0.4 * Math.sin(p.phase * 2)));
      x.translate(p.x, p.y);
      x.drawImage(p.sp, -p.sp.width * p.s / 2, -p.sp.height * p.s / 2, p.sp.width * p.s, p.sp.height * p.s);
      x.restore();
    }

    // ── sparkles: twinkle in place ──
    if (sparks.length < c.sparkles) sparks.push(this.makeSparkle());
    for (i = 0; i < sparks.length; i++) {
      p = sparks[i];
      p.tw += p.tws;
      var glow = 0.18 + 0.82 * (0.5 + 0.5 * Math.sin(p.tw));
      x.save();
      x.globalAlpha = glow;
      x.translate(p.x, p.y);
      x.drawImage(p.sp, -p.sp.width * p.s / 2, -p.sp.height * p.s / 2, p.sp.width * p.s, p.sp.height * p.s);
      x.restore();
    }

    // ── dust: slow drifting motes ──
    if (dust.length < c.dust) dust.push(this.makeDust(true));
    for (i = dust.length - 1; i >= 0; i--) {
      p = dust[i];
      p.x += p.vx;
      p.y += p.vy;
      p.tw += p.tws;
      if (p.y < -30) { dust[i] = this.makeDust(true); continue; }
      if (p.x < -30) p.x = w + 20;
      if (p.x > w + 30) p.x = -20;
      x.beginPath();
      x.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      x.fillStyle = "rgba(" + p.color + "," + (p.a * (0.55 + 0.45 * Math.sin(p.tw))).toFixed(3) + ")";
      x.fill();
    }

    if (this.running && !tabHidden && !motionOff()) {
      this.raf = requestAnimationFrame(this.boundFrame);
    } else {
      this.raf = 0;
      this.running = false;
    }
  };

  Field.prototype.start = function () {
    if (!this.c || !this.x || motionOff()) return;
    if (!this.ready) {
      this.resize();
      this.seed();
      this.ready = true;
    }
    if (!this.running) {
      this.running = true;
      this.boundFrame = this.boundFrame || this.frame.bind(this);
      this.raf = requestAnimationFrame(this.boundFrame);
    }
  };

  Field.prototype.stop = function () {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  Field.prototype.surge = function (ms) {
    this.surgeUntil = Date.now() + (ms || 2400);
  };

  /* ── One-shot DOM bursts ─────────────────────────────────────────────── */
  var burstLayer = null;
  function getLayer() {
    if (!burstLayer) {
      burstLayer = document.createElement("div");
      burstLayer.className = "fx-burst-layer";
      burstLayer.setAttribute("aria-hidden", "true");
      document.body.appendChild(burstLayer);
    }
    return burstLayer;
  }

  var HEART_SVG = '<svg viewBox="0 0 32 30" focusable="false"><path d="M16 27S2.7 18.7 2.7 10.9A6.9 6.9 0 0 1 16 7a6.9 6.9 0 0 1 13.3 3.9C29.3 18.7 16 27 16 27Z" fill="currentColor"/></svg>';
  var SPARK_SVG = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 1.8c1 4.4 1.6 5 6 6-4.4 1-5 1.6-6 6-1-4.4-1.6-5-6-6 4.4-1 5-1.6 6-6Z" fill="currentColor"/></svg>';
  var HEART_COLORS = ["#eda9b0", "#d97f92", "#c9687f", "#e8b896", "#b95c72"];
  var SPARK_COLORS = ["#f4dcab", "#ecc098", "#f6e7c8"];

  function spawnBurst(cls, svg, colors, x, y, n, opts) {
    if (motionOff() || !n) return;
    var L = getLayer();
    for (var i = 0; i < n; i++) {
      var el = document.createElement("span");
      el.className = cls;
      el.style.setProperty("--x", Math.round(x) + "px");
      el.style.setProperty("--y", Math.round(y) + "px");
      el.style.setProperty("--dx", Math.round((Math.random() * 2 - 1) * (opts.dx || 150)) + "px");
      el.style.setProperty("--dy", Math.round((opts.up ? -(20 + Math.random() * (opts.dy || 180)) : (Math.random() * 2 - 1) * (opts.dy || 180))) + "px");
      el.style.setProperty("--rot", Math.round((Math.random() * 2 - 1) * 150) + "deg");
      el.style.setProperty("--s", Math.round((opts.min || 9) + Math.random() * ((opts.max || 22) - (opts.min || 9))) + "px");
      el.style.setProperty("--dur", (opts.dur || 1.1).toFixed(2) + (opts.durJitter ? (Math.random() * opts.durJitter).toFixed(2) : "") + "s");
      el.style.color = colors[(Math.random() * colors.length) | 0];
      el.innerHTML = svg;
      L.appendChild(el);
      el.addEventListener("animationend", function () { this.remove(); });
    }
  }

  function burstHearts(x, y, n) {
    spawnBurst("fx-burst-heart", HEART_SVG, HEART_COLORS, x, y, n,
      { dx: 160, dy: 190, up: true, min: 10, max: 24, dur: 1.05, durJitter: 0.7 });
  }

  function burstSparkles(x, y, n) {
    spawnBurst("fx-burst-spark", SPARK_SVG, SPARK_COLORS, x, y, n,
      { dx: 110, dy: 110, up: false, min: 6, max: 14, dur: 0.75, durJitter: 0.4 });
  }

  /* ── Cards: gentle float + pointer tilt (fine pointers only) ─────────── */
  function initCards() {
    var cards = [].slice.call(document.querySelectorAll(".card"));
    if (!cards.length || motionOff()) return;
    var hoverFine = fineMQ.matches;
    var small = window.innerWidth < 560;
    var amp = small ? 2.2 : 3.4;
    var items = [];

    cards.forEach(function (card) {
      var inner = card.querySelector(".card__inner");
      if (!inner) return;
      var s = {
        el: inner, rx: 0, ry: 0, trx: 0, tryy: 0,
        phase: Math.random() * 6.283, visible: false, lastSpark: 0
      };
      items.push(s);
      if (!hoverFine) return;
      var rect = null;
      card.addEventListener("pointerenter", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        rect = card.getBoundingClientRect();
      });
      card.addEventListener("pointermove", function (e) {
        if (!rect || (e.pointerType && e.pointerType !== "mouse")) return;
        s.trx = ((rect.top + rect.height / 2 - e.clientY) / (rect.height / 2)) * 6;
        s.tryy = ((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 7;
        var now = Date.now();
        if (now - s.lastSpark > 360) {
          s.lastSpark = now;
          if (Math.random() < 0.85) burstSparkles(e.clientX, e.clientY, 1);
        }
      });
      card.addEventListener("pointerleave", function () {
        s.trx = 0;
        s.tryy = 0;
        rect = null;
      });
    });

    if (!items.length) return;

    var running = false;
    function loop(now) {
      var live = false;
      for (var i = 0; i < items.length; i++) {
        var s = items[i];
        if (!s.visible) continue;
        live = true;
        s.rx += (s.trx - s.rx) * 0.12;
        s.ry += (s.tryy - s.ry) * 0.12;
        var fy = Math.sin(now / 950 + s.phase) * amp;
        s.el.style.transform = "perspective(780px) rotateX(" + s.rx.toFixed(2) +
          "deg) rotateY(" + s.ry.toFixed(2) + "deg) translateY(" + fy.toFixed(2) + "px)";
      }
      if (live) requestAnimationFrame(loop);
      else running = false;
    }
    function ensure() {
      if (!running) { running = true; requestAnimationFrame(loop); }
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          for (var i = 0; i < items.length; i++) {
            if (items[i].el.parentElement === e.target) items[i].visible = e.isIntersecting;
          }
        });
        ensure();
      }, { rootMargin: "90px" });
      cards.forEach(function (c) { io.observe(c); });
    } else {
      items.forEach(function (s) { s.visible = true; });
      ensure();
    }
  }

  /* ── Blooming rose ───────────────────────────────────────────────────── */
  function initRose() {
    var wrap = document.getElementById("roseWrap");
    if (!wrap) return;
    var rose = wrap.querySelector(".rose");
    var btn = document.getElementById("roseBtn");
    var seen = false;

    function bloom() {
      if (!rose) return;
      rose.classList.remove("is-bloom");
      void rose.getBoundingClientRect();
      rose.classList.add("is-bloom");
      wrap.classList.add("is-lit");
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !seen) {
            seen = true;
            io.disconnect();
            if (motionOff()) rose.classList.add("is-bloom");
            else setTimeout(bloom, 240);
          }
        });
      }, { threshold: 0.3 });
      io.observe(wrap);
    } else {
      rose.classList.add("is-bloom");
    }

    if (btn) {
      btn.addEventListener("click", function () {
        bloom();
        var r = wrap.getBoundingClientRect();
        burstSparkles(r.left + r.width / 2, r.top + r.height * 0.34, 9);
      });
    }
  }

  /* ── Interactive love letter ─────────────────────────────────────────── */
  function initLetter() {
    var stage = document.getElementById("letterStage");
    if (!stage) return null;
    var btn = document.getElementById("letterEnvBtn");
    var paper = document.getElementById("letterPaper");
    var hint = document.getElementById("letterHint");
    var replay = document.getElementById("letterReplay");
    var opened = false, seen = false, unlocked = false, timer = 0;

    function open() {
      if (opened) return;
      opened = true;
      window.clearTimeout(timer);
      stage.classList.add("is-open");
      if (btn) {
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("aria-label", "الرسالة مفتوحة");
      }
      if (paper) paper.removeAttribute("aria-hidden");
      if (hint) hint.setAttribute("hidden", "");
      if (replay) replay.removeAttribute("hidden");
      if (paper && !motionOff()) {
        var r = paper.getBoundingClientRect();
        if (r.width) burstSparkles(r.left + r.width * 0.5, Math.max(40, r.top + 40), 8);
      }
    }

    function close() {
      if (!opened) return;
      opened = false;
      stage.classList.remove("is-open");
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", "افتحي الرسالة");
      }
      if (paper) paper.setAttribute("aria-hidden", "true");
      if (hint) hint.removeAttribute("hidden");
      if (replay) replay.setAttribute("hidden", "");
    }

    function replayFn() {
      close();
      window.setTimeout(open, motionOff() ? 80 : 1350);
    }

    /* The gentle auto-open only starts once the visitor has unlocked the
       experience AND scrolled the envelope into view, so the interactive
       envelope is always the first thing they meet. */
    function arm() {
      if (unlocked || opened) return;
      unlocked = true;
      maybe();
    }

    function maybe() {
      if (!unlocked || !seen || opened || timer) return;
      timer = window.setTimeout(open, motionOff() ? 250 : 4200);
    }

    if (btn) {
      btn.addEventListener("click", open);
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    }
    if (replay) replay.addEventListener("click", replayFn);

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !seen) {
            seen = true;
            io.disconnect();
            maybe();
          }
        });
      }, { threshold: 0.3 });
      io.observe(stage);
    } else {
      unlocked = true;
      seen = true;
      maybe();
    }

    return {
      open: open,
      close: close,
      arm: arm,
      opened: function () { return opened; }
    };
  }

  /* ── Share: Web Share API → clipboard fallback ───────────────────────── */
  var CANONICAL_URL = "https://goda-emad.github.io/toqa-mostafa-website/";

  function initShare(toast) {
    var btns = [].slice.call(document.querySelectorAll("[data-share]"));
    if (!btns.length) return;

    function legacyCopy() {
      var ta = document.createElement("textarea");
      ta.value = CANONICAL_URL;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok
        ? "تم نسخ رابط الهدية — شاركيه بحب ♥"
        : "تعذّر النسخ — انسخي الرابط من شريط العنوان");
    }

    function copyLink() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CANONICAL_URL).then(function () {
          toast("تم نسخ رابط الهدية — شاركيه بحب ♥");
        }, legacyCopy);
      } else {
        legacyCopy();
      }
    }

    function go() {
      if (navigator.share) {
        navigator.share({
          title: document.title,
          text: "هدية صغيرة بامتنان إلى تقى مصطفى",
          url: CANONICAL_URL
        }).then(function () {
          toast("تمت المشاركة ♡");
        }).catch(function (err) {
          if (err && err.name === "AbortError") return;
          copyLink();
        });
      } else {
        copyLink();
      }
    }

    btns.forEach(function (b) { b.addEventListener("click", go); });
  }

  /* ── Light / dark theme ──────────────────────────────────────────────── */
  function initTheme() {
    var btn = document.getElementById("themeBtn");
    var root = document.documentElement;
    var tTimer = 0;

    function syncButton() {
      if (!btn) return;
      var dark = root.getAttribute("data-theme") === "dark";
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.setAttribute("aria-label", dark ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي");
    }

    function apply(t, animate) {
      if (t === "dark") root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t === "dark" ? "#1c0f16" : "#FBF6F1");
      syncButton();
      if (animate && !motionOff()) {
        root.classList.add("theming");
        window.clearTimeout(tTimer);
        tTimer = window.setTimeout(function () { root.classList.remove("theming"); }, 720);
      }
      try { window.localStorage.setItem("toqa-theme", t === "dark" ? "dark" : "light"); } catch (e) {}
    }

    syncButton();
    if (btn) {
      btn.addEventListener("click", function () {
        apply(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
      });
    }
    return { apply: apply };
  }

  /* ── Music-note particles above the player ───────────────────────────── */
  function initNotes(isPlaying) {
    var host = document.getElementById("playerNotes");
    if (!host) return;
    var glyphs = [
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 18.4a2.7 2.7 0 1 1-1.7-2.5V6.1l9.4-2.3v9.7a2.7 2.7 0 1 1-1.7-2.5V7.3L9 8.7z" fill="currentColor"/></svg>',
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M8 18.4a2.5 2.5 0 1 1-1.6-2.4V5.8l11-2.6v4.2L10 9.2v9.7a2.5 2.5 0 1 1-1.6-2.4V7.4l7.4-1.8v1.6L8 8.8z" fill="currentColor"/></svg>'
    ];
    var last = 0;
    window.setInterval(function () {
      if (tabHidden || motionOff() || !isPlaying()) return;
      var now = Date.now();
      if (now - last < 1150) return;
      if (host.childElementCount > 6) return;
      last = now;
      var s = document.createElement("span");
      s.className = "note";
      s.innerHTML = glyphs[(Math.random() * glyphs.length) | 0];
      s.style.setProperty("--nx", Math.round((Math.random() * 2 - 1) * 30) + "px");
      s.style.setProperty("--nd", (2.1 + Math.random() * 1.2).toFixed(2) + "s");
      s.style.width = Math.round(10 + Math.random() * 5) + "px";
      host.appendChild(s);
      s.addEventListener("animationend", function () { this.remove(); });
    }, 650);
  }

  /* ── Hidden sentence + interactive heart ─────────────────────────────── */
  function initSecrets(burstHeartsFn, burstSparklesFn) {
    var heartBtn = document.getElementById("heartBtn");
    if (heartBtn) {
      heartBtn.addEventListener("click", function () {
        var r = heartBtn.getBoundingClientRect();
        burstHeartsFn(r.left + r.width / 2, r.top + r.height / 2, 13);
      });
    }

    var btn = document.getElementById("secretBtn");
    var line = document.getElementById("secretLine");
    if (btn && line) {
      btn.addEventListener("click", function () {
        var shown = line.classList.toggle("is-in");
        btn.setAttribute("aria-expanded", shown ? "true" : "false");
        line.setAttribute("aria-hidden", shown ? "false" : "true");
        if (shown) {
          var label = btn.querySelector(".secret__label");
          if (label) label.textContent = "أغلقية تاني";
          var r = btn.getBoundingClientRect();
          burstHeartsFn(r.left + r.width / 2, r.top + r.height / 2, 11);
        }
      });
    }

    var roseBtn = document.getElementById("roseBtn");
    if (roseBtn && roseBtn.addEventListener) {
      roseBtn.addEventListener("click", function () {
        var r = roseBtn.getBoundingClientRect();
        burstSparklesFn(r.left + r.width / 2, r.top + r.height * 0.34, 6);
      });
    }
  }

  /* ── Parallax (cached geometry, no layout thrash) ────────────────────── */
  var parallaxItems = [];
  function initParallax() {
    var els = [].slice.call(document.querySelectorAll("[data-parallax]"));
    if (!els.length || motionOff()) return;
    parallaxItems = els.map(function (el) {
      return { el: el, f: parseFloat(el.getAttribute("data-parallax")) || 0.05, base: 0, h: 1 };
    });
    measure();
    window.addEventListener("resize", measure, { passive: true });
  }

  function measure() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    parallaxItems.forEach(function (it) {
      var saved = it.el.style.transform;
      it.el.style.transform = "none";
      var r = it.el.getBoundingClientRect();
      it.el.style.transform = saved;
      it.base = r.top + scrollY;
      it.h = r.height;
    });
  }

  function runParallax() {
    if (!parallaxItems.length) return;
    var vh = window.innerHeight;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    for (var i = 0; i < parallaxItems.length; i++) {
      var it = parallaxItems[i];
      var center = it.base + it.h / 2 - scrollY;
      if (center < -160 || center > vh + 160) continue;
      var y = ((vh / 2 - center) * it.f).toFixed(1);
      it.el.style.transform = "translate3d(0," + y + "px,0)";
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */
  window.ToqaFX = {
    Field: Field,
    burstHearts: burstHearts,
    burstSparkles: burstSparkles,
    petalSurge: function (ms) {
      window.ToqaFX.fields.forEach(function (f) { f.surge(ms); });
    },
    fields: [],
    initCards: initCards,
    initRose: initRose,
    initLetter: initLetter,
    initShare: initShare,
    initTheme: initTheme,
    initNotes: initNotes,
    initSecrets: initSecrets,
    initParallax: initParallax,
    runParallax: runParallax,
    remeasureParallax: measure,
    motionOff: motionOff,
    setMotion: setMotion,
    initMotion: initMotion,
    fineMQ: fineMQ
  };

  /* ── Motion toggle ───────────────────────────────────────────────────── */
  function setMotion(off) {
    if (off) root.setAttribute("data-motion", "off");
    else root.removeAttribute("data-motion");
    try { window.localStorage.setItem("toqa-motion", off ? "off" : "on"); } catch (e) {}
    syncMotionButton();
    return motionOff();
  }

  function syncMotionButton() {
    var btn = document.getElementById("motionBtn");
    if (!btn) return;
    var off = motionOff();
    btn.setAttribute("aria-pressed", off ? "true" : "false");
    btn.setAttribute("aria-label", off ? "تشغيل حركة الموقع" : "تقليل حركة الموقع");
  }

  function initMotion() { syncMotionButton(); }
})();
