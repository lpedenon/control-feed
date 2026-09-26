import { HIDDEN_ATTRIBUTE } from './stylesheet';

/** Teaches the filter how to find and read content tiles on one site. */
export interface TileSource<Info> {
  /** Matches tiles and anything nested inside them that marks a tile. */
  readonly candidateSelector: string;
  /** The outermost element to hide for a candidate, or null when it is not part of a tile. */
  resolveTile(element: Element): Element | null;
  /** What the tile shows, or null while it is still loading or is not content (an ad). */
  describe(tile: Element): Info | null;
}

/** Returns why a tile should be hidden, or null to show it. */
export type TileDecider<Info> = (info: Info | null) => string | null;

export interface TileFilter<Info> {
  /** Swaps the decision rule and re-evaluates every tile; null turns filtering off. */
  setDecider(decide: TileDecider<Info> | null): void;
  /** Re-evaluates every tile, for when context outside the tiles changed. */
  rescan(): void;
  stop(): void;
}

/**
 * The whole document is observed because sites rebuild their feed containers
 * on every in-app navigation. Measured on a playing YouTube video the cost is
 * about 0.3 ms per second; live chat runs in its own frame and adds nothing.
 */
const OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  // Sites recycle tile elements and swap their text and links in place.
  attributeFilter: ['href', 'title', 'aria-label'],
};

function asElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/**
 * Watches `root` and marks each content tile with HIDDEN_ATTRIBUTE when the
 * decider rejects it. The mark carries the reason, and the stylesheet does the
 * hiding, so a tile never flashes: MutationObserver callbacks run before paint.
 */
export function startTileFilter<Info>(
  root: Element,
  source: TileSource<Info>,
  initialDecider: TileDecider<Info> | null,
): TileFilter<Info> {
  let decide = initialDecider;

  function evaluate(tile: Element): void {
    const reason = decide ? decide(source.describe(tile)) : null;
    if (reason === null) {
      if (tile.hasAttribute(HIDDEN_ATTRIBUTE)) tile.removeAttribute(HIDDEN_ATTRIBUTE);
    } else if (tile.getAttribute(HIDDEN_ATTRIBUTE) !== reason) {
      tile.setAttribute(HIDDEN_ATTRIBUTE, reason);
    }
  }

  function collectTiles(element: Element, into: Set<Element>): void {
    const own = source.resolveTile(element);
    if (own) into.add(own);
    for (const candidate of element.querySelectorAll(source.candidateSelector)) {
      const tile = source.resolveTile(candidate);
      if (tile) into.add(tile);
    }
  }

  function evaluateAll(): void {
    const tiles = new Set<Element>();
    collectTiles(root, tiles);
    tiles.forEach(evaluate);
  }

  function clearMarks(): void {
    for (const marked of root.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`)) {
      marked.removeAttribute(HIDDEN_ATTRIBUTE);
    }
  }

  const observer = new MutationObserver((records) => {
    const tiles = new Set<Element>();
    for (const record of records) {
      const target = asElement(record.target);
      const tile = target && source.resolveTile(target);
      if (tile) tiles.add(tile);
      for (const added of record.addedNodes) {
        if (added.nodeType === Node.ELEMENT_NODE) collectTiles(added as Element, tiles);
      }
    }
    tiles.forEach(evaluate);
  });

  function setDecider(next: TileDecider<Info> | null): void {
    decide = next;
    observer.disconnect();
    if (decide === null) {
      clearMarks();
      return;
    }
    observer.observe(root, OBSERVE_OPTIONS);
    evaluateAll();
  }

  setDecider(initialDecider);

  return {
    setDecider,
    rescan: () => {
      if (decide) evaluateAll();
    },
    stop: () => setDecider(null),
  };
}
