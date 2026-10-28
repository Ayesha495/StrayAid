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
 * A rail beside the chapters fills as you go. On narrow screens each chapter simply shows
 * its own photo above the text.
 */
function Journey() {
  const [active, setActive] = useState(0);
  const chapters = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // A chapter becomes active when it reaches the middle band of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    chapters.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="journey" style={{ "--journey-progress": (active + 1) / CHAPTERS.length } as React.CSSProperties}>
      <ol className="journey-steps">
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
