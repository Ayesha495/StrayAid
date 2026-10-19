import { useEffect, useState } from "react";
import "./SectionNav.css";

export type SectionLink = { id: string; label: string };

/**
 * A sticky row of in-page links that highlights the section you're reading. Everything stays
 * on one scrolling page (nothing hidden behind tabs), which is easier for every age group.
 */
function SectionNav({ sections, label }: { sections: SectionLink[]; label: string }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="section-nav" aria-label={label}>
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`} className={section.id === active ? "is-active" : undefined} aria-current={section.id === active ? "location" : undefined}>
          {section.label}
        </a>
      ))}
    </nav>
  );
}

export default SectionNav;
