#!/usr/bin/env python3
"""
Builds the data for the football grid games (Egyptian league + English Premier League).

For each league:
1. Pulls players who played for the league's clubs from Wikidata (free, no API key).
2. Turns them into criteria (clubs, national team, nationality, played in country X,
   position, awards).
3. Generates one 3x3 grid per day, making sure every cell has enough answers.
4. Finds extra photos (Wikipedia, Commons, TheSportsDB) for players Wikidata has none for.

Outputs (per league, in its out_dir):
  data.json         players + criteria (what the site loads)
  grids.json        one grid per date (past dates are never changed)
  photo_cache.json  photo lookups, so each player is only searched once

Only uses the Python standard library, so it runs on GitHub Actions as-is.

Usage:
  python scraper/build_data.py                         # all leagues
  python scraper/build_data.py --league epl            # one league
  python scraper/build_data.py --league egypt --raw-out raw.json   # also save the raw download
  python scraper/build_data.py --league egypt --raw-in raw.json    # rebuild offline
"""
import argparse
import datetime as dt
import json
import math
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "config.json")

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "FootballGridGame/1.0 (fan-made football quiz; python-urllib)"

FEMALE = "Q6581072"
FOOTBALLER = "Q937857"
NATIONAL_TEAM_CLASS = "Q6979593"
CLUB_CLASSES = ["Q476028", "Q847017", "Q12973014"]  # football club, sports club, sports team
POSITION_ROOTS = {"Q201330": "gk", "Q336286": "df", "Q193592": "mf", "Q280658": "fw"}
NOT_FOOTBALL = ("handball", "basketball", "volleyball", "futsal", "beach soccer", "water polo",
                "لكرة اليد", "لكرة السلة", "للكرة الطائرة", "لكرة الطائرة", "لكرة الصالات")

TEXT = {
    "ar": {
        "pos": {"gk": "حارس مرمى", "df": "مدافع", "mf": "لاعب وسط", "fw": "مهاجم"},
        "abroad": "لعب في {}",
        "nat": "من {}",
    },
    "en": {
        "pos": {"gk": "Goalkeeper", "df": "Defender", "mf": "Midfielder", "fw": "Forward"},
        "abroad": "Played in {}",
        "nat": "{}",
    },
}

COMMON_DEFAULTS = {
    "exclude": [],           # criterion ids to never use, e.g. "award:Q123"
    "labels": {},            # criterion id -> label override
    "min_cell": 3,           # minimum valid answers per cell
    "min_club": 10,          # min players for a league club to become a criterion
    "min_foreign_club": 8,   # same for a club outside the league's country
    "min_country": 8,        # nationality criteria
    "min_abroad": 15,        # played-in-country criteria
    "min_position": 8,
    "min_award": 6,
    "days_ahead": 90,
    "photo_sources": ["commons_category", "thesportsdb"],  # extra photo sources, in order
    "badge_sources": ["wikidata", "thesportsdb"],  # club crest sources, in order
    "photo_retry_days": 30,      # how long before re-checking a player with no photo
    "photo_lookup_limit": 2000,  # max new photo lookups per run (most famous first)
    "min_birth_year": None,      # ignore players born before this year
    "min_links": 0,              # ignore players with fewer Wikipedia articles than this
}

