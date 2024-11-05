import * as F from './modules/funcs.js'
import * as MS from './modules/minesweeper.js'
import './modules/dial.js'
import './modules/nutritionLabel.js'
import * as EmissionSource from './modules/emission_source.js'
import {Pollutant} from './modules/pollutant.js'

let CURRENT_GAME_MODE = 'explore'
let POLLUTANTS = []
let N_POLLUTANTS = 1
let N_HIDDEN_POLLUTANTS = 0
const SHOW_ZONES = false
let CYCLE_POLLUTANTS = false
let MARKERS = []
let SENSOR_COST = 51.99

///////////////////////////////////////////////////////
//                   DOM elements
///////////////////////////////////////////////////////
const el_button_more_sensors = document.getElementById('button-more-sensors')
const el_emission_sources = document.getElementById('emission-sources')
const el_game_hint = document.getElementById('game-hint')
// const el_game_mode = document.getElementById("game-mode");
const el_game_text = document.getElementById('game-text')
const el_pollutant_count = document.getElementById('pollutant-count')
// const el_pollution_level = document.getElementById("pollution-level");
const el_rotatable_icon = document.getElementById('rotatable-icon')
const el_scenario_title = document.getElementById('scenario-title')
const el_stats_popover = document.getElementById('stats-popover')
const el_wind_strength = document.getElementById('wind-strength')
const el_wind_strength_parent = document.getElementById('wind-strength-parent')

/////////////////////////////////////////////////////////////////////
//         Create rotation dial with random wind direction
/////////////////////////////////////////////////////////////////////
const el_wind_dial_parent = document.getElementById('wind-dial-parent')
var wc = document.createElement('wc-rotation-input')
wc.setAttribute('precision', '2')
wc.setAttribute('unit', 'deg')
wc.setAttribute('trigger', 'settled')
wc.setAttribute('current_value', Math.floor(Math.random() * 360))
var dial = document.createElement('input')
dial.setAttribute('type', 'number')
dial.setAttribute('id', 'wind-dial')
wc.append(dial)
el_wind_dial_parent.append(wc)

const el_wind_dial = document.getElementById('wind-dial')
el_wind_dial.value = document.querySelector('wc-rotation-input').current_value

// Prevent weird scroll stuff on phones
document.addEventListener('gesturestart', function (e) {
  e.preventDefault()
})

///////////////////////////////////////////////////////
//                      SCENARIOS
///////////////////////////////////////////////////////
class Scenario {
  constructor({
    title = 'NO TITLE',
    hint = 'NO HINT',
    scenario_class = 'NO SCENARIO',
    callbacks = [],
  }) {
    this.title = title
    this.hint = hint
    this.scenario_class = scenario_class
    this.callbacks = callbacks
  }

  activate() {
    ;[el_wind_dial_parent, el_emission_sources, el_wind_strength_parent, el_stats_popover].forEach(
      (s) => {
        s.classList.add(this.scenario_class)
      },
    )

    el_scenario_title.innerHTML = this.title
    el_game_hint.innerHTML = this.hint
    el_game_hint.classList.add(this.scenario_class)
    this.callbacks.forEach((cb) => cb())
  }
}

const scenario_explore = new Scenario({
  title: 'Explore all map options',
  hint: 'Place emissions and play with wind to see how it affects the map.',
  scenario_class: 'no-scenario',
  callbacks: [gamemode_learn, randomEmitter],
})
const scenario1 = new Scenario({
  title: 'Scenario 1 &mdash; Wind strength',
  hint: 'What does wind strength do to the emissions pattern?',
  scenario_class: 'scenario1',
  callbacks: [gamemode_learn, randomEmitter],
})
const scenario2 = new Scenario({
  title: `Scenario 2 &mdash; Wind direction`,
  hint: 'What happens to emissions when you change wind direction?',
  scenario_class: 'scenario2',
  callbacks: [gamemode_learn, randomEmitter],
})
const scenario3 = new Scenario({
  title: `Scenario 3 &mdash; Multiple sources`,
  hint: 'Try adding 3 emission sources. How do they affect each other?',
  scenario_class: 'scenario3',
  callbacks: [
    gamemode_learn,
    () => {
      CYCLE_POLLUTANTS = true
      N_POLLUTANTS = 3
    },
  ],
})
const scenario4 = new MS.ScenarioMinesweeper({
  title: 'Scenario 4 &mdash; Find hidden sources',
  hint: 'Use all your practice to find 3 hidden pollutants!',
  scenario_class: 'scenario4',
  callbacks: [gamemode_minesweep],
})

