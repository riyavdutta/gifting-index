// Vercel serverless function: GET /api/pageviews
// Fetches the four brands' daily Wikipedia pageviews once, then Vercel's CDN caches the answer
// for 6 hours (and serves the old copy for up to a day while it refreshes). So the site makes
// 4 requests to Wikimedia every few hours in total, instead of 4 per visitor.
const ARTICLES = {
  jo: 'Jo_Malone_London',
  dip: 'Diptyque',
  ck: 'Charles_%26_Keith',
  coach: 'Coach_New_York'
};

module.exports = async (req, res) => {
  const end = new Date(Date.now() - 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  try {
    const series = {};
    await Promise.all(Object.keys(ARTICLES).map(async (id) => {
      const url = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' +
        ARTICLES[id] + '/daily/20150701/' + end;
      const r = await fetch(url, { headers: { 'User-Agent': 'GiftingIndex/1.0 (https://gifting-index.vercel.app)' } });
      if (!r.ok) throw new Error('Wikimedia returned ' + r.status + ' for ' + id);
      const j = await r.json();
      series[id] = j.items.map((i) => [i.timestamp.slice(0, 8), i.views]);
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ fetched: new Date().toISOString(), series });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