LEAGUES = {
    "egypt": {
        "lang": "ar",
        "out_dir": "data",
        "league_qids": [],
        "league_label_en": "Egyptian Premier League",
        "home_countries": ["Q79"],
        "clubs_by_country": True,       # every Egyptian club counts as a league club
        "extra_player_country": "Q79",  # also include Egyptian footballers found directly
        "national_team_country": "Q79",
        "national_team_label": "منتخب مصر",
        # Egyptian players get no nationality criterion (UAR / Ottoman Empire count as Egypt)
        "skip_nationalities": ["Q79", "Q170468", "Q12560"],
        "wikipedia_photo_wikis": ["en.wikipedia.org", "ar.wikipedia.org"],
        "start_date": "2026-10-08",
        "salt": "egypt-grid",
    },
    "epl": {
        "lang": "en",
        "out_dir": "data/epl",
        "league_qids": ["Q9448"],          # Premier League
        "league_label_en": "Premier League",
        "home_countries": ["Q145", "Q21", "Q25"],  # United Kingdom, England, Wales
        "clubs_by_country": False,         # only clubs that played in the Premier League
        "extra_player_country": None,
        "national_team_country": None,
        "national_team_label": None,
        "skip_nationalities": [],
        "wikipedia_photo_wikis": ["en.wikipedia.org"],
        "min_birth_year": 1960,
        "min_links": 2,
        "min_cell": 4,
        "min_club": 15,
        "min_foreign_club": 20,
        "min_country": 15,
        "min_abroad": 25,
        "min_award": 10,
        "photo_lookup_limit": 700,
        "start_date": "2026-10-08",
        "salt": "epl-grid",
    },
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- Wikidata

def sparql(query, retries=5):
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                ENDPOINT,
                data=body,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/sparql-results+json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                rows = json.load(r)["results"]["bindings"]
            time.sleep(1)  # be polite
            return rows
        except Exception as e:  # noqa: BLE001
            wait = 15 * (attempt + 1)
            log(f"  query failed ({e}); retry in {wait}s")
            time.sleep(wait)
    raise RuntimeError("Wikidata query kept failing")


def qid(binding):
    return binding["value"].rsplit("/", 1)[-1]


def val(row, key):
    return row[key]["value"] if key in row else None


def values(ids):
    return " ".join("wd:" + i for i in ids)


def chunks(seq, n):
    seq = list(seq)
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def try_query(name, query):
    try:
        rows = sparql(query)
        log(f"  {name}: {len(rows)} rows")
        return rows
    except RuntimeError:
        log(f"  {name}: skipped (failed)")
        return []


def find_league_clubs(cfg):
    clubs = set()
    if cfg["clubs_by_country"]:
        for country in cfg["home_countries"]:
            for cls in CLUB_CLASSES:
                rows = try_query(f"clubs {cls}", f"""
                    SELECT DISTINCT ?c WHERE {{ ?c wdt:P17 wd:{country} ; wdt:P31/wdt:P279* wd:{cls} . }}""")
                clubs |= {qid(r["c"]) for r in rows}

    leagues = set(cfg["league_qids"])
    if cfg.get("league_label_en"):
        country_filter = " UNION ".join(f"{{ ?l wdt:P17 wd:{c} }}" for c in cfg["home_countries"])
        rows = try_query("league by name", f"""
            SELECT DISTINCT ?l WHERE {{
              ?l rdfs:label "{cfg['league_label_en']}"@en . {country_filter}
            }}""")
        leagues |= {qid(r["l"]) for r in rows}
    if leagues:
        rows = try_query("league clubs", f"""
            SELECT DISTINCT ?c WHERE {{
              VALUES ?l {{ {values(sorted(leagues))} }}
              {{ ?c wdt:P118 ?l }} UNION {{ ?s wdt:P3450 ?l . ?s wdt:P1923 ?c }}
            }}""")
        clubs |= {qid(r["c"]) for r in rows}
    log(f"  {len(clubs)} league clubs")
    return clubs


def fetch_raw(cfg):
    log("Finding league clubs...")
    clubs = find_league_clubs(cfg)

    log("Finding players...")
    players = set()
    batch_size = 80 if cfg["clubs_by_country"] else 8  # big clubs have thousands of players
    for batch in chunks(sorted(clubs), batch_size):
        rows = try_query("club players", f"""
            SELECT DISTINCT ?p WHERE {{
              VALUES ?c {{ {values(batch)} }}
              ?p p:P54/ps:P54 ?c ; wdt:P31 wd:Q5 .
            }}""")
        players |= {qid(r["p"]) for r in rows}
    if cfg.get("extra_player_country"):
        rows = try_query("national footballers", f"""
            SELECT DISTINCT ?p WHERE {{
              ?p wdt:P106 wd:{FOOTBALLER} ; wdt:P27 wd:{cfg['extra_player_country']} . }}""")
        players |= {qid(r["p"]) for r in rows}
    log(f"  {len(players)} candidate players")

    raw = {"fetched": dt.date.today().isoformat(), "players": {}, "items": {},
           "position_roots": {}, "national_team": [], "league_clubs": sorted(clubs)}
    P = raw["players"]
    for p in players:
        P[p] = {"en": None, "ar": None, "links": 0, "female": False,
                "teams": [], "cit": [], "sport": [], "pos": [], "awards": []}

    log("Player names...")
    for batch in chunks(sorted(players), 150):
        rows = try_query("labels", f"""
            SELECT ?p ?en ?ar ?arz ?links ?sex ?img ?birth ?cat WHERE {{
              VALUES ?p {{ {values(batch)} }}
              OPTIONAL {{ ?p rdfs:label ?en FILTER(lang(?en)="en") }}
              OPTIONAL {{ ?p rdfs:label ?ar FILTER(lang(?ar)="ar") }}
              OPTIONAL {{ ?p rdfs:label ?arz FILTER(lang(?arz)="arz") }}
              OPTIONAL {{ ?p wikibase:sitelinks ?links }}
              OPTIONAL {{ ?p wdt:P21 ?sex }}
              OPTIONAL {{ ?p wdt:P18 ?img }}
              OPTIONAL {{ ?p wdt:P569 ?birth }}
              OPTIONAL {{ ?p wdt:P373 ?cat }}
            }}""")
        for r in rows:
            d = P[qid(r["p"])]
            d["en"] = d["en"] or val(r, "en")
            d["ar"] = d["ar"] or val(r, "ar") or val(r, "arz")
            d["links"] = int(val(r, "links") or 0)
            if val(r, "img") and not d.get("img"):
                # Commons file name, e.g. "Mohamed Salah 2018.jpg"
                d["img"] = urllib.parse.unquote(val(r, "img").rsplit("/", 1)[-1])
            if val(r, "birth") and not d.get("birth"):
                d["birth"] = val(r, "birth")[:10]  # YYYY-MM-DD
            if val(r, "cat") and not d.get("cat"):
                d["cat"] = val(r, "cat")  # Commons category name
            if val(r, "sex") and qid(r["sex"]) == FEMALE:
                d["female"] = True

    # Drop players we will never use before the expensive queries.
    min_year, min_links = cfg.get("min_birth_year"), cfg.get("min_links") or 0
    for p in list(P):
        d = P[p]
        born = int(d["birth"][:4]) if d.get("birth", "")[:4].lstrip("-").isdigit() else None
        too_old = min_year and (born is None or born < min_year)
        if d["female"] or d["links"] < min_links or too_old or not (d["en"] or d["ar"]):
            del P[p]
    log(f"  {len(P)} players after filters")

    log("Player careers...")
    for batch in chunks(sorted(P), 150):
        rows = try_query("teams", f"""
            SELECT ?p ?t WHERE {{
              VALUES ?p {{ {values(batch)} }}
              ?p p:P54 ?s . ?s ps:P54 ?t .
              FILTER NOT EXISTS {{ ?s wikibase:rank wikibase:DeprecatedRank }}
            }}""")
        for r in rows:
            d = P[qid(r["p"])]
            t = qid(r["t"])
            if t not in d["teams"]:
                d["teams"].append(t)

        rows = try_query("props", f"""
            SELECT ?p ?prop ?v WHERE {{
              VALUES ?p {{ {values(batch)} }}
              VALUES ?prop {{ wdt:P27 wdt:P1532 wdt:P413 wdt:P166 }}
              ?p ?prop ?v .
            }}""")
        key = {"P27": "cit", "P1532": "sport", "P413": "pos", "P166": "awards"}
        for r in rows:
            k = key[qid(r["prop"])]
            d = P[qid(r["p"])]
            v = qid(r["v"])
            if v not in d[k]:
                d[k].append(v)

    log("Extra photos from Wikipedia articles...")
    fetch_page_images(raw, cfg["wikipedia_photo_wikis"])

    log("Team / country / award details...")
    item_ids = set()
    for d in P.values():
        item_ids |= set(d["teams"]) | set(d["cit"]) | set(d["sport"]) | set(d["awards"])
    fetch_items(raw, item_ids)
    countries = {c for i in raw["items"].values() for c in i["country"]}
    if cfg.get("national_team_country"):
        countries.add(cfg["national_team_country"])
    countries -= set(raw["items"])
    fetch_items(raw, countries)

    positions = {p for d in P.values() for p in d["pos"]}
    roots = values(POSITION_ROOTS)
    for batch in chunks(sorted(positions), 200):
        rows = try_query("positions", f"""
            SELECT ?pos ?root WHERE {{
              VALUES ?pos {{ {values(batch)} }} VALUES ?root {{ {roots} }}
              ?pos wdt:P279* ?root .
            }}""")
        for r in rows:
            raw["position_roots"][qid(r["pos"])] = POSITION_ROOTS[qid(r["root"])]

    nt = cfg.get("national_team_country")
    if nt:
        rows = try_query("national team", f"""
            SELECT DISTINCT ?t WHERE {{
              ?t wdt:P31 wd:{NATIONAL_TEAM_CLASS} . {{ ?t wdt:P17 wd:{nt} }} UNION {{ ?t wdt:P1532 wd:{nt} }}
            }}""")
        raw["national_team"] = sorted({qid(r["t"]) for r in rows})
    return raw


def wiki_api(host, params, retries=4):
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            time.sleep(0.3)
            return data
        except Exception as e:  # noqa: BLE001
            log(f"  wiki api failed ({e}); retrying")
            time.sleep(5 * (attempt + 1))
    return {}


JUNK_IMAGE = re.compile(r"flag|logo|crest|coat[_ ]of[_ ]arms|emblem|map|kit|badge|stadium|trophy|cup", re.I)


def looks_like_photo(url):
    """Skip flags, club logos and other non-portrait lead images."""
    path = urllib.parse.unquote(url.split("?", 1)[0])
    name = path.rsplit("/", 1)[-1]
    return not (".svg" in path.lower() or JUNK_IMAGE.search(name))


def parse_page_images(resp, title_to_pid):
    """Map a Wikipedia pageimages response back to player ids -> thumbnail URL."""
    q = resp.get("query", {})
    alias = {}
    for n in q.get("normalized", []) + q.get("redirects", []):
        alias[n["to"]] = n["from"]
    found = {}
    for page in q.get("pages", []):
        thumb = (page.get("thumbnail") or {}).get("source")
        if not thumb or not looks_like_photo(thumb):
            continue
        title = page.get("title")
        pid = title_to_pid.get(title) or title_to_pid.get(alias.get(title, ""))
        if not pid:
            # follow a chain like normalized -> redirect
            pid = title_to_pid.get(alias.get(alias.get(title, ""), ""))
        if pid:
            found[pid] = thumb
    return found


def fetch_page_images(raw, wikis):
    """For players with no Wikidata photo, use the free lead image of their Wikipedia article."""
    total = 0
    for wiki in wikis:
        missing = [p for p, d in raw["players"].items() if not d.get("img")]
        title_to_pid = {}
        for batch in chunks(sorted(missing), 150):
            rows = try_query(f"{wiki} titles", f"""
                SELECT ?p ?title WHERE {{
                  VALUES ?p {{ {values(batch)} }}
                  ?a schema:about ?p ; schema:isPartOf <https://{wiki}/> ; schema:name ?title .
                }}""")
            for r in rows:
                title_to_pid[val(r, "title")] = qid(r["p"])
        for batch in chunks(sorted(title_to_pid), 50):
            resp = wiki_api(wiki, {"action": "query", "prop": "pageimages", "piprop": "thumbnail",
                                   "pithumbsize": "240", "pilicense": "free", "redirects": "1",
                                   "titles": "|".join(batch)})
            for pid, url in parse_page_images(resp, title_to_pid).items():
                if not raw["players"][pid].get("img"):
                    raw["players"][pid]["img"] = url
                    total += 1
    log(f"  {total} extra photos")


def local_photo(pid):
    """A photo you add yourself: photos/<QID>.jpg (or .png / .webp) overrides everything.
    The path is relative to the site root; the page adds the right prefix."""
    for ext in ("jpg", "jpeg", "png", "webp"):
        if os.path.exists(os.path.join(ROOT, "photos", f"{pid}.{ext}")):
            return f"photos/{pid}.{ext}"
    return None


def local_badge(qid_):
    """A crest you add yourself: badges/<QID>.png (or .svg / .webp / .jpg) overrides everything."""
    for ext in ("png", "svg", "webp", "jpg"):
        if os.path.exists(os.path.join(ROOT, "badges", f"{qid_}.{ext}")):
            return f"badges/{qid_}.{ext}"
    return None


def fetch_items(raw, ids):
    for batch in chunks(sorted(ids), 200):
        rows = try_query("items", f"""
            SELECT ?i ?en ?ar ?arz ?c ?t ?flag ?hex ?logo WHERE {{
              VALUES ?i {{ {values(batch)} }}
              OPTIONAL {{ ?i rdfs:label ?en FILTER(lang(?en)="en") }}
              OPTIONAL {{ ?i rdfs:label ?ar FILTER(lang(?ar)="ar") }}
              OPTIONAL {{ ?i rdfs:label ?arz FILTER(lang(?arz)="arz") }}
              OPTIONAL {{ ?i wdt:P17 ?c }}
              OPTIONAL {{ ?i wdt:P31 ?t }}
              OPTIONAL {{ ?i wdt:P41 ?flag }}
              OPTIONAL {{ ?i wdt:P6364 ?col . ?col wdt:P465 ?hex }}
              OPTIONAL {{ ?i wdt:P154 ?logo }}
            }}""")
        for r in rows:
            i = raw["items"].setdefault(qid(r["i"]), {"en": None, "ar": None, "country": [], "types": []})
            i["en"] = i["en"] or val(r, "en")
            i["ar"] = i["ar"] or val(r, "ar") or val(r, "arz")
            if "c" in r and qid(r["c"]) not in i["country"]:
                i["country"].append(qid(r["c"]))
            if "t" in r and qid(r["t"]) not in i["types"]:
                i["types"].append(qid(r["t"]))
            if val(r, "logo") and not i.get("logo"):
                i["logo"] = urllib.parse.unquote(val(r, "logo").rsplit("/", 1)[-1])
            if val(r, "flag") and not i.get("flag"):
                i["flag"] = urllib.parse.unquote(val(r, "flag").rsplit("/", 1)[-1])
            hexv = (val(r, "hex") or "").lstrip("#").upper()
            if re.fullmatch(r"[0-9A-F]{6}", hexv):
                i.setdefault("colors", [])
                if hexv not in i["colors"]:
                    i["colors"].append(hexv)


# ---------------------------------------------------------------- criteria

def name_of(item, lang):
    item = item or {}
    return (item.get("ar") or item.get("en")) if lang == "ar" else (item.get("en") or item.get("ar"))


def club_name(item, lang):
    """Short club name: 'نادي الزمالك' -> 'الزمالك', 'Arsenal F.C.' -> 'Arsenal'."""
    name = name_of(item, lang) or ""
    name = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    if lang == "ar":
        for prefix in ("النادي ", "نادي "):
            if name.startswith(prefix) and len(name) > len(prefix) + 2:
                name = name[len(prefix):]
                break
    else:
        name = re.sub(r"\s+(A\.?\s?F\.?\s?C\.?|F\.?\s?C\.?|C\.?\s?F\.?|S\.?\s?C\.?)$", "", name)
        name = re.sub(r"^(A\.?F\.?C\.?|F\.?C\.?)\s+(?=\S{3,})", "", name)  # 'FC Porto' -> 'Porto'
        name = re.sub(r"\s+(Club de F[uú]tbol|Futbol Club|Football Club)$", "", name)  # 'Real Madrid Club de Fútbol'

    return name.strip()


def build_data(raw, cfg):
    lang = cfg["lang"]
    txt = TEXT[lang]
    items = raw["items"]
    nt_teams = set(raw.get("national_team") or raw.get("egypt_nt") or [])
    league_clubs = set(raw.get("league_clubs") or raw.get("egypt_clubs") or [])
    home = set(cfg["home_countries"])
    skip_nats = set(cfg["skip_nationalities"])

    def is_national(t):
        it = items.get(t, {})
        en = (it.get("en") or "").lower()
        return (t in nt_teams or NATIONAL_TEAM_CLASS in it.get("types", [])
                or "national" in en or "olympic" in en or "under-" in en)

    def is_womens(t):
        """Women's teams and non-football sections (handball, basketball...)."""
        it = items.get(t, {})
        en = (it.get("en") or "").lower()
        ar = it.get("ar") or ""
        return ("women" in en or "ladies" in en
                or any(w in en or w in ar for w in NOT_FOOTBALL))

    def in_home(t):
        return not home.isdisjoint(items.get(t, {}).get("country", []))

    def is_league_club(t):
        if is_national(t) or is_womens(t):
            return False
        return t in league_clubs or (cfg["clubs_by_country"] and in_home(t))

    # Keep players who played for at least one league club.
    kept = [pid for pid, d in raw["players"].items()
            if not d["female"] and (d["ar"] or d["en"]) and any(is_league_club(t) for t in d["teams"])]
    # Most famous first: index = fame rank (used for rarity).
    kept.sort(key=lambda p: (-raw["players"][p]["links"], raw["players"][p]["en"] or ""))
    index = {p: i for i, p in enumerate(kept)}

    members = defaultdict(set)
    meta = {}

    for pid in kept:
        d = raw["players"][pid]
        i = index[pid]
        for t in d["teams"]:
            if t in nt_teams:
                members["nt:home"].add(i)
                meta["nt:home"] = ("nt", cfg["national_team_label"])
            elif is_national(t) or is_womens(t):
                continue
            elif is_league_club(t):
                cid = f"club:{t}"
                members[cid].add(i)
                meta[cid] = ("club", club_name(items.get(t), lang) or t)
            elif in_home(t):
                continue  # a non-league club in the same country (e.g. lower English divisions)
            else:
                cid = f"fclub:{t}"
                members[cid].add(i)
                countries = items.get(t, {}).get("country", [])
                where = name_of(items.get(countries[0]), lang) if countries else None
                label = club_name(items.get(t), lang) or t
                meta[cid] = ("fclub", f"{label} ({where})" if where else label)
                for c in countries:
                    if c not in home:
                        aid = f"abroad:{c}"
                        members[aid].add(i)
                        meta[aid] = ("abroad", txt["abroad"].format(name_of(items.get(c), lang) or c))
        nats = d["sport"] or d["cit"]
        if skip_nats.isdisjoint(nats):
            for c in nats:
                nid = f"nat:{c}"
                members[nid].add(i)
                meta[nid] = ("nat", txt["nat"].format(name_of(items.get(c), lang) or c))
        for pos in {raw["position_roots"].get(p) for p in d["pos"]} - {None}:
            members[f"pos:{pos}"].add(i)
            meta[f"pos:{pos}"] = ("pos", txt["pos"][pos])
        for a in d["awards"]:
            aid = f"award:{a}"
            members[aid].add(i)
            meta[aid] = ("award", name_of(items.get(a), lang) or a)

    def flag_of(country):
        return (items.get(country) or {}).get("flag") or ""

    def extras(cid):
        """Badge info for the page: a flag file (Commons) and/or club colours."""
        typ, _, ref = cid.partition(":")
        out = {}
        if typ in ("nat", "abroad"):
            out["f"] = flag_of(ref)
        elif typ == "nt":
            out["f"] = flag_of(cfg.get("national_team_country") or "")
        elif typ in ("club", "fclub"):
            colors = (items.get(ref) or {}).get("colors") or []
            if colors:
                out["c"] = colors[:2]
            badge = local_badge(ref)
            if not badge and "wikidata" in cfg.get("badge_sources", []):
                badge = (items.get(ref) or {}).get("logo") or ""
            if badge:
                out["b"] = badge
            if typ == "fclub":
                countries = (items.get(ref) or {}).get("country") or []
                out["f"] = flag_of(countries[0]) if countries else ""
        return {k: v for k, v in out.items() if v}

    minimum = {"club": cfg["min_club"], "fclub": cfg["min_foreign_club"], "nt": cfg["min_club"],
               "nat": cfg["min_country"], "abroad": cfg["min_abroad"],
               "pos": cfg["min_position"], "award": cfg["min_award"]}
    criteria = {}
    for cid, mset in members.items():
        typ, label = meta[cid]
        if len(mset) < minimum[typ]:
            continue
        criteria[cid] = {"t": typ, "l": label, **extras(cid), "m": sorted(mset)}
    apply_config(criteria, cfg)

    players_out = []
    for pid in kept:
        d = raw["players"][pid]
        img = local_photo(pid) or d.get("img") or ""
        shown = (d["ar"] or d["en"]) if lang == "ar" else (d["en"] or d["ar"])
        born = d.get("birth") or ""
        year = int(born[:4]) if born[:4].isdigit() else 0
        players_out.append([pid, shown, d["en"] or "", d["links"], img, year])

    log(f"{len(players_out)} players, {len(criteria)} criteria "
        f"({sum(1 for c in criteria.values() if c['t'] == 'club')} league clubs)")
    return {"updated": raw["fetched"], "players": players_out, "criteria": criteria}


def allowed(cid, cfg):
    """False for criteria switched off in config.json (exclude list, awards allow-list)."""
    if cid in cfg.get("exclude", []):
        return False
    allow = cfg.get("allow_awards")
    if cid.startswith("award:") and allow is not None and cid not in allow:
        return False
    return True


def apply_config(criteria, cfg):
    """Remove switched-off criteria and apply label overrides, in place."""
    labels = dict(cfg.get("labels", {}))
    if "nt:egypt" in labels:  # old config name
        labels.setdefault("nt:home", labels["nt:egypt"])
    for cid in list(criteria):
        if not allowed(cid, cfg):
            del criteria[cid]
        elif cid in labels:
            criteria[cid]["l"] = labels[cid]


# ---------------------------------------------------------------- grids

WEIGHT = {"club": 3.0, "fclub": 0.6, "nt": 2.0, "nat": 0.8, "abroad": 0.9, "pos": 0.6, "award": 0.6}


def grid_ok(rows, cols, sets, min_cell):
    for r in rows:
        for c in cols:
            if len(sets[r] & sets[c]) < min_cell:
                return False
    return True


def type_ok(chosen, crit):
    types = [crit[c]["t"] for c in chosen]
    return (types.count("club") >= 3 and types.count("pos") <= 1 and types.count("award") <= 1
            and types.count("nat") + types.count("abroad") <= 2 and types.count("fclub") <= 1)


def fame_weights(crit, players):
    """How likely each criterion is to be picked.

    Clubs are weighted by how famous their best-known players are, so Manchester United
    or Al Ahly come up more often than clubs that merely had many players.
    """
    ids = sorted(crit)
    links = [p[3] for p in players] if players else None
    out = []
    for c in ids:
        typ, members = crit[c]["t"], crit[c]["m"]
        if links and typ in ("club", "fclub", "nt"):
            # median fame of the club's 100 best-known players, so a club with many
            # forgettable players doesn't outrank one with famous ones
            top = sorted((links[i] for i in members), reverse=True)[:100]
            score = (top[len(top) // 2] + 1) ** 1.5
        else:
            score = math.sqrt(len(members))
        out.append(WEIGHT[typ] * score)
    if links:  # keep the two kinds of score on a similar scale
        size_based = [w for c, w in zip(ids, out) if crit[c]["t"] not in ("club", "fclub", "nt")]
        fame_based = [w for c, w in zip(ids, out) if crit[c]["t"] in ("club", "fclub", "nt")]
        if size_based and fame_based:
            k = (sum(size_based) / len(size_based)) / (sum(fame_based) / len(fame_based))
            out = [w * k if crit[c]["t"] in ("club", "fclub", "nt") else w for c, w in zip(ids, out)]
    return ids, out


def make_grid(date, crit, sets, cfg, recent, weighting):
    rng = random.Random(f"{cfg['salt']}:{date}")
    ids, weights = weighting
    for min_cell in (cfg["min_cell"], max(2, cfg["min_cell"] - 1), 1):
        for _ in range(30000):
            chosen = []
            while len(chosen) < 6:
                c = rng.choices(ids, weights)[0]
                if c not in chosen:
                    chosen.append(c)
            if not type_ok(chosen, crit):
                continue
            key = frozenset(chosen)
            if key in recent:
                continue
            rows, cols = chosen[:3], chosen[3:]
            if grid_ok(rows, cols, sets, min_cell):
                return {"rows": rows, "cols": cols}
    return None


def build_grids(data, cfg, existing, today, keep_future=True):
    """keep_future=False regenerates every grid after today (past days and today stay as they were)."""
    crit = data["criteria"]
    sets = {c: set(v["m"]) for c, v in crit.items()}
    weighting = fame_weights(crit, data.get("players"))
    start = dt.date.fromisoformat(cfg["start_date"])
    end = today + dt.timedelta(days=cfg["days_ahead"])
    out = {}
    recent = []
    day = start
    while day <= end:
        ds = day.isoformat()
        old = existing.get(ds)
        if old:  # renamed criterion id
            old = {k: [("nt:home" if c == "nt:egypt" else c) for c in old[k]] for k in ("rows", "cols")}
        n = (day - start).days + 1
        keep = day <= today or keep_future
        if old and (day < today or (keep and all(c in crit for c in old["rows"] + old["cols"])
                                    and grid_ok(old["rows"], old["cols"], sets, cfg["min_cell"]))):
            g = {"rows": old["rows"], "cols": old["cols"]}
        elif day < today:
            day += dt.timedelta(days=1)
            continue  # never invent grids for the past
        else:
            g = make_grid(ds, crit, sets, cfg, set(recent[-60:]), weighting)
            if g is None:
                log(f"could not build a grid for {ds}")
                day += dt.timedelta(days=1)
                continue
        g["n"] = n
        out[ds] = g
        recent.append(frozenset(g["rows"] + g["cols"]))
        day += dt.timedelta(days=1)
    return out


def cairo_today():
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("Africa/Cairo")).date()
    except Exception:  # noqa: BLE001
        return (dt.datetime.utcnow() + dt.timedelta(hours=2)).date()


# ---------------------------------------------------------------- extra photos
#
# Results are cached in <out_dir>/photo_cache.json so each player is only looked up once
# (players with no photo are re-checked every `photo_retry_days`).

SPORTSDB = "https://www.thesportsdb.com/api/v1/json/123/searchplayers.php"
PHOTO_LOGIC_VERSION = 2  # bump to re-check cached "no photo" results after matching changes


def http_json(url, retries=3, pause=0.0):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.load(r)
            if pause:
                time.sleep(pause)
            return data
        except urllib.error.HTTPError as e:
            wait = 65 if e.code == 429 else 5 * (attempt + 1)
            log(f"  {e.code} from {url.split('?')[0]}; waiting {wait}s")
            time.sleep(wait)
        except Exception as e:  # noqa: BLE001
            log(f"  request failed ({e}); retrying")
            time.sleep(5 * (attempt + 1))
    return None


def simple_name(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z ]+", " ", s).split()


def commons_category_photo(cat):
    """First portrait-looking image in the player's Wikimedia Commons category."""
    data = http_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "categorymembers", "gcmtitle": f"Category:{cat}", "gcmtype": "file",
        "gcmlimit": "20", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": "240",
    }), pause=0.3)
    if data is None:
        return None
    pages = (data.get("query") or {}).get("pages") or []
    for page in sorted(pages, key=lambda x: x.get("title", "")):
        title = page.get("title", "")
        if not re.search(r"\.(jpe?g|png|webp)$", title, re.I) or JUNK_IMAGE.search(title):
            continue
        info = (page.get("imageinfo") or [{}])[0]
        url = info.get("thumburl") or info.get("url")
        if url:
            return url
    return ""


