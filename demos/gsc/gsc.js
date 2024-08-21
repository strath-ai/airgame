var map = L.map("map").setView([55.853, -4.25], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

const size = 64; // needs to correspond to font-size above
const iconOptions = {
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
  className: "emoji-marker",
  html: "🔥",
};
const markerOptions = {
  draggable: true,
  icon: L.divIcon(iconOptions),
};

var firemarker = L.marker([0, 0], markerOptions).addTo(map);
var triangles = [];

// Function to load and add the JSON markers to the map
fetch("node-locations.json")
  .then((response) => response.json())
  .then((data) => {
    data.forEach((node) => {
      // check node.latitude and node.longitude are not null
      if (node.latitude && node.longitude) {
        var marker = L.circle([node.latitude, node.longitude], {
          color: "gray", // Outline color
          fillColor: "gray", // Fill color
          fillOpacity: 1, // Adjust fill opacity as needed
          radius: 125, // Radius in meters
        }).addTo(map);
        marker.bindPopup(
          `<b>${node.location}</b><br>${node.area}<br>${node.postcode}`
        );
      }
    });
  })
  .catch((err) => console.error("Error loading the JSON file:", err));

// Function to create a triangle
function createTriangle(latlng, height, color) {
  const triangle = L.polygon(
    [
      [latlng.lat, latlng.lng],
      [latlng.lat + height, latlng.lng - height],
      [latlng.lat + height, latlng.lng + height],
    ],
    {
      color: color,
      fillColor: color,
      fillOpacity: 1,
    }
  );
  return triangle;
}

function distance(point1, point2) {
  return Math.sqrt(
    Math.pow(point2.lat - point1.lat, 2) + Math.pow(point2.lng - point1.lng, 2)
  );
}
function rotatePolygon(polygon, angleDeg, pivot = null) {
  const angleRad = (Math.PI / 180) * angleDeg; // Convert angle to radians

  // Ensure we are working with a flat array of coordinates
  let coordinates = polygon;

  // Check if it's a nested array (which happens if there's only one ring)
  if (Array.isArray(coordinates[0]) && coordinates[0][0].lat !== undefined) {
    coordinates = coordinates[0];
  }

  // Use the first point in the polygon as the default pivot if none is provided
  const pivotPoint = pivot
    ? [pivot.lat, pivot.lng]
    : [coordinates[0].lat, coordinates[0].lng];

  return coordinates.map((latlng) => {
    const latDiff = latlng.lat - pivotPoint[0];
    const lngDiff = latlng.lng - pivotPoint[1];

    const rotatedLat =
      pivotPoint[0] +
      (latDiff * Math.cos(angleRad) - lngDiff * Math.sin(angleRad));
    const rotatedLng =
      pivotPoint[1] +
      (latDiff * Math.sin(angleRad) + lngDiff * Math.cos(angleRad));

    return [rotatedLat, rotatedLng];
  });
}

////////////////////////////////////////////////////////////////////////////////
// Functions to Rotate a polygon around a pivot point using Cartesian coordinates
////////////////////////////////////////////////////////////////////////////////

const R = 6378137; // Earth's radius in meters (WGS 84)

// Convert from Lat/Lng to Cartesian Coordinates
function latLngToCartesian(lat, lng) {
  const phi = (lat * Math.PI) / 180; // latitude in radians
  const lambda = (lng * Math.PI) / 180; // longitude in radians

  const x = R * Math.cos(phi) * Math.cos(lambda);
  const y = R * Math.cos(phi) * Math.sin(lambda);
  const z = R * Math.sin(phi);

  return { x, y, z };
}

// Convert from Cartesian Coordinates to Lat/Lng
function cartesianToLatLng(x, y, z) {
  const lat = (Math.asin(z / R) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;

  return [lat, lng];
}

// Rotate a point in Cartesian space around a pivot
function rotateCartesian(point, pivot, angleRad) {
  const translatedPoint = {
    x: point.x - pivot.x,
    y: point.y - pivot.y,
    z: point.z - pivot.z,
  };

  const rotatedPoint = {
    x:
      translatedPoint.x * Math.cos(angleRad) -
      translatedPoint.y * Math.sin(angleRad) +
      pivot.x,
    y:
      translatedPoint.x * Math.sin(angleRad) +
      translatedPoint.y * Math.cos(angleRad) +
      pivot.y,
    z: translatedPoint.z + pivot.z, // Assuming no rotation around the z-axis (up-down)
  };

  return rotatedPoint;
}

// Main function to rotate the polygon
function rotatePolygonCartesian(polygon, angleDeg, pivot = null) {
  const angleRad = (Math.PI / 180) * angleDeg; // Convert angle to radians

  // Convert pivot point to Cartesian if provided, otherwise use the first point in the polygon
  const pivotLatLng = pivot || polygon[0];
  const pivotCartesian = latLngToCartesian(pivotLatLng.lat, pivotLatLng.lng);

  // Rotate all points in the polygon
  const rotatedPoints = polygon.map((latlng) => {
    const pointCartesian = latLngToCartesian(latlng.lat, latlng.lng);
    const rotatedCartesian = rotateCartesian(
      pointCartesian,
      pivotCartesian,
      angleRad
    );
    return cartesianToLatLng(
      rotatedCartesian.x,
      rotatedCartesian.y,
      rotatedCartesian.z
    );
  });

  return rotatedPoints;
}

/////
// Rotate pixels
///
function rotatePixelPoint(point, angle, origin) {
  var rad = (angle * Math.PI) / 180;
  var x = point.x - origin.x;
  var y = point.y - origin.y;

  var rotatedX = x * Math.cos(rad) - y * Math.sin(rad);
  var rotatedY = x * Math.sin(rad) + y * Math.cos(rad);

  return L.point(rotatedX + origin.x, rotatedY + origin.y);
}

function rotatePixelPolygon(polygon, angle, pivot = null) {
  px_points = polygon.getLatLngs()[0].map((point) => {
    return map.latLngToLayerPoint(point);
  });
  const origin = pivot || px_points[0];
  px_rotated = px_points.map((point) => {
    return rotatePixelPoint(point, angle, origin);
  });

  return px_rotated.map((point) => {
    return map.layerPointToLatLng(point);
  });
}

map.on("click", function (e) {
  firemarker.setLatLng(e.latlng);
  // Remove previous triangles
  triangles.forEach((triangle) => {
    map.removeLayer(triangle);
  });
  triangles = [];

  const rotation_scheme = document.getElementById("rotation_scheme").value;

  // Triangle
  const rotation_angle = Number(document.getElementById("rotation").value);
  const height = 0.04;
  const latlng = e.latlng;
  const triangle = L.polygon(
    [
      [latlng.lat, latlng.lng],
      [latlng.lat + height, latlng.lng - height],
      [latlng.lat + height, latlng.lng + height],
    ],
    {
      color: "green",
      fillColor: "green",
      fillOpacity: 0.2,
    }
  );
  triangle.addTo(map);
  triangles.push(triangle);

  switch (rotation_scheme) {
    case "normal":
      // Rotate the triangle by xx degrees around the first point (default behavior)
      const rotatedTriangleCoordinates = rotatePolygon(
        triangle.getLatLngs()[0],
        rotation_angle
      );

      const rotatedTriangle = L.polygon(rotatedTriangleCoordinates, {
        color: "magenta",
        fillColor: "magenta",
        fillOpacity: 0.1,
      });
      rotatedTriangle.addTo(map);
      triangles.push(rotatedTriangle);
      break;
    case "cartesian":
      // Rotate the triangle by xx degrees around the first point (default behavior)
      const rotatedCartesianCoordinates = rotatePolygonCartesian(
        triangle.getLatLngs()[0],
        -rotation_angle
      );
      const rotatedCartesianTriangle = L.polygon(rotatedCartesianCoordinates, {
        color: "magenta",
        fillColor: "magenta",
        fillOpacity: 0.1,
      });
      rotatedCartesianTriangle.addTo(map);
      triangles.push(rotatedCartesianTriangle);
      break;

    case "pixel":
      const rotatedTrianglePolygon = L.polygon(
        rotatePixelPolygon(triangle, rotation_angle),
        {
          color: "magenta",
          fillColor: "magenta",
          fillOpacity: 0.1,
        }
      );
      rotatedTrianglePolygon.addTo(map);
      triangles.push(rotatedTrianglePolygon);
      break;
  }
  const amber = createTriangle(e.latlng, 0.02, "orange");
  amber.addTo(map);
  triangles.push(amber);
  red = createTriangle(e.latlng, 0.01, "red");
  red.addTo(map);
  triangles.push(red);
});
