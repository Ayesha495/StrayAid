import { useEffect, useRef, useState } from "react";

const CHAPTERS = [
  {
    key: "spotted",
    title: "Spotted",
    text: "Someone sees an injured stray and takes one photo in the StrayAid app. Their location goes with it.",
    detail: "Our AI checks the photo really shows an animal, and people nearby confirm it's still there.",
    image: "/landing/spotted.webp",
    alt: "A young stray puppy asleep on bare ground beside a yellow container",
  },
  {
    key: "rescued",
    title: "Rescued",
    text: "The nearest rescue team with space gets the alert, accepts the case and heads out.",
    detail: "The person who reported it can follow along and message the team.",
    image: "/landing/rescued.webp",
    alt: "A vet and a volunteer checking a brown dog on a clinic table",
  },
  {
    key: "healing",
    title: "Healing",
    text: "Vets and volunteers treat and care for the animal. Every update is shared with the people following its story.",
    detail: "Sponsors can see exactly what treatment costs and how much is covered.",
    image: "/landing/rickshaw.webp",
    alt: "A brown dog asleep on the back seat of an auto rickshaw",
  },
  {
    key: "home",
    title: "Home",
    text: "Once they've recovered, they're matched with a family through a simple, careful adoption process.",
    detail: "The story ends where it should: on someone's sofa.",
    image: "/landing/home.webp",
    alt: "A woman holding her curly-haired dog close, eyes closed",
  },
];

/**
 * "From the curb to a couch" as a scroll story: the four chapters scroll by on one side
 * while a single photo frame stays put on the other and cross-fades to the chapter you're
 * reading. Nothing slides over anything else, and the section ends cleanly before the next.
 * A rail beside the chapters fills continuously as you scroll. On narrow screens each chapter simply shows
 * its own photo above the text.
 */
function Journey() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement | null>(null);
  const chapters = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let frame = 0;

    // The rail follows the scroll position itself: its fill ends exactly at the middle of the
    // screen (the "reading line"), measured between the first and last dot, so it moves with
    // every pixel scrolled instead of jumping when the next chapter becomes active.
    const update = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const dots = element.querySelectorAll<HTMLElement>(".journey-dot");
      if (dots.length < 2) return;
      const center = (dot: HTMLElement) => {
        const r = dot.getBoundingClientRect();
        return r.top + r.height / 2 - box.top;
      };
      const start = center(dots[0]);
      const length = Math.max(center(dots[dots.length - 1]) - start, 1);
      const reading = window.innerHeight / 2 - box.top;
      const fill = Math.min(Math.max(reading - start, 0), length);
      element.style.setProperty("--rail-top", `${start}px`);
      element.style.setProperty("--rail-len", `${length}px`);
      element.style.setProperty("--rail-fill", `${fill}px`);

      // The chapter under the reading line is the active one.
      let current = 0;
      chapters.current.forEach((chapter, i) => {
        if (chapter && chapter.getBoundingClientRect().top - box.top <= reading) current = i;
      });
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Photos load lazily and change the heights, so measure again once the layout settles.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(element);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="journey">
      <ol className="journey-steps" ref={list}>
        {CHAPTERS.map((item, i) => (
          <li
            key={item.key}
            ref={(element) => {
              chapters.current[i] = element;
            }}
            data-index={i}
            className={`journey-step${i === active ? " is-active" : ""}${i < active ? " is-done" : ""}`}
            aria-current={i === active ? "step" : undefined}
          >
            <span className="journey-dot" aria-hidden="true" />
            <img className="journey-step-photo" src={item.image} alt={item.alt} loading="lazy" />
            <span className="journey-step-number">
              0{i + 1} <span>/ 0{CHAPTERS.length}</span>
            </span>
            <h3>{item.title}</h3>
            <p className="journey-step-lead">{item.text}</p>
            <p className="journey-step-detail">{item.detail}</p>
          </li>
        ))}
      </ol>

      {/* Decorative: each chapter carries the same photo with its alt text for narrow screens. */}
      <div className="journey-media" aria-hidden="true">
        <div className="journey-frame">
          {CHAPTERS.map((item, i) => (
            <img key={item.key} src={item.image} alt="" className={i === active ? "is-active" : undefined} loading="lazy" />
          ))}
          <span className="journey-caption">
            <strong>{CHAPTERS[active].title}</strong> · step {active + 1} of {CHAPTERS.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Journey;
