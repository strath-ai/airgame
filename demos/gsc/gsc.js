let zoom = 13;
const map = L.map("map").setView([55.853, -4.25], zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

const size = 64;
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

const firemarkers = [L.marker([0, 0], markerOptions).addTo(map)];
let triangles = [];
const markers = [];
let showTriangle = false;

// // Function to load and add the JSON markers to the map
fetch("node-locations.json")
	.then((response) => response.json())
	.then((data) => {
		data.forEach((node) => {
			// check node.latitude and node.longitude are not null
			if (node.latitude && node.longitude) {
				const marker = L.circle([node.latitude, node.longitude], {
					color: "gray", // Outline color
					fillColor: "gray", // Fill color
					fillOpacity: 1, // Adjust fill opacity as needed
					radius: 125, // Radius in meters
				}).addTo(map);
				marker.bindPopup(
					`<b>${node.location}</b><br>${node.area}<br>${node.postcode}`,
				);
				markers.push(marker);
			}
		});
	})
	.catch((err) => console.error("Error loading the JSON file:", err));

// Function to create a triangle
function createTriangle(latlng, height, color, wind, pollution) {
	let tri_height = height * [0.1, 0.2, 0.3][wind];
	let tri_width = height * [0.1, 0.2, 0.3][pollution]
	const triangle = L.polygon(
		[
			[latlng.lat, latlng.lng],
			[latlng.lat + tri_height, latlng.lng - tri_width],
			[latlng.lat + tri_height, latlng.lng + tri_width],
		],
		{
			color: color,
			fillColor: color,
			fillOpacity: 0.1,
		},
	);
	return triangle;
}

function distance(point1, point2) {
	return Math.sqrt(
		Math.pow(point2.lat - point1.lat, 2) +
			Math.pow(point2.lng - point1.lng, 2),
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

		const rotatedLat = pivotPoint[0] +
			(latDiff * Math.cos(angleRad) - lngDiff * Math.sin(angleRad));
		const rotatedLng = pivotPoint[1] +
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
		x: translatedPoint.x * Math.cos(angleRad) -
			translatedPoint.y * Math.sin(angleRad) +
			pivot.x,
		y: translatedPoint.x * Math.sin(angleRad) +
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
			angleRad,
		);
		return cartesianToLatLng(
			rotatedCartesian.x,
			rotatedCartesian.y,
			rotatedCartesian.z,
		);
	});

	return rotatedPoints;
}

// Rotate by pixels -- more like an intuitive 'visual' rotation, as lat long are different so the rotation
function rotatePixelPoint(point, angle, origin) {
	const rad = (angle * Math.PI) / 180;
	const x = point.x - origin.x;
	const y = point.y - origin.y;

	const rotatedX = x * Math.cos(rad) - y * Math.sin(rad);
	const rotatedY = x * Math.sin(rad) + y * Math.cos(rad);

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

// Function to check if a point is inside a polygon (triangle)
function isPointInPolygon(point, polygon) {
	const x = point.lat,
	y = point.lng;

	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		let xi = polygon[i].lat,
		yi = polygon[i].lng;
		let xj = polygon[j].lat,
		yj = polygon[j].lng;

		let intersect = yi > y != yj > y &&
			x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}

	return inside;
}

function rotateTriangle(triangle, scheme, angle) {
	let newtriangle = undefined;
	const color = triangle.options.color;
	switch (scheme) {
		case "normal":
			// Rotate the triangle by xx degrees around the first point (default behavior)
			const rotatedTriangleCoordinates = rotatePolygon(
				triangle.getLatLngs()[0],
				angle,
			);

			const rotatedTriangle = L.polygon(rotatedTriangleCoordinates, {
				color: color,
				fillColor: color,
				fillOpacity: 0.1,
			});
			newtriangle = rotatedTriangle;
			break;
		case "cartesian":
			// Rotate the triangle by xx degrees around the first point (default behavior)
			const rotatedCartesianCoordinates = rotatePolygonCartesian(
				triangle.getLatLngs()[0],
				-angle,
			);
			const rotatedCartesianTriangle = L.polygon(
				rotatedCartesianCoordinates,
				{
					color: color,
					fillColor: color,
					fillOpacity: 0.1,
				},
			);
			newtriangle = rotatedCartesianTriangle;
			break;

		case "pixel":
			const rotatedTrianglePolygon = L.polygon(
				rotatePixelPolygon(triangle, angle),
				{
					color: color,
					fillColor: color,
					fillOpacity: 0.1,
				},
			);
			newtriangle = rotatedTrianglePolygon;
			break;
	}
	return newtriangle;
	// triangles.push(rotatedTriangle);
	// break;
}

function updateMap() {
	// const rotation_scheme = document.getElementById("rotation_scheme").value;
	const rotation_scheme = "pixel";
	const rotation_angle = Number(document.getElementById("rotation").value);
	const pollution_level = Number(document.getElementById("pollution_level").selectedIndex);
	const wind_strength = Number(document.getElementById("wind_strength").selectedIndex);

	// Remove previous triangles
	const latlng = firemarkers[0].getLatLng();
	firemarkers.forEach((f) => map.removeLayer(f));

	for (let i = 0; i <= pollution_level; i++){
		let f = L.marker([0, 0], markerOptions);
		f.addTo(map);
		let newLatLng = new L.LatLng(latlng.lat - (i * 0.001), latlng.lng + (i * (i % 2 ? -1 : 1 ) * 0.001));
		f.setLatLng(newLatLng);
		firemarkers.push(f);
	}

	triangles.forEach((triangle) => {
		map.removeLayer(triangle);
	});
	triangles = [		
		createTriangle(latlng, 0.4, "green", wind_strength, pollution_level),
		createTriangle(latlng, 0.2, "orange", wind_strength, pollution_level),
		createTriangle(latlng, 0.1, "red", wind_strength, pollution_level),
	];

	triangles = triangles.map((t) => rotateTriangle(t, rotation_scheme, rotation_angle));
	if (showTriangle) {
		triangles.forEach((t) => t.addTo(map));
	}

	// Apply the check to each marker
	let defaultColor = "gray";
	markers.forEach((m) => m.setStyle({ color: defaultColor, fillColor: defaultColor }));
	for (const triangle of triangles) {
		let triangleCoords = triangle.getLatLngs()[0];
		let triangleColor = triangle.options.color;

		for (let marker of markers) {
			let latLng = marker.getLatLng();

			if (isPointInPolygon(latLng, triangleCoords)) {
				marker.setStyle({ color: triangleColor, fillColor: triangleColor });
			}
		}
	}
}

map.on("click", function(e) { 
	firemarkers[0].setLatLng(e.latlng);
	console.log(firemarkers[0]);
	updateMap() 
});

// Create a custom control element
var windDirectionControl = L.control({ position: "bottomleft" });

windDirectionControl.onAdd = function (map) {
  var angle = 45;
  var div = L.DomUtil.create("div", "rotatable-icon-container");
  div.innerHTML = `<div class="rotatable-icon" style="transform: rotate(${angle}deg);"></div>`;
  return div;
};

windDirectionControl.addTo(map);