def sportsdb_photo(name_en, birth):
    """Photo from TheSportsDB, accepted only when it is clearly the same person.

    Accepted when: same birth date, or exactly the same name with the same birth
    year (TheSportsDB sometimes has the wrong day/month), or exactly the same name
    when a birth date is missing on either side. Only one footballer may match.
    Returns None when the lookup itself failed (so it is retried next run).
    """
    if not name_en:
        return ""
    data = http_json(SPORTSDB + "?" + urllib.parse.urlencode({"p": name_en.replace(" ", "_")}), pause=2.1)
    if data is None:
        return None
    results = [x for x in (data.get("player") or []) if x.get("strSport") == "Soccer"]
    target = simple_name(name_en)
    best = None
    if birth:
        same_day = [x for x in results if (x.get("dateBorn") or "")[:10] == birth]
        if len(same_day) == 1:
            best = same_day[0]
    if best is None:
        exact = [x for x in results if simple_name(x.get("strPlayer")) == target]
        if len(exact) == 1:
            theirs = (exact[0].get("dateBorn") or "")[:4]
            if not birth or not theirs or theirs == birth[:4]:
                best = exact[0]
    if not best:
        return ""
    thumb = best.get("strThumb") or best.get("strCutout") or ""
    return thumb + "/small" if thumb.startswith("http") else ""


