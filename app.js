/* ============================================================
   진로전담교사 심층면접 41문항 — 동작
   data.js 의 ITEMS / AREAS 를 읽어 목록·상세·낭독·타이머를 담당합니다.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var state = { grade: "all", area: "all", q: "", cur: null, done: loadDone() };

  /* ── 저장 ─────────────────────────────────────────── */
  function loadDone() {
    try { return JSON.parse(localStorage.getItem("jinro36.done") || "[]"); }
    catch (e) { return []; }
  }
  function saveDone() {
    try { localStorage.setItem("jinro36.done", JSON.stringify(state.done)); }
    catch (e) { /* 저장이 막힌 환경에서도 학습은 계속됩니다 */ }
  }
  function isDone(no) { return state.done.indexOf(no) > -1; }

  /* ── 낭독 ─────────────────────────────────────────── */
  var TTS = {
    queue: [], idx: 0, on: false, rate: 1, voiceQ: null, voiceA: null,
    onSeg: null, parts: null, fromSeg: 0,

    pickVoices: function () {
      if (!window.speechSynthesis) return;
      var v = speechSynthesis.getVoices().filter(function (x) {
        return /ko(-|_)?KR/i.test(x.lang) || /Korean|한국/i.test(x.name);
      });
      if (!v.length) return;
      var male = v.filter(function (x) { return /InJoon|Male|남/i.test(x.name); });
      var female = v.filter(function (x) { return /SunHi|Female|여|Yuna/i.test(x.name); });
      this.voiceQ = male[0] || v[0];
      this.voiceA = female[0] || v[v.length - 1] || v[0];
      this.list = v;
      var sel = $("voice");
      if (sel && sel.options.length !== v.length + 1) {
        var cur = sel.value;
        sel.innerHTML = '<option value="">기본 음성</option>';
        v.forEach(function (x, i) {
          var o = document.createElement("option");
          o.value = String(i); o.textContent = x.name.replace(/Microsoft |Google /, "");
          sel.appendChild(o);
        });
        sel.value = cur;
      }
    },

    chunk: function (text) {
      var LIM = this.rate > 1.2 ? 90 : (this.rate < 1 ? 60 : 75);
      var raw = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
      var sentences = [];
      raw.forEach(function (s) {                    /* 긴 문장은 쉼표에서 한 번 더 */
        if (s.length <= LIM + 25) { sentences.push(s); return; }
        var b = "";
        s.split(/,\s*/).forEach(function (p, i, arr) {
          p = p + (i < arr.length - 1 ? "," : "");
          if (b && (b + p).length > LIM) { sentences.push(b); b = p; } else { b += p; }
        });
        if (b) sentences.push(b);
      });
      var out = [], buf = "";
      sentences.forEach(function (s) {
        s = s.trim(); if (!s) return;
        if (buf && (buf + " " + s).length > LIM) { out.push(buf); buf = s; }
        else buf = buf ? buf + " " + s : s;
      });
      if (buf) out.push(buf);
      return out;
    },

    /* parts: [{text, who:'q'|'a', seg:index|null}] */
    play: function (parts, onSeg) {
      if (!window.speechSynthesis) {
        alert("이 브라우저는 읽어주기를 지원하지 않습니다. 크롬이나 사파리 최신 버전을 사용해 주십시오.");
        return;
      }
      this.stop();
      this.parts = parts;
      this.onSeg = onSeg || null;
      var self = this;
      this.queue = [];
      parts.forEach(function (p) {
        self.chunk(p.text).forEach(function (t, i, arr) {
          self.queue.push({ text: t, who: p.who, seg: p.seg, last: i === arr.length - 1 });
        });
      });
      this.idx = 0; this.on = true;
      showSpeaking(true);
      this.next();
    },

    next: function () {
      if (!this.on || this.idx >= this.queue.length) { this.stop(); return; }
      var item = this.queue[this.idx], self = this;
      var u = new SpeechSynthesisUtterance(item.text);
      u.lang = "ko-KR";
      u.rate = this.rate;
      u.pitch = item.who === "q" ? 0.95 : 1.02;
      var v = item.who === "q" ? this.voiceQ : this.voiceA;
      if (v) u.voice = v;
      if (this.onSeg) this.onSeg(item.seg);
      u.onend = function () { self.idx++; setTimeout(function () { self.next(); }, item.last ? 300 : 130); };
      u.onerror = function () { self.idx++; setTimeout(function () { self.next(); }, 130); };
      setTimeout(function () { if (self.on) speechSynthesis.speak(u); }, 0);
    },

    stop: function () {
      this.on = false;
      if (window.speechSynthesis) speechSynthesis.cancel();
      if (this.onSeg) this.onSeg(null);
      showSpeaking(false);
    }
  };
  if (window.speechSynthesis) {
    TTS.pickVoices();
    speechSynthesis.onvoiceschanged = function () { TTS.pickVoices(); };
  }
  function showSpeaking(on) {
    $("speaking").hidden = !on;
  }

  /* ── 타이머 ───────────────────────────────────────── */
  var Timer = { id: null, left: 0, total: 0, warned: false };

  function chime(times) {                       /* 실제 전형의 타종을 대신하는 신호음 */
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      for (var i = 0; i < times; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.5;
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.start(t); o.stop(t + 0.4);
      }
    } catch (e) { /* 소리를 낼 수 없는 환경에서는 화면 표시로 대신합니다 */ }
  }
  function timerStop() {
    if (Timer.id) { clearInterval(Timer.id); Timer.id = null; }
    $("timerBtn").textContent = labelFor();
    $("timer").hidden = true;
    document.body.classList.remove("is-timing");
  }
  function labelFor() {
    var v = parseInt($("thinkSec").value, 10);
    return "⏱ " + (v >= 60 ? Math.floor(v / 60) + "분" + (v % 60 ? " " + (v % 60) + "초" : "") : v + "초") + " 시작";
  }

  function timerStart() {
    timerStop();
    Timer.warned = false;
    Timer.total = Timer.left = parseInt($("thinkSec").value, 10);
    $("timer").hidden = false;
    $("timerBtn").textContent = "⏱ 중지";
    document.body.classList.add("is-timing");
    paintTimer();
    Timer.id = setInterval(function () {
      Timer.left--;
      paintTimer();
      if (Timer.left === 30 && Timer.total > 60 && !Timer.warned) { Timer.warned = true; chime(1); }
      if (Timer.left <= 0) {
        chime(2);
        timerStop();
        $("timer").hidden = false;
        document.body.classList.add("is-timing");
        $("timerNum").textContent = "0:00";
        $("timerFill").style.width = "0%";
      }
    }, 1000);
  }
  function paintTimer() {
    var m = Math.floor(Timer.left / 60), s = Timer.left % 60;
    $("timerNum").textContent = m + ":" + (s < 10 ? "0" : "") + s;
    $("timerFill").style.width = (Timer.left / Timer.total * 100) + "%";
    $("timerFill").className = Timer.left <= 10 ? "is-low" : "";
  }

  /* ── 목록 ─────────────────────────────────────────── */
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return ITEMS.filter(function (it) {
      if (state.grade === "fresh") { if (!it.fresh) return false; }
      else if (state.grade !== "all" && it.grade !== state.grade) return false;
      if (state.area !== "all" && it.area !== state.area) return false;
      if (!q) return true;
      var hay = [it.slug, it.kind, it.area, it.prompt, it.fresh || "",
        it.subs.join(" "), it.keywords.join(" ")].join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderChips() {
    var box = $("areaChips");
    box.innerHTML = "";
    var all = ["all"].concat(AREAS);
    all.forEach(function (a) {
      var b = document.createElement("button");
      b.className = "chip" + (state.area === a ? " is-on" : "");
      b.textContent = a === "all" ? "모든 영역" : a;
      b.onclick = function () { state.area = a; renderChips(); renderList(); };
      box.appendChild(b);
    });
  }

  function renderList() {
    var box = $("cards"), list = filtered();
    box.innerHTML = "";
    $("empty").hidden = list.length > 0;
    list.forEach(function (it) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.className = "card" + (it.grade === "S" ? " is-s" : "") +
        (state.cur && state.cur.no === it.no ? " is-on" : "");
      b.innerHTML =
        '<div class="card__top">' +
          '<span class="card__no">' + pad(it.no) + '</span>' +
          '<span class="card__grade">' + it.grade + '</span>' +
          (isDone(it.no) ? '<span class="card__done">✓</span>' : '') +
        '</div>' +
        '<div class="card__title"></div>' +
        '<div class="card__kind">' + it.kind + " · " + it.area + '</div>' +
        (it.fresh ? '<span class="card__fresh">최신 반영</span>' : '');
      b.querySelector(".card__title").textContent = it.slug;
      b.onclick = function () { open(it); };
      li.appendChild(b);
      box.appendChild(li);
    });
    $("progressNum").textContent = state.done.length;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ── 상세 ─────────────────────────────────────────── */
  function open(it) {
    TTS.stop(); timerStop();
    state.cur = it;
    document.body.classList.add("is-detail");
    $("welcome").hidden = true;
    $("q").hidden = false;

    $("qGrade").textContent = it.grade === "S" ? "S 반드시 준비" : "A 준비 권장";
    $("qGrade").className = "badge" + (it.grade === "S" ? " is-s" : "");
    $("qKind").textContent = it.kind;
    $("qArea").textContent = it.area;
    $("qNo").textContent = pad(it.no);
    $("qTitle").textContent = it.slug;
    $("qFresh").hidden = !it.fresh;
    if (it.fresh) $("qFresh").textContent = it.fresh;
    $("qPrompt").textContent = it.prompt;

    ["qRubric", "qPitfall", "qEvidence"].forEach(function (id, k) {
      var box = $(id); if (!box) return;
      box.innerHTML = "";
      var src = k === 0 ? it.rubric : (k === 1 ? it.pitfall : it.evidence);
      (src || []).forEach(function (x) {
        var li = document.createElement("li"); li.textContent = x; box.appendChild(li);
      });
    });

    var fc = $("qFocus"); fc.innerHTML = "";
    (it.focus || []).forEach(function (f) {
      var li = document.createElement("li"); li.textContent = f; fc.appendChild(li);
    });

    var subs = $("qSubs"); subs.innerHTML = "";
    it.subs.forEach(function (s) {
      var li = document.createElement("li"); li.textContent = s; subs.appendChild(li);
    });

    var kw = $("qKw"); kw.innerHTML = "";
    it.keywords.forEach(function (k) {
      var li = document.createElement("li"); li.textContent = k; kw.appendChild(li);
    });
    kw.hidden = true;
    $("kwToggle").hidden = false;
    $("kwToggle").setAttribute("aria-expanded", "false");

    $("ansBody").hidden = true;
    $("ansToggle").hidden = false;
    $("ansToggle").setAttribute("aria-expanded", "false");

    /* 발화 시간 막대 */
    var rib = $("ribbon"); rib.innerHTML = "";
    it.answer.forEach(function (a, i) {
      var s = document.createElement("span");
      s.style.flex = a.sec;
      s.className = "is-" + Math.min(i + 1, 3);
      s.dataset.seg = i;
      rib.appendChild(s);
    });
    var m = Math.floor(it.total_sec / 60), s2 = it.total_sec % 60;
    $("totalSec").textContent = m + "분 " + (s2 ? s2 + "초" : "") + " 기준";

    /* 답안 구간 */
    var segs = $("segs"); segs.innerHTML = "";
    it.answer.forEach(function (a, i) {
      var b = document.createElement("button");
      b.className = "seg"; b.dataset.seg = i;
      b.innerHTML =
        '<div class="seg__head">' +
          '<span class="seg__label">' + a.label + '</span>' +
          '<span class="seg__sec">' + a.sec + '초</span>' +
          (a.sub ? '<span class="seg__sub">질문 ' + a.sub + '</span>' : '') +
        '</div><p class="seg__text"></p>';
      b.querySelector(".seg__text").textContent = a.text;
      b.onclick = function () { readAnswer(i); };
      segs.appendChild(b);
    });

    $("doneBtn").className = "btn" + (isDone(it.no) ? " is-done" : "");
    $("doneBtn").textContent = isDone(it.no) ? "✓ 완료함" : "✓ 연습 완료";
    $("qSrc").textContent = "원본 대응 " + it.source + "  ·  재구성 전 번호 " + it.origin + "번";

    renderList();
    $("detailScroll").scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function markSeg(i) {
    Array.prototype.forEach.call(document.querySelectorAll(".seg"), function (el) {
      el.classList.toggle("is-live", i !== null && +el.dataset.seg === i);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#ribbon span"), function (el) {
      el.classList.toggle("is-live", i !== null && +el.dataset.seg === i);
    });
  }

  function readQuestion() {
    var it = state.cur; if (!it) return;
    var parts = [{ text: it.prompt, who: "q", seg: null }];
    it.subs.forEach(function (s) { parts.push({ text: s, who: "q", seg: null }); });
    TTS.rate = parseFloat($("rate").value);
    TTS.play(parts, markSeg);
  }

  function readAnswer(from) {
    var it = state.cur; if (!it) return;
    showAnswer();
    var parts = it.answer.slice(from || 0).map(function (a, i) {
      return { text: a.text, who: "a", seg: (from || 0) + i };
    });
    TTS.rate = parseFloat($("rate").value);
    TTS.play(parts, markSeg);
  }

  function showAnswer() {
    $("ansBody").hidden = false;
    $("ansToggle").setAttribute("aria-expanded", "true");
  }

  function move(step) {
    if (!state.cur) return;
    var list = filtered();
    if (!list.length) return;
    var i = list.findIndex(function (x) { return x.no === state.cur.no; });
    if (i < 0) i = 0;
    open(list[(i + step + list.length) % list.length]);
  }

  /* ── 연결 ─────────────────────────────────────────── */
  $("search").oninput = function () { state.q = this.value; renderList(); };
  Array.prototype.forEach.call($("gradeChips").children, function (b) {
    b.onclick = function () {
      state.grade = b.dataset.grade;
      Array.prototype.forEach.call($("gradeChips").children, function (x) {
        x.classList.toggle("is-on", x === b);
      });
      renderList();
    };
  });

  $("kwToggle").onclick = function () {
    $("qKw").hidden = false; this.setAttribute("aria-expanded", "true");
  };
  $("ansToggle").onclick = function () { showAnswer(); };
  $("readQ").onclick = readQuestion;
  $("readA").onclick = function () { readAnswer(0); };
  $("stopBtn").onclick = function () { TTS.stop(); };
  $("speakingStop").onclick = function () { TTS.stop(); };
  function applyVoice() {
    var sel = $("voice");
    if (!sel || !TTS.list) return;
    if (sel.value === "") { TTS.pickVoices(); return; }
    var v = TTS.list[parseInt(sel.value, 10)];
    if (v) { TTS.voiceQ = v; TTS.voiceA = v; }
  }
  function restartSpeech() {
    if (!TTS.on || !TTS.parts) return;
    var parts = TTS.parts, seg = TTS.queue[TTS.idx] ? TTS.queue[TTS.idx].seg : null;
    var from = 0;
    if (seg !== null) {
      for (var i = 0; i < parts.length; i++) { if (parts[i].seg === seg) { from = i; break; } }
    }
    TTS.play(parts.slice(from), TTS.onSeg);
  }
  $("rate").onchange = function () {
    TTS.rate = parseFloat(this.value);
    restartSpeech();
  };
  if ($("voice")) $("voice").onchange = function () { applyVoice(); restartSpeech(); };
  $("timerBtn").onclick = function () { Timer.id ? timerStop() : timerStart(); };
  $("thinkSec").onchange = function () { if (!Timer.id) $("timerBtn").textContent = labelFor(); };

  (function renderExam() {
    var t = $("examTable"); if (!t || typeof EXAM === "undefined") return;
    var b = t.querySelector("tbody");
    var head = document.createElement("tr");
    head.innerHTML = '<th colspan="2">' + EXAM.title + '</th>';
    b.appendChild(head);
    ([["일시", EXAM.date], ["장소", EXAM.place]].concat(EXAM.rows)).forEach(function (r) {
      var tr = document.createElement("tr");
      var th = document.createElement("th"); th.textContent = r[0];
      var td = document.createElement("td"); td.textContent = r[1];
      tr.appendChild(th); tr.appendChild(td); b.appendChild(tr);
    });
  })();

  $("doneBtn").onclick = function () {
    var no = state.cur.no;
    if (isDone(no)) state.done = state.done.filter(function (x) { return x !== no; });
    else state.done.push(no);
    saveDone();
    this.className = "btn" + (isDone(no) ? " is-done" : "");
    this.textContent = isDone(no) ? "✓ 완료함" : "✓ 연습 완료";
    renderList();
  };

  $("prevBtn").onclick = function () { move(-1); };
  $("nextBtn").onclick = function () { move(1); };
  function rand() { open(ITEMS[Math.floor(Math.random() * ITEMS.length)]); }
  $("randomBtn").onclick = rand;
  $("randomBtn2").onclick = rand;
  $("startBtn").onclick = function () { open(ITEMS[0]); };
  $("backBtn").onclick = function () {
    TTS.stop(); timerStop();
    document.body.classList.remove("is-detail");
    window.scrollTo(0, 0);
  };

  /* 전체화면 API는 iOS 사파리에서 동작하지 않으므로,
     지원되지 않는 환경에서는 CSS 기반 넓게 보기(집중 모드)로 대체합니다. */
  var FS_OK = (function () {
    var el = document.documentElement;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return false;
    if (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) return false;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  })();

  function isZen() { return document.body.classList.contains("is-zen"); }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function paintFsBtn() {
    var on = isFull() || isZen();
    $("fsBtn").textContent = on ? "⤡ 넓게 보기 해제" : "⛶ 넓게 보기";
    $("fsBtn").setAttribute("aria-pressed", on ? "true" : "false");
  }
  function setZen(to) {
    document.body.classList.toggle("is-zen", to);
    $("zenExit").hidden = !to;
    paintFsBtn();
  }
  function toggleFull() {
    var d = document, el = d.documentElement;
    if (!FS_OK) { setZen(!isZen()); return; }
    if (!isFull()) {
      var p;
      try { p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { p = null; }
      if (p && p.catch) p.catch(function () { setZen(true); });
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    }
  }
  $("fsBtn").onclick = toggleFull;
  $("zenExit").onclick = function () { setZen(false); };
  ["fullscreenchange", "webkitfullscreenchange"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      document.body.classList.toggle("is-full", isFull());
      paintFsBtn();
    });
  });
  paintFsBtn();

  document.addEventListener("keydown", function (e) {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") move(1);
    if (e.key === "ArrowLeft") move(-1);
    if (e.key === "Escape") { TTS.stop(); if (isZen()) setZen(false); }
    if (e.key === "f" || e.key === "F") toggleFull();
    if (e.key === " " && state.cur) { e.preventDefault(); readQuestion(); }
  });

  window.addEventListener("beforeunload", function () { TTS.stop(); });

  renderChips();
  renderList();
})();
