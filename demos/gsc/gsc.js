import { randn_bm } from "./modules/funcs.js";
import * as MS from "./modules/minesweeper.js";
import "./modules/dial.js";
import "./modules/nutritionLabel.js";
import * as EmissionSource from "./modules/emission_source.js";
import { Pollutant } from "./modules/pollutant.js";

const BEACON_OR_GRID = "grid";
const SHOW_ZONES = false;
const MARKERS = [];
const REAL_BEACON_MARKERS = false;
const BEACON_DEFAULT_STYLE = {
  color: "gray", // Outline color
  fillColor: "lightgray", // Fill color
  fillOpacity: 1, // Adjust fill opacity as needed
  radius: 170, // Radius in meters
  weight: 1,
};

let POLLUTANTS = [];

const MAP = L.map("map", {
  maxZoom: 13,
  minZoom: 11,
  maxBounds: [
    [55.8, -4.35],
    [55.9, -4.2],
  ],
}).setView([55.853, -4.35], 11);

const BASEMAPS = {
  carto: "http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  cartovoyage:
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};
L.tileLayer(BASEMAPS["carto"], { maxZoom: 13 }).addTo(MAP);

const POLLUTION_SOURCES = {
  wildfire: EmissionSource.wildfire,
  factory: EmissionSource.factory,
  transport: EmissionSource.transport,
};
let ACTIVE_POLLUTANT = "wildfire"; // leave undefined to select first source

//////////////////////////////////////////////////////////////
//                       functions
//////////////////////////////////////////////////////////////
function makeBeaconIcon(colour) {
  const plain_iconsize = [25, 56];
  const highlight_iconsize = [34, 60];
  const shadowsize = [38, 50];
  let icon;
  let iconsize;
  switch (colour) {
    case "gray":
      icon = "sensor.png";
      iconsize = plain_iconsize;
      break;
    case "green":
      icon = "sensor-green.png";
      iconsize = highlight_iconsize;

      break;
    case "orange":
      icon = "sensor-orange.png";
      iconsize = highlight_iconsize;

      break;
    case "red":
      icon = "sensor-red.png";
      iconsize = highlight_iconsize;

      break;
  }
  return L.icon({
    iconUrl: icon,
    shadowUrl: "shadow.png",
    iconSize: iconsize,
    shadowSize: shadowsize,
    iconAnchor: [0, 0],
    shadowAnchor: [3, -10],
  });
}

function changeEmissionSource() {
  for (let c of document.getElementById("emission_sources").children) {
    if (c.checked == true) {
      ACTIVE_POLLUTANT = c.id;
      POLLUTION_SOURCES[ACTIVE_POLLUTANT].popover();
      return;
    }
  }
}

function createGridOfSensors({ grid_density = 0.025, wobble_factor = 0.03 }) {
  /* Populate the map with a grid of fake sensors
   *
   * This also applies a random latlng shift to each point, so the grid
   * is not so obvious
   */
  for (let lat = 55.8; lat < 55.91; lat += grid_density) {
    for (let lng = -4.4; lng < -4.1; lng += grid_density) {
      let wobble_lat = randn_bm(lat - wobble_factor, lat + wobble_factor, 1);
      let wobble_lng = randn_bm(lng - wobble_factor, lng + wobble_factor, 1);
      let ll = new L.LatLng(wobble_lat, wobble_lng);
      let marker;
      if (REAL_BEACON_MARKERS) {
        marker = L.marker(ll, { icon: makeBeaconIcon("gray") });
      } else {
        marker = L.circle(ll, BEACON_DEFAULT_STYLE);
      }
      marker.addTo(MAP);
      // marker.bindPopup(
      // 	`<b>${node.location}</b><br>${node.area}<br>${node.postcode}`,
      // );
      MARKERS.push(marker);
    }
  }
}

function loadBeaconsFromFile() {
  fetch("node-locations.json")
    .then((response) => response.json())
    .then((data) => {
      data.forEach((node) => {
        // check node.latitude and node.longitude are not null
        if (node.latitude && node.longitude) {
          const marker = L.circle(
            [node.latitude, node.longitude],
            BEACON_DEFAULT_STYLE,
          ).addTo(MAP);
          marker.bindPopup(
            `<b>${node.location}</b><br>${node.area}<br>${node.postcode}`,
          );
          MARKERS.push(marker);
        }
      });
    })
    .catch((err) => console.error("Error loading the JSON file:", err));
}

function distance(point1, point2) {
  return Math.sqrt(
    Math.pow(point2.lat - point1.lat, 2) + Math.pow(point2.lng - point1.lng, 2),
  );
}

//////////////////////////////////////////////////////////////
//                          update map
//////////////////////////////////////////////////////////////
function checkForPollutedSensors() {
  // Apply the check to each marker
  MARKERS.forEach((m) => {
    if (REAL_BEACON_MARKERS) {
      m.setIcon(makeBeaconIcon("gray"));
    } else {
      m.setStyle(BEACON_DEFAULT_STYLE);
    }
  });

  for (let marker of MARKERS) {
    let colours_seen = { green: 0, orange: 0, red: 0 };
    for (let pollutant of POLLUTANTS) {
      let colour = pollutant.which_colour_overlaps(marker.getLatLng());
      if (colour) {
        colours_seen[colour] += 1;
      }
    }
    let style;
    let sensor_colour;
    if (colours_seen["red"]) {
      style = { color: "red", fillColor: "red" };
      sensor_colour = "red";
    } else if (colours_seen["orange"]) {
      style = { color: "orange", fillColor: "orange" };
      sensor_colour = "orange";
    } else if (colours_seen["green"]) {
      style = { color: "green", fillColor: "green" };
      sensor_colour = "green";
    } else {
      style = BEACON_DEFAULT_STYLE;
      sensor_colour = "gray";
    }

    if (REAL_BEACON_MARKERS) {
      marker.setIcon(makeBeaconIcon(sensor_colour));
    } else {
      marker.setStyle(style);
    }
  }
}