//////////////////////////////////////////////////////
//                      SETTINGS
//////////////////////////////////////////////////////
const LIMITS = {
  lat: {min: 55.78, max: 55.92},
  lng: {min: -4.48, max: -4.02},
}
const LATLNG_CENTRE = [55.853, -4.26]

const OPTIONS_MINESWEEPER = {
  // configuration specific to 'minesweeper' mode
  reveal_proportion: 0.333, // Only relevant if we use the 'inactive_markers' version
  n_pollutants_to_hide: 3,
  n_random_sensors_to_create: 10, // How many sensors to create when we deploy
}

const BEACON_DEFAULT_STYLE = {
  color: 'lightgray',
  opacity: 1,
  fillColor: 'lightgray',
  fillOpacity: 1,
  radius: 200,
  weight: 1,
}

// Duplicate default style with a few changes
const BEACON_DEFAULT_UNHIDDEN_STYLE = Object.assign({}, BEACON_DEFAULT_STYLE, {
  color: 'gray',
  opacity: 1,
})

const BEACON_HIDDEN = Object.assign({}, BEACON_DEFAULT_STYLE, {
  fillOpacity: 0,
  opacity: 0,
})

const MAP = L.map('map', {
  maxZoom: 11,
  minZoom: 11,
  maxBounds: [
    [LIMITS.lat.min, LIMITS.lng.min],
    [LIMITS.lat.max, LIMITS.lng.max],
  ],
}).setView(LATLNG_CENTRE, 11)

const BASEMAPS = {
  carto: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  cartovoyage: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
}
L.tileLayer(BASEMAPS['carto'], {maxZoom: 13}).addTo(MAP)

const POLLUTION_SOURCES = {
  wildfire: EmissionSource.wildfire,
  factory: EmissionSource.factory,
  transport: EmissionSource.transport,
}
let ACTIVE_POLLUTANT = 'wildfire' // leave undefined to select first source

//////////////////////////////////////////////////////////////
//                       functions
//////////////////////////////////////////////////////////////
function changeEmissionSource() {
  for (let c of el_emission_sources.children) {
    if (c.checked == true) {
      ACTIVE_POLLUTANT = c.id
      POLLUTION_SOURCES[ACTIVE_POLLUTANT].popover()
      return
    }
  }
}

function randomSensor(lat_lims, lng_lims) {
  let ll = F.generateLatLng(lat_lims, lng_lims)
  let marker = L.circle(ll, BEACON_DEFAULT_STYLE)
  marker.addTo(MAP)
  // marker.bindPopup(`POPUP`);
  MARKERS.push(marker)
}

function createGridOfSensors({
  grid_density = [0.025, 0.025],
  wobble_factor = 0.03,
  lat_limits,
  lng_limits,
}) {
  /* Populate the map with a grid of fake sensors
   *
   * This also applies a random latlng shift to each point, so the grid
   * is not so obvious
   */
  F.generateRandomLatLngGrid({
    grid_density,
    wobble_factor,
    lat_limits,
    lng_limits,
  }).forEach((ll) => {
    const marker = L.circle(ll, BEACON_DEFAULT_STYLE)
    marker.addTo(MAP)
    // marker.bindPopup(`POPUP`);
    MARKERS.push(marker)
  })
}

//////////////////////////////////////////////////////////////
//                          update map
//////////////////////////////////////////////////////////////
function checkForPollutedSensors() {
  // Apply the check to each marker
  MARKERS.forEach((m) => {
    if (CURRENT_GAME_MODE == 'mode_minesweep') {
      m.setStyle(BEACON_HIDDEN)
    } else {
      m.setStyle(BEACON_DEFAULT_STYLE)
    }
  })

  for (let [idx, marker] of MARKERS.entries()) {
    let colours_seen = {green: 0, orange: 0, red: 0}
    for (let pollutant of POLLUTANTS) {
      let colour = pollutant.which_colour_overlaps(marker.getLatLng())
      if (colour) {
        colours_seen[colour] += 1
      }
    }
    let style
    let sensor_colour
    if (colours_seen['red']) {
      style = {color: 'red', fillColor: 'red', fillOpacity: 1}
      sensor_colour = 'red'
    } else if (colours_seen['orange']) {
      style = {color: 'orange', fillColor: 'orange', fillOpacity: 1}
      sensor_colour = 'orange'
    } else if (colours_seen['green']) {
      style = {color: 'green', fillColor: 'green', fillOpacity: 1}
      sensor_colour = 'green'
    } else {
      style = BEACON_DEFAULT_STYLE
      if (CURRENT_GAME_MODE == 'minesweeper' || CURRENT_GAME_MODE == 'scenario4') {
        style = BEACON_DEFAULT_UNHIDDEN_STYLE
      }
      sensor_colour = 'gray'
    }

    marker.setStyle(style)
  }
}

