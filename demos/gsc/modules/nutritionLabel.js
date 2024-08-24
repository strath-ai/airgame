export class NutritionLabel extends HTMLElement {
	#name = "";
	#pm = 0;
	#sox = 0;
	#co2 = 0;
	static observedAttributes = ["name", "pm", "sox", "co2"];

	constructor() {
		super();
		this.bind(this);
	}

	bind(element) {
		this.render = this.render.bind(element);
	}


	render(element) {
		this.shadow = this.attachShadow({ mode: "open" });

		this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    flex-flow: row nowrap;
                    gap: 0;
                    align-items: center;
					font-size: 0.4em;
                }
				#nutri-pm {
					fill: #ee7777;
				}
				#nutri-sox {
					fill: #77ee77;
				}
				#nutri-co2 {
					fill: #ffbb77;
				}
			</style>

			<nutrition-block name="pm" rating="${this.#pm}"></nutrition-block>
			<nutrition-block name="co2" rating="${this.#co2}"></nutrition-block>
			<nutrition-block name="SOx" rating="${this.#sox}"></nutrition-block>
        `;
	}
	connectedCallback() {
		this.render();
	}
	attributeChangedCallback(name, oldValue, newValue) {
		this[name] = newValue;
	}
	set name(val) {
		this.#name = val;
	}
	set pm(val) {
		this.#pm = val;
	}
	set sox(val) {
		this.#sox = val;
	}
	set co2(val) {
		this.#co2 = val;
	}

}

export class NutritionBlock extends HTMLElement {
	#name = "";
	#rating = 0;

	static observedAttributes = ["rating", "name"];

	constructor() {
		super();
		this.bind(this);
	}

	bind(element) {
		this.render = this.render.bind(element);
	}

	render(element) {
		this.shadow = this.attachShadow({ mode: "open" });
		let color = ["#77ee77", "#ffbb77", "#ee7777"][Number(this.#rating)];
		let rating_txt = ["LO", "MID", "HI"][Number(this.#rating)];
		let rating_x = [64, 55, 64][Number(this.#rating)];
		this.shadow.innerHTML = `
			<style>
			.rating_text {
				font-family:'ArialMT', 'Arial', sans-serif;
				font-size:75px;
				font-weight: bold;
			}
			.nutrition_name {
				font-family:'ArialMT', 'Arial', sans-serif;
				font-size:75px;
			}
			</style>
			<svg width="100%" height="100%" viewbox="0 0 239 356" class = "nutrition_block">
				<path id="nutri-${this.#name}" d="M5.258,70.396c-0,-35.951 51.161,-65.138 114.176,-65.138c63.016,-0 114.176,29.187 114.176,65.138l0,214.268c0,35.951 -51.16,65.138 -114.176,65.138c-63.015,0 -114.176,-29.187 -114.176,-65.138l-0,-214.268Z" style="fill:${color};stroke:#000;stroke-width:10.52px;"/>
				<path d="M5.258,230.174l228.352,0" style="fill:none;stroke:#000;stroke-width:10.52px;"/>
				<g transform="matrix(75,0,0,75,169.108,102.722)">
				</g>
				<text x="55px" y="102px" class="nutrition_name" class="nutrition_name">${this.#name}</text>
				<text x="${rating_x}px" y="192px"  class="rating_text">${rating_txt}</text>

			</svg>
        `;
	}
	connectedCallback() {
		this.render();
	}
	attributeChangedCallback(name, oldValue, newValue) {
		this[name] = newValue;
	}
	set name(val) {
		this.#name = val;
	}
	set rating(val) {
		this.#rating = val;
	}
}

customElements.define("nutrition-label", NutritionLabel);
customElements.define("nutrition-block", NutritionBlock);
