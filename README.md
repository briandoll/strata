# Strata

**Publish one article at three author-approved levels of detail. Let the reader choose the depth.**

*(Working name — see "Naming" below.)*

Attention spans are shrinking and readers increasingly skim or ask an AI to summarize.
Strata flips that around: instead of leaving the short version to chance, a publisher
writes and approves their own **headline**, **summary**, and **full** versions of a
piece, ships all three, and lets the reader pinch (or tap) between them.

- **~5KB, zero dependencies.** Vanilla JS. Works with any stack that can serve HTML.
- **Progressive enhancement.** The full article is the real page. With JS off, readers
  get everything and search engines see clean, un-duplicated content.
- **The library never touches your words.** You author all three levels. Strata only
  swaps which one is visible.
- **Two ways to author:** a drop-in `<strata-text>` web component, or plain
  `data-` attributes on markup you already have.

The content convention is specified separately in **[FORMAT.md](./FORMAT.md)** — it's a
small, renderer-agnostic format, not tied to this library.

---

## How it feels to read

The full article shows by default. A small, always-visible control (three dots:
Headline · Summary · Full) sits with the piece so the feature is discoverable and works
for everyone, including mouse users.

On top of that, **pinch is the shortcut** (matching how pinch-zoom already works):

- **Fingers together** (pinch closed) → zoom *out* → a shorter level, toward the headline.
- **Fingers apart** (spread open) → zoom *in* → more detail, toward the full text.
- Each gesture past a threshold **snaps** to the next level with a quick scale-and-fade,
  so it reads as zooming even though the levels are discrete.

Keyboard: `←` / `→` (or `-` / `+`) step between levels when the piece is focused.

Pinch is treated as an enhancement, never the only way in. If a reader ignores it
entirely, the dots still work.

---

## Quick start

### CDN (no build step)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/strata-text@0/dist/strata.min.js"></script>

<strata-text>
  <template data-strata-level="1">The one-sentence version.</template>
  <template data-strata-level="2"><p>The paragraph version.</p></template>

  <h1>Your headline</h1>
  <p>Your full article, as normal HTML…</p>
</strata-text>
```

Loading the script registers `<strata-text>`. That's the whole install for the
drop-in path.

### npm

```bash
npm install strata-text
```

```js
import { Strata } from 'strata-text';

// Attribute mode: enhance every [data-strata] container on the page.
Strata.init();
```

```html
<article data-strata>
  <template data-strata-level="1">The one-sentence version.</template>
  <template data-strata-level="2"><p>The paragraph version.</p></template>

  <h1>Your headline</h1>
  <p>Your full article…</p>
</article>
```

---

## Authoring

Both modes use the same convention (full spec in **[FORMAT.md](./FORMAT.md)**):

- The **full article is plain HTML** inside the container — it's the default and the
  no-JS baseline.
- The **shorter levels live in `<template>`s** tagged `data-strata-level="1"` (headline)
  and `data-strata-level="2"` (summary). Templates don't render on their own, so there's
  no duplicate content and nothing breaks without JS.

You can also declare how each level was made, which is kind of the point of "intentional"
summaries:

```html
<template data-strata-level="1" data-strata-source="ai-assisted">…</template>
```

`human`, `ai-assisted`, or `ai`. Strata can optionally surface a small "AI-assisted"
note next to a summary.

---

## Configuration

```js
Strata.init({
  selector: '[data-strata]', // what to enhance (attribute mode)
  initialLevel: 3,           // 1 = headline, 2 = summary, 3 = full
  gestures: true,            // enable pinch / trackpad / wheel
  control: true,             // render the visible level indicator
  keyboard: true,            // arrow / +- stepping when focused
  animate: true,             // scale-and-fade transition (auto-off under reduced-motion)
});
```

Per-piece overrides go on the element: `data-strata-initial`, `data-strata-label`,
`data-strata-source` (see FORMAT.md §3).

---

## JavaScript API

`Strata.init()` returns the enhanced instances; you can also grab one and drive it
yourself — handy for custom controls.

```js
const [piece] = Strata.init();

piece.setLevel(1);      // jump to a level
piece.next();           // toward more detail (up)
piece.prev();           // toward less detail (down)
piece.current();        // -> 1 | 2 | 3

piece.addEventListener('strata:change', (e) => {
  console.log(e.detail.level); // 1 | 2 | 3
});
```

---

## Accessibility

- The full article always renders without JavaScript.
- Level changes are announced via an `aria-live="polite"` region rather than swapping
  the DOM silently.
- Pinch interception is **scoped to the piece**, so the rest of the page keeps native
  browser zoom — readers who pinch to enlarge small text aren't hijacked.
- `prefers-reduced-motion` disables the zoom animation (levels still cross-fade).

These aren't afterthoughts; hijacking the pinch gesture is the sharpest risk in a tool
like this, so the defaults are built to minimize it.

---

## Browser support

| Platform                        | Gesture source                         | Status   |
| ------------------------------- | -------------------------------------- | -------- |
| iOS Safari                      | `TouchEvent` (+ `GestureEvent`)        | Priority |
| macOS Safari / Chrome / Firefox | trackpad pinch → `wheel` + `ctrlKey`   | Priority |
| Android Chrome                  | `TouchEvent`                           | Best-effort |
| Desktop mouse (no pinch)        | visible control + keyboard             | Always   |

Anywhere gestures aren't available, the visible control and keyboard still work. No
gesture support means a slightly less magical experience, not a broken one.

---

## Naming

`strata-text` is a placeholder. Candidates under consideration: **Précis**, **Strata**,
**Pith**, **Lede**. The npm package and repo name will follow the final pick.

---

## Roadmap

- v0.1 — core engine, visible control, both authoring modes, docs, demo.
- Later — React/Vue wrappers, arbitrary level counts, standardized JSON-LD, per-block
  (rather than whole-piece) summarization.

---

## Contributing

Early and rough. Issues and ideas welcome, especially real-device gesture reports
(which iPhone, which browser, what felt off).

## License

MIT.
