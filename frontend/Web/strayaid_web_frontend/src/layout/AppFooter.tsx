import { Link } from "react-router-dom";
import { LogoMark } from "../ui/Logo";
import { LEGAL_DOCS, LEGAL_DOC_ORDER } from "../content/legal";
import { SITE } from "../content/site";

const LEGAL_LINK_LABELS: Partial<Record<string, string>> = { donations: "Donations & Refunds" };

/** The slim footer under every signed-in page: the policies and who to contact. */
function AppFooter() {
  return (
    <footer className="app-footer">
      <span className="app-footer-brand"><LogoMark size={22} /> {SITE.name}</span>
      <nav aria-label="Policies" className="app-footer-links">
        {LEGAL_DOC_ORDER.map((key) => (
          <Link key={key} to={`/legal/${key}`}>{LEGAL_LINK_LABELS[key] ?? LEGAL_DOCS[key].title}</Link>
        ))}
        {SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>Contact</a> : null}
      </nav>
      <span className="app-footer-copy">© {new Date().getFullYear()} {SITE.name} · A final-year project</span>
    </footer>
  );
}

export default AppFooter;
