#!/usr/bin/env python3
"""Fetch medical and wellness places for selected cities from the OpenStreetMap Overpass API.

Each city is saved as soon as it is fetched. If a city fails, its data from the previous run is kept.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "wellness_osm.json"
OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY_TIMEOUT = 120   # seconds, enforced by the Overpass server
HTTP_TIMEOUT = 150    # seconds, enforced by this script
RETRIES = 3

# bbox = [south, west, north, east]; approximate city areas.
# The Macao box also covers part of Hengqin and Zhuhai.
CITIES = {
    "macao": {"name": "Macao area", "bbox": [22.10, 113.52, 22.22, 113.61]},
    "lisbon": {"name": "Lisbon area", "bbox": [38.68, -9.25, 38.80, -9.08]},
    "rio": {"name": "Rio de Janeiro area", "bbox": [-23.08, -43.80, -22.74, -43.10]},
    "luanda": {"name": "Luanda area", "bbox": [-8.98, 13.15, -8.75, 13.35]},
    "maputo": {"name": "Maputo area", "bbox": [-26.05, 32.52, -25.85, 32.65]},
    "praia": {"name": "Praia", "bbox": [14.89, -23.56, 14.97, -23.47]},
    "dili": {"name": "Dili", "bbox": [-8.59, 125.50, -8.53, 125.63]},
}


def log(msg):
    print(msg, flush=True)


def build_query(bbox):
    b = "({},{},{},{})".format(*bbox)
    return f"""
[out:json][timeout:{QUERY_TIMEOUT}];
(
  nwr["amenity"~"^(hospital|clinic)$"]{b};
  nwr["natural"="hot_spring"]{b};
  nwr["amenity"="public_bath"]{b};
  nwr["leisure"="spa"]{b};
  nwr["leisure"="fitness_centre"]{b};
  nwr["sport"="yoga"]{b};
);
out center tags;
"""


def categorize(tags):
    amenity, leisure = tags.get("amenity"), tags.get("leisure")
    if amenity == "hospital":
        return "hospital"
    if amenity == "clinic":
        return "clinic"
    if tags.get("natural") == "hot_spring" or amenity == "public_bath":
        return "hot_spring"
    if leisure == "spa":
        return "spa"
    if leisure == "fitness_centre" or tags.get("sport") == "yoga":
        return "fitness"
    return None


def overpass(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": "travel-health-dashboard"})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or attempt == RETRIES:
                raise
            log(f"  HTTP {e.code}, retrying ({attempt}/{RETRIES})")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == RETRIES:
                raise
            log(f"  {e}, retrying ({attempt}/{RETRIES})")
        time.sleep(20 * attempt)


def parse_places(result):
    places = []
    for el in result.get("elements", []):
        tags = el.get("tags", {})
        cat = categorize(tags)
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lon = el.get("lon", el.get("center", {}).get("lon"))
        if cat is None or lat is None or lon is None:
            continue
        places.append({
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "cat": cat,
            "name": tags.get("name:en") or tags.get("name:pt") or tags.get("name") or "",
        })
    return places


def load_previous():
    try:
        return json.loads(OUT.read_text(encoding="utf-8")).get("cities", {})
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save(cities):
    ordered = {k: cities[k] for k in CITIES if k in cities}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "© OpenStreetMap contributors (ODbL)",
        "cities": ordered,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    previous = load_previous()
    cities = {k: v for k, v in previous.items() if k in CITIES}
    failed = []

    for key, city in CITIES.items():
        log(f"Fetching {city['name']}...")
        start = time.time()
        try:
            places = parse_places(overpass(build_query(city["bbox"])))
        except Exception as e:
            failed.append(city["name"])
            note = "keeping previous data" if key in cities else "no previous data, skipped"
            log(f"  failed ({e}); {note}")
            continue
        cities[key] = {
            **city,
            "places": places,
            "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        save(cities)
        log(f"  {len(places)} places in {time.time() - start:.0f}s")
        time.sleep(10)  # be polite to the public Overpass server

    if cities:
        save(cities)
        log(f"Wrote {OUT} with {len(cities)} cities")
    if failed:
        log(f"Failed this run: {', '.join(failed)}")


if __name__ == "__main__":
    main()
