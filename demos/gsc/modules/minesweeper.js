export let grid_fm = [];

export function generateRandomPollution(n_pollution, map) {
	let lat_bounds = [55.8, 55.9];
	let lat_diff = lat_bounds[1] - lat_bounds[0];
	let lng_bounds = [-4.35, -4.2];
	let lng_diff = lng_bounds[1] - lng_bounds[0];
	grid_fm.forEach((f) => map.removeLayer(f));

	for (let i = 0; i < n_pollution; i++) {
		let lat = lat_bounds[0] + Math.random() * lat_diff;
		let lng = lng_bounds[0] + Math.random() * lng_diff;

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

		let fm = L.marker([0, 0], markerOptions);
		fm.setLatLng(new L.LatLng(lat, lng));
		grid_fm.push(fm);
		fm.addTo(map);
	}
}

export function checkClick(latlng, map) {
	let px_click = map.latLngToLayerPoint(latlng);
	let radius_threshold = 100;
	grid_fm.forEach((fm) => {
		let px_pollution = map.latLngToLayerPoint(fm.getLatLng())
		let dx = Math.abs(px_click.x - px_pollution.x);
		let dy = Math.abs(px_click.y - px_pollution.y);
		let radius = Math.floor(Math.sqrt(dx * dx + dy * dy));
		if (radius < radius_threshold) {
			let d = new Date();
			let hh = String(d.getHours()).padStart(2, '0');
			let mm = String(d.getMinutes()).padStart(2, '0');
			let ss = String(d.getSeconds()).padStart(2, '0');

			console.log(`[${hh}:${mm}:${ss}] Found pollution! ${radius} px away`)
		}
	})
}
