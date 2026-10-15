/**
 * Minimal DOM adapter for scene and island lifecycle tests (adapted from impl/codex-t10). It models
 * events, attributes and the element tree — not WebGL, CSS or layout.
 */
type Style = Record<string, string> & { setProperty(name: string, value: string): void; removeProperty(name: string): void };

export class ElementStub extends EventTarget {
  children: ElementStub[] = [];
  parent: ElementStub | null = null;
  style: Style;
  attributes = new Map<string, string>();
  textContent = '';
  className = '';
  clientWidth = 960;
  clientHeight = 540;
  constructor(readonly tagName: string) {
    super();
    const style = {} as Style;
    Object.defineProperties(style, {
      setProperty: { value: (name: string, value: string) => { style[name] = value; } },
      removeProperty: { value: (name: string) => { delete style[name]; } },
    });
    this.style = style;
  }
  get id() { return this.getAttribute('id') ?? ''; }
  get offsetWidth() { return Math.min(this.textContent.length * 7.5 + 12, 944); }
  get offsetHeight() { return 18; }
  classList = {
    contains: (name: string) => this.className.split(' ').includes(name),
    toggle: (name: string, force?: boolean) => {
      const names = new Set(this.className.split(' ').filter(Boolean));
      const add = force ?? !names.has(name);
      if (add) names.add(name); else names.delete(name);
      this.className = [...names].join(' ');
      return add;
    },
    add: (name: string) => { this.classList.toggle(name, true); },
    remove: (name: string) => { this.classList.toggle(name, false); },
  };
  append(...children: ElementStub[]) { for (const c of children) { c.remove(); c.parent = this; this.children.push(c); } }
  prepend(...children: ElementStub[]) { for (const c of [...children].reverse()) { c.remove(); c.parent = this; this.children.unshift(c); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  /** Supports `tag`, `.class`, `[attr]` and `[attr="value"]`. */
  matchesSelector(selector: string): boolean {
    const attr = /^\[([\w-]+)(?:="(.*)")?\]$/.exec(selector);
    if (attr) return attr[2] === undefined ? this.hasAttribute(attr[1]!) : this.getAttribute(attr[1]!) === attr[2];
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName === selector;
  }
  querySelector(selector: string): ElementStub | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

export class DocumentStub extends EventTarget {
  hidden = false;
  fonts = { ready: Promise.resolve() };
  createElement(tag: string) { return new ElementStub(tag); }
}

/** Stands in for ResizeObserver, IntersectionObserver and MutationObserver. */
export class ObserverStub {
  static instances: ObserverStub[] = [];
  disconnected = false;
  observed: unknown[] = [];
  constructor(readonly callback: (entries: { isIntersecting: boolean }[]) => void) { ObserverStub.instances.push(this); }
  observe(target: unknown) { this.observed.push(target); }
  disconnect() { this.disconnected = true; }
}
