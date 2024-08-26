import { Pollutant } from "./pollutant.js";
import * as EmissionSource from "./emission_source.js";
export let grid_fm = [];

export function generateRandomPollution(
  n_pollution,
  map,
  wind_strength,
  wind_angle,
) {
  let lat_bounds = [55.8, 55.9];
  let lat_diff = lat_bounds[1] - lat_bounds[0];
  let lng_bounds = [-4.35, -4.2];
  let lng_diff = lng_bounds[1] - lng_bounds[0];
  grid_fm.forEach((f) => map.removeLayer(f));

  for (let i = 0; i < n_pollution; i++) {
    let lat = lat_bounds[0] + Math.random() * lat_diff;
    let lng = lng_bounds[0] + Math.random() * lng_diff;

    let latlng = new L.LatLng(lat, lng);
    let p = new Pollutant({
      emission_source: EmissionSource.wildfire,
      latlng: latlng,
      wind_strength: wind_strength,
      wind_angle: wind_angle,
    });

    // add new pollutants to map
    // p.marker.addTo(map);
    p.marker.setLatLng(latlng);
    p.setWind(wind_strength, wind_angle, map);
    p.zones.forEach((z) => z.addTo(map));
    grid_fm.push(p);
  }
  grid_fm.forEach((pollutant) => {
    console.log(`Pollutant @ ${pollutant.marker.getLatLng()}`);
  });
  return grid_fm;
}

export function checkClick(latlng, map) {
  let px_click = map.latLngToLayerPoint(latlng);
  console.log(`Clicked pixel @ ${px_click}`);
  let radius_threshold = 100;
  let found = 0;
  grid_fm.forEach((fm) => {
    let px_pollution = map.latLngToLayerPoint(fm.marker.getLatLng());
    console.log(`  - Pollutant pixel @ ${px_pollution}`);
    let dx = Math.abs(px_click.x - px_pollution.x);
    let dy = Math.abs(px_click.y - px_pollution.y);
    let radius = Math.floor(Math.sqrt(dx * dx + dy * dy));
    if (radius < radius_threshold) {
      let d = new Date();
      let hh = String(d.getHours()).padStart(2, "0");
      let mm = String(d.getMinutes()).padStart(2, "0");
      let ss = String(d.getSeconds()).padStart(2, "0");

      console.log(`[${hh}:${mm}:${ss}] Found pollution! ${radius} px away`);
      fm.marker.addTo(map);
      found += 1;
    }
  });
  return found;
}
