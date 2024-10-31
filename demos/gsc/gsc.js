import { randn_bm } from "./modules/funcs.js";
import * as MS from "./modules/minesweeper.js";
import "./modules/dial.js";
import "./modules/nutritionLabel.js";
import * as EmissionSource from "./modules/emission_source.js";
import { Pollutant } from "./modules/pollutant.js";

let CURRENT_GAME_MODE = "learn";
let POLLUTANTS = [];
let N_POLLUTANTS = 3;
let N_HIDDEN_POLLUTANTS = 0;
const BEACON_OR_GRID = "grid";
const SHOW_ZONES = false;
let CYCLE_POLLUTANTS = false;
let MARKERS = [];
let SENSOR_COST = 51.99;
// indices into MARKERS, to indicate 'hidden' beacons during minesweeper
// let INACTIVE_MARKERS = [];

const LIMITS = {
  lat: { min: 55.78, max: 55.92 },
  lng: { min: -4.48, max: -4.02 },
};
const LATLNG_CENTRE = [55.853, -4.26];

const OPTIONS_MINESWEEPER = {
  // configuration specific to 'minesweeper' mode
  reveal_proportion: 0.333, // Only relevant if we use the 'inactive_markers' version
  n_pollutants_to_hide: 3,
  n_random_sensors_to_create: 10, // How many sensors to create when we deploy
};

const BEACON_DEFAULT_STYLE = {
  color: "lightgray",
  opacity: 1,
  fillColor: "lightgray",
  fillOpacity: 1,
  radius: 200,
  weight: 1,
};

// Duplicate default style with a few changes
const BEACON_DEFAULT_UNHIDDEN_STYLE = Object.assign({}, BEACON_DEFAULT_STYLE, {
  color: "gray",
  opacity: 1,
});

const BEACON_HIDDEN = Object.assign({}, BEACON_DEFAULT_STYLE, {
  fillOpacity: 0,
  opacity: 0,
});

const MAP = L.map("map", {
  maxZoom: 13,
  minZoom: 11,
  maxBounds: [
    [LIMITS.lat.min, LIMITS.lng.min],
    [LIMITS.lat.max, LIMITS.lng.max],
  ],
}).setView(LATLNG_CENTRE, 11);

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
function changeEmissionSource() {
  for (let c of document.getElementById("emission_sources").children) {
    if (c.checked == true) {
      ACTIVE_POLLUTANT = c.id;
      POLLUTION_SOURCES[ACTIVE_POLLUTANT].popover();
      return;
    }
  }
}

function randomSensor(lat_lims, lng_lims) {
  let diff_lat = lat_lims.max - lat_lims.min;
  let diff_lng = lng_lims.max - lng_lims.min;
  let wobble_lat = Math.random() * diff_lat + lat_lims.min;
  let wobble_lng = Math.random() * diff_lng + lng_lims.min;
  let ll = new L.LatLng(wobble_lat, wobble_lng);
  let marker;
  marker = L.circle(ll, BEACON_DEFAULT_STYLE);
  marker.addTo(MAP);
  // marker.bindPopup(`POPUP`);
  MARKERS.push(marker);
}

function createGridOfSensors({
  grid_density = 0.025,
  wobble_factor = 0.03,
  lat_limits,
  lng_limits,
}) {
  /* Populate the map with a grid of fake sensors
   *
   * This also applies a random latlng shift to each point, so the grid
   * is not so obvious
   */
  let { min: lat_min, max: lat_max } = lat_limits;
  let { min: lng_min, max: lng_max } = lng_limits;
  for (let lat = lat_min; lat < lat_max; lat += grid_density) {
    for (let lng = lng_min; lng < lng_max; lng += grid_density) {
      let wobble_lat = randn_bm(lat - wobble_factor, lat + wobble_factor, 1);
      let wobble_lng = randn_bm(lng - wobble_factor, lng + wobble_factor, 1);
      let ll = new L.LatLng(wobble_lat, wobble_lng);
      let marker;
      marker = L.circle(ll, BEACON_DEFAULT_STYLE);
      marker.addTo(MAP);
      // marker.bindPopup(`POPUP`);
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
          // marker.bindPopup(
          //   `<b>${node.location}</b><br>${node.area}<br>${node.postcode}`,
          // );
          MARKERS.push(marker);
        }
      });
    })
    .catch((err) => console.error("Error loading the JSON file:", err));
}