function updateWind() {
  const rotation_angle = Number(document.getElementById("wind_dial").value);
  document.getElementById("rotatable-icon").style =
    `transform: rotate(${rotation_angle}deg)`;
  return {
    wind_strength: document.getElementById("wind_strength").selectedIndex,
    wind_angle: rotation_angle,
  };
}

function createNewPollutant(latlng, source, wind_strength, wind_angle) {
  let p = new Pollutant({
    emission_source: source,
    latlng: latlng,
    wind_strength: wind_strength,
    wind_angle: wind_angle,
  });

  // add new pollutants to map
  p.marker.addTo(MAP);
  p.marker.setLatLng(latlng);
  if (SHOW_ZONES) {
    p.zones.forEach((z) => z.addTo(MAP));
  }
  p.setWind(wind_strength, wind_angle, MAP);
  POLLUTANTS.push(p);
}

function updateMap(event = undefined) {
  let { wind_strength, wind_angle } = updateWind();

  if (event && event.type == "click") {
    createNewPollutant(
      event.latlng,
      POLLUTION_SOURCES[ACTIVE_POLLUTANT],
      wind_strength,
      wind_angle,
    );
  }

  POLLUTANTS.forEach((p) => {
    p.setWind(wind_strength, wind_angle, MAP);
    if (SHOW_ZONES) {
      p.zones.forEach((z) => z.addTo(MAP));
    }
  });

  checkForPollutedSensors();
}

function mapUpdater_minesweep(event = undefined) {
  let { wind_strength, wind_angle } = updateWind();
  POLLUTANTS.forEach((p) => {
    p.setWind(wind_strength, wind_angle, MAP);
    if (SHOW_ZONES) {
      p.zones.forEach((z) => z.addTo(MAP));
    }
  });

  if (event && event.type == "click") {
    // guess pollution
  }

  checkForPollutedSensors();
}

function revealMorePollution() {
  // find gray beacons
  // get the proportion to activate
  // randomly select from the gray beacons
  // change them to the relevant pollution colour
}

function removePollutants() {
  // Remove existing pollutants
  POLLUTANTS.forEach((thing) => {
    MAP.removeLayer(thing.marker);
    thing.zones.map((zone) => {
      MAP.removeLayer(zone);
    });
  });
  POLLUTANTS = [];
}

function hidePopover(e) {
  document.getElementById("stats-popover").style.opacity = "0";
}

function generateMarkers() {
  MARKERS.forEach((m) => MAP.removeLayer(m));
  // Load the sensors and set the default state
  if (BEACON_OR_GRID == "beacon") {
    loadBeaconsFromFile();
  } else {
    createGridOfSensors({ grid_density: 0.025, wobble_factor: 0.03 });
  }
}

/*************************************************************
 *                                                           *
 *                      RUN THE PROGRAM                      *
 *                                                           *
 *************************************************************/
function gamemode_learn() {
  // Set up all listeners
  MAP.on("click", function (e) {
    removePollutants();
    updateMap(e);
  });

  // document
  //   .getElementById("pollution_level")
  //   .addEventListener("change", updateMap);
  document
    .getElementById("wind_strength")
    .addEventListener("change", updateMap);
  document.getElementById("wind_dial").addEventListener("change", updateMap);
  document
    .getElementById("emission_sources")
    .addEventListener("click", changeEmissionSource);
  document
    .getElementById("stats-popover")
    .addEventListener("click", hidePopover);

  generateMarkers();

  changeEmissionSource();
  POLLUTION_SOURCES[ACTIVE_POLLUTANT].popover();
  updateMap();
}

function gamemode_minesweep() {
  MAP.on("click", function (e) {
    MS.checkClick(e.latlng, MAP);
    mapUpdater_minesweep(e);
  });

  document
    .getElementById("wind_strength")
    .addEventListener("change", mapUpdater_minesweep);
  document
    .getElementById("wind_dial")
    .addEventListener("change", mapUpdater_minesweep);

  // Load the sensors and set the default state
  generateMarkers();
  let { wind_strength, wind_angle } = updateWind();
  POLLUTANTS = MS.generateRandomPollution(3, MAP, wind_strength, wind_angle);
  mapUpdater_minesweep();
}

function change_gamemode(e) {
  let GAME_MODE = document.getElementById("game_mode").value;
  removePollutants();
  hidePopover();

  // Remove existing event listeners
  MAP.off("click");
  // MAP.on("click", function (e) {
  //   removePollutants();
  //   updateMap(e);
  // });

  // document
  //   .getElementById("pollution_level")
  //   .addEventListener("change", updateMap);
  document
    .getElementById("wind_strength")
    .removeEventListener("change", updateMap);
  document.getElementById("wind_dial").removeEventListener("change", updateMap);
  document
    .getElementById("emission_sources")
    .removeEventListener("click", changeEmissionSource);
  document
    .getElementById("stats-popover")
    .removeEventListener("click", hidePopover);

  switch (GAME_MODE) {
    case "mode_learn":
      gamemode_learn();
      break;
    case "mode_minesweep":
      gamemode_minesweep();
      break;
  }
}

document
  .getElementById("game_mode")
  .addEventListener("change", change_gamemode);
change_gamemode();
