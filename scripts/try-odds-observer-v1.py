#!/usr/bin/env python3
"""Passive PRE-only odds observation. Writes ONLY a separate artifact directory."""
import argparse
import datetime as dt
import hashlib
import html
import json
import math
import pathlib
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

JST = ZoneInfo('Asia/Tokyo')
ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = 'TRY-ODDS-OBSERVER-V1'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('SOURCE_REDIRECT')


def stamp():
    return dt.datetime.now(dt.timezone.utc)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def parse_odds(raw):
    """Only the official 6-column trifecta grid; require all 120 unique orders."""
    text = raw.decode('utf-8')
    bodies = re.findall(r'<tbody\b[^>]*class="is-p3-0"[^>]*>(.*?)</tbody>', text, re.S)
    if len(bodies) != 1 or '3連単オッズ' not in text:
        raise ValueError('ODDS_GRID_UNAVAILABLE')
    rows = re.findall(r'<tr\b[^>]*>(.*?)</tr>', bodies[0], re.S)
    if len(rows) != 20:
        raise ValueError('ODDS_GRID_SHAPE')
    seconds, out = {}, {}
    for row_index, row in enumerate(rows):
        cells = re.findall(r'<td\b([^>]*)>(.*?)</td>', row, re.S)
        pos = 0
        for first in range(1, 7):
            if row_index % 4 == 0:
                attrs, value = cells[pos]; pos += 1
                if not re.search(r'rowspan="4"', attrs):
                    raise ValueError('SECOND_COLUMN_SHAPE')
                seconds[first] = int(re.sub('<[^>]+>', '', value).strip())
            _, third = cells[pos]; attrs, value = cells[pos + 1]; pos += 2
            third = int(re.sub('<[^>]+>', '', third).strip())
            order = (first, seconds[first], third)
            if 'oddsPoint' not in attrs or len(set(order)) != 3 or any(x not in range(1,7) for x in order):
                raise ValueError('INVALID_ODDS_ORDER')
            key = '-'.join(map(str, order))
            if key in out:
                raise ValueError('DUPLICATE_ODDS_ORDER')
            value = html.unescape(re.sub('<[^>]+>', '', value)).strip().replace(',', '')
            if not re.fullmatch(r'\d+(?:\.\d+)?', value):
                raise ValueError('ODDS_UNAVAILABLE_OR_CANCELLED')
            number = float(value)
            if not math.isfinite(number) or number <= 0:
                raise ValueError('INVALID_ODDS_VALUE')
            out[key] = number
        if pos != len(cells):
            raise ValueError('EXTRA_ODDS_CELLS')
    if len(out) != 120:
        raise ValueError('INCOMPLETE_ODDS')
    return out


def valid_prediction(x, code, slug, date, race, now):
    if (x.get('venueCode'), x.get('slug'), x.get('date'), x.get('race')) != (code, slug, date, race):
        raise ValueError('PREDICTION_IDENTITY')
    if x.get('resultInput') is not False or x.get('payoutInput') is not False or x.get('immutableAfterFirstWrite') is not True:
        raise ValueError('PREDICTION_BOUNDARY')
    deadline = dt.datetime.fromisoformat(date + 'T' + x['deadline'] + ':00+09:00')
    generated = dt.datetime.fromisoformat(x['generatedAt'].replace('Z', '+00:00'))
    if generated.tzinfo is None or generated > now or generated >= deadline:
        raise ValueError('PREDICTION_TIME')
    picks = x['picks']
    if len(picks) != 4 or len(set(picks)) != 4:
        raise ValueError('BASE_FOUR_PICKS_REQUIRED')
    probabilities = {p['order']: p['probability'] for p in x['probabilities']}
    for pick in picks:
        if not re.fullmatch(r'[1-6]-[1-6]-[1-6]', pick) or len(set(pick.split('-'))) != 3:
            raise ValueError('PICK_INVALID')
        p = probabilities[pick]
        if isinstance(p, bool) or not isinstance(p, (int, float)) or not math.isfinite(p) or not 0 <= p <= 1:
            raise ValueError('PROBABILITY_INVALID')
    if sum(probabilities[k] for k in picks) > 1 + 1e-9:
        raise ValueError('PROBABILITY_MASS')
    return deadline, picks, probabilities


