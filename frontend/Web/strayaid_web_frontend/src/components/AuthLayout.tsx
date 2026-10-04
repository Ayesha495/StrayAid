import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../styles/Auth.css";

interface AuthLayoutProps {
  image: string;
  headline: string;
  highlight: string;
  tagline?: string;
  children: ReactNode;
}

function AuthLayout({ image, headline, highlight, tagline, children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <aside className="auth-visual">
          <img className="auth-visual__img" src={image} alt="" aria-hidden="true" />

          <Link to="/" className="auth-brand">
            🐾 StrayAid
          </Link>

          <div>
            <p className="auth-headline">
              {headline}
              <em>{highlight}</em>
            </p>
            {tagline && <p className="auth-tagline">{tagline}</p>}
          </div>
        </aside>

        <section className="auth-panel">
          <div className="auth-panel__inner">{children}</div>
        </section>
      </div>
    </main>
  );
}

export default AuthLayout;
