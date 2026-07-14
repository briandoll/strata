// Minimal functional test for the Strata engine, run under jsdom.
// node test/basic.test.mjs
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.customElements = dom.window.customElements;
globalThis.CustomEvent = dom.window.CustomEvent;
// Match EventTarget/Event to jsdom's so dispatched CustomEvents are accepted
// (in a browser these all come from the same realm).
globalThis.EventTarget = dom.window.EventTarget;
globalThis.Event = dom.window.Event;

const { StrataPiece } = await import('../src/core.js');

let passed = 0;
const ok = (label, cond) => { assert.ok(cond, label); passed++; };

function makePiece(opts = {}) {
  const c = document.createElement('article');
  c.setAttribute('data-strata', '');
  c.innerHTML =
    '<template data-strata-level="1" data-strata-source="ai-assisted">ONE.</template>' +
    '<template data-strata-level="2"><p>TWO paragraph.</p></template>' +
    '<h1>Heading</h1><p>FULL body text.</p>';
  document.body.appendChild(c);
  // animate:false makes every render synchronous, which the assertions rely on.
  return { c, p: new StrataPiece(c, Object.assign({ animate: false }, opts)) };
}

// 1. Full content is the default level.
{
  const { c, p } = makePiece();
  ok('starts at level 3', p.current() === 3);
  ok('shows full content', c.querySelector('.strata-content').textContent.includes('FULL body text'));
}

// 2. Templates are consumed, not left rendering duplicate content.
{
  const { c } = makePiece();
  ok('templates removed from DOM', c.querySelector('template') === null);
}

// 3. Zooming out swaps to the shorter levels.
{
  const { c, p } = makePiece();
  p.setLevel(1);
  ok('level 1 shows the headline only', c.querySelector('.strata-content').textContent.trim() === 'ONE.');
  p.next();
  ok('next() moves toward more detail (to 2)', p.current() === 2);
  ok('level 2 shows the summary', c.textContent.includes('TWO paragraph'));
  p.prev();
  ok('prev() moves toward less detail (to 1)', p.current() === 1);
}

// 4. Clamping at the ends.
{
  const { p } = makePiece();
  p.setLevel(1); p.prev();
  ok('does not go below the lowest level', p.current() === 1);
  p.setLevel(3); p.next();
  ok('does not go above the highest level', p.current() === 3);
}

// 5. Change events fire once per real change (on the piece).
{
  const { p } = makePiece();
  let n = 0;
  p.addEventListener('strata:change', (e) => { n++; ok('event carries level', typeof e.detail.level === 'number'); });
  p.setLevel(2);
  p.setLevel(2); // no-op, should not fire
  ok('event fired exactly once', n === 1);
}

// 6. The visible control renders one dot per level.
{
  const { c } = makePiece();
  ok('three dots for three levels', c.querySelectorAll('.strata-dot').length === 3);
}

// 7. Provenance badge appears for non-human levels, hidden for full.
{
  const { c, p } = makePiece();
  p.setLevel(1); // ai-assisted
  ok('badge visible on AI-assisted level', c.querySelector('.strata-badge').hidden === false);
  p.setLevel(3); // human
  ok('badge hidden on human level', c.querySelector('.strata-badge').hidden === true);
}

// 8. A piece with only full content still works (summary levels optional).
{
  const c = document.createElement('article');
  c.setAttribute('data-strata', '');
  c.innerHTML = '<p>Only the full thing.</p>';
  document.body.appendChild(c);
  const p = new StrataPiece(c, { animate: false });
  ok('single-level piece stays at 3', p.current() === 3);
  ok('single-level piece has one dot', c.querySelectorAll('.strata-dot').length === 1);
}

console.log(`\n✓ ${passed} assertions passed`);
