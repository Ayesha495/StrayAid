import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import StatusChip from "../../ui/StatusChip";
import type { Animal } from "../../types/platform";

function useCarouselButtons(api: ReturnType<typeof useEmblaCarousel>[1]) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [selected, setSelected] = useState(0);
  const update = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
    setSelected(api.selectedScrollSnap());
  }, [api]);
  useEffect(() => {
    if (!api) return;
    api.on("select", update).on("reInit", update);
    // Read the initial state once Embla is ready.
    queueMicrotask(update);
  }, [api, update]);
  return { canPrev, canNext, selected };
}

/** Real animals looking for a home or sponsors, swipeable. */
export function AnimalCarousel({ animals }: { animals: Animal[] }) {
  const [viewportRef, api] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const { canPrev, canNext } = useCarouselButtons(api);

  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label="Animals looking for help">
      <div className="carousel-viewport" ref={viewportRef}>
        <ul className="carousel-track">
          {animals.map((animal, index) => {
            const percent = animal.funding_goal_pkr ? Math.min(100, Math.round(((animal.raised_pkr ?? 0) / animal.funding_goal_pkr) * 100)) : null;
            return (
              <li key={animal.id} className="carousel-slide animal-slide" aria-roledescription="slide" aria-label={`${index + 1} of ${animals.length}`}>
                <Link to={`/animals/${animal.id}`} className="animal-slide-card">
                  {animal.image ? <img src={animal.image} alt={`${animal.name}, ${animal.species ?? "animal"}`} loading="lazy" /> : null}
                  <span className="animal-slide-status"><StatusChip kind="animal" value={animal.status} /></span>
                  <span className="animal-slide-info">
                    <strong>{animal.name}</strong>
                    <span>{[animal.breed || animal.species, animal.age !== null && animal.age !== undefined ? `${animal.age} yr` : ""].filter(Boolean).join(" · ")}</span>
                    {percent !== null ? (
                      <span className="animal-slide-fund">
                        <span className="animal-slide-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                        {percent}% of care funded
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="carousel-controls">
        <button type="button" className="carousel-btn" onClick={() => api?.scrollPrev()} disabled={!canPrev} aria-label="Previous animals"><ChevronLeft size={22} /></button>
        <button type="button" className="carousel-btn" onClick={() => api?.scrollNext()} disabled={!canNext} aria-label="Next animals"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
}
