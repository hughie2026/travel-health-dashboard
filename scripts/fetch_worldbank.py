#!/usr/bin/env python3
"""Fetch country-level tourism and health indicators from the World Bank API (no key required)."""
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "worldbank.json"
BASE = "https://api.worldbank.org/v2"
START_YEAR = 2000

INDICATORS = {
    "arrivals": {"code": "ST.INT.ARVL", "label": "International tourism arrivals"},
    "departures": {"code": "ST.INT.DPRT", "label": "International tourism departures"},
    "tourism_receipts_pct_exports": {"code": "ST.INT.RCPT.XP.ZS", "label": "Tourism receipts (% of exports)"},
    "health_exp_per_capita": {"code": "SH.XPD.CHEX.PC.CD", "label": "Health expenditure per capita (current US$)"},
    "out_of_pocket_pct": {"code": "SH.XPD.OOPC.CH.ZS", "label": "Out-of-pocket spending (% of health expenditure)"},
    "physicians_per_1000": {"code": "SH.MED.PHYS.ZS", "label": "Physicians per 1,000 people"},
    "beds_per_1000": {"code": "SH.MED.BEDS.ZS", "label": "Hospital beds per 1,000 people"},
    "life_expectancy": {"code": "SP.DYN.LE00.IN", "label": "Life expectancy at birth (years)"},
    "malaria_incidence": {"code": "SH.MLR.INCD.P3", "label": "Malaria incidence (per 1,000 people at risk)"},
    "tb_incidence": {"code": "SH.TBS.INCD", "label": "Tuberculosis incidence (per 100,000 people)"},
    "hiv_prevalence": {"code": "SH.DYN.AIDS.ZS", "label": "HIV prevalence (% of ages 15-49)"},
    "measles_immunization": {"code": "SH.IMM.MEAS", "label": "Measles immunization (% of children 12-23 months)"},
    "population": {"code": "SP.POP.TOTL", "label": "Population"},
}

# China, Macao SAR and the nine member states of the Community of Portuguese Language Countries (CPLP).
# Edit "members" to follow a different definition, e.g. the Forum Macao participant list.
GROUPS = {
    "china_lusophone": {
        "label": "China & Portuguese-speaking countries",
        "members": ["CHN", "MAC", "AGO", "BRA", "CPV", "GNB", "GNQ", "MOZ", "PRT", "STP", "TLS"],
    },
}


def get_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "travel-health-dashboard"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(5 * (attempt + 1))


def fetch_paged(path, params):
    rows, page = [], 1
    while True:
        query = urllib.parse.urlencode({**params, "format": "json", "page": page})
        payload = get_json(f"{BASE}/{path}?{query}")
        if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
            raise RuntimeError(f"Unexpected response for {path}: {str(payload)[:300]}")
        meta, data = payload
        rows.extend(data)
        if page >= int(meta.get("pages", 1)):
            return rows
        page += 1


def fetch_countries():
    countries = {}
    for c in fetch_paged("country", {"per_page": 400}):
        if c["region"]["value"] == "Aggregates":
            continue
        countries[c["id"]] = {
            "name": c["name"],
            "region": c["region"]["value"].strip(),
            "income": c["incomeLevel"]["value"].strip(),
        }
    return countries


def fetch_indicator(code, countries):
    end = datetime.now().year
    rows = fetch_paged(f"country/all/indicator/{code}", {"per_page": 20000, "date": f"{START_YEAR}:{end}"})
    series = {}
    for r in rows:
        iso3, value = r.get("countryiso3code"), r.get("value")
        if value is None or iso3 not in countries:
            continue
        series.setdefault(iso3, {})[r["date"]] = round(float(value), 4)
    return series


def main():
    countries = fetch_countries()
    print(f"{len(countries)} countries")
    for group in GROUPS.values():
        missing = [iso for iso in group["members"] if iso not in countries]
        if missing:
            print(f"Warning: group members not found in World Bank list: {missing}")

    data = {}
    for key, meta in INDICATORS.items():
        series = fetch_indicator(meta["code"], countries)
        print(f"{meta['code']}: {len(series)} countries with data")
        for iso3, values in series.items():
            data.setdefault(iso3, {})[key] = values
        time.sleep(1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "World Bank Open Data (CC BY 4.0)",
        "indicators": INDICATORS,
        "groups": GROUPS,
        "countries": countries,
        "data": data,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
