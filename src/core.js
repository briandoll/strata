// Strata core — a gesture-unified, level-based "intentional summary" engine.
//
// One piece of writing, up to three author-approved levels of detail:
//   1 = Headline (shortest)   2 = Summary   3 = Full (the real DOM)
// Higher number = more detail. "Zoom out" walks toward 1, "zoom in" toward 3.
//
// The full content (level 3) is whatever HTML is already in the container.
// Summary levels live in <template data-strata-level="1|2"> and are inert until
// activated. This file never generates or rewrites text; it only swaps which
// author-written level is visible.

const LEVEL_NAMES = { 1: 'Headline', 2: 'Summary', 3: 'Full' };
const enhanced = new WeakSet();
let stylesInjected = false;

const CSS = `
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
  if (stylesInjected || doc.getElementById('strata-styles')) { stylesInjected = true; return; }
  const style = doc.createElement('style');
  style.id = 'strata-styles';
  style.textContent = CSS;
  doc.head.appendChild(style);
  stylesInjected = true;
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class StrataPiece extends EventTarget {
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
    container.classList.add('strata');

    // --- Collect the levels -------------------------------------------------
    // sources[level] = { node: DocumentFragment, source: string|null, label: string|null }
    this.sources = {};

    container.querySelectorAll('template[data-strata-level]').forEach((tpl) => {
      const lvl = parseInt(tpl.getAttribute('data-strata-level'), 10);
      if (lvl !== 1 && lvl !== 2) return;
      this.sources[lvl] = {
        node: tpl.content,
        source: tpl.getAttribute('data-strata-source'),
        label: tpl.getAttribute('data-strata-label'),
      };
      tpl.remove();
    });

    // Everything still inside the container is the full content (level 3).
    const full = doc.createDocumentFragment();
    while (container.firstChild) full.appendChild(container.firstChild);
    this.sources[3] = {
      node: full,
      source: container.getAttribute('data-strata-source') || 'human',
      label: container.getAttribute('data-strata-label'),
    };

    this.levels = Object.keys(this.sources).map(Number).sort((a, b) => a - b);

    // --- Build the shell ----------------------------------------------------
    this.host = doc.createElement('div');
    this.host.className = 'strata-content';

    if (this.options.control) this._buildControl();
    this.container.appendChild(this.host);
    this._buildLiveRegion();

    // --- Initial level ------------------------------------------------------
    let initial = this.options.initialLevel;
    if (initial == null) initial = parseInt(container.getAttribute('data-strata-initial'), 10);
    if (!this.levels.includes(initial)) initial = this.levels[this.levels.length - 1]; // full
    this.level = initial;
    this._prevRendered = initial;
    this._render(initial, { animate: false, silent: true });

    if (this.options.gestures) this._bindGestures();
    if (this.options.keyboard) this._bindKeyboard();

    enhanced.add(container);
    container.__strata = this;
  }

  // --- Public API -----------------------------------------------------------

  current() { return this.level; }

  setLevel(level, { animate = true } = {}) {
    if (!this.levels.includes(level) || level === this.level) return this.level;
    const previous = this.level;
    this.level = level;
    this._render(level, { animate });
    const detail = { level, previous };
    this.dispatchEvent(new CustomEvent('strata:change', { detail }));
    this.container.dispatchEvent(new CustomEvent('strata:change', { detail, bubbles: true }));
    return level;
  }

  next() { // toward more detail
    const i = this.levels.indexOf(this.level);
    if (i < this.levels.length - 1) this.setLevel(this.levels[i + 1]);
    return this.level;
  }

  prev() { // toward less detail
    const i = this.levels.indexOf(this.level);
    if (i > 0) this.setLevel(this.levels[i - 1]);
    return this.level;
  }

  // --- Rendering ------------------------------------------------------------

  _render(level, { animate = true, silent = false } = {}) {
    const clone = this.sources[level].node.cloneNode(true);
    const swap = () => {
      this.host.replaceChildren(clone);
      this.host.setAttribute('data-strata-current', String(level));
    };

    if (!animate || prefersReducedMotion() || !this.options.animate) {
      swap();
    } else {
      const dir = level > this._prevRendered ? 1 : -1; // in vs out
      const h = this.host;
      h.style.transition = 'opacity 120ms ease, transform 120ms ease';
      h.style.opacity = '0';
      h.style.transform = `scale(${dir > 0 ? 0.985 : 1.015})`;
      window.setTimeout(() => {
        swap();
        h.style.transition = 'none';
        h.style.opacity = '0';
        h.style.transform = `scale(${dir > 0 ? 1.015 : 0.985})`;
        void h.offsetWidth; // force reflow so the incoming state applies
        h.style.transition = 'opacity 150ms ease, transform 150ms ease';
        h.style.opacity = '1';
        h.style.transform = 'scale(1)';
      }, 120);
    }

    this._prevRendered = level;
    this._updateControl(level);
    if (!silent) this._announce(level);
  }

  // --- Control (visible level indicator) ------------------------------------

  _buildControl() {
    const doc = this.container.ownerDocument;
    const nav = doc.createElement('div');
    nav.className = 'strata-control';
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Level of detail');

    this._dots = {};
    this.levels.forEach((lvl) => {
      const label = this.sources[lvl].label || LEVEL_NAMES[lvl];
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'strata-dot';
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.addEventListener('click', () => this.setLevel(lvl));
      nav.appendChild(btn);
      this._dots[lvl] = btn;
    });

    this._badge = doc.createElement('span');
    this._badge.className = 'strata-badge';
    this._badge.hidden = true;
    nav.appendChild(this._badge);

    this.container.appendChild(nav);
    this._control = nav;
  }

  _updateControl(level) {
    if (!this._control) return;
    this.levels.forEach((lvl) => {
      const on = lvl === level;
      this._dots[lvl].classList.toggle('is-active', on);
      this._dots[lvl].setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (this._badge) {
      const src = this.sources[level].source;
      if (src && src !== 'human') {
        this._badge.hidden = false;
        this._badge.textContent = src === 'ai' ? 'AI' : 'AI-assisted';
      } else {
        this._badge.hidden = true;
      }
    }
  }

  _buildLiveRegion() {
    const doc = this.container.ownerDocument;
    this._live = doc.createElement('div');
    this._live.className = 'strata-sr-only';
    this._live.setAttribute('aria-live', 'polite');
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
    el.classList.add('strata-gestures');

    // Cooldown so one continuous pinch doesn't blow through every level at once.
    let lock = false;
    const step = (fn) => {
      if (lock) return;
      fn();
      lock = true;
      window.setTimeout(() => { lock = false; }, 350);
    };

    // macOS Safari exposes a precomputed pinch via GestureEvent and has no
    // TouchEvent. Everywhere else we use wheel (trackpads) and touch (phones).
    const useGesture =
      typeof window !== 'undefined' &&
      window.GestureEvent &&
      typeof window.TouchEvent === 'undefined';

    if (useGesture) {
      let base = 1;
      const T = 0.15;
      el.addEventListener('gesturestart', (e) => { e.preventDefault(); base = e.scale; }, { passive: false });
      el.addEventListener('gesturechange', (e) => {
        e.preventDefault();
        if (e.scale >= base * (1 + T)) { step(() => this.next()); base = e.scale; }       // spread -> more detail
        else if (e.scale <= base * (1 - T)) { step(() => this.prev()); base = e.scale; }   // pinch  -> less detail
      }, { passive: false });
      el.addEventListener('gestureend', (e) => { e.preventDefault(); }, { passive: false });
    } else {
      // Trackpad pinch arrives as a wheel event with ctrlKey set.
      const STEP = 60;
      let accum = 0;
      let idle = null;
      el.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;   // leave ordinary scrolling alone
        e.preventDefault();       // scoped to this element; page zoom elsewhere is untouched
        accum += e.deltaY;
        if (idle) clearTimeout(idle);
        idle = window.setTimeout(() => { accum = 0; }, 200);
        if (accum <= -STEP) { step(() => this.next()); accum = 0; }        // spread (deltaY<0) -> more detail
        else if (accum >= STEP) { step(() => this.prev()); accum = 0; }    // pinch  (deltaY>0) -> less detail
      }, { passive: false });
    }

    // Two-finger touch pinch (iOS Safari, Android Chrome).
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    let startDist = 0;
    const T = 0.18;
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) startDist = dist(e.touches);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault(); // block the page's native pinch-zoom within the piece only
      const ratio = dist(e.touches) / startDist;
      if (ratio >= 1 + T) { step(() => this.next()); startDist = dist(e.touches); }   // spread -> more detail
      else if (ratio <= 1 - T) { step(() => this.prev()); startDist = dist(e.touches); } // pinch -> less detail
    }, { passive: false });
    el.addEventListener('touchend', (e) => { if (e.touches.length < 2) startDist = 0; }, { passive: true });
  }

  // --- Keyboard -------------------------------------------------------------

  _bindKeyboard() {
    if (!this.container.hasAttribute('tabindex')) this.container.tabIndex = 0;
    this.container.addEventListener('keydown', (e) => {
      if (['ArrowRight', 'ArrowUp', '+', '='].includes(e.key)) { this.next(); e.preventDefault(); }
      else if (['ArrowLeft', 'ArrowDown', '-', '_'].includes(e.key)) { this.prev(); e.preventDefault(); }
    });
  }
}
