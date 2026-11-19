#!/usr/bin/env python3
"""One-off test: which extra houses show a clean December pattern on Google Trends?

Run by hand from the Actions tab ("Screen new houses"). Each candidate is fetched on its
own (monthly, all time, worldwide), so it gets Google's full 0-100 detail; the site only
ever compares a house with its own typical month, so no shared scale is needed.
Jo Malone is fetched too, as a check that the numbers match the live site (Dec about x2.0).

Saves data/screen.json and prints a table. About 10 SerpApi searches, once.
"""
import datetime as dt
import os
import statistics as st
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_data import get_json, save, now  # noqa: E402

CANDIDATES = {
    # id: (search term, which side we expect)
    'jo': ('Jo Malone', 'check'),
    'penh': ("Penhaligon's", 'classic'),
    'adp': ('Acqua di Parma', 'classic'),
    'molton': ('Molton Brown', 'classic'),
    'floris': ('Floris London', 'classic'),
    'mfk': ('Maison Francis Kurkdjian', 'cult'),
    'malle': ('Frederic Malle', 'cult'),
    'pdm': ('Parfums de Marly', 'cult'),
    'kilian': ('Kilian Paris', 'cult'),
    'dsd': ('DS and Durga', 'cult'),
}


def monthly(key, term):
    url = 'https://serpapi.com/search.json?' + urllib.parse.urlencode({
        'engine': 'google_trends', 'data_type': 'TIMESERIES', 'q': term, 'date': 'all', 'api_key': key,
    })
    resp = get_json(url)
    if resp.get('error'):
        raise RuntimeError(resp['error'])
    rows = []
    for p in resp['interest_over_time']['timeline_data']:
        if p.get('partial_data'):
            continue
        d = dt.datetime.fromtimestamp(int(p['timestamp']), dt.timezone.utc)
        rows.append((d.year, d.month, p['values'][0].get('extracted_value', 0)))
    return rows


def lifts(rows):
    """Same method as the site: month / that year's median month, then the median across full years."""
    by = {}
    for yr, mo, v in rows:
        by.setdefault(yr, {})[mo] = v
    months = list(range(1, 13))
    per = {m: [] for m in months}
    years = []
    for yr, ms in sorted(by.items()):
        if yr < 2016 or len(ms) < 12:
            continue
        med = st.median(ms.values())
        if med <= 5:
            continue
        years.append(yr)
        for m in months:
            per[m].append(ms[m] / med)
    if not years:
        return None
    return {'years': [years[0], years[-1]], 'lift': [round(st.median(per[m]), 2) for m in months],
            'dec_by_year': {str(y): round(by[y][12] / st.median(by[y].values()), 2) for y in years}}


def main():
    key = os.environ.get('SERPAPI_KEY', '').strip()
    if not key:
        sys.exit('SERPAPI_KEY not set')
    out = {'fetched': now(), 'source': 'Google Trends via SerpApi, monthly, worldwide, each term alone', 'houses': {}}
    for hid, (term, side) in CANDIDATES.items():
        try:
            res = lifts(monthly(key, term))
        except Exception as e:  # noqa: BLE001
            res = {'error': str(e).replace(key, '***')}
        out['houses'][hid] = {'term': term, 'side': side, **(res or {'error': 'not enough data'})}
        r = out['houses'][hid]
        if 'lift' in r:
            print(f"{term:26} {side:8} {r['years'][0]}-{r['years'][1]}  Nov x{r['lift'][10]:.2f}  Dec x{r['lift'][11]:.2f}")
        else:
            print(f"{term:26} {side:8} {r['error']}")
        time.sleep(2)
    save('screen.json', out)


if __name__ == '__main__':
    main()
