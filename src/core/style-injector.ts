export interface StyleInjector {
  /**
   * Replaces the injected CSS, re-attaching the element if the page removed it.
   * `source` is exposed as data-settings, which tells whether stored settings
   * have been applied yet (useful when debugging and in tests).
   */
  update(css: string, source: 'default' | 'stored'): void;
  remove(): void;
}

/**
 * Owns a single <style> element. It works at document_start, before <head>
 * exists, by attaching to the root element.
 */
export function createStyleInjector(doc: Document, id: string): StyleInjector {
  const style = doc.createElement('style');
  style.id = id;

  return {
    update(css, source) {
      if (style.textContent !== css) style.textContent = css;
      style.dataset.settings = source;
      if (!style.isConnected) (doc.head ?? doc.documentElement).append(style);
    },
    remove() {
      style.remove();
    },
  };
}