//////////////////////////////////////////////////////////////
//                          update map
//////////////////////////////////////////////////////////////
function checkForPollutedSensors() {
  // Apply the check to each marker
  MARKERS.forEach((m) => {
    if (CURRENT_GAME_MODE == "mode_minesweep") {
      m.setStyle(BEACON_HIDDEN);
    } else {
      m.setStyle(BEACON_DEFAULT_STYLE);
    }
  });

  for (let [idx, marker] of MARKERS.entries()) {
    // if (INACTIVE_MARKERS.find((el) => el == idx)) {
    //   continue;
    // }
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
      style = { color: "red", fillColor: "red", fillOpacity: 1 };
      sensor_colour = "red";
    } else if (colours_seen["orange"]) {
      style = { color: "orange", fillColor: "orange", fillOpacity: 1 };
      sensor_colour = "orange";
    } else if (colours_seen["green"]) {
      style = { color: "green", fillColor: "green", fillOpacity: 1 };
      sensor_colour = "green";
    } else {
      style = BEACON_DEFAULT_STYLE;
      if (CURRENT_GAME_MODE == "mode_minesweep") {
        style = BEACON_DEFAULT_UNHIDDEN_STYLE;
      }
      sensor_colour = "gray";
    }

    marker.setStyle(style);
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

function updateMap_minesweeper(event = undefined) {
  console.info("UPDATE minesweeper ");
  let { wind_strength, wind_angle } = updateWind();
  POLLUTANTS.forEach((p) => {
    p.setWind(wind_strength, wind_angle, MAP);
    if (SHOW_ZONES) {
      p.zones.forEach((z) => z.addTo(MAP));
    }
  });

  checkForPollutedSensors();
  if (N_HIDDEN_POLLUTANTS == 0) {
    document.getElementById("pollutant-count").innerText =
      `Found all ${POLLUTANTS.length} pollutants!`;
    // INACTIVE_MARKERS = [];
    POLLUTANTS.forEach((p) => {
      p.zones.forEach((z) => z.addTo(MAP));
    });
  } else {
    let value = parseInt(MARKERS.length * SENSOR_COST);
    document.getElementById("pollutant-count").innerHTML =
      `<b>Remaining pollutants:</b> ${N_HIDDEN_POLLUTANTS} <br> <i>Sensor cost:</i> £${value}`;
  }
}

Object.defineProperty(Array.prototype, "shuffle", {
  value: function () {
    for (let i = this.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this[i], this[j]] = [this[j], this[i]];
    }
    return this;
  },
});

function deployMoreSensors() {
  for (let i = 0; i < OPTIONS_MINESWEEPER.n_random_sensors_to_create; i++) {
    randomSensor(LIMITS.lat, LIMITS.lng);
  }
  // let n_remaining = INACTIVE_MARKERS.length;
  // let to_reveal = Math.ceil(OPTIONS_MINESWEEPER.reveal_proportion * n_remaining);
  // for (let i = 0; i < to_reveal; i++) {
  //   INACTIVE_MARKERS.pop();
  // }
  // console.debug(`INACTIVE len ${INACTIVE_MARKERS.length}`);
  updateMap_minesweeper();
}

function removePollutants() {
  // Remove existing pollutants
  if (CYCLE_POLLUTANTS) {
    if (POLLUTANTS.length < N_POLLUTANTS) {
      // still filling the buffer, so don't worry about removing the previous one
      // COULD replace this with a circular buffer
      // as long as I make sure to remove the 'target' index's map layer and zone
      // before adding a new one in
      // ...would also need to probably change the creation as it currently pushes
      // ...so would need to make it insert into specific circular buffer location
      return;
    }
    var thing = POLLUTANTS.shift();

    MAP.removeLayer(thing.marker);
    thing.zones.map((zone) => MAP.removeLayer(zone));
  } else {
    POLLUTANTS.forEach((thing) => {
      MAP.removeLayer(thing.marker);
      thing.zones.map((zone) => {
        MAP.removeLayer(zone);
      });
    });
    POLLUTANTS = [];
  }
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
    createGridOfSensors({
      grid_density: 0.025,
      wobble_factor: 0.03,
      lat_limits: LIMITS.lat,
      lng_limits: LIMITS.lng,
    });
  }
}

function visualiseGameBoundary() {
  L.rectangle(
    [
      [LIMITS.lat.min, LIMITS.lng.min],
      [LIMITS.lat.max, LIMITS.lng.max],
    ],
    {
      color: "lightgray",
      weight: 1,
      opacity: 0.3,
    },
  ).addTo(MAP);
  L.circle(LATLNG_CENTRE, { color: "magenta" }).addTo(MAP);
}

/*************************************************************
 *                                                           *
 *                      RUN THE PROGRAM                      *
 *                                                           *
 *************************************************************/
