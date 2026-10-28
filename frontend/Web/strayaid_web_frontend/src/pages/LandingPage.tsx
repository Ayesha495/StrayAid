import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getPublicAnimals } from "../services/platformService";
import { getCommunityStats } from "../services/caseService";
import { getDirectory } from "../services/socialService";
import { useApi } from "../hooks/useApi";
import { getDefaultAuthenticatedRoute, useCurrentUser } from "../services/authService";
import SiteNav from "../layout/SiteNav";
import SiteFooter from "../layout/SiteFooter";
import { Reveal } from "./landing/motion";
import Journey from "./landing/Journey";
import { AnimalCarousel } from "./landing/Carousels";
import { ProgressiveBlur } from "@/components/vendor/skiper-ui/skiper41";
import { HoverExpand_001 } from "@/components/vendor/skiper-ui/skiper52";
import { AnimatedNumber } from "@/components/vendor/animated-number";
import "./landing/landing.css";

const WAYS = [
  {
    tone: "coral",
    image: "/landing/street-pair.webp",
    alt: "Two stray dogs walking towards the camera through a shaded street",
    title: "You found an injured animal",
    text: "Open the StrayAid mobile app, take one photo and send it. Your location goes with it, so rescue teams nearby can see the case and take it on.",
    cta: { label: "How reporting works", href: "#journey" },
  },
  {
    tone: "green",
    image: "/landing/kitten.webp",
    alt: "A tabby kitten walking straight towards the camera",
    title: "You want to adopt or sponsor",
    text: "Meet animals who have recovered and need a family, or cover part of someone's treatment. You see exactly what the care costs.",
    cta: { label: "Browse animals", to: "/animals/browse" },
  },
  {
    tone: "amber",
    image: "/landing/healing.webp",
    alt: "A vet in blue scrubs sitting beside an old dog on the clinic table",
    title: "You run a rescue or shelter",
    text: "Urgent cases near you, sorted by priority. Chat with reporters, review adopters and keep donations in one place. It costs nothing.",
    cta: { label: "Register your team", to: "/register?as=organization" },
  },
];

function WayCta({ way, light = false }: { way: (typeof WAYS)[number]; light?: boolean }) {
  const className = `lp-way-cta${light ? " is-light" : ""}`;
  return way.cta.to ? (
    <Link to={way.cta.to} className={className}>{way.cta.label} <ArrowRight size={16} aria-hidden="true" /></Link>
  ) : (
    <a href={way.cta.href} className={className}>{way.cta.label} <ArrowRight size={16} aria-hidden="true" /></a>
  );
}

