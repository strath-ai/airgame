// Wrapper around javascripts' default random to turn it from uniform
// to approximately normally distributed
export function rand_normal(min, max, skew) {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random() //Converting [0,1) to (0,1)
  while (v === 0) v = Math.random()
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)

  num = num / 10.0 + 0.5 // Translate to 0 -> 1
  if (num > 1 || num < 0)
    num = randn_bm(min, max, skew) // resample between 0 and 1 if out of range
  else {
    num = Math.pow(num, skew) // Skew
    num *= max - min // Stretch to fill range
    num += min // offset to min
  }
  return num
}

export function generateRandomLatLngGrid({
  grid_density = [0.025, 0.025],
  wobble_factor = 0.03,
  lat_limits,
  lng_limits,
  rand_method = 'normal',
}) {
  let {min: lat_min, max: lat_max} = lat_limits
  let {min: lng_min, max: lng_max} = lng_limits
  let [density_lat, density_lng] = grid_density
  var grid = []
  for (let lat = lat_min; lat < lat_max; lat += density_lat) {
    for (let lng = lng_min; lng < lng_max; lng += density_lng) {
      if (rand_method == 'normal') {
        let wobble_lat = rand_normal(lat - wobble_factor, lat + wobble_factor, 1)
        let wobble_lng = rand_normal(lng - wobble_factor, lng + wobble_factor, 1)
        let ll = new L.LatLng(wobble_lat, wobble_lng)
        grid.push(ll)
      } else {
        let ll = generateLatLng(lat_limits, lng_limits)
        grid.push(ll)
      }
    }
  }
  return grid
}

export function generateLatLng(lat_bounds, lng_bounds) {
  let lat_diff = lat_bounds.max - lat_bounds.min
  let lng_diff = lng_bounds.max - lng_bounds.min
  let lat = lat_bounds.min + Math.random() * lat_diff
  let lng = lng_bounds.min + Math.random() * lng_diff

  return new L.LatLng(lat, lng)
}

export function randomChoice(array) {
  var shuffled = array
    .map((value) => ({value, sort: Math.random()}))
    .sort((a, b) => a.sort - b.sort)
    .map(({value}) => value)

  return shuffled[0]
}

export const popupCenter = ({url, title, w, h}) => {
  // Fixes dual-screen position                             Most browsers      Firefox
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY

  const width = window.innerWidth
    ? window.innerWidth
    : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width
  const height = window.innerHeight
    ? window.innerHeight
    : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height

  const systemZoom = width / window.screen.availWidth
  const left = (width - w) / 2 / systemZoom + dualScreenLeft
  const top = (height - h) / 2 / systemZoom + dualScreenTop
  const newWindow = window.open(
    url,
    title,
    `
      scrollbars=yes,
      width=${w / systemZoom}, 
      height=${h / systemZoom}, 
      top=${top}, 
      left=${left}
      `,
  )

  if (window.focus) newWindow.focus()
}

export function gameNotePopover(text, timeout) {
  let el = document.getElementById('game-notes-popover')
  let el_text = document.getElementById('game-notes-popover-text')
  el_text.innerHTML = `<strong>${text}</strong>`
  el.classList.add('visible')
  setTimeout(() => {
    el.classList.remove('visible')
    el_text.innerHTML = ''
  }, timeout)
}

export function gameNotePopoverOff() {
  document.getElementById('game-notes-popover').classList.remove('visible')
}
