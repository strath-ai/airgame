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

		console.log(this.#name);
		console.log(this.name);
		this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    flex-flow: row nowrap;
                    gap: 0.5rem;
                    align-items: center;
					font-size: 0.5em;
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
		console.log(this.#rating);
		let color = ["#77ee77", "#ffbb77", "#ee7777"][Number(this.#rating)];
		let rating_txt = ["LO", "MID", "HI"][Number(this.#rating)];
		let rating_x = [18, 14, 18][Number(this.#rating)];
		this.shadow.innerHTML = `
			<style>
			.rating_text {
				font-family:'ArialMT', 'Arial', sans-serif;
				font-size:18px;
				font-weight: bold;
			}
			.nutrition_name {
				font-family:'ArialMT', 'Arial', sans-serif;
				font-size:18px;
			}
			.nutrition_block {
				fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;
			}
			</style>
			<svg width="100%" height="100%" viewbox="3 0 57 90" class = "nutrition_block">
			<path id="nutri-${this.#name}" d="M4.064,18.507c-0,-8.628 12.278,-15.633 27.402,-15.633c15.124,-0 27.402,7.005 27.402,15.633l0,51.424c0,8.628 -12.278,15.633 -27.402,15.633c-15.124,0 -27.402,-7.005 -27.402,-15.633l-0,-51.424Z" style="fill: ${color};stroke:#000;stroke-width:2.52px;"/>
			<path d="M4.064,56.854l54.414,-0" style="fill:none;stroke:#000;stroke-width:2.52px;"/>
			<g transform="matrix(18,0,0,18,100.254,25.9466)"></g>
			<text x="18px" y="26px" class="nutrition_name">${this.#name}</text>
				<text class="rating_text" x="${rating_x}px" y="48px" >${rating_txt}</text>
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
