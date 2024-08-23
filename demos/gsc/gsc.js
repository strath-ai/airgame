import { randn_bm } from "./modules/funcs.js";
import * as MS from "./modules/minesweeper.js";
import * as DIAL from "./modules/dial.js";

let beacon_or_grid = "grid";

// _____ ____  ___    _    _   _  ____ _     _____ 
// |_   _|  _ \|_ _|  / \  | \ | |/ ___| |   | ____|
//  | | | |_) || |  / _ \ |  \| | |  _| |   |  _|  
//  | | |  _ < | | / ___ \| |\  | |_| | |___| |___ 
//  |_| |_| \_\___/_/   \_\_| \_|\____|_____|_____|
//  TRIANGLE
let triangles = [];
let showTriangle = false;
let triangleScale = 0.1;
let triangle_factors = {
	'normal': [
		[1.0, 0.1], // no wind
		[1.5, 1.0], // calm
		[1.0, 1.5], // medium breeze
		[0.5, 2.0]  // gale
	]
}["normal"];  // Scale (WIDTH, HEIGHT) based on chosen wind speed


// __  __    _    ____  
// |  \/  |  / \  |  _ \ 
// | |\/| | / _ \ | |_) |
// | |  | |/ ___ \|  __/ 
// |_|  |_/_/   \_\_|    
// MAP
const map = L.map("map", {
	maxZoom: 13,
	minZoom: 11,
	maxBounds: [[55.8, -4.35], [55.9, -4.2]]
}).setView([55.853, -4.35], 11);


// MS.generateRandomPollution(1, map);

const basemaps = {
	'carto': "http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
	'osm': "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};
L.tileLayer(basemaps['carto'], { maxZoom: 15 }).addTo(map);

const pollutionSourceSize = 64;
const markerOptions = {
	draggable: true, icon: L.divIcon({
		iconSize: [pollutionSourceSize, pollutionSourceSize],
		// (width / 2, pollutionSourceSize) works with fire as it sits on bottom middle of the box
		// for the bus or whatever, if they are floating in the centre of the square, probably want
		// both to be /2
		iconAnchor: [pollutionSourceSize / 2, pollutionSourceSize],
		className: "emoji-marker",
		html: "🔥",
	})
};
const firemarkers = [L.marker([0, 0], markerOptions).addTo(map)];
const markers = [];

//  _____ _   _ _   _  ____ _____ ___ ___  _   _ ____  
// |  ___| | | | \ | |/ ___|_   _|_ _/ _ \| \ | / ___| 
// | |_  | | | |  \| | |     | |  | | | | |  \| \___ \ 
// |  _| | |_| | |\  | |___  | |  | | |_| | |\  |___) |
// |_|    \___/|_| \_|\____| |_| |___\___/|_| \_|____/ 
// functions
// Function to load and add the JSON markers to the map
function createGridOfSensors({grid_density= 0.025, wobble_factor = 0.03}) {
	for (let lat = 55.8; lat < 55.91; lat += grid_density) {
		for (let lng = -4.4; lng < -4.1; lng += grid_density) {
			let wobble_lat = randn_bm(lat - wobble_factor, lat + wobble_factor, 1);
			let wobble_lng = randn_bm(lng - wobble_factor, lng + wobble_factor, 1);
			let ll = new L.LatLng(wobble_lat, wobble_lng);
			const marker = L.circle(ll, {
				color: "magenta", // Outline color
				fillColor: "magenta", // Fill color
				fillOpacity: 1, // Adjust fill opacity as needed
				radius: 125, // Radius in meters
			}).addTo(map);
			// marker.bindPopup(
			// 	`<b>${node.location}</b><br>${node.area}<br>${node.postcode}`,
			// );
			markers.push(marker);
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
					const marker = L.circle([node.latitude, node.longitude], {
						color: "gray", // Outline color
						fillColor: "gray", // Fill color
						fillOpacity: 1, // Adjust fill opacity as needed
						radius: 125, // Radius in meters
					}).addTo(map);
					marker.bindPopup(
						`<b>${node.location}</b><br>${node.area}<br>${node.postcode}`
					);
					markers.push(marker);
				}
			});
		})
		.catch((err) => console.error("Error loading the JSON file:", err));
}

if (beacon_or_grid == "beacon") {
	loadBeaconsFromFile();
} else {
	createGridOfSensors({"grid_density": 0.025, "wobble_factor": 0.03});
}



