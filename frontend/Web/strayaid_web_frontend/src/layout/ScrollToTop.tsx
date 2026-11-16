import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Single-page apps keep the window's scroll position when the route changes, so opening a page
 * after scrolling another one used to land you part-way down it (or at a form field on phones).
 * Every new page opened by a link now starts at the top, a "#section" link scrolls to that
 * section, and the browser's back/forward buttons still restore where you were.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "POP") return;

    if (hash) {
      // The target may not be rendered yet (lazy pages), so retry for a moment.
      const id = decodeURIComponent(hash.slice(1));
      let tries = 0;
      let frame = 0;
      const seek = () => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView();
          return;
        }
        if (tries++ < 30) frame = requestAnimationFrame(seek);
        else window.scrollTo(0, 0);
      };
      seek();
      return () => cancelAnimationFrame(frame);
    }

    window.scrollTo(0, 0);
    // Only a different page resets the scroll: changing a filter in the address bar (?q=…) must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash]);

  return null;
}

export default ScrollToTop;