def fill_extra_photos(data, raw, cfg, out_dir, live):
    cache_path = os.path.join(out_dir, "photo_cache.json")
    try:
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, ValueError):
        cache = {}
    today = dt.date.today()
    retry = dt.timedelta(days=cfg.get("photo_retry_days", 30))
    sources = cfg.get("photo_sources", [])
    limit = cfg.get("photo_lookup_limit", 2000)
    looked_up = found = 0

    def save():
        os.makedirs(out_dir, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, sort_keys=True, indent=0)

    for row in data["players"]:  # most famous first
        pid = row[0]
        if row[4]:
            continue
        hit = cache.get(pid)
        fresh = hit and (hit.get("u") or (hit.get("v") == PHOTO_LOGIC_VERSION
                                          and dt.date.fromisoformat(hit["t"]) + retry > today))
        if not fresh and live and looked_up < limit:
            d = raw["players"].get(pid, {})
            url = ""
            if "commons_category" in sources and d.get("cat"):
                url = commons_category_photo(d["cat"]) or ""
            if not url and "thesportsdb" in sources:
                url = sportsdb_photo(d.get("en"), d.get("birth"))
            if url is None:  # lookup failed (rate limit / network): try again next run
                continue
            hit = {"u": url, "t": today.isoformat(), "v": PHOTO_LOGIC_VERSION}
            cache[pid] = hit
            looked_up += 1
            found += bool(url)
            if looked_up % 50 == 0:
                log(f"  photos: checked {looked_up}, found {found}")
                save()
        if hit and hit.get("u"):
            row[4] = hit["u"]

    save()
    have = sum(1 for r in data["players"] if r[4])
    log(f"Extra photos: checked {looked_up}, found {found}. "
        f"Players with a photo: {have}/{len(data['players'])}")


