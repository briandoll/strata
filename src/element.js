// <strata-text> — the drop-in web component wrapper around StrataPiece.
//
// Same convention as attribute mode: summary levels in <template data-strata-level>,
// full content as ordinary light-DOM children. If the element never upgrades (script
// blocked, old browser), those children still render, so the reader gets the full piece.

import { StrataPiece } from './core.js';

const BOOL_ATTRS = ['gestures', 'control', 'keyboard', 'animate'];

export class StrataText extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._ready(() => this._enhance());
  }

  // Custom elements can upgrade before their children have been parsed. Wait for
  // the document to finish parsing when it's still loading; otherwise go now.
  _ready(cb) {
    const doc = this.ownerDocument;
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      cb();
    }
  }

  _enhance() {
    const opts = {};
    if (this.hasAttribute('data-strata-initial')) {
      opts.initialLevel = parseInt(this.getAttribute('data-strata-initial'), 10);
    }
    BOOL_ATTRS.forEach((k) => {
      if (this.getAttribute(k) === 'false') opts[k] = false;
    });
    this.piece = new StrataPiece(this, opts);
  }

  // Convenience passthroughs so authors can drive the element directly.
  setLevel(...a) { return this.piece && this.piece.setLevel(...a); }
  next() { return this.piece && this.piece.next(); }
  prev() { return this.piece && this.piece.prev(); }
  current() { return this.piece && this.piece.current(); }
}

if (typeof customElements !== 'undefined' && !customElements.get('strata-text')) {
  customElements.define('strata-text', StrataText);
}
