import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

if (!global.TextEncoder) {
  // react-router uses TextEncoder in jsdom tests.
  global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// jsdom doesn't implement scrolling.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no IntersectionObserver (scroll reveals and the section nav use it).
// Report everything as visible straight away.
class TestIntersectionObserver {
  private callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target, intersectionRatio: 1, boundingClientRect: target.getBoundingClientRect() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (!("IntersectionObserver" in window)) {
  Object.assign(window, { IntersectionObserver: TestIntersectionObserver });
  Object.assign(global, { IntersectionObserver: TestIntersectionObserver });
}

// jsdom has no matchMedia (motion and responsive hooks ask for it). Nothing matches.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

import { toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);
