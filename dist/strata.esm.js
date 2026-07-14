// src/core.js
var LEVEL_NAMES = { 1: "Headline", 2: "Summary", 3: "Full" };
var enhanced = /* @__PURE__ */ new WeakSet();
var stylesInjected = false;
var CSS = `
.strata { position: relative; }
.strata-gestures { touch-action: pan-y; }
.strata-content { transform-origin: center top; }
.strata-control {
  display: inline-flex; gap: .55rem; align-items: center;
  margin: 0 0 1rem; padding: 0;
}
.strata-dot {
  width: .7rem; height: .7rem; padding: 0; border-radius: 50%;
  border: 1.5px solid currentColor; background: transparent;
  opacity: .4; cursor: pointer; transition: opacity .15s ease, background .15s ease;
  -webkit-appearance: none; appearance: none;
}
.strata-dot:hover { opacity: .7; }
.strata-dot.is-active { opacity: 1; background: currentColor; }
.strata-dot:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.strata-badge {
  font-size: .68rem; letter-spacing: .03em; text-transform: uppercase;
  opacity: .6; border: 1px solid currentColor; border-radius: 999px;
  padding: .05rem .45rem; line-height: 1.4;
}
.strata-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .strata-content { transition: none !important; transform: none !important; }
}
`;
function injectStyles(doc) {
  if (stylesInjected || doc.getElementById("strata-styles")) {
    stylesInjected = true;
    return;
  }
  const style = doc.createElement("style");
  style.id = "strata-styles";
  style.textContent = CSS;
  doc.head.appendChild(style);
  stylesInjected = true;
}
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
var StrataPiece = class extends EventTarget {
  constructor(container, options = {}) {
    super();
    if (enhanced.has(container) && container.__strata) return container.__strata;
    this.container = container;
    this.options = Object.assign(
      { gestures: true, control: true, keyboard: true, animate: true, initialLevel: null },
      options
    );
    const doc = container.ownerDocument;
    injectStyles(doc);
    container.classList.add("strata");
    this.sources = {};
    container.querySelectorAll("template[data-strata-level]").forEach((tpl) => {
      const lvl = parseInt(tpl.getAttribute("data-strata-level"), 10);
      if (lvl !== 1 && lvl !== 2) return;
      this.sources[lvl] = {
        node: tpl.content,
        source: tpl.getAttribute("data-strata-source"),
        label: tpl.getAttribute("data-strata-label")
      };
      tpl.remove();
    });
    const full = doc.createDocumentFragment();
    while (container.firstChild) full.appendChild(container.firstChild);
    this.sources[3] = {
      node: full,
      source: container.getAttribute("data-strata-source") || "human",
      label: container.getAttribute("data-strata-label")
    };
    this.levels = Object.keys(this.sources).map(Number).sort((a, b) => a - b);
    this.host = doc.createElement("div");
    this.host.className = "strata-content";
    if (this.options.control) this._buildControl();
    this.container.appendChild(this.host);
    this._buildLiveRegion();
    let initial = this.options.initialLevel;
    if (initial == null) initial = parseInt(container.getAttribute("data-strata-initial"), 10);
    if (!this.levels.includes(initial)) initial = this.levels[this.levels.length - 1];
    this.level = initial;
    this._prevRendered = initial;
    this._render(initial, { animate: false, silent: true });
    if (this.options.gestures) this._bindGestures();
    if (this.options.keyboard) this._bindKeyboard();
    enhanced.add(container);
    container.__strata = this;
  }
  // --- Public API -----------------------------------------------------------
  current() {
    return this.level;
  }
  setLevel(level, { animate = true } = {}) {
    if (!this.levels.includes(level) || level === this.level) return this.level;
    const previous = this.level;
    this.level = level;
    this._render(level, { animate });
    const detail = { level, previous };
    this.dispatchEvent(new CustomEvent("strata:change", { detail }));
    this.container.dispatchEvent(new CustomEvent("strata:change", { detail, bubbles: true }));
    return level;
  }
  next() {
    const i = this.levels.indexOf(this.level);
    if (i < this.levels.length - 1) this.setLevel(this.levels[i + 1]);
    return this.level;
  }
  prev() {
    const i = this.levels.indexOf(this.level);
    if (i > 0) this.setLevel(this.levels[i - 1]);
    return this.level;
  }
  // --- Rendering ------------------------------------------------------------
  _render(level, { animate = true, silent = false } = {}) {
    const clone = this.sources[level].node.cloneNode(true);
    const swap = () => {
      this.host.replaceChildren(clone);
      this.host.setAttribute("data-strata-current", String(level));
    };
    if (!animate || prefersReducedMotion() || !this.options.animate) {
      swap();
    } else {
      const dir = level > this._prevRendered ? 1 : -1;
      const h = this.host;
      h.style.transition = "opacity 120ms ease, transform 120ms ease";
      h.style.opacity = "0";
      h.style.transform = `scale(${dir > 0 ? 0.985 : 1.015})`;
      window.setTimeout(() => {
        swap();
        h.style.transition = "none";
        h.style.opacity = "0";
        h.style.transform = `scale(${dir > 0 ? 1.015 : 0.985})`;
        void h.offsetWidth;
        h.style.transition = "opacity 150ms ease, transform 150ms ease";
        h.style.opacity = "1";
        h.style.transform = "scale(1)";
      }, 120);
    }
    this._prevRendered = level;
    this._updateControl(level);
    if (!silent) this._announce(level);
  }
  // --- Control (visible level indicator) ------------------------------------
  _buildControl() {
    const doc = this.container.ownerDocument;
    const nav = doc.createElement("div");
    nav.className = "strata-control";
    nav.setAttribute("role", "group");
    nav.setAttribute("aria-label", "Level of detail");
    this._dots = {};
    this.levels.forEach((lvl) => {
      const label = this.sources[lvl].label || LEVEL_NAMES[lvl];
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "strata-dot";
      btn.title = label;
      btn.setAttribute("aria-label", label);
      btn.addEventListener("click", () => this.setLevel(lvl));
      nav.appendChild(btn);
      this._dots[lvl] = btn;
    });
    this._badge = doc.createElement("span");
    this._badge.className = "strata-badge";
    this._badge.hidden = true;
    nav.appendChild(this._badge);
    this.container.appendChild(nav);
    this._control = nav;
  }
  _updateControl(level) {
    if (!this._control) return;
    this.levels.forEach((lvl) => {
      const on = lvl === level;
      this._dots[lvl].classList.toggle("is-active", on);
      this._dots[lvl].setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (this._badge) {
      const src = this.sources[level].source;
      if (src && src !== "human") {
        this._badge.hidden = false;
        this._badge.textContent = src === "ai" ? "AI" : "AI-assisted";
      } else {
        this._badge.hidden = true;
      }
    }
  }
  _buildLiveRegion() {
    const doc = this.container.ownerDocument;
    this._live = doc.createElement("div");
    this._live.className = "strata-sr-only";
    this._live.setAttribute("aria-live", "polite");
    this.container.appendChild(this._live);
  }
  _announce(level) {
    if (!this._live) return;
    const label = this.sources[level].label || LEVEL_NAMES[level];
    this._live.textContent = `Showing ${label}`;
  }
  // --- Gestures -------------------------------------------------------------
  _bindGestures() {
    const el = this.container;
    el.classList.add("strata-gestures");
    let lock = false;
    const step = (fn) => {
      if (lock) return;
      fn();
      lock = true;
      window.setTimeout(() => {
        lock = false;
      }, 350);
    };
    const useGesture = typeof window !== "undefined" && window.GestureEvent && typeof window.TouchEvent === "undefined";
    if (useGesture) {
      let base = 1;
      const T2 = 0.15;
      el.addEventListener("gesturestart", (e) => {
        e.preventDefault();
        base = e.scale;
      }, { passive: false });
      el.addEventListener("gesturechange", (e) => {
        e.preventDefault();
        if (e.scale >= base * (1 + T2)) {
          step(() => this.next());
          base = e.scale;
        } else if (e.scale <= base * (1 - T2)) {
          step(() => this.prev());
          base = e.scale;
        }
      }, { passive: false });
      el.addEventListener("gestureend", (e) => {
        e.preventDefault();
      }, { passive: false });
    } else {
      const STEP = 60;
      let accum = 0;
      let idle = null;
      el.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        accum += e.deltaY;
        if (idle) clearTimeout(idle);
        idle = window.setTimeout(() => {
          accum = 0;
        }, 200);
        if (accum <= -STEP) {
          step(() => this.next());
          accum = 0;
        } else if (accum >= STEP) {
          step(() => this.prev());
          accum = 0;
        }
      }, { passive: false });
    }
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    let startDist = 0;
    const T = 0.18;
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) startDist = dist(e.touches);
    }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      const ratio = dist(e.touches) / startDist;
      if (ratio >= 1 + T) {
        step(() => this.next());
        startDist = dist(e.touches);
      } else if (ratio <= 1 - T) {
        step(() => this.prev());
        startDist = dist(e.touches);
      }
    }, { passive: false });
    el.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) startDist = 0;
    }, { passive: true });
  }
  // --- Keyboard -------------------------------------------------------------
  _bindKeyboard() {
    if (!this.container.hasAttribute("tabindex")) this.container.tabIndex = 0;
    this.container.addEventListener("keydown", (e) => {
      if (["ArrowRight", "ArrowUp", "+", "="].includes(e.key)) {
        this.next();
        e.preventDefault();
      } else if (["ArrowLeft", "ArrowDown", "-", "_"].includes(e.key)) {
        this.prev();
        e.preventDefault();
      }
    });
  }
};

