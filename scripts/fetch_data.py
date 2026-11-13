#!/usr/bin/env python3
"""Fetch the Gifting Index data and save it as static files the site reads.

Run every morning by .github/workflows/data.yml. Uses only the standard library.

  data/trends.json  Google Trends search interest (via SerpApi), the main signal.
                    Needs the SERPAPI_KEY environment variable. Two requests a run:
                    - weekly, last 5 years: "this week" and the long-run chart
                    - monthly, all time:    the December lift (only refreshed weekly)
  data/wiki.json    Daily Wikipedia pageviews, the second signal. No key needed.

If a fetch fails, the old file is kept, so the site always has the last good data.
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
UA = 'GiftingIndex/1.0 (https://gifting-index.vercel.app)'

# id -> (search term for Google Trends, English Wikipedia article)
BRANDS = {
    'jo': ('Jo Malone', 'Jo_Malone_London'),
    'dip': ('Diptyque', 'Diptyque'),
    'lelabo': ('Le Labo', 'Le_Labo'),
    'byredo': ('Byredo', 'Byredo'),
}


def get_json(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - retry anything, report the last one
            err = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f'{url.split("?")[0]}: {err}')


def save(name, obj):
    path = os.path.join(DATA, name)
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(obj, f, separators=(',', ':'))
    os.replace(tmp, path)      # never leaves a half-written file
    print('saved', name)


def load(name):
    try:
        with open(os.path.join(DATA, name)) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- Wikipedia

def fetch_wiki():
    end = (dt.date.today() - dt.timedelta(days=1)).strftime('%Y%m%d')
    series = {}
    for bid, (_, article) in BRANDS.items():
        url = ('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/'
               + urllib.parse.quote(article, safe='') + '/daily/20150701/' + end)
        series[bid] = [[i['timestamp'][:8], i['views']] for i in get_json(url)['items']]
        time.sleep(1)
    save('wiki.json', {'fetched': now(), 'source': 'Wikimedia Pageviews API', 'series': series})


# ---------------------------------------------------------------- Google Trends

def parse_trends(resp):
    """SerpApi google_trends TIMESERIES response -> {dates, partial, series}.
    Values are Google's 0-100 scale, relative to the highest point across all four terms."""
    if resp.get('error'):
        raise RuntimeError('SerpApi: ' + resp['error'])
    term_to_id = {term.lower(): bid for bid, (term, _) in BRANDS.items()}
    dates, partial, series = [], [], {bid: [] for bid in BRANDS}
    for point in resp['interest_over_time']['timeline_data']:
        dates.append(dt.datetime.fromtimestamp(int(point['timestamp']), dt.timezone.utc).strftime('%Y-%m-%d'))
        partial.append(bool(point.get('partial_data')))
        got = {term_to_id[v['query'].lower()]: v.get('extracted_value', 0) for v in point['values']}
        for bid in BRANDS:
            series[bid].append(got.get(bid, 0))
    if not dates:
        raise RuntimeError('SerpApi returned no timeline data')
    return {'dates': dates, 'partial': partial, 'series': series}


def fetch_trends_range(key, date_range):
    q = ','.join(term for term, _ in BRANDS.values())
    url = 'https://serpapi.com/search.json?' + urllib.parse.urlencode({
        'engine': 'google_trends', 'data_type': 'TIMESERIES', 'q': q, 'date': date_range, 'api_key': key,
    })
    return parse_trends(get_json(url))


def fetch_trends(key):
    old = load('trends.json') or {}
    out = {'fetched': now(), 'source': 'Google Trends via SerpApi', 'geo': 'Worldwide',
           'terms': {bid: term for bid, (term, _) in BRANDS.items()}}
    out['weekly'] = fetch_trends_range(key, 'today 5-y')
    # Monthly history barely changes, so refresh it once a week (keeps SerpApi use ~35 a month).
    monthly_age = None
    if old.get('monthly_fetched'):
        monthly_age = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(old['monthly_fetched'])
    if old.get('monthly') and monthly_age is not None and monthly_age < dt.timedelta(days=7):
        out['monthly'], out['monthly_fetched'] = old['monthly'], old['monthly_fetched']
    else:
        out['monthly'], out['monthly_fetched'] = fetch_trends_range(key, 'all'), now()
    save('trends.json', out)


def main():
    failed = []
    try:
        fetch_wiki()
    except Exception as e:  # noqa: BLE001
        failed.append(f'Wikipedia: {e}')
    key = os.environ.get('SERPAPI_KEY', '').strip()
    if not key:
        print('SERPAPI_KEY not set: skipping Google Trends (the site keeps its last saved copy).')
    else:
        try:
            fetch_trends(key)
        except Exception as e:  # noqa: BLE001
            failed.append(f'Google Trends: {str(e).replace(key, "***")}')
    for f in failed:
        print('FAILED', f, file=sys.stderr)
    # Fail the run only if nothing could be fetched, so GitHub emails about real outages.
    sys.exit(1 if len(failed) == (2 if key else 1) else 0)


if __name__ == '__main__':
    main()
