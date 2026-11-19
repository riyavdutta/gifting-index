# The Gifting Index

What gets bought as a gift? Six luxury fragrance houses, three classic gift names (Jo Malone London, Diptyque, Molton Brown) and three cult niche houses (Le Labo, Byredo, Frédéric Malle), tracked every day. An independent project by Riya Dutta, live at [gifting-index.vercel.app](https://gifting-index.vercel.app/).

The page tells one point, perfume is a winter gift, as a garden: each house is a flower whose 12 petals are the months, petal length = how much more it's searched than usual. Soft white page, Cormorant Garamond and Zen Kaku Gothic New, warm flowers for the gift names (plum, rose, raspberry) and cool ones for the cult houses (sage, wisteria, eucalyptus), with antique gold for anything that's yours (your pick, your date, the hand):

1. **Call it:** the next gifting moment is named, and you tap the flower you think it makes biggest; the buds (all the same size until then) bloom, and a month bar lets you drag through the year. Quiet occasions become a trick question.
2. **Every December:** a meadow, one pair of stems per year, gift names against cult houses; stem height is the December lift.
3. **The gifting year:** the typical year (2022 onwards) as one flower with a petal for each week. Drag the gold hand or pick your own date; the six houses re-rank live.
4. **Next up, live:** days to the next gifting moment, where each house stands this week, and how the last moment went.
5. **How I know:** the checks behind the claim, including the test of nine more houses (`scripts/screen_houses.py`, results in `data/screen.json`) that chose Molton Brown and Frédéric Malle.

Every number is calculated in the page from the latest saved data, including the year count, the occasion lifts and the "how it went" card.

## Keeping the holidays up to date

Ten gifting moments are measured: Lunar New Year, Valentine's Day, Eid al-Fitr, Mother's Day, Father's Day, Raksha Bandhan, Diwali, Singles' Day, Black Friday and Christmas. Fixed and rule-based dates work out themselves. Moon-based ones (Lunar New Year, Eid al-Fitr, Raksha Bandhan, Diwali) are looked up from a table in `index.html` (search for `const OCC`) that runs to 2027: **add the next year's dates each year**. If a year is missing, that holiday is simply left out rather than shown on a wrong date.

## Where the data comes from

- **Google searches (main signal):** Google Trends interest, worldwide, through [SerpApi](https://serpapi.com/google-trends-api). Monthly since 2016 for the December lift; weekly for the dial, the occasions and "this week".
- **Wikipedia pageviews (second signal):** daily, from the [Wikimedia Pageviews API](https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews). Collected as a cross-check.

Every morning (scheduled for 06:20 UTC; GitHub often starts it a few hours late) a GitHub Action (`.github/workflows/data.yml`) runs `scripts/fetch_data.py`, saves `data/trends.json` and `data/wiki.json`, and commits them; Vercel redeploys. Visitors only load these saved files, so the site never waits on an outside service. If a fetch fails, the last good copy stays. SerpApi use is about 70 requests a month (two requests a pull: the four big names together, and the two smaller houses together, so the small ones keep detail on Google's 0–100 scale) (the free plan allows 100). The key is stored as the repository secret `SERPAPI_KEY`.

## What's here

| File | What it does |
|---|---|
| `index.html` | The whole page: words, styles and the script |
| `og.png` | The link-preview image |
| `scripts/fetch_data.py` | Fetches Google Trends and Wikipedia data (run by the Action) |
| `.github/workflows/data.yml` | Runs the fetcher every morning and commits the data |
| `scripts/screen_houses.py`, `.github/workflows/screen.yml` | One-off test of candidate houses, run by hand from the Actions tab |
| `data/trends.json`, `data/wiki.json` | The saved data the page reads (written by the Action; don't edit) |

## Preview locally

```
python3 -m http.server 4317
```

Then open http://localhost:4317 (opening `index.html` directly won't load the data).
