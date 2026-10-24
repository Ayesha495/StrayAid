import { useRef } from "react";
import { useScroll } from "motion/react";
import { StickyCard_001 } from "@/components/vendor/skiper-ui/skiper16";

const CHAPTERS = [
  {
    key: "spotted",
    title: "Spotted",
    text: "Someone sees an injured stray and takes one photo in the StrayAid app. Their location and how serious it looks go with it.",
    detail: "Our AI checks the photo really shows an animal and ranks how urgent it is.",
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
 * "From the curb to a couch": four cards that stack as you scroll (Skiper UI's sticky card
 * stack). Each card sticks a little lower than the one before and the earlier ones shrink
 * back, so the pile reads as depth. With reduced motion the cards simply stack without scaling.
 */
function Journey() {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: container, offset: ["start start", "end end"] });

  return (
    <div ref={container} className="journey-stack">
      {/* The cards must be direct siblings in one tall container for sticky stacking to work. */}
      {CHAPTERS.map((item, i) => (
            <StickyCard_001
              key={item.key}
              i={i}
              title={item.title}
              src={item.image}
              progress={scrollYProgress}
              range={[i * 0.25, 1]}
              targetScale={1 - (CHAPTERS.length - i - 1) * 0.04}
              top={`calc(96px + ${i * 22}px)`}
              className="journey-card"
            >
              <div className="journey-card-text">
                <span className="journey-card-number">0{i + 1} <span>/ 0{CHAPTERS.length}</span></span>
                <h3>{item.title}</h3>
                <p className="journey-card-lead">{item.text}</p>
                <p className="journey-card-detail">{item.detail}</p>
              </div>
              <img className="journey-card-photo" src={item.image} alt={item.alt} loading="lazy" />
            </StickyCard_001>
      ))}
    </div>
  );
}

export default Journey;
