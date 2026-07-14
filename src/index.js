// Strata — public entry point.
//
// Importing this module also registers the <strata-text> custom element (side effect
// of ./element.js), so a single <script type="module"> tag is enough for the drop-in
// component path. For attribute mode, call Strata.init() yourself.

import { StrataPiece } from './core.js';
import './element.js';

export const Strata = {
  /**
   * Enhance every matching container. Attribute mode.
   * @param {object} [options] - selector, initialLevel, gestures, control, keyboard, animate
   * @returns {StrataPiece[]}
   */
  init(options = {}) {
    if (typeof document === 'undefined') return [];
    const selector = options.selector || '[data-strata]';
    const pieces = [];
    document.querySelectorAll(selector).forEach((el) => {
      pieces.push(el.__strata || new StrataPiece(el, options));
    });
    return pieces;
  },
  Piece: StrataPiece,
};

if (typeof window !== 'undefined') window.Strata = Strata;

export { StrataPiece };
export default Strata;
