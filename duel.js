/*
 * «أهلاوي ولا زملكاوي؟» — a daily line-up of 11 players in a 4-3-3. They are revealed one by
 * one from the goalkeeper up; for each, guess: Al Ahly, Zamalek, both, or neither.
 * Line-ups come from data/duel.json (built by scraper/build_data.py), players from data/data.json.
 */
(() => {
  "use strict";
  const CFG = Object.assign({ root: "", data: "data/", key: "duel", title: "أهلاوي ولا زملكاوي؟" }, window.DUEL || {});
  const AHLY = "club:Q223566", ZAM = "club:Q286504";
  const SLOTS = ["gk", "df", "df", "df", "df", "mf", "mf", "mf", "fw", "fw", "fw"];
  // where each slot stands on the pitch (percent of width / height; the team attacks upwards)
  const SPOTS = [[50, 85], [84, 61], [61, 65], [39, 65], [16, 61], [76, 41], [50, 44], [24, 41], [78, 19], [50, 14], [22, 19]];
  const POS = { gk: "حارس مرمى", df: "مدافع", mf: "لاعب وسط", fw: "مهاجم" };
  const CHOICES = [
    { id: "ahly", label: "أهلاوي" }, { id: "zam", label: "زملكاوي" },
    { id: "both", label: "لعب للاتنين" }, { id: "none", label: "لا أهلاوي ولا زملكاوي" },
  ];
  const ANSWER_TEXT = { ahly: "لعب للأهلي", zam: "لعب للزمالك", both: "لعب للأهلي والزمالك", none: "لم يلعب للأهلي ولا للزمالك" };
  const LEAGUES = [
    { id: "duel", href: "duel.html", label: "أهلي ولا زمالك؟" },
    { id: "epl", href: "epl.html", label: "الدوري الإنجليزي" },
    { id: "egypt", href: "./", label: "الدوري المصري" },
  ];
  const ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  };

  // ---------------------------------------------------------------- helpers
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  function cairoParts(d = new Date()) {
    const o = {};
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(d).forEach((p) => { o[p.type] = p.value; });
    return o;
  }
  const cairoToday = () => { const o = cairoParts(); return `${o.year}-${o.month}-${o.day}`; };
  const secondsToMidnight = () => { const o = cairoParts(); return 86400 - (+o.hour * 3600 + +o.minute * 60 + +o.second); };
  const fmtClock = (sec) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((x) => String(x).padStart(2, "0")).join(":");
  const addDays = (ds, n) => { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const prettyDate = (ds) => new Date(ds + "T12:00:00Z").toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  function assetUrl(file, width) {
    if (/^https?:/.test(file)) return file;
    if (/^(photos|badges)\//.test(file)) return CFG.root + file;
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=" + width;
  }
  const initial = (name) => (name || "?").replace(/^ال/, "").charAt(0);
  function photoHtml(p, size, cls) {
    const letter = esc(initial(p.name));
    if (!p.img) return `<span class="${cls} ini">${letter}</span>`;
    return `<img class="${cls}" alt="" loading="lazy" referrerpolicy="no-referrer" data-letter="${letter}" src="${esc(assetUrl(p.img, size))}">`;
  }

  // ---------------------------------------------------------------- state
  let date, lineup, crests = {}, state, clockTimer = null, lastFocus = null;
  const keyFor = (d) => `${CFG.key}:${d}`;
  const correct = () => state.answers.filter((a, k) => a === lineup[k].cat).length;

  // ---------------------------------------------------------------- layout
  function shell() {
    const nav = LEAGUES.map((l) => `<a href="${CFG.root}${l.href}" class="${l.id === "duel" ? "on" : ""}" ${l.id === "duel" ? 'aria-current="page"' : ""}>${esc(l.label)}</a>`).join("");
    const modal = (id, title, body) => `
      <div class="modal" id="${id}" hidden role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <div class="sheet"><div class="sheet-head"><h2 id="${id}-title">${title}</h2>
          <button class="icon-btn small" data-close aria-label="إغلاق">${ICONS.close}</button></div>${body}</div>
      </div>`;
    document.getElementById("app").innerHTML = `
      <header class="masthead">
        <div class="mast-row">
          <button class="icon-btn" id="btn-help" aria-label="طريقة اللعب" title="طريقة اللعب">${ICONS.help}</button>
          <div class="title"><h1>${esc(CFG.title)}</h1><p class="edition" id="edition"></p></div>
          <div class="mast-actions"><button class="icon-btn" id="btn-stats" aria-label="الإحصائيات" title="الإحصائيات">${ICONS.stats}</button></div>
        </div>
        <nav class="leagues">${nav}</nav>
      </header>
      <main class="duel">
        <p class="status" id="status">جارٍ تحميل تشكيلة اليوم…</p>
        <div class="pitch" id="pitch" hidden aria-label="تشكيلة اليوم"></div>
        <section class="duel-card" id="card" hidden aria-live="polite"></section>
      </main>
      <footer class="foot"><p>البيانات من <a href="https://www.wikidata.org" target="_blank" rel="noopener">ويكي بيانات</a> والصور من <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">ويكيميديا كومنز</a></p>
        <p class="foot-links"><a href="about.html">عن اللعبة</a> · <a href="privacy.html">الخصوصية</a> · <a href="credits.html">حقوق الصور</a></p></footer>
      ${modal("m-help", "طريقة اللعب", `<ul class="help">
        <li>كل يوم تشكيلة جديدة من ١١ لاعبًا بطريقة ٤-٣-٣، وكل لاعب في مركزه الحقيقي.</li>
        <li>يظهر اللاعبون واحدًا تلو الآخر، من حارس المرمى حتى الهجوم.</li>
        <li>اختر لكل لاعب: أهلاوي (لعب للأهلي)، زملكاوي (لعب للزمالك)، لعب للاتنين، أو لا أهلاوي ولا زملكاوي.</li>
        <li>يكفي أن يكون لعب للنادي في أي وقت من مسيرته.</li>
        <li>تشكيلة جديدة كل يوم عند منتصف الليل بتوقيت القاهرة.</li>
      </ul><p class="hint">البيانات من ويكي بيانات وقد تكون ناقصة لبعض اللاعبين.</p>`)}
      ${modal("m-stats", "الإحصائيات", '<div id="stats-body"></div>')}
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
  }

  function renderPitch() {
    const markings = `<div class="pitch-lines" aria-hidden="true"><span class="half"></span><span class="circle"></span><span class="spot-c"></span>
      <span class="box top"></span><span class="box bottom"></span><span class="six top"></span><span class="six bottom"></span>
      <span class="arc top"></span><span class="arc bottom"></span><span class="goal"></span></div>`;
    $("#pitch").innerHTML = markings + lineup.map((p, k) => {
      const [x, y] = SPOTS[k];
      const a = state.answers[k];
      let cls = "spot", inner = `<span class="shirt">?</span>`, label = "";
      if (a !== undefined) {
        cls += ` done ${p.cat} ${a === p.cat ? "right" : "wrong"}`;
        inner = `<span class="spot-ph">${photoHtml(p, 120, "sp")}</span><span class="mark">${a === p.cat ? "✓" : "✗"}</span>`;
        label = `<span class="spot-name">${esc(p.name)}</span>`;
      } else if (k === state.answers.length && !state.over) {
        cls += " current";
      }
      return `<button type="button" class="${cls}" data-k="${k}" style="right:${x}%;top:${y}%" aria-label="${esc(POS[p.pos])}">${inner}${label}</button>`;
    }).join("");
  }

  function crestImg(id) {
    return crests[id] ? `<img class="choice-crest" alt="" referrerpolicy="no-referrer" src="${esc(assetUrl(crests[id], 96))}">` : "";
  }

  function renderCard(feedback) {
    const card = $("#card");
    if (state.over) { renderResult(); return; }
    const k = state.answers.length;
    const p = lineup[k];
    const fb = feedback
      ? `<p class="fb ${feedback.ok ? "ok" : "no"}">${feedback.ok ? "صح! " : "غلط! "}${esc(feedback.name)} ${ANSWER_TEXT[feedback.cat]}</p>` : "";
    card.innerHTML = `
      ${fb}
      <div class="who-card">
        ${photoHtml(p, 160, "big-ph")}
        <div class="who-txt"><span class="who-pos">${POS[p.pos]}، اللاعب ${arNum(k + 1)} من ١١</span>
          <span class="who-big">${esc(p.name)}</span>
          <span class="who-en">${esc(p.en || "")}${p.year ? " · مواليد " + p.year : ""}</span></div>
      </div>
      <div class="choices">${CHOICES.map((c) => {
        // the answers are the crests: Ahly, Zamalek, both crests, both crests crossed out
        const art = c.id === "ahly" ? crestImg(AHLY) : c.id === "zam" ? crestImg(ZAM)
          : `<span class="pair-crests">${crestImg(AHLY)}${crestImg(ZAM)}</span>`;
        return `<button type="button" class="choice ${c.id}" data-c="${c.id}" aria-label="${c.label}" title="${c.label}">${art}<span class="choice-txt">${c.label}</span></button>`;
      }).join("")}</div>`;
  }

  function shareText() {
    const marks = state.answers.map((a, k) => (a === lineup[k].cat ? "🟩" : "🟥"));
    const rows = [marks.slice(8, 11), marks.slice(5, 8), marks.slice(1, 5), marks.slice(0, 1)].map((r) => r.join("")).join("\n");
    return `${CFG.title} #${arNum(lineup.n)}\n${arNum(correct())}/١١ ⚽\n${rows}\n‎${location.origin + location.pathname}‎`;
  }

  function renderResult() {
    const n = correct();
    const verdict = n === 11 ? "تشكيلة كاملة! 🏆" : n >= 9 ? "ممتاز!" : n >= 6 ? "مش بطال" : "حظ أوفر بكرة";
    $("#card").innerHTML = `
      <div class="result">
        <p class="big">${arNum(n)} من ١١</p><p class="verdict">${verdict}</p>
        <div class="share-row">
          <button class="btn primary" id="btn-share">شارك النتيجة</button>
          <a class="btn whatsapp" id="btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText())}">${ICONS.whatsapp}<span>واتساب</span></a>
        </div>
        <p class="hint">اضغط على أي لاعب في الملعب لترى إجابته.</p>
        <p class="report"><a href="mailto:islamspo@gmail.com?subject=${encodeURIComponent("خطأ في " + CFG.title)}&body=${encodeURIComponent(`${CFG.title} - التشكيلة رقم ${lineup.n} (${date})\nاسم اللاعب والخطأ:\n`)}">إبلاغ عن خطأ في معلومة لاعب</a></p>
        <p class="next" id="next-panel"></p>
      </div>`;
    $("#btn-share").addEventListener("click", doShare);
    const el = $("#next-panel");
    const tick = () => {
      const s = secondsToMidnight();
      el.innerHTML = `التشكيلة التالية بعد <b dir="ltr">${fmtClock(s)}</b>`;
      if (s <= 1) setTimeout(() => location.reload(), 1500);
    };
    tick();
    clearInterval(renderResult._t);
    renderResult._t = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------- play
  function answer(c) {
    if (state.over) return;
    const k = state.answers.length;
    const p = lineup[k];
    state.answers.push(c);
    if (state.answers.length === lineup.length) state.over = true;
    store.set(keyFor(date), { answers: state.answers, over: state.over, ids: lineup.map((x) => x.id),
      score: state.over ? correct() : undefined });
    renderPitch();
    renderCard({ ok: c === p.cat, name: p.name, cat: p.cat });
    if (state.over) setTimeout(showStats, 900);
  }

  function showSpot(k) {
    const p = lineup[k];
    if (state.answers[k] === undefined) return;
    toast(`${p.name}: ${ANSWER_TEXT[p.cat]}`);
  }

  async function doShare() {
    const text = shareText();
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(text); } catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    toast("تم نسخ النتيجة");
  }

  // ---------------------------------------------------------------- stats
  function computeStats(days) {
    const today = cairoToday();
    let played = 0, perfect = 0, total = 0, run = 0, best = 0;
    const finished = new Set();
    for (const d of days) {
      const s = store.get(keyFor(d));
      if (s && s.over) { finished.add(d); played += 1; total += s.score || 0; if (s.score === 11) perfect += 1; }
    }
    for (const d of days) { run = finished.has(d) ? run + 1 : 0; best = Math.max(best, run); }
    let streak = 0, d = finished.has(today) ? today : addDays(today, -1);
    while (finished.has(d)) { streak += 1; d = addDays(d, -1); }
    return { played, perfect, streak, best, avg: played ? (total / played).toFixed(1).replace(".", "٫") : "0" };
  }
  let ALL_DAYS = [];
  function showStats() {
    if (state.over) {
      const s = store.get(keyFor(date)) || {};
      if (s.score === undefined) store.set(keyFor(date), Object.assign(s, { score: correct() }));
    }
    const st = computeStats(ALL_DAYS);
    const stat = (v, l) => `<div class="stat"><b>${arNum(v)}</b><span>${l}</span></div>`;
    $("#stats-body").innerHTML = `
      ${state.over ? `<section class="today"><h3>نتيجة اليوم</h3><p class="big">${arNum(correct())} من ١١</p>
        <div class="share-row"><button class="btn primary" id="btn-share2">شارك النتيجة</button>
        <a class="btn whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText())}">${ICONS.whatsapp}<span>واتساب</span></a></div></section>` : ""}
      <div class="stat-row">${stat(st.played, "تشكيلات لُعبت")}${stat(st.perfect, "تشكيلات كاملة")}${stat(st.streak, "السلسلة الحالية")}${stat(st.avg, "متوسط الإجابات")}</div>
      <p class="next" id="next-modal"></p>`;
    const b2 = $("#btn-share2");
    if (b2) b2.addEventListener("click", doShare);
    openModal("#m-stats");
    const el = $("#next-modal");
    const tick = () => { el.innerHTML = `التشكيلة التالية بعد <b dir="ltr">${fmtClock(secondsToMidnight())}</b>`; };
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------- dialogs
  function openModal(id) {
    lastFocus = document.activeElement;
    closeModals(true);
    $(id).hidden = false;
    const f = $(id).querySelector("[data-close]");
    if (f) setTimeout(() => f.focus(), 20);
  }
  function closeModals(silent) {
    document.querySelectorAll(".modal").forEach((m) => { m.hidden = true; });
    clearInterval(clockTimer);
    if (silent !== true && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function bind() {
    $("#card").addEventListener("click", (e) => {
      const b = e.target.closest("[data-c]");
      if (b) answer(b.dataset.c);
    });
    $("#pitch").addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (b) showSpot(+b.dataset.k);
    });
    document.querySelectorAll(".modal").forEach((m) => {
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModals(); });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModals();
      const n = { "1": "ahly", "2": "zam", "3": "both", "4": "none" }[e.key];
      if (n && document.querySelectorAll(".modal:not([hidden])").length === 0) answer(n);
    });
    document.addEventListener("error", (e) => {
      const img = e.target;
      if (img.tagName !== "IMG") return;
      if (img.classList.contains("choice-crest")) {   // crest didn't load: show the words instead
        const b = img.closest(".choice");
        if (b) b.classList.add("no-crest");
        img.remove();
        return;
      }
      const span = document.createElement("span");
      span.className = img.className + " ini";
      span.textContent = img.dataset.letter || "?";
      img.replaceWith(span);
    }, true);
    $("#btn-help").addEventListener("click", () => openModal("#m-help"));
    $("#btn-stats").addEventListener("click", () => { if (lineup) showStats(); });
  }

  // ---------------------------------------------------------------- start
  async function start() {
    shell();
    bind();
    try {
      const v = Date.now() / 3.6e6 | 0;   // refresh the data at least hourly
      const [data, duel] = await Promise.all([
        fetch(`${CFG.data}data.json?h=${v}`).then((r) => r.json()),
        fetch(`${CFG.data}duel.json?h=${v}`).then((r) => r.json()),
      ]);
      date = cairoToday();
      ALL_DAYS = Object.keys(duel).filter((d) => d <= date).sort();
      const today = duel[date];
      if (!today) { $("#status").textContent = "لا توجد تشكيلة لليوم بعد. عُد لاحقًا."; return; }
      const crit = data.criteria;
      const ahly = new Set(crit[AHLY].m), zam = new Set(crit[ZAM].m);
      crests = { [AHLY]: crit[AHLY].b, [ZAM]: crit[ZAM].b };
      const index = {};
      data.players.forEach((p, i) => { index[p[0]] = i; });
      lineup = today.p.map((id, k) => {
        const i = index[id];
        const p = data.players[i] || [id, "?", "", 0, "", 0];
        const cat = ahly.has(i) && zam.has(i) ? "both" : ahly.has(i) ? "ahly" : zam.has(i) ? "zam" : "none";
        return { id, name: p[1], en: p[2], img: p[4], year: p[5], pos: SLOTS[k], cat };
      });
      lineup.n = today.n;
      const saved = store.get(keyFor(date));
      const same = saved && Array.isArray(saved.ids) && saved.ids.join() === today.p.join();
      state = same ? { answers: saved.answers || [], over: !!saved.over } : { answers: [], over: false };
      $("#edition").textContent = `التشكيلة رقم ${arNum(today.n)}، ${prettyDate(date)}`;
      $("#status").hidden = true;
      $("#pitch").hidden = false;
      $("#card").hidden = false;
      renderPitch();
      renderCard();
      if (!store.get(CFG.key + ":seen-help")) { store.set(CFG.key + ":seen-help", 1); openModal("#m-help"); }
    } catch (e) {
      $("#status").textContent = "تعذر تحميل البيانات. تحقق من الاتصال ثم أعد تحميل الصفحة.";
    }
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  start();
})();
