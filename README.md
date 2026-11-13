# The Gifting Index

A live look at public attention for four luxury fragrance houses: two classic gift names (Jo Malone London, Diptyque) and two cult niche houses (Le Labo, Byredo). The headline question: which ones people buy as a gift.

## Where the data comes from

- **Google searches (main signal):** Google Trends interest, worldwide, collected through [SerpApi](https://serpapi.com/google-trends-api). Weekly for the last 5 years, monthly since 2016.
- **Wikipedia pageviews (second signal):** daily, from the [Wikimedia Pageviews API](https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews). Used for the live season and Moments, which need daily data.

Every morning at 06:20 UTC, a GitHub Action (`.github/workflows/data.yml`) runs `scripts/fetch_data.py`, saves `data/trends.json` and `data/wiki.json`, and commits them; Vercel redeploys. Visitors only ever load these saved files, so the site never waits on, or breaks because of, an outside service. If a fetch fails, the last good copy stays and the page shows its date. SerpApi use is about 35 requests a month (the free plan allows 100).

Without `data/trends.json` the whole site runs on Wikipedia data; with it, Google searches drive this week, the December finding and the game.

### Set up Google Trends (once)

1. Create a free account at serpapi.com and copy your API key from its dashboard.
2. On github.com, open this repository: **Settings → Secrets and variables → Actions → New repository secret**. Name: `SERPAPI_KEY`, value: the key.
3. **Actions → Refresh data → Run workflow** to fetch straight away instead of waiting for the morning.

## What's here

| File | What it does |
|---|---|
| `index.html` | The page and all its words |
| `assets/app.js` | Loads the data and draws everything: the weekly stamps, the seasons, the long-run chart, and Moments |
| `assets/index.css` | Layout and chart styles |
| `assets/brand.css`, `assets/made-by-riya.js` | From the lab starter: palette, fonts, and the corner stamp |
| `scripts/fetch_data.py` | Fetches Google Trends and Wikipedia data (run by the Action) |
| `.github/workflows/data.yml` | Runs the fetcher every morning and commits the data |
| `data/trends.json`, `data/wiki.json` | The saved data the site reads (written by the Action; don't edit) |
| `data/moments.json` | Your notes on spikes |
| `data/dispatch.json` | This week's short note, shown under the stamps |

## Write this week's dispatch

Change the `date` and `text` in `data/dispatch.json` and push. Two or three sentences on what moved and what you think it means. Delete the file to hide the note.

## Explain a spike

Moments are found automatically: any day at 6× a brand's usual level. Spikes with no note show as "Unexplained spike". To explain one, add an entry to `data/moments.json`:

```json
{ "brand": "jo", "date": "2026-03-12", "title": "Short headline", "note": "What happened and what it shows.", "source": "https://link-to-a-news-story" }
```

`brand` is one of `jo`, `dip`, `lelabo`, `byredo`. `date` only has to be within three weeks of the spike. Add a `source` link to every note, including the one already there.

## Preview locally

```
python3 -m http.server 4317
```

Then open http://localhost:4317 (opening `index.html` directly won't load the notes).

## Publish

1. GitHub Desktop: **File → Add Local Repository**, choose this folder, then **Publish repository** (public).
2. vercel.com: **Add New → Project**, import `gifting-index`, then **Deploy**. No settings needed.