# ---------------------------------------------------------------- club crests

SPORTSDB_TEAMS = "https://www.thesportsdb.com/api/v1/json/123/searchteams.php"
# TheSportsDB country names for Wikidata countries that differ
COUNTRY_ALIASES = {"United Kingdom": {"England", "Wales", "Scotland", "Northern Ireland"},
                   "People's Republic of China": {"China"}, "United States": {"USA"},
                   "Kingdom of the Netherlands": {"Netherlands"}, "Republic of Ireland": {"Ireland"}}


def team_names(name):
    """Name variants to search: 'Manchester United F.C.' -> 'Manchester United F.C.', 'Manchester United'."""
    out = [name]
    short = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    short = re.sub(r"\s+(A\.?\s?F\.?\s?C\.?|F\.?\s?C\.?|C\.?\s?F\.?|S\.?\s?C\.?)$", "", short).strip()
    short = re.sub(r"^(A\.?F\.?C\.?|F\.?C\.?)\s+", "", short).strip()
    if short and short not in out:
        out.append(short)
    return out


def sportsdb_badge(name_en, country_en):
    """Crest from TheSportsDB: a football team with the same name in the same country.
    Returns None when the lookup failed (retried next run)."""
    if not name_en:
        return ""
    countries = {country_en} | COUNTRY_ALIASES.get(country_en, set()) if country_en else set()
    for variant in team_names(name_en):
        data = http_json(SPORTSDB_TEAMS + "?" + urllib.parse.urlencode({"t": variant.replace(" ", "_")}), pause=2.1)
        if data is None:
            return None
        teams = [t for t in (data.get("teams") or []) if t.get("strSport") == "Soccer" and t.get("strBadge")]
        if countries:
            teams = [t for t in teams if t.get("strCountry") in countries]
        want = simple_name(variant)
        exact = [t for t in teams if simple_name(t.get("strTeam")) == want
                 or want in [simple_name(a) for a in (t.get("strTeamAlternate") or "").split(",")]]
        pick = exact[0] if len(exact) >= 1 else (teams[0] if len(teams) == 1 else None)
        if pick:
            return pick["strBadge"] + "/small"
    return ""


