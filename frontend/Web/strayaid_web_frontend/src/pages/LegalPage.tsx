import { Link, NavLink, useParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { LEGAL_DOCS, LEGAL_DOC_ORDER, type LegalDocKey } from "../content/legal";
import { SITE } from "../content/site";
import { EmptyState } from "../ui/States";
import "./LegalPage.css";

const isLegalDoc = (key: string | undefined): key is LegalDocKey => Boolean(key && key in LEGAL_DOCS);

/** Terms, privacy, cookies, donations and account deletion: public, readable without an account. */
function LegalPage() {
  const { doc } = useParams();

  if (!isLegalDoc(doc)) {
    return (
      <div className="page legal-page">
        <EmptyState
          headingLevel={1}
          icon={<FileQuestion size={22} />}
          title="We couldn't find that policy"
          action={<Link to="/legal/terms" className="btn btn-primary btn-sm">See all policies</Link>}
        />
      </div>
    );
  }

  const content = LEGAL_DOCS[doc];
  return (
    <div className="page legal-page">
      <nav className="legal-nav" aria-label="All policies">
        {LEGAL_DOC_ORDER.map((key) => (
          <NavLink key={key} to={`/legal/${key}`} className="legal-nav-link">{LEGAL_DOCS[key].title}</NavLink>
        ))}
      </nav>

      <article className="legal-doc">
        <header>
          <h1>{content.title}</h1>
          <p className="legal-updated">Last updated {content.updated}</p>
          <p className="legal-summary">{content.summary}</p>
        </header>

        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}

        <section className="legal-contact" aria-label="Contact">
          <h2>Contact</h2>
          <p>
            {SITE.name} is run by {SITE.operator}. {SITE.about}{" "}
            {SITE.contactEmail ? (
              <>Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> with any question about this policy.</>
            ) : (
              <>Signed-in users can reach the team from Settings.</>
            )}
          </p>
        </section>
      </article>
    </div>
  );
}

export default LegalPage;