def observe(root, output, now=None, fetch=None, clock=stamp, limit=12):
    now = now or stamp()
    date = now.astimezone(JST).date().isoformat()
    output = output.resolve(); root = root.resolve()
    if output == root or root in output.parents:
        raise ValueError('OUTPUT_MUST_BE_OUTSIDE_REPOSITORY')
    output.mkdir(parents=True, exist_ok=False)
    config = json.loads((root / 'shared-try-config-v1.json').read_text())
    report = dict(version=VERSION, date=date, generatedAt=now.isoformat(), shadowOnly=True,
                  productionMutation=False, resultEndpointsRequested=False, payoutEndpointsRequested=False,
                  calibrationStatus='NOT_VALIDATED', promotionEligible=False, venues=[])
    if sorted(a['venueCode'] for a in config['activeAdapters']) != [f'{i:02}' for i in range(1,25)]:
        raise ValueError('REQUIRE_24_UNIQUE_VENUES')
    queue = []
    for adapter in config['activeAdapters']:
        venue = dict(venueCode=adapter['venueCode'], slug=adapter['slug'], races=[])
        report['venues'].append(venue)
        for race in range(1, 13):
            record = dict(race=race, status='MISSING_PREDICTION', decision='SKIP', reason='MISSING_PRE_RACE_INPUT')
            venue['races'].append(record)
            source = root / 'live' / adapter['slug'] / date / 'shadow/program-only' / f'race-{race}.json'
            if not source.exists():
                continue  # Missing input is never classified as non開催.
            try:
                raw = source.read_bytes(); x = json.loads(raw)
                deadline, picks, probabilities = valid_prediction(x, adapter['venueCode'], adapter['slug'], date, race, now)
                record.update(predictionPath=str(source.relative_to(root)), predictionSha256=digest(raw),
                              deadline=deadline.isoformat(), predictionGeneratedAt=x['generatedAt'])
                margin = (deadline - now).total_seconds()
                if not 180 <= margin <= 480:
                    record.update(status='OUTSIDE_CAPTURE_WINDOW', reason='NOT_3_TO_8_MINUTES_BEFORE_DEADLINE')
                    continue
                record.update(status='CAPTURE_LIMIT', reason='NOT_FETCHED_THIS_RUN')
                queue.append((deadline, adapter['venueCode'], race, record, raw, x, picks, probabilities))
            except (ValueError, KeyError, TypeError, OverflowError) as exc:
                record.update(status='INVALID_PREDICTION', reason=type(exc).__name__ + ':' + str(exc))
    for deadline, code, race, record, prediction_raw, prediction, picks, probabilities in sorted(queue, key=lambda q:q[:3])[:limit]:
        url = f'https://www.boatrace.jp/owpc/pc/race/odds3t?rno={race}&jcd={code}&hd={date.replace("-", "")}'
        start = clock()
        if not 180 <= (deadline - start).total_seconds() <= 480:
            record.update(status='LATE_BEFORE_REQUEST', reason='CAPTURE_WINDOW_EXPIRED'); continue
        record.update(sourceUrl=url, requestStartedAt=start.isoformat())
        try:
            if fetch:
                raw, final_url = fetch(url)
            else:
                with urllib.request.build_opener(NoRedirect).open(urllib.request.Request(url, headers={'User-Agent': VERSION}), timeout=8) as response:
                    raw, final_url = response.read(500000), response.url
            end = clock()
            if final_url != url:
                raise ValueError('SOURCE_REDIRECT')
            stem = f'{code}-{race}'
            (output / f'{stem}.html').write_bytes(raw)
            (output / f'{stem}-prediction.json').write_bytes(prediction_raw)
            record.update(sourceUrl=url, requestStartedAt=start.isoformat(), receivedAt=end.isoformat(),
                          secondsBeforeDeadline=(deadline-end).total_seconds(), oddsPageSha256=digest(raw))
            if not 180 <= (deadline-end).total_seconds() <= 480:
                raise ValueError('RESPONSE_OUTSIDE_CAPTURE_WINDOW')
            page = html.unescape(raw.decode('utf-8'))
            identity = f'rno={race}&jcd={code}&hd={date.replace("-", "")}'
            if f'/owpc/pc/race/beforeinfo?{identity}' not in page or f'/owpc/pc/race/racelist?{identity}' not in page:
                raise ValueError('PAGE_IDENTITY_UNVERIFIED')
            odds = parse_odds(raw)
            # A closing-price label is never accepted as a pre-race observation.
            if '締切時オッズ' in raw.decode('utf-8'):
                raise ValueError('CLOSING_ODDS_NOT_PRE_RACE')
            diagnostic = sum(probabilities[k] * odds[k] for k in picks) / len(picks)
            record.update(status='CAPTURED', reason='CALIBRATION_NOT_VALIDATED', odds=odds,
                          picks=picks, modelVersion=prediction.get('modelVersion'),
                          uncalibratedExpectedGrossReturnPerYen=diagnostic)
        except Exception as exc:
            record.update(status='CAPTURE_FAILED', reason=type(exc).__name__ + ':' + str(exc))
    report['requestedCount'] = sum('requestStartedAt' in r for v in report['venues'] for r in v['races'])
    report['capturedCount'] = sum(r['status']=='CAPTURED' for v in report['venues'] for r in v['races'])
    (output / 'observation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    report = observe(ROOT, args.output)
    print(json.dumps({k:report[k] for k in ('date','requestedCount','capturedCount','calibrationStatus')}, ensure_ascii=False))
