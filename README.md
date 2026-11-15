# The Gifting Index

Who gets bought as a gift? Four luxury fragrance houses, two classic gift names (Jo Malone London, Diptyque) and two cult niche houses (Le Labo, Byredo), tracked every day. Live at [gifting-index.vercel.app](https://gifting-index.vercel.app/); part of [Riya Dutta's portfolio](https://riya-folio.vercel.app/).

The page tells one point in four steps, in the portfolio's burgundy-and-cream system:

1. **Call it:** tap the four houses in the order you think December lifts them; the cards re-sort into the real order.
2. **Every year:** scrub through each December since 2018, classic houses against cult houses.
3. **This December, live:** days to Christmas, and where each house stands this week.
4. **How I know:** the checks behind the claim.

Every number is calculated in the page from the latest saved data, including the year count and the "running hottest" line.

## Where the data comes from

- **Google searches (main signal):** Google Trends interest, worldwide, through [SerpApi](https://serpapi.com/google-trends-api). Monthly since 2016 for the December lift; weekly for "this week".
- **Wikipedia pageviews (second signal):** daily, from the [Wikimedia Pageviews API](https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews). Collected as a cross-check.

Every morning at 06:20 UTC a GitHub Action (`.github/workflows/data.yml`) runs `scripts/fetch_data.py`, saves `data/trends.json` and `data/wiki.json`, and commits them; Vercel redeploys. Visitors only load these saved files, so the site never waits on an outside service. If a fetch fails, the last good copy stays. SerpApi use is about 35 requests a month (the free plan allows 100). The key is stored as the repository secret `SERPAPI_KEY`.

## What's here

| File | What it does |
|---|---|
| `index.html` | The whole page: words, styles and the script |
| `scripts/fetch_data.py` | Fetches Google Trends and Wikipedia data (run by the Action) |
| `.github/workflows/data.yml` | Runs the fetcher every morning and commits the data |
| `data/trends.json`, `data/wiki.json` | The saved data the page reads (written by the Action; don't edit) |

## Preview locally

```
python3 -m http.server 4317
```

Then open http://localhost:4317 (opening `index.html` directly won't load the data).
