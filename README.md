# The Gifting Index

A live look at public attention for four affordable-luxury brands: Jo Malone London, Diptyque, Charles & Keith and Coach. The headline question: which ones people treat as a gift.

Daily Wikipedia pageviews come from the [Wikimedia Pageviews API](https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews) through `api/pageviews.js`, a small Vercel function that Vercel caches for 6 hours. So Wikimedia gets a few requests a day however many people visit. If the function isn't there (a local preview), the page asks Wikimedia directly.

## What's here

| File | What it does |
|---|---|
| `index.html` | The page and all its words |
| `assets/app.js` | Loads the data and draws everything: the weekly stamps, the seasons, the long-run chart, and Moments |
| `assets/index.css` | Layout and chart styles |
| `assets/brand.css`, `assets/made-by-riya.js` | From the lab starter: palette, fonts, and the corner stamp |
| `api/pageviews.js` | The cached data function (Vercel runs it; nothing to install) |
| `data/moments.json` | Your notes on spikes |
| `data/dispatch.json` | This week's short note, shown under the stamps |

## Write this week's dispatch

Change the `date` and `text` in `data/dispatch.json` and push. Two or three sentences on what moved and what you think it means. Delete the file to hide the note.

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