function updateWind() {
  const rotation_angle = Number(document.querySelector('wc-rotation-input').current_value)
  el_rotatable_icon.style = `transform: rotate(${rotation_angle}deg)`
  return {
    wind_strength: el_wind_strength.value,
    wind_angle: rotation_angle,
  }
}

function createNewPollutant(latlng, source, wind_strength, wind_angle) {
  let p = new Pollutant({
    emission_source: source,
    latlng: latlng,
    wind_strength: wind_strength,
    wind_angle: wind_angle,
  })

  // add new pollutants to map
  p.marker.addTo(MAP)
  p.marker.setLatLng(latlng)
  if (SHOW_ZONES) {
    p.zones.forEach((z) => z.addTo(MAP))
  }
  p.setWind(wind_strength, wind_angle, MAP)
  POLLUTANTS.push(p)
}

function updateMap(event = undefined) {
  let {wind_strength, wind_angle} = updateWind()

  if (event && event.type == 'click') {
    createNewPollutant(event.latlng, POLLUTION_SOURCES[ACTIVE_POLLUTANT], wind_strength, wind_angle)
  }

  POLLUTANTS.forEach((p) => {
    p.setWind(wind_strength, wind_angle, MAP)
    if (SHOW_ZONES) {
      p.zones.forEach((z) => z.addTo(MAP))
    }
  })

  checkForPollutedSensors()
}

function updateMap_minesweeper(event = undefined) {
  console.info('UPDATE minesweeper ')
  let {wind_strength, wind_angle} = updateWind()
  POLLUTANTS.forEach((p) => {
    p.setWind(wind_strength, wind_angle, MAP)
    if (SHOW_ZONES) {
      p.zones.forEach((z) => z.addTo(MAP))
    }
  })

  checkForPollutedSensors()
  if (N_HIDDEN_POLLUTANTS == 0) {
    el_pollutant_count.innerHTML = `Found all ${POLLUTANTS.length} pollutants!`
    POLLUTANTS.forEach((p) => {
      p.zones.forEach((z) => z.addTo(MAP))
    })
  } else {
    let value = parseInt(MARKERS.length * SENSOR_COST)
    el_pollutant_count.innerHTML = `<b>Remaining pollutants:</b> ${N_HIDDEN_POLLUTANTS}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>Sensor cost:</i> £${value}`
  }
}

Object.defineProperty(Array.prototype, 'shuffle', {
  value: function () {
    for (let i = this.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this[i], this[j]] = [this[j], this[i]]
    }
    return this
  },
})

function deployMoreSensors() {
  if (N_HIDDEN_POLLUTANTS > 0) {
    for (let i = 0; i < OPTIONS_MINESWEEPER.n_random_sensors_to_create; i++) {
      randomSensor(LIMITS.lat, LIMITS.lng)
    }
    updateMap_minesweeper()
  }
}

function removePollutants() {
  // Remove existing pollutants
  console.log(`remove pollutants -- ${POLLUTANTS.length}`)
  if (CYCLE_POLLUTANTS) {
    if (POLLUTANTS.length < N_POLLUTANTS) {
      // still filling the buffer, so don't worry about removing the previous one
      // COULD replace this with a circular buffer
      // as long as I make sure to remove the 'target' index's map layer and zone
      // before adding a new one in
      // ...would also need to probably change the creation as it currently pushes
      // ...so would need to make it insert into specific circular buffer location
      return
    }
    var thing = POLLUTANTS.shift()

    MAP.removeLayer(thing.marker)
    thing.zones.map((zone) => MAP.removeLayer(zone))
  } else {
    POLLUTANTS.forEach((thing) => {
      MAP.removeLayer(thing.marker)
      thing.zones.map((zone) => {
        MAP.removeLayer(zone)
      })
    })
    POLLUTANTS = []
  }
}

function hidePopover(e) {
  el_stats_popover.style.opacity = '0'
}

function generateMarkers() {
  MARKERS.forEach((m) => MAP.removeLayer(m))
  // Load the sensors and set the default state
  createGridOfSensors({
    grid_density: [0.025, 0.025],
    wobble_factor: 0.03,
    lat_limits: LIMITS.lat,
    lng_limits: LIMITS.lng,
  })
}

function visualiseGameBoundary() {
  L.rectangle(
    [
      [LIMITS.lat.min, LIMITS.lng.min],
      [LIMITS.lat.max, LIMITS.lng.max],
    ],
    {
      color: 'lightgray',
      weight: 1,
      opacity: 0.3,
    },
  ).addTo(MAP)
  L.circle(LATLNG_CENTRE, {color: 'magenta'}).addTo(MAP)
}

