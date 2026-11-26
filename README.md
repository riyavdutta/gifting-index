# The Gifting Index

What gets bought as a gift? Six luxury fragrance houses, three classic gift names (Jo Malone London, Diptyque, Molton Brown) and three cult niche houses (Le Labo, Byredo, Frédéric Malle), tracked every day. An independent project by Riya Dutta, live at [gifting-index.vercel.app](https://gifting-index.vercel.app/).

The page is an ikebana arrangement: calm seasonal walls, Shippori Mincho, and each house drawn as a flower on a stem, plum and pink for the gift names and green, lilac and teal for the cult houses, with antique gold for anything that's yours. Five sections:

1. **The vase:** the next gifting moment is named, and you tap the flower you think it makes tallest. Until then every stem is the same height; after the pick each stem grows to that house's lift the week before the moment, and a month bar shows each month against a usual one (the wall colour follows the season). **Press a flower for someone** opens the gift card: a pressed month flower, an optional spray of a scent from the chosen house with its notes pressed beside it, who it is for, what it reminds you of, and your name; download or share it (made in the browser; nothing typed is saved or sent).
After the first guess, **Call all ten moments** runs through every gifting moment in calendar order (with "none of them" for the quiet ones), then scores you and makes a picture of your score to save or share.
2. **Find them a perfume:** pick who it's for, the occasion and up to three notes they love; it suggests one scent from the six houses (leaning to the gift names for others and the niche houses for yourself) and opens the card with it already sprayed.
3. **Every December:** a long tray with a pair of stems for each year, gift names against cult houses; stem height is the December lift.
4. **One house, the whole year:** a branch with a blossom for each month, sized by that month's lift; pick any of the six houses.
5. **Things I'm still not sure about:** the honest gaps, including the test of nine more houses (`scripts/screen_houses.py`, results in `data/screen.json`) that chose Molton Brown and Frédéric Malle.

Every number is calculated in the page from the latest saved data, including the year count and the occasion lifts.

## Keeping the holidays up to date

Ten gifting moments are measured: Lunar New Year, Valentine's Day, Eid al-Fitr, Mother's Day, Father's Day, Raksha Bandhan, Diwali, Singles' Day, Black Friday and Christmas. Fixed and rule-based dates work out themselves. Moon-based ones (Lunar New Year, Eid al-Fitr, Raksha Bandhan, Diwali) are looked up from a table in `index.html` (search for `const OCC`) that runs to 2027: **add the next year's dates each year**. If a year is missing, that holiday is simply left out rather than shown on a wrong date.

## Where the data comes from

- **Google searches (main signal):** Google Trends interest, worldwide, through [SerpApi](https://serpapi.com/google-trends-api). Monthly since 2016 for the December lift; weekly for the gifting moments.
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
