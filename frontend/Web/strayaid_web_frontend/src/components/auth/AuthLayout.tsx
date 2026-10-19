import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { LogoMark } from "../../ui/Logo";
import { ProgressiveBlur } from "@/components/ui/skiper-ui/skiper41";
import "./Auth.css";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The photo panel: an image and a short line that says why this matters. */
  image?: string;
  imageAlt?: string;
  quote?: ReactNode;
  /** Shows the "Log in / Sign up" switch above the form. */
  mode?: "login" | "register";
};

/**
 * Sign-in, sign-up and password reset share one layout: a full-height photo on the left that
 * runs to the edges of the window, and the form on a raised card over the paper canvas.
 * On phones the photo becomes a short banner above the card.
 */
function AuthLayout({ title, subtitle, children, image = "/landing/rickshaw.webp", imageAlt = "", quote, mode }: AuthLayoutProps) {
  return (
    <div className="ds auth">
      <a href="#auth-form" className="skip-link">Skip to form</a>
      <aside className="auth-photo">
        <img src={image} alt={imageAlt} />
        <ProgressiveBlur position="bottom" height="48%" blurAmount="6px" backgroundColor="rgba(10, 20, 16, 0)" className="auth-photo-blur" />
        <Link to="/" className="auth-brand" aria-label="StrayAid home"><LogoMark size={30} /> StrayAid</Link>
        {quote ? <div className="auth-quote">{quote}</div> : null}
      </aside>

      <main className="auth-main">
        <motion.div
          className="auth-card"
          id="auth-form"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {mode ? (
            <nav className="auth-switch" aria-label="Account">
              {(["login", "register"] as const).map((key) => (
                <NavLink key={key} to={key === "login" ? "/login" : "/register"} className="auth-switch-item">
                  {mode === key ? <motion.span layoutId="auth-switch" className="auth-switch-pill" transition={{ type: "spring", stiffness: 420, damping: 36 }} /> : null}
                  <span>{key === "login" ? "Log in" : "Sign up"}</span>
                </NavLink>
              ))}
            </nav>
          ) : null}
          <header className="auth-head">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export default AuthLayout;