function gamemode_learn() {
  console.info("SETUP gamemode learn");
  document.getElementById("game-text").innerText =
    "Click to place an emission source on the map";
  document.getElementById("game-text").classList.remove("scenario3");
  if (CURRENT_GAME_MODE == "mode_scenario_3") {
    document.getElementById("game-text").classList.add("scenario3");
  }
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
  document.getElementById("wind_dial").addEventListener("input", updateMap);
  document.getElementById("deployMoreSensors").style.display = "none";

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
  console.info("SETUP gamemode minesweeper");
  document.getElementById("game-text").innerText =
    "Click to guess the location of a pollutant";

  MAP.on("click", function (e) {
    if (N_HIDDEN_POLLUTANTS > 0) {
      N_HIDDEN_POLLUTANTS -= MS.checkClick(e.latlng, MAP);
      if (N_HIDDEN_POLLUTANTS < 0) {
        N_HIDDEN_POLLUTANTS = 0;
      }
      updateMap_minesweeper(e);
    }
  });

  document.getElementById("pollutant-count").style.display = "inline";
  document
    .getElementById("wind_strength")
    .addEventListener("change", updateMap_minesweeper);
  document
    .getElementById("wind_dial")
    .addEventListener("change", updateMap_minesweeper);
  document
    .getElementById("wind_dial")
    .addEventListener("input", updateMap_minesweeper);

  document.getElementById("deployMoreSensors").style.display = "inline";
  document
    .getElementById("deployMoreSensors")
    .addEventListener("click", deployMoreSensors);

  // Load the sensors and set the default state
  // generateMarkers();
  // for (let i = 0; i < OPTIONS_MINESWEEPER.n_random_sensors_to_create; i++) {
  //   randomSensor(LIMITS.lat, LIMITS.lng);
  // }
  MARKERS.forEach((m) => MAP.removeLayer(m));
  MARKERS = [];

  let { wind_strength, wind_angle } = updateWind();
  // for (let [idx, val] of MARKERS.entries()) {
  //   INACTIVE_MARKERS.push(idx);
  // }
  // INACTIVE_MARKERS.shuffle();
  POLLUTANTS = MS.generateRandomPollution(
    OPTIONS_MINESWEEPER.n_pollutants_to_hide,
    MAP,
    wind_strength,
    wind_angle,
  );
  N_HIDDEN_POLLUTANTS = POLLUTANTS.length;

  deployMoreSensors();
  // updateMap_minesweeper();
}

function change_gamemode(e) {
  CURRENT_GAME_MODE = document.getElementById("game_mode").value;
  removePollutants();
  hidePopover();
  // INACTIVE_MARKERS = [];

  // Remove existing event listeners
  MAP.off("click");
  // document
  //   .getElementById("pollution_level")
  //   .addEventListener("change", updateMap);
  document
    .getElementById("wind_strength")
    .removeEventListener("change", updateMap);
  document.getElementById("wind_dial").removeEventListener("change", updateMap);
  document.getElementById("wind_dial").removeEventListener("input", updateMap);
  document
    .getElementById("emission_sources")
    .removeEventListener("click", changeEmissionSource);
  document
    .getElementById("stats-popover")
    .removeEventListener("click", hidePopover);

  const el_dial = document.getElementById("wind_dial").parentElement;
  el_dial.disabled = false;
  el_dial.style.opacity = "1.0";

  const el_strength = document.getElementById("wind_strength");
  el_strength.disabled = false;

  const el_hint = document.getElementById("game-hint");

  ["scenario1", "scenario2", "scenario3"].forEach((n) => {
    el_hint.classList.remove(n);
    el_strength.parentElement.classList.remove(n);
    el_strength.classList.remove(n);
    el_dial.classList.remove(n);
  });

  CYCLE_POLLUTANTS = false;
  console.log("------------------------------------------------------------");
  console.log("CURRENT_GAME_MODE =", CURRENT_GAME_MODE);
  switch (CURRENT_GAME_MODE) {
    case "mode_learn":
      el_hint.classList.add("scenario_null");
      el_hint.innerText =
        "Place emissions and play with wind to see how it affects the map.";
      gamemode_learn();
      break;
    case "mode_minesweep":
      el_hint.classList.add("scenario_null");
      el_hint.innerText = "Use all your practice to find 3 hidden pollutants!";
      gamemode_minesweep();
      break;
    case "mode_scenario_1":
      // SCENARIO 1
      // Only wind strength
      console.log(`Scenario 1 -- wind strength only`);
      el_dial.disabled = true;
      el_dial.style.opacity = "0.5";

      el_strength.parentElement.classList.add("scenario1");
      el_strength.classList.add("scenario1");

      el_hint.classList.add("scenario1");
      el_hint.innerText =
        "What does wind strength do to the emissions pattern?";

      document.getElementById("wind_strength").selectedIndex = 2;
      gamemode_learn();
      break;
    case "mode_scenario_2":
      // Scenario 2
      // only wind DIRECTION
      console.log(`Scenario 2 -- wind direction only`);
      el_strength.disabled = true;

      el_dial.classList.add("scenario2");

      el_hint.classList.add("scenario2");
      el_hint.innerText =
        "What happens to emissions when you change wind direction?";
      document.getElementById("wind_strength").selectedIndex = 2;
      gamemode_learn();
      break;
    case "mode_scenario_3":
      // Scenario 3
      // Multiple sensors, without changing any params
      console.log(`Scenario 3 -- multiple sensors only`);

      CYCLE_POLLUTANTS = true;
      el_hint.classList.add("scenario3");
      el_hint.innerText =
        "Try adding 3 emission sources. How do they affect each other?";
      gamemode_learn();
      break;
  }
}

setTimeout(() => (document.getElementById("wind_dial").value = 90), 200);
document
  .getElementById("game_mode")
  .addEventListener("change", change_gamemode);
change_gamemode();

/* Visualise the latlong limits, and where we're focusing the centre of the map */
// visualiseGameBoundary();
//