/** The public landing page. Signed-in people go straight to their home in the app. */
function LandingPage() {
  const user = useCurrentUser();
  const animals = useApi(() => getPublicAnimals());
  const stats = useApi(getCommunityStats);
  const directory = useApi(getDirectory);

  const waiting = useMemo(
    () =>
      (animals.data ?? [])
        .filter((animal) => animal.status !== "adopted" && animal.image)
        .sort((a, b) => Number(b.status === "adoptable") - Number(a.status === "adoptable")),
    [animals.data],
  );
  const raised = (animals.data ?? []).reduce((sum, animal) => sum + (animal.raised_pkr ?? 0), 0);
  const rescued = stats.data?.rescued_total ?? 0;

  if (user && localStorage.getItem("access")) {
    return <Navigate to={getDefaultAuthenticatedRoute(user)} replace />;
  }

  return (
    <div className="ds lp">
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteNav />

      <main id="main">
        {/* Hero: the photo runs edge to edge; the words sit on it bottom-left. */}
        <section className="lp-hero" aria-labelledby="hero-title">
          <img
            className="lp-hero-img"
            src="/landing/hero-strays.webp"
            alt="A white stray dog and three puppies sitting on an empty road"
            fetchPriority="high"
          />
          <ProgressiveBlur position="bottom" height="38%" blurAmount="5px" backgroundColor="rgba(10, 20, 16, 0)" className="lp-hero-blur" />
          <div className="lp-hero-inner">
            <p className="lp-hero-place">Islamabad and Rawalpindi</p>
            <h1 id="hero-title">Help injured strays reach a rescue team near you.</h1>
            <p className="lp-lead">
              Send one photo from the street. Rescue teams nearby see it on their map, and you can follow the animal
              until it is well again.
            </p>
            <div className="lp-hero-actions">
              <Link to="/animals/browse" className="btn btn-primary lp-btn-lg">Meet the animals <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/register?as=organization" className="btn lp-btn-ghost lp-btn-lg">Register a rescue team</Link>
            </div>
          </div>
        </section>

        {/* Real numbers only, on a band that continues the hero's green so it reads as the hero's footer. */}
        {rescued > 0 ? (
          <section className="lp-numbers" aria-label="StrayAid so far">
            <dl>
              <div><dt>Animals rescued</dt><dd><AnimatedNumber value={rescued} /></dd></div>
              <div><dt>Rescue teams</dt><dd><AnimatedNumber value={directory.data?.length ?? 0} /></dd></div>
              <div><dt>Raised for treatment</dt><dd><span className="lp-unit">Rs</span><AnimatedNumber value={raised} format /></dd></div>
              <div><dt>Cost to use StrayAid</dt><dd>Free</dd></div>
            </dl>
          </section>
        ) : null}

        {/* Why it exists */}
        <section className="lp-section lp-why" aria-labelledby="why-title">
          <Reveal className="lp-why-photo">
            <img src="/landing/curb.webp" alt="A tired brown and white dog lying on a stone pavement, looking up" loading="lazy" />
          </Reveal>
          <div className="lp-why-text">
            <h2 id="why-title">Most people want to help. They don't know who to call.</h2>
            <p>
              An injured dog can lie on the same corner for days while people walk past. Rescue teams exist, but
              they hear about it late, through a WhatsApp forward or not at all.
            </p>
            <p>
              StrayAid puts the person on the street and the rescue teams nearby in touch, with a photo and a pin on the
              map.
            </p>
          </div>
        </section>

        {/* How it works: a scroll story */}
        <section id="journey" className="lp-section" aria-labelledby="journey-title">
          <div className="lp-section-head">
            <h2 id="journey-title">From the curb to a couch</h2>
            <p className="lp-sub">Four steps. Whoever reported the animal can follow each one.</p>
          </div>
          <Journey />
        </section>

        {/* Real animals */}
        {waiting.length ? (
          <section className="lp-section" aria-labelledby="meet-title">
            <div className="lp-section-head lp-section-head-row">
              <div>
                <h2 id="meet-title">They're waiting for you</h2>
                <p className="lp-sub">Animals in care right now, and how much of their treatment is covered.</p>
              </div>
              <Link to="/animals/browse" className="lp-link">All animals <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <AnimalCarousel animals={waiting} />
          </section>
        ) : null}

        {/* Ways to help: Skiper UI's hover-expand panels on wide screens, plain rows on small ones. */}
        <section className="lp-section" aria-labelledby="ways-title">
          <div className="lp-section-head">
            <h2 id="ways-title">Where you fit in</h2>
            <p className="lp-sub">Point at a photo to open it.</p>
          </div>
          <div className="lp-ways-expand" aria-hidden="true">
            <HoverExpand_001
              images={WAYS.map((way) => ({ src: way.image, alt: way.alt, code: way.title }))}
              activeWidth="640px"
              idleWidth="150px"
              height="440px"
              className="lp-expand"
              renderActive={(index) => (
                <div className="lp-expand-text">
                  <h3>{WAYS[index].title}</h3>
                  <p>{WAYS[index].text}</p>
                  <WayCta way={WAYS[index]} light />
                </div>
              )}
            />
          </div>
          <ul className="lp-ways">
            {WAYS.map((way) => (
              <li key={way.title} className={`lp-way way-${way.tone}`}>
                <img src={way.image} alt={way.alt} loading="lazy" />
                <div>
                  <h3>{way.title}</h3>
                  <p>{way.text}</p>
                  <WayCta way={way} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing call to action: a full-width band, no card. */}
        <section className="lp-final" aria-labelledby="final-title">
          <div className="lp-final-inner">
            <div>
              <h2 id="final-title">Next time you see an injured stray, you'll know what to do.</h2>
              <p>Sign up takes a minute. Reporting happens in the StrayAid mobile app.</p>
            </div>
            <div className="lp-ctas">
              <Link to="/register" className="btn lp-btn-light lp-btn-lg">Create an account</Link>
              <Link to="/animals/browse" className="btn lp-btn-outline-light lp-btn-lg">Browse animals</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default LandingPage;