def fill_badges(data, raw, cfg, out_dir, live):
    """Add TheSportsDB crests to club criteria that still have none. Cached in badge_cache.json."""
    if "thesportsdb" not in cfg.get("badge_sources", []):
        return
    path = os.path.join(out_dir, "badge_cache.json")
    try:
        with open(path, encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, ValueError):
        cache = {}
    today = dt.date.today()
    retry = dt.timedelta(days=cfg.get("photo_retry_days", 30))
    items = raw.get("items", {}) if raw else {}
    looked_up = found = 0
    for cid, c in data["criteria"].items():
        if c["t"] not in ("club", "fclub") or c.get("b"):
            continue
        q = cid.split(":", 1)[1]
        hit = cache.get(q)
        fresh = hit and (hit.get("u") or dt.date.fromisoformat(hit["t"]) + retry > today)
        if not fresh and live:
            it = items.get(q, {})
            country = (items.get((it.get("country") or [""])[0]) or {}).get("en") or ""
            url = sportsdb_badge(it.get("en"), country)
            if url is None:
                continue
            hit = {"u": url, "t": today.isoformat()}
            cache[q] = hit
            looked_up += 1
            found += bool(url)
        if hit and hit.get("u"):
            c["b"] = hit["u"]
    os.makedirs(out_dir, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, sort_keys=True, indent=0)
    clubs = [c for c in data["criteria"].values() if c["t"] in ("club", "fclub")]
    log(f"Crests: looked up {looked_up}, found {found}. Clubs with a crest: "
        f"{sum(1 for c in clubs if c.get('b'))}/{len(clubs)}")


