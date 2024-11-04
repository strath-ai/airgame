export class EmissionSource {
  #name;
  #pollution_params;
  #icon;
  #notes;

  constructor(name, icon, params, notes) {
    this.#name = name;
    this.#icon = icon;
    this.#pollution_params = params;
    this.#notes = notes;
  }

  popover() {
    let pop = `<div id="stats-title">${this.#name}</div>
		<div id="stats-label">${this.label()}</div>
		<div id="stats-notes" data-content="${this.#icon}">${this.#notes}</div>`;
    let target = document.getElementById("stats-popover");

    let title_el = document.getElementById("stats-title");
    let is_same = title_el != null && title_el.innerText == this.#name;
    let is_shown = target.style.right == "2em";
    if (is_same && is_shown) {
      return;
    }
    target.style.opacity = "0";
    target.style.right = "-50em";
    setTimeout(() => {
      target.innerHTML = pop;
      target.style.right = "2em";
      target.style.opacity = "1";
    }, 600);

    target.innerHTML = pop;
  }

  get icon() {
    return this.#icon;
  }

  label() {
    let { pm, sox, co2 } = this.#pollution_params;
    return `<nutrition-label name="${this.#name}" pm=${pm} co2=${co2} sox=${sox}></nutrition-label>`;
  }
}

let wildfire = new EmissionSource(
  "Wildfire",
  "🔥",
  { pm: 2, co2: 2, sox: 1 },
  "Wildfires are less frequent, but emit a high amount of sooty particles and CO2.",
);
let factory = new EmissionSource(
  "Factory",
  "🏭",
  { pm: 1, co2: 1, sox: 0 },
  "Cars and buses may emit less than factories, however they emit all along their travel route.",
);
let transport = new EmissionSource(
  "Transport",
  "🚌",
  { pm: 1, co2: 1, sox: 0 },
  "Cars and buses may emit less than factories, however they emit all along their travel route.",
);

export { wildfire, factory, transport };