// Function to create a triangle
export function createTriangle(latlng, height, color, wind) {
	let tri_width = height * triangle_factors[wind][0];
	let tri_height = height * triangle_factors[wind][1];

	const triangle = L.polygon(
		[
			[latlng.lat - 0.01, latlng.lng],
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
	);
	return triangle;
}

export function distance(point1, point2) {
	return Math.sqrt(
		Math.pow(point2.lat - point1.lat, 2) +
		Math.pow(point2.lng - point1.lng, 2),
	);
}

export function rotatePolygon(polygon, angleDeg, pivot = null) {
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

// Rotate by pixels -- more like an intuitive 'visual' rotation, as lat long are different so the rotation
export function rotatePixelPoint(point, angle, origin) {
	const rad = (angle * Math.PI) / 180;
	const x = point.x - origin.x;
	const y = point.y - origin.y;

	const rotatedX = x * Math.cos(rad) - y * Math.sin(rad);
	const rotatedY = x * Math.sin(rad) + y * Math.cos(rad);

	return L.point(rotatedX + origin.x, rotatedY + origin.y);
}

export function rotatePixelPolygon(polygon, angle, pivot = null) {
	let px_points = polygon.getLatLngs()[0].map((point) => {
		return map.latLngToLayerPoint(point);
	});
	let origin = px_points[0];
	if (pivot) {
		origin = map.latLngToLayerPoint(pivot);
	}
	let px_rotated = px_points.map((point) => {
		return rotatePixelPoint(point, angle, origin);
	});

	return px_rotated.map((point) => {
		return map.layerPointToLatLng(point);
	});
}

export function rotateTriangle(triangle, angle, pivot = null) {
	return L.polygon(
		rotatePixelPolygon(triangle, angle, pivot = firemarkers[0].getLatLng()),
		triangle.options
	);
}


// Function to check if a point is inside a polygon (triangle)
export function isPointInPolygon(point, polygon) {
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

function createCircle(latlng, radius, color) {
	return L.circle([latlng.lat, latlng.lng], radius,
				{
					color: color,
					opacity: 0.2,
					stroke: false,
					fillColor: color,
					fillOpacity: 0.2,
				},
			)
}

export function updatePollutionDispersionTriangles() {
	const rotation_angle = Number(document.getElementById("wind_dial").value);
	const pollution_level = Number(document.getElementById("pollution_level").selectedIndex);
	const wind_strength = Number(document.getElementById("wind_strength").selectedIndex);


	triangles.forEach((triangle) => {
		map.removeLayer(triangle);
	});
	const latlng = firemarkers[0].getLatLng();
	if (wind_strength == 0) {
		triangles = [
			createCircle(latlng, 9000, "green"),
			createCircle(latlng, 4000, "orange"),	
			createCircle(latlng, 2000, "red")	
		]
	} else {
		triangles = [
			createTriangle(latlng, triangleScale, "green", wind_strength, pollution_level),
			createTriangle(latlng, triangleScale / 2, "orange", wind_strength, pollution_level),
			createTriangle(latlng, triangleScale / 4, "red", wind_strength, pollution_level),
		];

		triangles = triangles.map((t) =>
			rotateTriangle(t, rotation_angle));

	}
	if (showTriangle) {
		triangles.forEach((t) => t.addTo(map));
	}
}

export function updatePollutionMarkers() {
	const pollution_level = Number(document.getElementById("pollution_level").selectedIndex);
	const latlng = firemarkers[0].getLatLng();
	firemarkers.forEach((f) => map.removeLayer(f));

	for (let i = 0; i <= pollution_level; i++) {
		let f = L.marker([0, 0], markerOptions);
		f.addTo(map);
		let newLatLng = new L.LatLng(latlng.lat - (i * 0.001), latlng.lng + (i * (i % 2 ? -1 : 1) * 0.001));
		f.setLatLng(newLatLng);
		firemarkers.push(f);
	}
    firemarkers = [];
}

export function rotateWindvane() {
	const rotation_angle = Number(document.getElementById("wind_dial").value);
	document.getElementById('rotatable-icon').style = `transform: rotate(${rotation_angle}deg)`;
}

export function updateMap() {
	updatePollutionDispersionTriangles();
	updatePollutionMarkers();
	rotateWindvane();

	// Apply the check to each marker
	let defaultColor = "gray";
	markers.forEach((m) => m.setStyle({ color: defaultColor, fillColor: defaultColor }));
	for (const triangle of triangles) {
		if ( typeof(triangle.getLatLngs) == "function" ){
			let triangleCoords = triangle.getLatLngs()[0];
			let triangleColor = triangle.options.color;

			for (let marker of markers) {
				let latLng = marker.getLatLng();

				if (isPointInPolygon(latLng, triangleCoords)) {
					marker.setStyle({ color: triangleColor, fillColor: triangleColor });
				}
			}
		} else {
			let circle_latlng = triangle.getLatLng();
			let color = triangle.options.color;
			for (let marker of markers) {
				let latLng = marker.getLatLng();

				let latdiff = Math.abs(latLng.lat - circle_latlng.lat);
				let lngdiff = Math.abs(latLng.lng - circle_latlng.lng);
				let raddiff = Math.sqrt(latdiff * latdiff + lngdiff * lngdiff);
				let threshold = (0.01 * triangle.getRadius() / 1000 * 1.1);
				if (raddiff < threshold) {
					marker.setStyle({ color: color, fillColor: color });
				}
			} 
		}
	}

}

map.on("click", function(e) {
	firemarkers[0].setLatLng(e.latlng);
	MS.checkClick(e.latlng, map);
	updateMap();
});

// document.getElementById("rotation").addEventListener("change", updateMap);
document.getElementById("pollution_level").addEventListener("change", updateMap);
document.getElementById("wind_strength").addEventListener("change", updateMap);
document.getElementById("wind_dial").addEventListener("input", updateMap);
document.getElementById("wind_dial").addEventListener("change", updateMap);

// firemarkers[0].setLatLng(new L.LatLng(55.853, -4.35));
// updateMap();

// Create a custom control element
var windDirectionControl = L.control({ position: "bottomleft" });

windDirectionControl.onAdd = function(map) {
	var div = L.DomUtil.create("div", "rotatable-icon-container");

	const rotation_angle = Number(document.getElementById("wind_dial").value+90);

	div.innerHTML = `<div id="rotatable-icon" style="transform: rotate(${rotation_angle}deg);"></div>`;
	return div;
};

windDirectionControl.addTo(map);

// setInterval(() => {
// 	let rotation_angle = document.getElementById("rotation").value;
// 	 let shift = Math.random() * 10;
// 	document.getElementById("rotation").value = rotation_angle + shift;
// 	 updateMap();
// }, 1000)
