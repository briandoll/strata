# The Intentional Summary Format

**Version 0.1 (draft) · working name: Strata**

A small, framework-agnostic convention for publishing a single piece of writing at
multiple author-approved levels of detail.

The point is in the word *intentional*. These are not summaries generated on the fly
by whatever LLM the reader happens to have. They are levels the publisher wrote,
reviewed, and stands behind — shipped alongside the full text so readers (and machines)
can pick the depth they want.

This document specifies the markup. It says nothing about how a reader moves between
levels; that is the job of a rendering library (the reference implementation is
Strata). The format is deliberately renderer-agnostic — a screen reader, an RSS
reader, or a search crawler should be able to make sense of it with no JavaScript at
all.

The key words MUST, SHOULD, and MAY are used per RFC 2119.

---

## 1. The model

A conforming piece has up to **three levels of detail**:

| Level | Name     | Length (guideline)      | Who authors it                         |
| ----- | -------- | ----------------------- | -------------------------------------- |
| 1     | Headline | one or two sentences    | publisher (often AI-assisted, approved)|
| 2     | Summary  | a paragraph or two      | publisher (often AI-assisted, approved)|
| 3     | Full     | the complete piece      | publisher (written by hand)            |

Higher number means **more** detail. Level 3 is the whole thing; level 1 is the most
condensed. "Zooming out" moves toward level 1; "zooming in" moves toward level 3.

Two rules make the format degrade gracefully:

- The **full content (level 3) MUST be present as ordinary, rendered HTML** — the
  default the reader sees with no JavaScript, no custom elements, nothing.
- The **summary levels (1 and 2) MUST be inert until activated**, carried in
  `<template>` elements so they never render on their own and never duplicate content
  for crawlers.

Levels 1 and 2 are each OPTIONAL. A piece with only full content is still valid — it
simply has nothing to zoom out to. Publishers SHOULD provide both summary levels when
they provide any, so the experience has a real middle gear.

The format is fixed at three levels for now. Renderers MAY support additional levels;
this spec will define how in a later version.

---

## 2. Markup

There are two equivalent ways to author a piece. They share the same attributes and
produce the same result; pick whichever fits your stack.

### 2.1 Attribute mode (progressive enhancement)

Mark a container with `data-strata`. Put summary levels in `<template>` elements
tagged with `data-strata-level`. Everything else inside the container is the full
content.

```html
<article data-strata>
  <template data-strata-level="1">
    Attention spans are shrinking, so let readers choose their depth.
  </template>

  <template data-strata-level="2">
    <p>
      Readers increasingly skim or lean on AI to summarize. Instead of leaving that to
      chance, publishers can ship their own approved short and medium versions next to
      the full text, and let the reader pick the level they want.
    </p>
  </template>

  <!-- Level 3: the full piece, plain HTML, shown by default -->
  <h1>Let readers choose their depth</h1>
  <p>Attention spans are shrinking. AI summarization is everywhere…</p>
  <p>…the rest of the article…</p>
</article>
```

With JavaScript disabled, the reader gets the full article and the two templates render
nothing. That is the intended baseline.

### 2.2 Element mode (drop-in web component)

The `<strata-text>` custom element wraps the exact same convention. Use it when you'd
rather not wire up initialization yourself.

```html
<strata-text>
  <template data-strata-level="1">Attention spans are shrinking…</template>
  <template data-strata-level="2"><p>Readers increasingly skim…</p></template>

  <h1>Let readers choose their depth</h1>
  <p>Attention spans are shrinking…</p>
</strata-text>
```

If the browser doesn't register the custom element (or the script fails to load), the
light-DOM children still render, so the reader still gets the full piece. Same baseline.

---

## 3. Attributes

| Attribute              | Applies to                    | Required | Default   | Meaning                                                        |
| ---------------------- | ----------------------------- | -------- | --------- | -------------------------------------------------------------- |
| `data-strata`          | the container (attribute mode)| yes\*    | —         | Marks a container for enhancement. \*Not used in element mode. |
| `data-strata-level`    | a `<template>`                | yes      | —         | The level a template provides: `1` or `2`.                     |
| `data-strata-initial`  | the container                 | no       | `3`       | Level shown on first render. SHOULD be `3` for the no-JS/SEO baseline. |
| `data-strata-label`    | a `<template>`                | no       | see §5    | Display name for that level in the control (e.g. "Headline").  |
| `data-strata-source`   | a `<template>` or container   | no       | see §4    | Provenance of the text: `human`, `ai-assisted`, or `ai`.       |

A renderer MUST ignore attributes it does not recognize.

---

## 4. Provenance

Because the whole premise is *approved* summaries, the format lets publishers state how
each level was produced:

```html
<template data-strata-level="1" data-strata-source="ai-assisted">…</template>
<template data-strata-level="2" data-strata-source="ai-assisted">…</template>
```

- `human` — written by a person, unaided.
- `ai-assisted` — drafted with AI, reviewed and approved by the publisher.
- `ai` — generated by AI, published without human review. (Discouraged for this format,
  but honest.)

If `data-strata-source` is absent, a renderer SHOULD assume `human` for the full content
and make no assumption for summary levels. Renderers MAY surface this (e.g. a small note
that a summary is AI-assisted). This field is advisory; nothing enforces its accuracy.

---

## 5. Default level names

When `data-strata-label` is not given, renderers SHOULD use:

- Level 1 → "Headline"
- Level 2 → "Summary"
- Level 3 → "Full"

---

## 6. Machine readability (recommended)

The summaries are useful beyond the pinch UI — they are structured, author-blessed
descriptions of the piece. Publishers SHOULD make level 1 available to non-visual
consumers by also emitting it as page metadata, for example:

```html
<meta name="description" content="Attention spans are shrinking, so let readers choose their depth.">
```

Publishers MAY additionally expose the levels as JSON-LD (e.g. `abstract` and
`description` on an `Article`) for crawlers and reading tools. A future version of this
spec may standardize a JSON-LD shape; for now, treat it as an open, encouraged
extension.

---

## 7. Accessibility requirements

- The full content (level 3) MUST render without JavaScript.
- Summary levels MUST NOT be presented as duplicate visible content in the no-JS state;
  `<template>` satisfies this.
- When a renderer changes the visible level, it SHOULD announce the change to assistive
  technology (e.g. via an `aria-live="polite"` region) rather than silently swapping the
  DOM.
- A renderer that intercepts the pinch gesture MUST scope that interception to the piece
  itself, leaving the rest of the page's native zoom intact, so readers who rely on
  browser zoom to enlarge text are not trapped.
- A renderer MUST honor `prefers-reduced-motion` and skip scale/zoom animation for
  readers who ask for it.

---

## 8. Conformance

A **document** conforms if it contains at least a full-content level and any summary
levels are expressed as specified above.

A **renderer** conforms if it:

1. shows the full content when JavaScript is unavailable,
2. never renders a `<template>` summary as standalone visible content unless activated,
3. respects `data-strata-initial`, and
4. meets the accessibility requirements in §7.

---

*Draft. Names and attribute spellings may change before 1.0. Feedback welcome.*
