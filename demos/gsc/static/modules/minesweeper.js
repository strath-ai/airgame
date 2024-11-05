import { Pollutant } from "./pollutant.js";
import * as EmissionSource from "./emission_source.js";
import * as F from "./funcs.js";
export let grid_fm = [];

function distance(latlng1, latlng2) {
  const R = 6371; // radius of the earth in km

  const lat1Rad = degToRad(latlng1.lat);
  const lon1Rad = degToRad(latlng1.lng);

  const lat2Rad = degToRad(latlng2.lat);
  const lon2Rad = degToRad(latlng2.lng);

  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 3 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class ScenarioMinesweeper {
  constructor({
    title = "NO TITLE",
    hint = "NO HINT",
    scenario_class = "NO SCENARIO",
    callbacks = [],
  }) {
    this.title = title;
    this.hint = hint;
    this.scenario_class = scenario_class;
    this.callbacks = callbacks;
  }

  activate() {
    [
      document.getElementById("wind-dial-parent"),
      document.getElementById("emission-sources"),
      document.getElementById("wind-strength-parent"),
    ].forEach((s) => {
      s.classList.add(this.scenario_class);
    });

    document.getElementById("scenario-title").innerHTML = this.title;
    let hint = document.getElementById("game-hint");
    hint.innerHTML = this.hint;
    hint.classList.add(this.scenario_class);
    this.callbacks.forEach((cb) => cb());
  }
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function generateRandomPollution(
  n_pollution,
  map,
  wind_strength,
  wind_angle,
) {
  let lat_bounds = { min: 55.8, max: 55.9 };
  let lng_bounds = { min: -4.35, max: -4.2 };

  var wobbleGrid = F.generateRandomLatLngGrid({
    grid_density: [0.02, 0.02],
    wobble_factor: 0.01,
    lat_limits: lat_bounds,
    lng_limits: lng_bounds,
    rand_method: "uniform",
  });

  console.log(`wobbleGrid length`, wobbleGrid.length);
  // split the indices into N_POLLUTANTS groups
  // and then select randomly from within these groups
  // ...so I should equally sample from N portions of the map

  let wobbleGridShuffled = wobbleGrid
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  grid_fm.forEach((f) => map.removeLayer(f));

  wobbleGridShuffled.slice(0, n_pollution).forEach((latlng) => {
    var source = F.randomChoice([
      EmissionSource.wildfire,
      EmissionSource.factory,
      EmissionSource.transport,
    ]);

    let p = new Pollutant({
      emission_source: source,
      latlng: latlng,
      wind_strength: wind_strength,
      wind_angle: wind_angle,
    });
    p.setVisible(false);

    // add new pollutants to map
    /* FOR DEBUGGING ...
     * show the generated pollutant on the map
     */
    // p.marker.addTo(map);

    p.marker.setLatLng(latlng);
    p.setWind(wind_strength, wind_angle, map);
    p.zones.forEach((z) => z.addTo(map));
    grid_fm.push(p);
  });

  grid_fm.forEach((pollutant) => {
    console.info(`Pollutant @ ${pollutant.marker.getLatLng()}`);
  });
  return grid_fm;
}

export function checkClick(latlng, map) {
  let px_click = map.latLngToLayerPoint(latlng);
  console.debug(`Clicked pixel @ ${px_click}`);
  let distance_threshold = 1.8;
  let found = 0;
  grid_fm.forEach((fm) => {
    if (fm.visible) {
      // Don't do a clickcheck for already visible sensors,
      // otherwise, we could click the same location 3 times and
      // increment the 'found' counter falsely.
      // This fixes the bug where we reveal at the end and one of the triangles
      // doesn't have an emission source (because we reveal all triangles,
      // but only add the marker of sensors we have clicked within threshold)
      return;
    }
    const dist = distance(fm.marker.getLatLng(), latlng);
    console.debug(`  - Pollutant @ ${fm.marker.getLatLng()} -- dist ${dist}`);
    if (dist < distance_threshold) {
      let d = new Date();
      let hh = String(d.getHours()).padStart(2, "0");
      let mm = String(d.getMinutes()).padStart(2, "0");
      let ss = String(d.getSeconds()).padStart(2, "0");

      console.debug(
        `[${hh}:${mm}:${ss}] Found pollution! ${dist} degrees away`,
      );
      fm.marker.addTo(map);
      fm.visible = true;
      found += 1;
    }
  });
  return found;
}
