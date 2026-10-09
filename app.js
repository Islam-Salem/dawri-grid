/*
 * Football grid game — shared by the Egyptian league page (Arabic) and the
 * Premier League page (Arabic, epl.html). Each page sets window.GAME before loading this file:
 *   { lang: "ar" | "en", root: "", data: "data/" | "data/epl/",
 *     key: "egrid" | "epl", league: "egypt" | "epl", title: "..." }
 * The whole interface is built here, so both pages stay identical in behaviour.
 */
(() => {
  "use strict";

  const GAME = Object.assign(
    { lang: "ar", root: "", data: "data/", key: "egrid", league: "egypt", title: "شبكة الدوري المصري" },
    window.GAME || {}
  );
  const TOTAL_GUESSES = 9;
  const LEAGUES = [
    { id: "epl", href: "epl.html", label: "الدوري الإنجليزي", lang: "ar" },
    { id: "egypt", href: "./", label: "الدوري المصري", lang: "ar" },
  ];

  // ---------------------------------------------------------------- text
  const STRINGS = {
    ar: {
      help: "طريقة اللعب", stats: "الإحصائيات", archive: "الشبكات السابقة", close: "إغلاق",
      loading: "جارٍ تحميل شبكة اليوم…",
      edition: (n, d) => `الشبكة رقم ${n} · ${d}`,
      whatsapp: "واتساب",
      footLinks: '<a href="about.html">عن اللعبة</a> · <a href="privacy.html">الخصوصية</a> · <a href="credits.html">حقوق الصور</a>',
      guessesLeft: "محاولات متبقية",
      giveUp: "استسلم وأظهر الإجابات",
      seeResult: "نتيجتك",
      confirmGiveUp: "سيتم إنهاء شبكة اليوم وإظهار الإجابات. هل تريد الاستسلام؟",
      searchPlaceholder: "ابحث باسم اللاعب",
      searchHint: "اكتب حرفين على الأقل",
      noPlayer: "لا يوجد لاعب بهذا الاسم. جرّب جزءًا من الاسم.",
      used: "مستخدم",
      born: (y) => `مواليد ${y}`,
      wrong: "إجابة خاطئة",
      copied: "تم نسخ النتيجة",
      shareResult: "شارك النتيجة",
      todayResult: "نتيجة اليوم",
      scoreLine: (n) => `${n} من 9`,
      triesLine: (k) => `استخدمت ${k} من ٩ محاولات`,
      shareLine: (n, k) => `${n}/9 · ${k} محاولات`,
      played: "شبكات لُعبت", perfect: "شبكات كاملة", streak: "السلسلة الحالية", best: "أطول سلسلة",
      nextGrid: "الشبكة التالية بعد",
      tapCell: "اضغط على أي خانة لرؤية كل الإجابات الصحيحة.",
      answersCount: (k) => `${k} إجابة صحيحة`,
      more: (k) => `و${k} آخرين`,
      topAnswer: "",
      yourAnswer: "إجابتك",
      archiveEmpty: "لا توجد شبكات سابقة بعد.",
      archiveDone: (n) => `${n}/9`,
      archiveStarted: "لم تكتمل",
      loadFail: "تعذر تحميل البيانات. تحقق من الاتصال ثم أعد تحميل الصفحة.",
      noGrid: "لا توجد شبكة لليوم بعد. عُد لاحقًا.",
      gridGone: "شبكة هذا اليوم لم تعد متاحة. اختر يومًا آخر من الشبكات السابقة.",
      updated: (d) => `آخر تحديث للبيانات ${d}`,
      dataFrom: 'البيانات من <a href="https://www.wikidata.org" target="_blank" rel="noopener">ويكي بيانات</a> والصور من <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">ويكيميديا كومنز</a>',
      tags: { fclub: "نادٍ خارج مصر", nat: "الجنسية", abroad: "", pos: "المركز", award: "جائزة", nt: "" },
      helpItems: [
        "اختر لاعبًا لكل خانة ينطبق عليه شرط الصف وشرط العمود معًا.",
        "مثال: صف «الأهلي» وعمود «الزمالك» يعني لاعبًا لعب للناديين في أي وقت من مسيرته.",
        "معك ٩ محاولات فقط، والإجابة الخاطئة تُحتسب محاولة.",
        "لا يمكن استخدام نفس اللاعب في أكثر من خانة.",
        "شبكة جديدة كل يوم عند منتصف الليل بتوقيت القاهرة.",
      ],
      helpNote: "البيانات من ويكي بيانات وقد تكون ناقصة لبعض اللاعبين.",
      and: " و ",
    },
    en: {
      help: "How to play", stats: "Statistics", archive: "Past grids", close: "Close",
      loading: "Loading today's grid…",
      edition: (n, d) => `Grid ${n} · ${d}`,
      whatsapp: "WhatsApp",
      footLinks: '<a href="about.html">About</a> · <a href="privacy.html">Privacy</a> · <a href="credits.html">Photo credits</a>',
      guessesLeft: "guesses left",
      giveUp: "Give up and show answers",
      seeResult: "Your result",
      confirmGiveUp: "This ends today's grid and shows the answers. Give up?",
      searchPlaceholder: "Search for a player",
      searchHint: "Type at least two letters",
      noPlayer: "No player by that name. Try part of the name.",
      used: "Used",
      born: (y) => `Born ${y}`,
      wrong: "Wrong answer",
      copied: "Copied to clipboard",
      shareResult: "Share result",
      todayResult: "Today's result",
      scoreLine: (n) => `${n} of 9`,
      triesLine: (k) => `Used ${k} of 9 guesses`,
      shareLine: (n, k) => `${n}/9 · ${k} guesses`,
      played: "Grids played", perfect: "Perfect grids", streak: "Current streak", best: "Best streak",
      nextGrid: "Next grid in",
      tapCell: "Tap any square to see every correct answer.",
      answersCount: (k) => `${k} correct ${k === 1 ? "answer" : "answers"}`,
      more: (k) => `and ${k} more`,
      topAnswer: "",
      yourAnswer: "Your answer",
      archiveEmpty: "No past grids yet.",
      archiveDone: (n) => `${n}/9`,
      archiveStarted: "Unfinished",
      loadFail: "Couldn't load the game data. Check your connection and reload the page.",
      noGrid: "There's no grid for today yet. Check back later.",
      gridGone: "This day's grid is no longer available. Pick another day from past grids.",
      updated: (d) => `Data updated ${d}`,
      dataFrom: 'Data from <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a>, photos from <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>',
      tags: { fclub: "Club abroad", nat: "Nationality", abroad: "", pos: "Position", award: "Award", nt: "" },
      helpItems: [
        "Pick a player for each square who matches both its row and its column.",
        "Example: row “Arsenal” and column “Chelsea” means a player who played for both clubs at any point in their career.",
        "You have 9 guesses in total, and a wrong answer uses one up.",
        "Each player can only be used once.",
        "A new grid every day at midnight Cairo time.",
      ],
      helpNote: "Data comes from Wikidata and may be incomplete for some players.",
      and: " & ",
    },
  };
  // Arabic Premier League page: same Arabic text with English-league examples
  const T = Object.assign({}, STRINGS[GAME.lang] || STRINGS.ar, GAME.league === "epl" && GAME.lang === "ar" ? {
    helpItems: STRINGS.ar.helpItems.map((x) => x.replace("«الأهلي»", "«أرسنال»").replace("«الزمالك»", "«تشيلسي»")),
    tags: Object.assign({}, STRINGS.ar.tags, { fclub: "نادٍ خارج إنجلترا" }),
  } : {});
  // How to play, the result panel, statistics and past grids can use another language than
  // the grid itself: the Premier League page shows English names with Arabic menus.
  const UL = GAME.uiLang || GAME.lang;
  const U = UL === GAME.lang ? T : Object.assign({}, STRINGS[UL] || T, GAME.league === "epl" && UL === "ar" ? {
    helpItems: T.helpItems.map((x) => x.replace("«الأهلي»", "«أرسنال»").replace("«الزمالك»", "«تشيلسي»")),
  } : {});
  const UDIR = UL !== GAME.lang ? `lang="${UL}" dir="${UL === "ar" ? "rtl" : "ltr"}"` : "";

  const ICONS = {
    cake: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0M12 12V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3.5c1 1.2 1.2 2.3 0 3.2-1.2-.9-1-2 0-3.2Z" fill="currentColor"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/></svg>',
    whistle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5a5.5 5.5 0 1 0 11 0V9H21V6H8.5A5.5 5.5 0 0 0 3 11.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8.5" cy="11.5" r="1.8" fill="currentColor"/><path d="M14 6V4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    trophy: '<svg viewBox="0 0 40 30" aria-hidden="true"><path d="M13 4h14v6a7 7 0 0 1-14 0V4z" fill="currentColor"/><path d="M13 6H8a4 4 0 0 0 5 6M27 6h5a4 4 0 0 1-5 6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 17h4v4h-4zM14 22h12v3H14z" fill="currentColor"/></svg>',
    globe: '<svg viewBox="0 0 40 30" aria-hidden="true"><circle cx="20" cy="15" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 15h22M20 4c4 4 4 18 0 22M20 4c-4 4-4 18 0 22" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  };
  // Tiny pitch with the player's zone shaded: goalkeeper, defence, midfield, attack.
  // zones measured from the team's own goal; on Arabic pages the own goal is on the right
  // (where reading starts), so the team attacks towards the left
  const ZONES = { gk: [2, 7], df: [7, 17], mf: [17, 29], fw: [29, 38] };
  function pitchIcon(pos) {
    let [x0, x1] = ZONES[pos] || [0, 0];
    if (GAME.lang === "ar") [x0, x1] = [40 - x1, 40 - x0];
    const own = GAME.lang === "ar" ? 38 : 2;            // own goal line
    const dir = GAME.lang === "ar" ? -1 : 1;            // attacking direction
    const box = (x, w) => `<rect x="${Math.min(x, x + w)}" y="9" width="${Math.abs(w)}" height="12" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".6"/>`;
    return `<svg viewBox="0 0 40 30" aria-hidden="true">
      <rect x="${x0}" y="3" width="${x1 - x0}" height="24" fill="currentColor" opacity=".9"/>
      <rect x="2" y="3" width="36" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".75"/>
      <path d="M20 3v24" stroke="currentColor" stroke-width="1.1" opacity=".6"/>
      <circle cx="20" cy="15" r="3.6" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".6"/>
      ${box(own, 5 * dir)}${box(40 - own, -5 * dir)}
      <rect x="${own - (dir > 0 ? 2 : 0)}" y="12" width="2" height="6" fill="currentColor"/>
    </svg>`;
  }

  // ---------------------------------------------------------------- helpers
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function cairoParts(d = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(d);
    const o = {};
    parts.forEach((p) => { o[p.type] = p.value; });
    return o;
  }
  function cairoToday() { const o = cairoParts(); return `${o.year}-${o.month}-${o.day}`; }
  function secondsToMidnight() {
    const o = cairoParts();
    return 86400 - (+o.hour * 3600 + +o.minute * 60 + +o.second);
  }
  function addDays(ds, n) {
    const d = new Date(ds + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function prettyDate(ds) {
    return new Date(ds + "T12:00:00Z").toLocaleDateString((GAME.uiLang || GAME.lang) === "ar" ? "ar-EG" : "en-GB",
      { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  }
  function fmtClock(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
  }

  function norm(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[ً-ٰٟـ]/g, "") // tashkeel, hamza marks, tatweel
      .replace(/[̀-ͯ]/g, "")              // latin accents
      .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
      .replace(/ؤ/g, "و").replace(/ئ/g, "ي")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function commons(file, width) {
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=" + width;
  }

  // ---------------------------------------------------------------- state
  let DATA, GRIDS, players, crit, sets, date, grid, state, normNames, byId = {};
  let activeCell = null, activeResult = -1, lastPlaced = null, clockTimer = null;

  const keyFor = (d) => `${GAME.key}:${d}`;

  // Saved answers are stored by player id ("Q1234"), so the weekly data
  // refresh can't swap them for other players.
  function readSaved(d) {
    const s = store.get(keyFor(d));
    if (!s || !s.cells) return null;
    const cells = {};
    let lost = false;
    for (const [i, v] of Object.entries(s.cells)) {
      const p = typeof v === "number" ? v : byId[v]; // numbers: saved by an older version
      if (p !== undefined && players[p]) cells[i] = p;
      else lost = true;
    }
    return { cells, guesses: s.guesses ?? TOTAL_GUESSES, over: !!s.over, grid: s.grid, lost };
  }
  const gridId = () => grid.rows.concat(grid.cols).join("|");
  function load() {
    const fresh = { cells: {}, guesses: TOTAL_GUESSES, over: false };
    const s = readSaved(date);
    if (!s) { state = fresh; return; }
    // a saved game belongs to one grid: if that day's grid was replaced, start again
    const sameGrid = s.grid ? s.grid === gridId()
      : !s.lost && Object.entries(s.cells).every(([i, p]) => sets[rowOf(+i)].has(p) && sets[colOf(+i)].has(p))
        && (Object.keys(s.cells).length > 0 || s.guesses === TOTAL_GUESSES);
    state = sameGrid ? { cells: s.cells, guesses: s.guesses, over: s.over } : fresh;
  }
  function save() {
    const cells = {};
    for (const [i, p] of Object.entries(state.cells)) cells[i] = players[p][0];
    store.set(keyFor(date), { cells, guesses: state.guesses, over: state.over, grid: gridId() });
  }

  const rowOf = (i) => grid.rows[Math.floor(i / 3)];
  const colOf = (i) => grid.cols[i % 3];
  const used = (p) => Object.values(state.cells).includes(p);
  const filledCount = (s = state) => Object.keys(s.cells).length;

  function answersFor(i, g = grid) {
    const a = sets[g.rows[Math.floor(i / 3)]], b = sets[g.cols[i % 3]];
    if (!a || !b) return [];
    const out = [];
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    small.forEach((p) => { if (big.has(p)) out.push(p); });
    return out.sort((x, y) => x - y); // players are stored most-famous first
  }

  // ---------------------------------------------------------------- badges
  const PALETTE = ["#C8102E", "#1E6F50", "#1F4E9C", "#E2A400", "#6B2D8F", "#0E7C86", "#B5441B", "#2B2B2B"];
  function hashColor(s) {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function isLight(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 170;
  }
  function monogram(label) {
    const clean = label.replace(/\(.*?\)/g, "").trim();
    if (GAME.lang === "ar") return clean.replace(/^ال/, "").charAt(0);
    const words = clean.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return clean.slice(0, 3).toUpperCase();
  }
  // Generated shield in the club's colours with its initials (used when no crest is available).
  function crestHtml(label, colors, corner = "") {
    const cols = (colors || []).map((x) => "#" + x);
    const c1 = cols[0] || hashColor(label), c2 = cols[1] || c1;
    const ink = isLight(c1) ? "#14213D" : "#fff";
    return `<span class="badge crest" style="--c1:${c1};--c2:${c2};--mono:${ink}"><span>${esc(monogram(label))}</span>${corner}</span>`;
  }

  // A file from Commons (bare file name), a full URL, or a file in this repo (photos/, badges/).
  function assetUrl(file, width) {
    if (/^https?:/.test(file)) return file;
    if (/^(photos|badges)\//.test(file)) return GAME.root + file;
    return commons(file, width);
  }

  function flagImg(file, extraClass = "") {
    return `<img class="flag ${extraClass}" alt="" loading="lazy" referrerpolicy="no-referrer" src="${commons(file, 80)}">`;
  }
  function badgeHtml(c) {
    switch (c.t) {
      case "club":
      case "fclub": {
        const corner = c.t === "fclub" && c.f ? flagImg(c.f, "corner") : "";
        if (c.b) {
          // the club's real crest; if it fails to load, the generated shield replaces it
          return `<span class="badge logo" data-crest="${esc(JSON.stringify({ l: c.l, c: c.c || [] }))}"><img class="club-logo" alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(assetUrl(c.b, 96))}">${corner}</span>`;
        }
        return crestHtml(c.l, c.c, corner);
      }
      case "nat":
      case "abroad":
      case "nt":
        return c.f ? `<span class="badge flagbox">${flagImg(c.f)}</span>` : `<span class="badge icon">${ICONS.globe}</span>`;
      case "pos":
        return `<span class="badge icon">${pitchIcon(c.id.split(":")[1])}</span>`;
      case "award":
        return `<span class="badge icon">${ICONS.trophy}</span>`;
      case "decade":
        return `<span class="badge icon">${ICONS.cake}</span>`;
      case "bplace":
        return c.f ? `<span class="badge flagbox">${flagImg(c.f)}</span>` : `<span class="badge icon">${ICONS.pin}</span>`;
      case "coach":
        return `<span class="badge icon">${ICONS.whistle}</span>`;
      default:
        return "";
    }
  }
  function headerHtml(id, axis) {
    const c = Object.assign({ id }, crit[id]);
    const tag = T.tags[c.t] ? `<span class="tag">${esc(T.tags[c.t])}</span>` : "";
    return `<div class="hdr ${axis}">${badgeHtml(c)}<span class="hdr-text">${tag}<span class="hdr-label">${esc(c.l)}</span></span></div>`;
  }

  function photoHtml(p, size, cls = "ph") {
    const file = players[p][4];
    const name = players[p][1] || "?";
    const letter = esc(GAME.lang === "ar" ? name.replace(/^ال/, "").charAt(0) : name.charAt(0));
    if (!file) return `<span class="${cls} ini">${letter}</span>`;
    const src = assetUrl(file, size);
    return `<img class="${cls}" loading="lazy" alt="" referrerpolicy="no-referrer" data-letter="${letter}" src="${esc(src)}">`;
  }

  // ---------------------------------------------------------------- layout
  function shell() {
    const leagueLinks = LEAGUES.map((l) =>
      `<a href="${GAME.root}${l.href}" lang="${l.lang}" dir="${l.lang === "ar" ? "rtl" : "ltr"}" class="${l.id === GAME.league ? "on" : ""}" ${l.id === GAME.league ? 'aria-current="page"' : ""}>${esc(l.label)}</a>`
    ).join("");
    const modal = (id, title, body, sheetAttrs = "") => `
      <div class="modal" id="${id}" hidden role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <div class="sheet" ${sheetAttrs}>
          <div class="sheet-head">
            <h2 id="${id}-title">${title}</h2>
            <button class="icon-btn small" data-close aria-label="${T.close}">${ICONS.close}</button>
          </div>
          ${body}
        </div>
      </div>`;
    document.getElementById("app").innerHTML = `
      <header class="masthead">
        <div class="mast-row">
          <button class="icon-btn" id="btn-help" aria-label="${U.help}" title="${U.help}">${ICONS.help}</button>
          <div class="title">
            <h1 dir="auto">${esc(GAME.title)}</h1>
            <p class="edition" id="edition" ${UDIR}></p>
          </div>
          <div class="mast-actions">
            <button class="icon-btn" id="btn-stats" aria-label="${U.stats}" title="${U.stats}">${ICONS.stats}</button>
            <button class="icon-btn" id="btn-archive" aria-label="${U.archive}" title="${U.archive}">${ICONS.archive}</button>
          </div>
        </div>
        <nav class="leagues">${leagueLinks}</nav>
      </header>

      <main class="board">
        <p class="status" id="status">${T.loading}</p>
        <section class="album" id="album" hidden>
          <div class="grid" id="grid"></div>
        </section>
        <aside class="panel" id="panel" hidden ${UDIR}>
          <div class="meter">
            <div class="pips" id="pips" aria-hidden="true"></div>
            <p class="meter-text"><b id="guesses">9</b> ${U.guessesLeft}</p>
          </div>
          <div class="actions">
            <button class="btn primary" id="btn-results" hidden>${U.seeResult}</button>
            <button class="btn quiet" id="btn-giveup">${U.giveUp}</button>
          </div>
          <p class="next" id="next-panel" hidden></p>
        </aside>
      </main>

      <footer class="foot"><p>${T.dataFrom}</p><p class="foot-links">${T.footLinks}</p><p id="updated"></p></footer>

      <div class="modal search-modal" id="m-search" hidden role="dialog" aria-modal="true" aria-label="${T.searchPlaceholder}">
        <div class="sheet">
          <div class="sheet-head">
            <div class="pair" id="search-q"></div>
            <button class="icon-btn small" data-close aria-label="${T.close}">${ICONS.close}</button>
          </div>
          <input id="search-input" type="search" autocomplete="off" autocapitalize="off" spellcheck="false"
                 placeholder="${T.searchPlaceholder}" aria-controls="search-results"
                 aria-autocomplete="list" role="combobox" aria-expanded="false">
          <ul class="results" id="search-results" role="listbox"></ul>
        </div>
      </div>

      ${modal("m-answers", '<span class="pair" id="answers-q"></span>', '<p class="hint first" id="answers-count"></p><ul class="results answers" id="answers-list"></ul>')}
      ${modal("m-stats", U.stats, '<div id="stats-body"></div>', UDIR)}
      ${modal("m-help", U.help, `<ul class="help">${U.helpItems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="hint">${U.helpNote}</p>`, UDIR)}
      ${modal("m-archive", U.archive, '<ul class="archive" id="archive-list"></ul>', UDIR)}
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
    `;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 1800);
  }

  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    closeModals(true);
    const m = $(id);
    m.hidden = false;
    // the search box first (opens the phone keyboard), otherwise the close button
    const focusable = m.querySelector("input") || m.querySelector("[data-close]");
    if (focusable) setTimeout(() => focusable.focus(), 20);
  }
  function closeModals(silent) {
    document.querySelectorAll(".modal").forEach((m) => { m.hidden = true; });
    clearInterval(clockTimer);
    if (silent !== true && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---------------------------------------------------------------- render
  const TILT = [-2.2, 1.4, -0.8, 1.9, -1.6, 0.9, -2.6, 1.7, -0.6];

  // After the game: the most famous answer for each unsolved square, without
  // repeating a player (squares with the fewest answers choose first).
  let revealCache = null;
  function revealed() {
    const key = gridId() + JSON.stringify(state.cells);
    if (revealCache && revealCache.key === key) return revealCache.map;
    const taken = new Set(Object.values(state.cells));
    const open = [...Array(9).keys()].filter((i) => state.cells[i] === undefined)
      .map((i) => [i, answersFor(i)]).sort((a, b) => a[1].length - b[1].length);
    const map = {};
    for (const [i, ans] of open) {
      const p = ans.find((x) => !taken.has(x));
      map[i] = p !== undefined ? p : ans[0];
      taken.add(map[i]);
    }
    revealCache = { key, map };
    return map;
  }

  function cellHtml(i) {
    const p = state.cells[i];
    const label = crit[rowOf(i)].l + T.and + crit[colOf(i)].l;
    if (p === undefined) {
      // game over: an unsolved square shows its most famous correct answer
      const top = state.over ? revealed()[i] : undefined;
      if (top !== undefined) {
        return `<button class="sticker revealed" data-i="${i}" aria-label="${esc(label + ": " + players[top][1] + (T.topAnswer ? " (" + T.topAnswer + ")" : ""))}">
      <span class="sticker-photo">${photoHtml(top, 240)}</span>
      <span class="sticker-name">${esc(players[top][1])}</span>
      ${T.topAnswer ? `<span class="sticker-tag">${T.topAnswer}</span>` : ""}
    </button>`;
      }
      return `<button class="slot${state.over ? " over" : ""}" data-i="${i}" aria-label="${esc(label)}"><span class="slot-mark" aria-hidden="true">${state.over ? "?" : "+"}</span></button>`;
    }
    const placed = lastPlaced === i && !reduceMotion ? " placed" : "";
    return `<button class="sticker${placed}" data-i="${i}" style="--tilt:${TILT[i]}deg" aria-label="${esc(label + ": " + players[p][1])}" ${state.over ? "" : 'aria-disabled="true"'}>
      <span class="sticker-photo">${photoHtml(p, 240)}</span>
      <span class="sticker-name">${esc(players[p][1])}</span>
    </button>`;
  }

  function render() {
    // an empty column after the squares, as wide as the row headers, keeps the
    // 3x3 squares centred under the page title on wider screens
    const spacer = `<div class="spacer" aria-hidden="true"></div>`;
    let html = `<div class="corner" aria-hidden="true"></div>`;
    grid.cols.forEach((c) => { html += headerHtml(c, "col"); });
    html += spacer;
    for (let r = 0; r < 3; r++) {
      html += headerHtml(grid.rows[r], "row");
      for (let c = 0; c < 3; c++) html += cellHtml(r * 3 + c);
      html += spacer;
    }
    $("#grid").innerHTML = html;
    lastPlaced = null;

    $("#pips").innerHTML = Array.from({ length: TOTAL_GUESSES }, (_, k) =>
      `<span class="pip${k < state.guesses ? " left" : ""}"></span>`).join("");
    $("#guesses").textContent = state.guesses;
    $("#btn-giveup").hidden = state.over;
    $("#btn-results").hidden = !state.over;
    const next = $("#next-panel");
    next.hidden = !state.over || date !== cairoToday();
    if (!next.hidden) tickPanelClock();
  }

  function tickPanelClock() {
    clearInterval(tickPanelClock._t);
    const el = $("#next-panel");
    const tick = () => {
      const s = secondsToMidnight();
      el.innerHTML = `${U.nextGrid} <b dir="ltr">${fmtClock(s)}</b>`;
      if (s <= 1) setTimeout(() => location.reload(), 1500);
    };
    tick();
    tickPanelClock._t = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------- search
  function pairHtml(i) {
    const r = Object.assign({ id: rowOf(i) }, crit[rowOf(i)]);
    const c = Object.assign({ id: colOf(i) }, crit[colOf(i)]);
    return `<span class="pair-item">${badgeHtml(r)}<span>${esc(r.l)}</span></span><span class="pair-x" aria-hidden="true">×</span><span class="pair-item">${badgeHtml(c)}<span>${esc(c.l)}</span></span>`;
  }

  function openSearch(i) {
    activeCell = i;
    activeResult = -1;
    $("#search-q").innerHTML = pairHtml(i);
    const inp = $("#search-input");
    inp.value = "";
    $("#search-results").innerHTML = `<li class="none">${T.searchHint}</li>`;
    openModal("#m-search");
  }

  // Sound-alike search: Arabic typing finds a player stored with an English name
  // ("كين" finds Kane, "جوميز" finds Gomez). Both spellings become a rough
  // consonant skeleton and the typed words must start the name's words.
  const AR_SOUND = { "ب": "b", "پ": "b", "ف": "f", "ڤ": "f", "ت": "t", "ط": "t", "ث": "t", "د": "d", "ض": "d", "ذ": "d",
    "ج": "g", "غ": "g", "ك": "k", "خ": "k", "ق": "k", "س": "s", "ص": "s", "ز": "s", "ظ": "s", "ش": "s",
    "م": "m", "ن": "n", "ر": "r" };
  const LAT_SOUND = { b: "b", p: "b", f: "f", v: "f", t: "t", d: "d", g: "g", j: "g", k: "k", q: "k", s: "s", z: "s", m: "m", n: "n", r: "r" };
  const squeeze = (x) => x.replace(/(.)\1+/g, "$1");
  function soundAr(w) {
    w = w.replace(/تش/g, "ش");
    let out = "";
    for (const ch of w) out += AR_SOUND[ch] || "";
    return squeeze(out);
  }
  function soundLat(w) {
    w = w.replace(/ph/g, "f").replace(/th/g, "t").replace(/sh|ch/g, "s").replace(/ck|kh|qu/g, "k")
      .replace(/gh/g, "g").replace(/x/g, "ks").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k");
    let out = "";
    for (const ch of w) out += LAT_SOUND[ch] || "";
    return squeeze(out);
  }
  const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
  let soundNames = null;
  function soundOf(p) {
    if (!soundNames) {
      soundNames = players.map((pl) => norm(pl[2] || (hasArabic(pl[1]) ? "" : pl[1])).split(" ").map(soundLat).filter(Boolean));
    }
    return soundNames[p];
  }

  function search(q) {
    const tokens = norm(q).split(" ").filter(Boolean);
    if (!tokens.length || tokens.join("").length < 2) return null;
    const out = [];
    for (let p = 0; p < players.length && out.length < 300; p++) {
      const n = normNames[p];
      if (tokens.every((t) => n.includes(t))) out.push(p);
    }
    const direct = new Set(out);
    const sounds = GAME.soundSearch && hasArabic(q) ? tokens.map(soundAr).filter(Boolean) : [];
    if (sounds.join("").length >= 2) {
      for (let p = 0; p < players.length && out.length < 300; p++) {
        if (direct.has(p)) continue;
        const words = soundOf(p);
        if (words.length && sounds.every((t) => words.some((w) => w.startsWith(t)))) out.push(p);
      }
    }
    const first = tokens[0];
    const score = (p) => {
      if (!direct.has(p)) {        // sound-alike: whole-word matches before partial ones
        const words = soundOf(p);
        return sounds.every((t) => words.includes(t)) ? 3 : 4;
      }
      const n = normNames[p];
      if (n.startsWith(first)) return 0;
      if (n.includes(" " + first)) return 1;
      return 2;
    };
    out.sort((a, b) => score(a) - score(b) || a - b);
    return out.slice(0, 12);
  }

  function renderResults(q) {
    const list = $("#search-results");
    const res = search(q);
    activeResult = -1;
    if (res === null) { list.innerHTML = `<li class="none">${T.searchHint}</li>`; return; }
    if (!res.length) { list.innerHTML = `<li class="none">${T.noPlayer}</li>`; return; }
    list.innerHTML = res.map((p) => {
      const [, shown, en, , , year] = players[p];
      const isUsed = used(p);
      const sub = [en && en !== shown ? esc(en) : "", year ? T.born(year) : "", isUsed ? T.used : ""].filter(Boolean).join(" · ");
      return `<li role="option" aria-disabled="${isUsed}"><button type="button" data-p="${p}" ${isUsed ? "disabled" : ""}>
        ${photoHtml(p, 80)}<span class="who"><span class="who-name">${esc(shown)}</span><span class="who-sub">${sub}</span></span>
      </button></li>`;
    }).join("");
    $("#search-input").setAttribute("aria-expanded", "true");
    moveActive(0, true);
  }

  function moveActive(delta, reset) {
    const buttons = [...document.querySelectorAll("#search-results button:not([disabled])")];
    if (!buttons.length) return;
    activeResult = reset ? 0 : (activeResult + delta + buttons.length) % buttons.length;
    buttons.forEach((b, k) => b.classList.toggle("active", k === activeResult));
    buttons[activeResult].scrollIntoView({ block: "nearest" });
  }

  function guess(p) {
    if (state.over || activeCell === null || used(p)) return;
    const i = activeCell;
    state.guesses -= 1;
    const ok = sets[rowOf(i)].has(p) && sets[colOf(i)].has(p);
    if (ok) { state.cells[i] = p; lastPlaced = i; }
    if (state.guesses <= 0 || filledCount() === 9) state.over = true;
    save();
    closeModals();
    render();
    if (!ok) {
      const el = document.querySelector(`[data-i="${i}"]`);
      if (el && !reduceMotion) { el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 500); }
      toast(T.wrong);
    }
    if (state.over) setTimeout(() => showStats(), ok ? 700 : 900);
  }

  // ---------------------------------------------------------------- stats
  function computeStats() {
    const today = cairoToday();
    const days = Object.keys(GRIDS).filter((d) => d <= today).sort();
    let played = 0, perfect = 0, best = 0, run = 0;
    const finished = new Set();
    for (const d of days) {
      const s = readSaved(d);
      if (s && s.over) {
        finished.add(d);
        played += 1;
        if (filledCount(s) === 9) perfect += 1;
      }
    }
    for (const d of days) {
      run = finished.has(d) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    // current streak: ends today, or yesterday if today isn't finished yet
    let streak = 0;
    let d = finished.has(today) ? today : addDays(today, -1);
    while (finished.has(d)) { streak += 1; d = addDays(d, -1); }
    return { played, perfect, streak, best };
  }

  function shareText() {
    let rows = "";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) rows += state.cells[r * 3 + c] !== undefined ? "🟩" : "⬜";
      rows += "\n";
    }
    return `${GAME.title} #${grid.n}\n${U.shareLine(filledCount(), TOTAL_GUESSES - state.guesses)}\n${rows}‎${location.origin + location.pathname}‎`;
  }

  function showStats() {
    const st = computeStats();
    let today = "";
    if (state.over) {
      const squares = Array.from({ length: 9 }, (_, i) => {
        const p = state.cells[i];
        return p === undefined ? `<span class="mini-cell"></span>`
          : `<span class="mini-cell hit">${photoHtml(p, 80, "mini-ph")}</span>`;
      }).join("");
      today = `
        <section class="today">
          <h3>${U.todayResult}</h3>
          <div class="today-row">
            <div class="mini-grid">${squares}</div>
            <div class="today-score">
              <p class="big">${U.scoreLine(filledCount())}</p>
              <p>${U.triesLine(TOTAL_GUESSES - state.guesses)}</p>
            </div>
          </div>
          <div class="share-row">
            <button class="btn primary" id="btn-share">${U.shareResult}</button>
            <a class="btn whatsapp" id="btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText())}">${ICONS.whatsapp}<span>${U.whatsapp}</span></a>
          </div>
          <p class="hint">${U.tapCell}</p>
        </section>`;
    }
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    $("#stats-body").innerHTML = `
      ${today}
      <div class="stat-row">
        ${stat(st.played, U.played)}${stat(st.perfect, U.perfect)}${stat(st.streak, U.streak)}${stat(st.best, U.best)}
      </div>
      <p class="next" id="next-modal"></p>`;
    const share = $("#btn-share");
    if (share) share.addEventListener("click", doShare);
    openModal("#m-stats");
    const el = $("#next-modal");
    const tick = () => { el.innerHTML = `${U.nextGrid} <b dir="ltr">${fmtClock(secondsToMidnight())}</b>`; };
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  async function doShare() {
    const text = shareText();
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ text }); return; } catch (e) { /* cancelled: fall back to copying */ }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    toast(U.copied);
  }

  function showAnswers(i) {
    const ans = answersFor(i);
    const mine = state.cells[i];
    const shownTop = mine === undefined ? revealed()[i] : undefined;
    $("#answers-q").innerHTML = pairHtml(i);
    $("#answers-count").textContent = T.answersCount(ans.length);
    // every correct answer, most famous first; yours is highlighted
    $("#answers-list").innerHTML = ans.map((p) => {
      const [, name, en, , , year] = players[p];
      const sub = [
        p === mine ? `<b class="tag-mine">${T.yourAnswer}</b>` : p === shownTop && T.topAnswer ? `<b class="tag-top">${T.topAnswer}</b>` : "",
        en && en !== name ? esc(en) : "", year ? T.born(year) : "",
      ].filter(Boolean).join(" · ");
      return `<li class="${p === mine ? "mine" : ""}">${photoHtml(p, 80)}<span class="who"><span class="who-name">${esc(name)}</span><span class="who-sub">${sub}</span></span></li>`;
    }).join("");
    openModal("#m-answers");
    $("#answers-list").scrollTop = 0;
  }

  function showArchive() {
    const today = cairoToday();
    const dates = Object.keys(GRIDS).filter((d) => d <= today).sort().reverse();
    $("#archive-list").innerHTML = dates.length ? dates.map((d) => {
      const s = readSaved(d);
      const mark = s && s.over ? U.archiveDone(filledCount(s)) : s ? U.archiveStarted : "";
      return `<li><a href="?d=${d}" class="${d === date ? "current" : ""}"><span class="arc-n">#${GRIDS[d].n}</span><span class="arc-d">${esc(prettyDate(d))}</span><span class="arc-m">${mark}</span></a></li>`;
    }).join("") : `<li class="none">${U.archiveEmpty}</li>`;
    openModal("#m-archive");
  }

  // ---------------------------------------------------------------- events
  function bind() {
    $("#grid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]");
      if (!b) return;
      const i = +b.dataset.i;
      if (state.over) showAnswers(i);
      else if (state.cells[i] === undefined) openSearch(i);
    });
    const inp = $("#search-input");
    inp.addEventListener("input", () => renderResults(inp.value));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const b = document.querySelector("#search-results button.active");
        if (b) guess(+b.dataset.p);
      }
    });
    $("#search-results").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]");
      if (b && !b.disabled) guess(+b.dataset.p);
    });
    document.querySelectorAll(".modal").forEach((m) => {
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModals(); });
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });
    // A photo or flag that fails to load is swapped for a letter / globe.
    document.addEventListener("error", (e) => {
      const img = e.target;
      if (img.tagName !== "IMG") return;
      if (img.classList.contains("club-logo")) {
        const box = img.closest(".badge");
        let info = {};
        try { info = JSON.parse(box.dataset.crest || "{}"); } catch (err) { /* ignore */ }
        const corner = box.querySelector(".flag.corner");
        const tmp = document.createElement("span");
        tmp.innerHTML = crestHtml(info.l || "?", info.c, corner ? corner.outerHTML : "");
        box.replaceWith(tmp.firstElementChild);
        return;
      }
      if (img.classList.contains("flag")) {
        if (img.classList.contains("corner")) { img.remove(); return; }
        const box = img.closest(".badge");
        if (box) { box.className = "badge icon"; box.innerHTML = ICONS.globe; }
        return;
      }
      const span = document.createElement("span");
      span.className = img.className + " ini";
      span.textContent = img.dataset.letter || "?";
      img.replaceWith(span);
    }, true);
    $("#btn-help").addEventListener("click", () => openModal("#m-help"));
    $("#btn-stats").addEventListener("click", () => { if (grid) showStats(); });
    $("#btn-archive").addEventListener("click", () => { if (GRIDS) showArchive(); });
    $("#btn-results").addEventListener("click", showStats);
    $("#btn-giveup").addEventListener("click", () => {
      if (!confirm(U.confirmGiveUp)) return;
      state.over = true; save(); render(); showStats();
    });
  }

  // ---------------------------------------------------------------- start
  function fail(msg) { $("#status").textContent = msg; $("#status").hidden = false; }

  // installable app: the service worker caches files so the game also opens offline
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  async function start() {
    document.body.dataset.league = GAME.league;
    shell();
    bind();
    try {
      const [d, g] = await Promise.all([
        fetch(GAME.data + "data.json", { cache: "no-cache" }).then((r) => r.json()),
        fetch(GAME.data + "grids.json", { cache: "no-cache" }).then((r) => r.json()),
      ]);
      DATA = d; GRIDS = g;
    } catch (e) {
      return fail(T.loadFail);
    }
    players = DATA.players;
    crit = DATA.criteria;
    sets = {};
    for (const id in crit) sets[id] = new Set(crit[id].m);
    normNames = players.map((p) => norm(p[1] + " " + (p[2] || "") + " " + (p[6] || "")));
    players.forEach((p, i) => { byId[p[0]] = i; });

    const today = cairoToday();
    const asked = new URLSearchParams(location.search).get("d");
    const available = Object.keys(GRIDS).filter((x) => x <= today).sort();
    if (!available.length) return fail(T.noGrid);
    date = asked && GRIDS[asked] && asked <= today ? asked : available[available.length - 1];
    grid = GRIDS[date];
    // grids made before the national-team criterion was renamed
    const fix = (c) => (c === "nt:egypt" && !crit[c] ? "nt:home" : c);
    grid.rows = grid.rows.map(fix);
    grid.cols = grid.cols.map(fix);
    if (![...grid.rows, ...grid.cols].every((id) => crit[id])) return fail(T.gridGone);

    load();
    $("#edition").innerHTML = U.edition(grid.n, esc(prettyDate(date)));
    $("#updated").textContent = DATA.updated ? T.updated(DATA.updated) : "";
    $("#status").hidden = true;
    $("#album").hidden = false;
    $("#panel").hidden = false;
    render();
    if (!store.get(GAME.key + ":seen-help")) { store.set(GAME.key + ":seen-help", 1); openModal("#m-help"); }
  }

  start();
})();
