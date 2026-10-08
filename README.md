# Football grids — شبكة الدوري المصري + Premier League Grid

Daily 3×3 football grid games (like Immaculate Grid):
- **Egyptian league** (Arabic) at the site root — data in `data/`
- **Premier League** (English) at `epl.html` — data in `data/epl/`

Both pages share `app.js` and `style.css`; each page sets `window.GAME` (language, data folder).

- **Site:** plain HTML/CSS/JS (`index.html`, `epl.html`, `style.css`, `app.js`). No build step. Hosted on GitHub Pages.
- **Data:** `scraper/build_data.py` pulls players from [Wikidata](https://www.wikidata.org) and writes
  `data/data.json` (players + criteria) and `data/grids.json` (one grid per day, 90 days ahead).
- **Updates:** a GitHub Action re-runs the scraper every Monday and commits the new data.

## Setup (one time, new repo)

1. Create a new **public** repo on GitHub (no README, no .gitignore).
2. On the empty repo page click **uploading an existing file**, then drag in **everything inside**
   the `football-grid` folder — files *and* folders (`data`, `scraper`, `photos`, `.github`).
   On Windows the `.github` folder is visible; on Mac press Cmd+Shift+. in Finder to show it.
   Commit.
3. Check the repo has `.github/workflows/update-data.yml`. If not, use **Add file → Create new
   file**, type that path, paste the file's contents and commit.
4. **Settings → Actions → General → Workflow permissions →** *Read and write permissions* → Save.
5. **Settings → Pages →** Source *Deploy from a branch*, branch `main`, folder `/ (root)` → Save.
6. After a minute the games are live:
   - Egyptian league: `https://<user>.github.io/<repo>/`
   - Premier League: `https://<user>.github.io/<repo>/epl.html`

The data is already included, so the site works straight away. The **Update data** workflow
refreshes it every Monday on its own (it can also be run by hand from the **Actions** tab;
the Premier League part takes about an hour).

## Criteria used

| Type | Example | Rule |
|---|---|---|
| Egyptian club | الأهلي | played for that club |
| Egypt national team | منتخب مصر | played for the senior national team |
| Nationality | من غانا | non-Egyptian player from that country |
| Played abroad | لعب في السعودية | played for a club in that country |
| Foreign club | نادٍ خارج مصر | played for a specific foreign club |
| Position | حارس مرمى | listed position on Wikidata |
| Award | (varies) | award listed on Wikidata |

Columns are always three league clubs; rows are always three non-club criteria (national team,
nationality, played in a country, position, award). Every cell needs at least `min_cell` valid answers.

## Tuning — `config.json`

`config.json` has one section per league: `"egypt"` and `"epl"`. Each accepts the keys below.
Premier League extras: `min_birth_year` (default 1960) and `min_links` (default 2) keep the player
pool to the modern era and players with Wikipedia articles.


- `exclude`: criterion ids to never use (ids look like `club:Q123`, `award:Q456`; find them in `data/data.json`).
- `labels`: override a label, e.g. `{"club:Q123": "الأهلي"}`.
- `allow_awards`: if set, only these award criteria are used (the Premier League keeps the two halls of fame).
- `min_cell`, `min_club`, …: thresholds. Raise `min_cell` for easier grids.
- `salt`: change it to reshuffle all *future* grids.
- `top_clubs`: the popular clubs; every grid has at least `min_top_clubs` (default 2) of them as columns.
- `known_links` / `min_known_per_cell`: every square needs at least `min_known_per_cell` (default 2) answers
  who have `known_links` or more Wikipedia articles (Egypt 10, Premier League 30).

After editing, run the *Update data* workflow again. Past days' grids are never changed.
To apply config changes without downloading anything, run `python scraper/build_data.py --regrid`
locally: it re-applies `config.json` and rebuilds every grid after today.

## Photos

Each player's photo comes from the first of these that exists:
1. `photos/<QID>.jpg` (or .png/.webp) that you add yourself — see `photos/README.md`
2. The photo on the player's Wikidata entry
3. The free lead image of their English or Arabic Wikipedia article
4. The player's Wikimedia Commons category
5. [TheSportsDB](https://www.thesportsdb.com) (free API), accepted only when the birth date matches
   Wikidata, so a different player's face is never shown

Sources 4–5 are looked up once per player and cached in `data/photo_cache.json`
(players with nothing found are re-checked every 30 days). Remove `"thesportsdb"` from
`photo_sources` in `config.json` to turn it off.

Players with none show the first letter of their name.

## Club crests

Each club's crest comes from the first of these that exists:
1. `badges/<QID>.png` (or .svg/.webp/.jpg) that you add yourself — see `badges/README.md`
2. The club's logo on Wikidata
3. [TheSportsDB](https://www.thesportsdb.com), accepted only for a football club with the same name in the same country

Clubs with none (or whose image fails to load) show a shield in the club's colours with its initials.
TheSportsDB lookups are cached in `badge_cache.json`. Club crests are trademarks: before adding ads or
publishing an app, remove `"thesportsdb"` from `badge_sources` in `config.json` (per league).

## Rarity

Players are ranked by how many Wikipedia language editions have an article on them (a proxy for fame).
Picking the most famous valid answer scores 0, the most obscure scores 100.

## Running locally

```
python scraper/build_data.py --raw-out raw.json   # fetch + build (raw.json lets you rebuild offline)
python scraper/build_data.py --raw-in raw.json    # rebuild without the network
python -m http.server                             # then open http://localhost:8000
```
