export function fireEvent(element, eventName, data, bubbles = true, cancelable = true) {
  const event = document.createEvent('HTMLEvents')
  event.initEvent(eventName, bubbles, cancelable)
  if (data) {
    event.data = data
  }
  return element.dispatchEvent(event)
}

export function validateEnum(val, choices) {
  if (choices.includes(val)) {
    return val
  }
  throw new Error(`invalid type, only ${choices.join(',')} allowed.`)
}

class WcRotationInput extends HTMLElement {
  #isManipulating = false
  #center = {}
  #precision = 2
  #unit = 'deg'
  #current_value = 90
  #disabled = false
  #random_start = true
  static #unitType = ['deg', 'rad']
  #trigger = 'manipulate'
  static #triggerType = ['manipulate', 'settled']
  static observedAttributes = ['precision', 'unit', 'trigger', 'current_value', 'random_start']

  constructor(value) {
    super()
    this.bind(this)
  }
  bind(element) {
    this.render = this.render.bind(element)
    this.cacheDom = this.cacheDom.bind(element)
    this.attachEvents = this.attachEvents.bind(element)
    this.onPointerDown = this.onPointerDown.bind(element)
    this.onPointerMove = this.onPointerMove.bind(element)
    this.onPointerUp = this.onPointerUp.bind(element)
  }
  render() {
    this.shadow = this.attachShadow({mode: 'open'})

    this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    flex-flow: row nowrap;
                    gap: 0.5rem;
                    align-items: center;
                    width: 8rem;
                    height: 3rem;
                    --half-stroke: calc(var(--stroke-width, 1px) / 2);
                }
                svg {
                    width: auto;
                    height: 100%;
                }
                circle {
                    r : calc(50% - var(--half-stroke));
                    cx : 50%;
                    cy : 50%;
                    fill: var(--fill-color, #fff);
                    stroke-width: var(--stoke-width, 1px);
                    stroke: var(--stroke-color, #000);
                }
                #pointer {
                    stroke-width: var(--stoke-width, 1px);
                    stroke: var(--stroke-color, #000);
                    transform-origin: center center;
                }
                #value {
                    user-select: none;
                }
            </style>
			Wind<br>direction
            <svg viewBox="0 0 24 24">
                <circle />
                <line x1="50%" x2="100%" y1="50%" y2="50%" id="pointer"/>
            </svg>
            <div style="display: none;" id="value"></div>

        `
  }
  connectedCallback() {
    this.render()
    this.cacheDom()
    this.attachEvents()
  }
  cacheDom() {
    this.dom = {
      input: this.querySelector('input'),
      pointer: this.shadow.querySelector('#pointer'),
      value: this.shadow.querySelector('#value'),
      svg: this.shadow.querySelector('svg'),
    }
  }
  attachEvents() {
    this.dom.svg.addEventListener('pointerdown', this.onPointerDown)
    let input = this.querySelector('input')
    input.value = this.#current_value

    this.dom.pointer.style = `transform: rotateZ(${this.#current_value - 90}deg)`
    fireEvent(input, 'input')
    fireEvent(input, 'change')
  }
  onPointerDown(e) {
    if (this.#disabled) {
      return
    }

    this.#isManipulating = true
    const rect = this.dom.svg.getBoundingClientRect()
    this.#center = {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2}
    document.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('pointerup', this.onPointerUp)
  }
  onPointerMove(e) {
    if (this.#disabled) {
      return
    }
    const offsetX = e.clientX - this.#center.x
    const offsetY = this.#center.y - e.clientY //y-coords flipped
    let rad
    if (offsetX >= 0 && offsetY >= 0) {
      rad = Math.atan(offsetY / offsetX)
    } else if (offsetX < 0 && offsetY >= 0) {
      rad = Math.PI / 2 + Math.atan(-offsetX / offsetY)
    } else if (offsetX < 0 && offsetY < 0) {
      rad = Math.PI + Math.atan(offsetY / offsetX)
    } else {
      rad = (3 * Math.PI) / 2 + Math.atan(offsetX / -offsetY)
    }
    const deg = (180 / Math.PI) * rad
    let finalValue = (this.#unit === 'rad' ? rad : deg).toFixed(this.#precision)
    this.dom.pointer.style = `transform: rotateZ(-${deg}deg)`
    this.dom.value.textContent = finalValue

    finalValue = Math.abs(finalValue - 450)

    if (this.#trigger === 'manipulate') {
      this.dom.input.value = finalValue
      this.#current_value = finalValue
      fireEvent(this.dom.input, 'input')
      fireEvent(this.dom.input, 'change')
    } else {
      this.#current_value = finalValue
      this.dom.input.value = finalValue

      fireEvent(this.dom.input, 'input')
      fireEvent(this.dom.input, 'change')
    }
  }
  onPointerUp() {
    this.#isManipulating = false
    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)
    if (this.#trigger === 'settled') {
      this.dom.input.value = this.#current_value
      fireEvent(this.dom.input, 'input')
      fireEvent(this.dom.input, 'change')
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    this[name] = newValue
  }
  set precision(val) {
    this.#precision = parseInt(val)
  }
  set unit(val) {
    this.#unit = validateEnum(val, WcRotationInput.#unitType)
  }
  set trigger(val) {
    this.#trigger = validateEnum(val, WcRotationInput.#triggerType)
  }
  set current_value(val) {
    this.#current_value = parseInt(val)
  }

  set random_start(val) {
    this.#random_start = val
  }

  set disabled(val) {
    this.#disabled = val
  }
}

customElements.define('wc-rotation-input', WcRotationInput)
