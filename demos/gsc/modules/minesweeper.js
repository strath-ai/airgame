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

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
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
    grid_density: 0.04,
    wobble_factor: 0.07,
    lat_limits: lat_bounds,
    lng_limits: lng_bounds,
    rand_method: "uniform",
  });

  console.log(`wobbleGrid`, wobbleGrid);

  let wobbleGridShuffled = wobbleGrid
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  grid_fm.forEach((f) => map.removeLayer(f));

  wobbleGridShuffled.slice(0, n_pollution).forEach((latlng) => {
    console.log("Creating hidden pollutant from shuffled wobble grid");

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
    // p.marker.addTo(map);
    p.marker.setLatLng(latlng);
    p.setWind(wind_strength, wind_angle, map);
    p.zones.forEach((z) => z.addTo(map));
    grid_fm.push(p);
  });

  // for (let i = 0; i < n_pollution; i++) {
  //   let latlng = F.generateLatLng(lat_bounds, lng_bounds);

  //   var far_enough = false || grid_fm.length == 0;
  //   var n_tries = 0;
  //   while (!far_enough || n_tries > 100) {
  //     n_tries += 1;
  //     // compare to all previous pollution markers to ensure they have _some_ reasonable
  //     // degree of separation

  //     latlng = F.generateLatLng(lat_bounds, lng_bounds);
  //     for (const pollutant of grid_fm) {
  //       var d = distance(pollutant.latlng, latlng);
  //       console.log(`distance ${d}`);
  //       if (d >= 11) {
  //         far_enough = true;
  //         break;
  //       }
  //     }
  //   }
  //   let p = new Pollutant({
  //     emission_source: EmissionSource.wildfire,
  //     latlng: latlng,
  //     wind_strength: wind_strength,
  //     wind_angle: wind_angle,
  //   });
  //   p.setVisible(false);

  //   // add new pollutants to map
  //   // p.marker.addTo(map);
  //   p.marker.setLatLng(latlng);
  //   p.setWind(wind_strength, wind_angle, map);
  //   p.zones.forEach((z) => z.addTo(map));
  //   grid_fm.push(p);
  // }
  grid_fm.forEach((pollutant) => {
    console.info(`Pollutant @ ${pollutant.marker.getLatLng()}`);
  });
  return grid_fm;
}

export function checkClick(latlng, map) {
  let px_click = map.latLngToLayerPoint(latlng);
  console.debug(`Clicked pixel @ ${px_click}`);
  let radius_threshold = 50;
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
    console.log(`distance ${distance(fm.marker.getLatLng(), latlng)}`);
    let px_pollution = map.latLngToLayerPoint(fm.marker.getLatLng());
    let dx = Math.abs(px_click.x - px_pollution.x);
    let dy = Math.abs(px_click.y - px_pollution.y);
    let radius = Math.floor(Math.sqrt(dx * dx + dy * dy));
    console.debug(
      `  - Pollutant pixel @ ${px_pollution} -- radius ${radius}px`,
    );
    if (radius < radius_threshold) {
      let d = new Date();
      let hh = String(d.getHours()).padStart(2, "0");
      let mm = String(d.getMinutes()).padStart(2, "0");
      let ss = String(d.getSeconds()).padStart(2, "0");

      console.debug(`[${hh}:${mm}:${ss}] Found pollution! ${radius} px away`);
      fm.marker.addTo(map);
      found += 1;
    }
  });
  return found;
}