# ---------------------------------------------------------------- main

def load_config():
    user = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding="utf-8") as f:
            user = json.load(f)
    if user and not any(k in LEAGUES for k in user):
        user = {"egypt": user}  # old single-league config
    configs = {}
    for name, base in LEAGUES.items():
        cfg = dict(COMMON_DEFAULTS)
        cfg.update(base)
        cfg.update(user.get(name, {}))
        configs[name] = cfg
    return configs


def run_league(name, cfg, args):
    log(f"\n===== {name} =====")
    out_dir = os.path.join(ROOT, cfg["out_dir"])
    if args.raw_in:
        with open(args.raw_in, encoding="utf-8") as f:
            raw = json.load(f)
    else:
        raw = fetch_raw(cfg)
        if args.raw_out:
            with open(args.raw_out, "w", encoding="utf-8") as f:
                json.dump(raw, f, ensure_ascii=False)

    data = build_data(raw, cfg)
    if len(data["players"]) < 50:
        log(f"Too few players for {name} - keeping the old data (Wikidata problem?)")
        return False
    fill_extra_photos(data, raw, cfg, out_dir, live=not args.raw_in)
    fill_badges(data, raw, cfg, out_dir, live=not args.raw_in)

    os.makedirs(out_dir, exist_ok=True)
    grids_path = os.path.join(out_dir, "grids.json")
    existing = {}
    if os.path.exists(grids_path):
        with open(grids_path, encoding="utf-8") as f:
            existing = json.load(f)
    today = dt.date.fromisoformat(args.today) if args.today else cairo_today()
    grids = build_grids(data, cfg, existing, today)

    with open(os.path.join(out_dir, "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    with open(grids_path, "w", encoding="utf-8") as f:
        json.dump(grids, f, ensure_ascii=False, indent=0, sort_keys=True)
    log(f"Wrote {len(grids)} grids ({min(grids)} .. {max(grids)})")
    return True


def regrid(name, cfg, args):
    out_dir = os.path.join(ROOT, cfg["out_dir"])
    with open(os.path.join(out_dir, "data.json"), encoding="utf-8") as f:
        data = json.load(f)
    with open(os.path.join(out_dir, "grids.json"), encoding="utf-8") as f:
        existing = json.load(f)
    apply_config(data["criteria"], cfg)
    today = dt.date.fromisoformat(args.today) if args.today else cairo_today()
    grids = build_grids(data, cfg, existing, today, keep_future=False)
    with open(os.path.join(out_dir, "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(out_dir, "grids.json"), "w", encoding="utf-8") as f:
        json.dump(grids, f, ensure_ascii=False, indent=0, sort_keys=True)
    log(f"{name}: {len(data['criteria'])} criteria, {len(grids)} grids rebuilt after {today}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", choices=["all"] + list(LEAGUES), default="all")
    ap.add_argument("--raw-in")
    ap.add_argument("--raw-out")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for testing")
    ap.add_argument("--regrid", action="store_true",
                    help="no download: apply config.json to the existing data and rebuild grids after today")
    args = ap.parse_args()
    if (args.raw_in or args.raw_out) and args.league == "all":
        ap.error("--raw-in / --raw-out need --league")

    configs = load_config()
    names = list(LEAGUES) if args.league == "all" else [args.league]
    if args.regrid:
        for n in names:
            regrid(n, configs[n], args)
        return
    ok = [run_league(n, configs[n], args) for n in names]
    if not any(ok):
        sys.exit("No league could be built")


if __name__ == "__main__":
    main()
