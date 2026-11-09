# Travel × Health Dashboard

A static dashboard of open data on travel, medical care, health and wellness, with a focus on
China, Macao SAR and Portuguese-speaking countries. All data sources are free and require no registration.

## Pages

- **Overview**: key figures and tourism arrivals across China and Portuguese-speaking countries
- **China & Lusophone**: tourism, health-system and travel-health indicators for China, Macao SAR and the nine CPLP countries
- **Tourism & Health Systems**: World Bank indicators for all countries, with the China–Lusophone group highlighted
- **Wellness Map**: medical and wellness places in Macao, Lisbon, Rio de Janeiro, Luanda, Maputo, Praia and Dili
- **Data & Methods**: sources, licences, formulas and limitations

## How it works

`.github/workflows/update-data.yml` runs every Monday. It fetches data with the Python
scripts in `scripts/`, commits the JSON files in `data/`, and deploys the site to GitHub Pages.

## Run locally

```bash
python scripts/fetch_worldbank.py
python scripts/fetch_osm.py
python -m http.server 8000
```

Open http://localhost:8000. Opening the HTML files directly does not work because the
browser blocks `fetch()` on `file://` URLs.

## Configuration

- Country group: `GROUPS` in `scripts/fetch_worldbank.py`
- Map cities: `CITIES` in `scripts/fetch_osm.py`

## Manual data

`data/manual/macao_visitors.csv` holds visitor arrivals to Macao by place of residence
(columns: `year,origin,visitors`), entered from Macao DSEC statistics. Names must not contain commas.
