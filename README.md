# The Gifting Index

A live look at public attention for four affordable-luxury brands: Jo Malone London, Diptyque, Charles & Keith and Coach. The headline question: which ones people treat as a gift.

Every visit loads daily Wikipedia pageviews straight from the [Wikimedia Pageviews API](https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews), so the site stays up to date with no server, database or scheduled job.

## What's here

| File | What it does |
|---|---|
| `index.html` | The page and all its words |
| `assets/app.js` | Loads the data and draws everything: the weekly stamps, the seasons, the long-run chart, and Moments |
| `assets/index.css` | Layout and chart styles |
| `assets/brand.css`, `assets/made-by-riya.js` | From the lab starter: palette, fonts, and the corner stamp |
| `data/moments.json` | Your notes on spikes |

## Explain a spike

Moments are found automatically: any day at 6× a brand's usual level. Spikes with no note show as "Unexplained spike". To explain one, add an entry to `data/moments.json`:

```json
{ "brand": "jo", "date": "2026-03-12", "title": "Short headline", "note": "What happened and what it shows.", "source": "https://link-to-a-news-story" }
```

`brand` is one of `jo`, `dip`, `ck`, `coach`. `date` only has to be within three weeks of the spike. Add a `source` link to every note, including the two already there.

## Preview locally

```
python3 -m http.server 4317
```

Then open http://localhost:4317 (opening `index.html` directly won't load the notes).

## Publish

1. GitHub Desktop: **File → Add Local Repository**, choose this folder, then **Publish repository** (public).
2. vercel.com: **Add New → Project**, import `gifting-index`, then **Deploy**. No settings needed.