/*************************************************************
 *                                                           *
 *                      RUN THE PROGRAM                      *
 *                                                           *
 *************************************************************/
function gamemode_learn() {
  console.info('SETUP gamemode learn')
  el_game_text.innerHTML = 'Click on the map to place emissions sources!'
  el_game_text.classList.remove('scenario3')

  // read game mode from dropdown
  if (CURRENT_GAME_MODE == 'scenario3') {
    el_game_text.classList.add('scenario3')
  }

  // Set up all listeners
  MAP.on('click', function (e) {
    removePollutants()
    updateMap(e)
  })

  // document
  //   .getElementById("pollution-level")
  //   .addEventListener("change", updateMap);
  el_wind_strength.addEventListener('input', updateMap)
  el_wind_dial.addEventListener('change', updateMap)
  el_wind_dial.addEventListener('input', updateMap)
  el_button_more_sensors.style.display = 'none'

  el_emission_sources.addEventListener('click', changeEmissionSource)
  el_stats_popover.addEventListener('click', hidePopover)

  generateMarkers()

  changeEmissionSource()
  POLLUTION_SOURCES[ACTIVE_POLLUTANT].popover()
  updateMap()
}

function randomEmitter() {
  console.log('random emitter')
  let {wind_strength, wind_angle} = updateWind()
  POLLUTANTS = MS.generateRandomPollution(1, MAP, wind_strength, wind_angle)
  POLLUTANTS.forEach((p) => {
    p.marker.addTo(MAP)
  })
  updateMap()
}

function gamemode_minesweep() {
  console.info('SETUP gamemode minesweeper')
  el_game_text.innerHTML = 'Click to guess locations of emissions'

  MAP.on('click', function (e) {
    if (N_HIDDEN_POLLUTANTS > 0) {
      N_HIDDEN_POLLUTANTS -= MS.checkClick(e.latlng, MAP)
      if (N_HIDDEN_POLLUTANTS < 0) {
        N_HIDDEN_POLLUTANTS = 0
      }
      updateMap_minesweeper(e)
    }
  })

  el_pollutant_count.style.display = 'inline'
  el_wind_strength.addEventListener('change', updateMap_minesweeper)
  el_wind_strength.addEventListener('input', updateMap_minesweeper)
  el_wind_dial.addEventListener('change', updateMap_minesweeper)
  el_wind_dial.addEventListener('input', updateMap_minesweeper)

  el_button_more_sensors.style.display = 'inline'
  el_button_more_sensors.addEventListener('click', deployMoreSensors)

  MARKERS.forEach((m) => MAP.removeLayer(m))
  MARKERS = []

  let {wind_strength, wind_angle} = updateWind()
  POLLUTANTS = MS.generateRandomPollution(
    OPTIONS_MINESWEEPER.n_pollutants_to_hide,
    MAP,
    wind_strength,
    wind_angle,
  )
  N_HIDDEN_POLLUTANTS = POLLUTANTS.length

  deployMoreSensors()
  // updateMap_minesweeper();
}

function change_gamemode(e) {
  // Game mode is defined by the URL parameter "mode"
  // (e.g. localhost:8000/?mode=scenario1 )
  // and then we use a switch statement to set up scenario logic
  CURRENT_GAME_MODE = new URLSearchParams(window.location.search).get('mode')

  removePollutants()
  hidePopover()

  // Remove existing event listeners
  MAP.off('click')
  el_wind_strength.removeEventListener('change', updateMap)
  el_wind_dial.removeEventListener('change', updateMap)
  el_wind_dial.removeEventListener('input', updateMap)
  el_emission_sources.removeEventListener('click', changeEmissionSource)
  el_stats_popover.removeEventListener('click', hidePopover)

  CYCLE_POLLUTANTS = false
  console.log('------------------------------------------------------------')
  console.log('CURRENT_GAME_MODE =', CURRENT_GAME_MODE)

  switch (CURRENT_GAME_MODE) {
    default:
    case 'scenario1':
      scenario1.activate()
      break

    case 'scenario2':
      scenario2.activate()
      break

    case 'scenario3':
      scenario3.activate()
      break

    case 'minesweeper':
    case 'scenario4':
      scenario4.activate()
      break

    case 'explore':
      scenario_explore.activate()
      break
  }
}

setTimeout(() => (el_wind_dial.value = 90), 200)
// el_game_mode.addEventListener("change", change_gamemode);
change_gamemode()

/* Visualise the latlong limits, and where we're focusing the centre of the map */
// visualiseGameBoundary();
//
