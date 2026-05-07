# Content & Data License

The **source code** of this project is MIT-licensed (see [LICENSE](LICENSE)).

The **curated data files and documentation** in this repository — the
hand-compiled tables of orbital elements, named star lists, event catalogs,
language translations, and prose documentation — are released under
**Creative Commons Attribution-ShareAlike 4.0** (CC BY-SA 4.0):
<https://creativecommons.org/licenses/by-sa/4.0/>

You are free to:
- **Share** — copy and redistribute in any medium or format
- **Adapt** — remix, transform, and build upon the material for any purpose,
  even commercially

Under the following terms:
- **Attribution** — credit "Kevin Lin / 太陽系模擬 (Solar System 3D)" with a
  link to the repository.
- **ShareAlike** — distribute derivatives under the same license.

## Third-party data loaded at runtime

The application fetches several data sets at runtime that are NOT part of
this repository and have their own licenses:

| Source | License | Notes |
|--------|---------|-------|
| NASA JPL orbital elements, Hipparcos, Yale BSC, IAU constellations, Messier | Public domain | Numerical values redistributed in `src/data/` |
| Solar System Scope planet textures | CC BY 4.0 | Attribution required (see README) |
| AWS Open Terrain (Terrarium DEM) | Open data, attribution required | Loaded from `s3.amazonaws.com/elevation-tiles-prod` |
| Esri World Imagery satellite tiles | **Non-commercial / dev use only** | Public commercial deployment needs ArcGIS Developer account |
| OpenStreetMap via Leaflet | ODbL | © OpenStreetMap contributors |
| d3-celestial constellation boundaries | MIT | GeoJSON IAU 1930 boundaries |

If you fork this project for **public commercial deployment**, you must
either obtain a licensed Esri tile URL or replace the satellite imagery
layer with a commercially-permissive alternative (e.g. ESA Sentinel,
Mapbox Satellite, your own tiles).
