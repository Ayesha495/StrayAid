import { Link } from "react-router-dom";
import { LogoMark } from "../ui/Logo";
import { LEGAL_DOCS, LEGAL_DOC_ORDER } from "../content/legal";
import { SITE } from "../content/site";
import "./SiteFooter.css";

const EXPLORE = [
  { to: "/animals/browse", label: "Animals" },
  { to: "/organizations", label: "Rescue teams" },
  { to: "/feed", label: "Community" },
  { to: "/register?as=organization", label: "Register your team" },
];

const LEGAL_LINK_LABELS: Partial<Record<string, string>> = { donations: "Donations & Refunds" };

/** The footer on every public page: what StrayAid is, who runs it, and every policy. */
function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-footer-logo"><LogoMark size={28} /> {SITE.name}</span>
          <p>Connecting people who spot injured strays with the rescue teams who can help, in {SITE.area}.</p>
          <p className="site-footer-about">{SITE.about}</p>
          {SITE.contactEmail ? (
            <p>Contact: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
          ) : null}
        </div>
        <nav aria-label="Explore">
          <h2>Explore</h2>
          {EXPLORE.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}
        </nav>
        <nav aria-label="Policies">
          <h2>Policies</h2>
          {LEGAL_DOC_ORDER.map((key) => (
            <Link key={key} to={`/legal/${key}`}>{LEGAL_LINK_LABELS[key] ?? LEGAL_DOCS[key].title}</Link>
          ))}
        </nav>
      </div>
      <p className="site-footer-copy">
        © {new Date().getFullYear()} {SITE.name} · A final-year project · Photos from{" "}
        <a href={SITE.photoCredit.url} target="_blank" rel="noreferrer">{SITE.photoCredit.name}</a>
      </p>
    </footer>
  );
}

export default SiteFooter;
