let dispersionZoneFactors = {
  normal: [
    [1.65, 0.55], // no wind
    [1.6, 0.7], // no wind
    [1.55, 0.85], // no wind
    [1.5, 1.0],
    [1.3, 1.2],
    [1.1, 1.4],
    [0.9, 1.6],
    [0.7, 1.8],
    [0.5, 2.0],
  ],
}['normal'] // Scale (WIDTH, HEIGHT) based on chosen wind speed

export class Pollutant {
  constructor({emission_source, latlng}) {
    this.source = emission_source
    this.latlng = latlng

    const pollutionSourceSize = window.innerWidth > 700 ? 64 : 32
    const markerOptions = {
      draggable: false,
      icon: L.divIcon({
        iconSize: [pollutionSourceSize, pollutionSourceSize],
        // (width / 2, pollutionSourceSize) works with fire as it sits on bottom middle of the box
        // for the bus or whatever, if they are floating in the centre of the square, probably want
        // both to be /2
        iconAnchor: [pollutionSourceSize / 2, pollutionSourceSize],
        className: 'emoji-marker',
        html: emission_source.icon,
      }),
    }

    this.visible = true
    this.marker = L.marker([0, 0], markerOptions)
    this.zones = []
  }
  setVisible(visible) {
    this.visible = visible
  }

  setWind(wind_strength, wind_angle, map) {
    this.zones.forEach((z) => map.removeLayer(z))
    const dispersion_zone_scale = 0.1

    if (wind_strength == 0) {
      this.zones = [
        createCircle(this.latlng, dispersion_zone_scale / 2, 'green'),
        createCircle(this.latlng, dispersion_zone_scale / 4, 'orange'),
        createCircle(this.latlng, dispersion_zone_scale / 8, 'red'),
      ]
    } else {
      this.zones = [
        createTriangle(this.latlng, dispersion_zone_scale, 'green', wind_strength),
        createTriangle(this.latlng, dispersion_zone_scale / 2, 'orange', wind_strength),
        createTriangle(this.latlng, dispersion_zone_scale / 4, 'red', wind_strength),
      ]

      this.zones = this.zones.map((t) => rotateTriangle(t, wind_angle, this.latlng, map))
    }
  }

  which_colour_overlaps(latLng) {
    let colour = undefined
    for (const dispersionZone of this.zones) {
      let latlngs = dispersionZone.getLatLngs()[0]
      //let colour = dispersionZone.options.color;
      // Polygons are in z order, so we should go through
      // green, orange, red...returning the highest colour that
      // we found a point in.
      //
      // If we fail the green check, don't need to check higher layers
      // as earlier layers are larger than later
      if (isPointInPolygon(latLng, latlngs)) {
        colour = dispersionZone.options.color
      } else {
        break
      }
    }
    return colour
  }
}

// Function to create a triangle
function createTriangle(latlng, height, color, wind) {
  let tri_width = height * dispersionZoneFactors[wind][0]
  let tri_height = height * dispersionZoneFactors[wind][1]

  return L.polygon(
    [
      [latlng.lat - 0.001, latlng.lng],
      [latlng.lat + tri_height, latlng.lng - tri_width],
      [latlng.lat + tri_height, latlng.lng + tri_width],
    ],
    {
      color: color,
      opacity: 0.2,
      stroke: false,
      fillColor: color,
      fillOpacity: 0.2,
    },
  )
}

function rotateTriangle(triangle, angle, pivot = null, map) {
  return L.polygon(
    rotatePixelPolygon(triangle, angle, (pivot = pivot || pollution_source[0].getLatLng()), map),
    triangle.options,
  )
}

// Function to check if a point is inside a polygon (triangle)
function isPointInPolygon(point, polygon) {
  const x = point.lat,
    y = point.lng

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lat,
      yi = polygon[i].lng
    let xj = polygon[j].lat,
      yj = polygon[j].lng

    let intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

////////////////////////////////////////////////////////////////////////////////
// Functions to Rotate a polygon around a pivot point using Cartesian coordinates
////////////////////////////////////////////////////////////////////////////////
// Rotate by pixels -- more like an intuitive 'visual' rotation,
// as lat long are different so the rotation
function rotatePixelPoint(point, angle, origin) {
  const rad = (angle * Math.PI) / 180
  const x = point.x - origin.x
  const y = point.y - origin.y

  const rotatedX = x * Math.cos(rad) - y * Math.sin(rad)
  const rotatedY = x * Math.sin(rad) + y * Math.cos(rad)

  return L.point(rotatedX + origin.x, rotatedY + origin.y)
}

function rotatePixelPolygon(polygon, angle, pivot = null, map) {
  let px_points = polygon.getLatLngs()[0].map((point) => {
    return map.latLngToLayerPoint(point)
  })
  let origin = px_points[0]
  if (pivot) {
    origin = map.latLngToLayerPoint(pivot)
  }
  let px_rotated = px_points.map((point) => {
    return rotatePixelPoint(point, angle, origin)
  })

  return px_rotated.map((point) => {
    return map.layerPointToLatLng(point)
  })
}

function createCircle(latlng, radius, color) {
  // because of the map projection, using the same radius for lat and lng
  // looks distorted/squashed
  // instead, use the below ratio when modifying the radius to get a visually
  // equal octagon
  // ...calculated by generating a circle, getting it's latlng bounds,
  // and calculating the ratio between their respective west-centre and north-centre radii
  const lat_lng_ratio = 1.7815211511100661
  let radius_lat = radius
  let radius_lng = lat_lng_ratio * radius_lat
  let points = []
  let n_points = 16
  for (let i = 0; i < n_points; i++) {
    let ang = ((360 / n_points) * i * Math.PI) / 180
    let lat = radius_lat * Math.cos(ang)
    let lng = radius_lng * Math.sin(ang)
    points.push(new L.LatLng(latlng.lat + lat, latlng.lng + lng))
  }
  //map.removeLayer(c);
  return L.polygon(points, {
    color: color,
    opacity: 0.2,
    stroke: false,
    fillColor: color,
    fillOpacity: 0.2,
  })
}