// src/element.js
var BOOL_ATTRS = ["gestures", "control", "keyboard", "animate"];
var StrataText = class extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._ready(() => this._enhance());
  }
  // Custom elements can upgrade before their children have been parsed. Wait for
  // the document to finish parsing when it's still loading; otherwise go now.
  _ready(cb) {
    const doc = this.ownerDocument;
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }
  _enhance() {
    const opts = {};
    if (this.hasAttribute("data-strata-initial")) {
      opts.initialLevel = parseInt(this.getAttribute("data-strata-initial"), 10);
    }
    BOOL_ATTRS.forEach((k) => {
      if (this.getAttribute(k) === "false") opts[k] = false;
    });
    this.piece = new StrataPiece(this, opts);
  }
  // Convenience passthroughs so authors can drive the element directly.
  setLevel(...a) {
    return this.piece && this.piece.setLevel(...a);
  }
  next() {
    return this.piece && this.piece.next();
  }
  prev() {
    return this.piece && this.piece.prev();
  }
  current() {
    return this.piece && this.piece.current();
  }
};
if (typeof customElements !== "undefined" && !customElements.get("strata-text")) {
  customElements.define("strata-text", StrataText);
}

// src/index.js
var Strata = {
  /**
   * Enhance every matching container. Attribute mode.
   * @param {object} [options] - selector, initialLevel, gestures, control, keyboard, animate
   * @returns {StrataPiece[]}
   */
  init(options = {}) {
    if (typeof document === "undefined") return [];
    const selector = options.selector || "[data-strata]";
    const pieces = [];
    document.querySelectorAll(selector).forEach((el) => {
      pieces.push(el.__strata || new StrataPiece(el, options));
    });
    return pieces;
  },
  Piece: StrataPiece
};
if (typeof window !== "undefined") window.Strata = Strata;
var src_default = Strata;
export {
  Strata,
  StrataPiece,
  src_default as default
};
