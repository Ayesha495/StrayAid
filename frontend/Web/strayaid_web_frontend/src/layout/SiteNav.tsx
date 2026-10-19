import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { LogoMark } from "../ui/Logo";
import { SpotlightNavbar } from "@/components/ui/spotlight-navbar";
import "./SiteNav.css";

const LINKS = [
  { href: "/#journey", label: "How it works" },
  { href: "/animals/browse", label: "Animals" },
  { href: "/organizations", label: "Rescue teams" },
  { href: "/feed", label: "Community" },
];

/**
 * The top bar for people who aren't signed in, on the landing page and every public page.
 * The links use VengeanceUI's spotlight navbar: a light follows the pointer along the track,
 * and a glow marks the page you're on.
 */
function SiteNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  const current = LINKS.findIndex((link) => !link.href.includes("#") && location.pathname.startsWith(link.href));

  const go = (href: string) => {
    setOpen(false);
    const [path, hash] = href.split("#");
    if (hash && location.pathname === (path || "/")) {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
  };

  return (
    <header className="site-nav-wrap">
      <nav className="site-nav" aria-label="Main">
        <Link to="/" className="site-brand" aria-label="StrayAid home"><LogoMark size={28} /> StrayAid</Link>
        <SpotlightNavbar
          key={location.pathname}
          items={LINKS}
          defaultActiveIndex={current}
          onItemClick={(item) => go(item.href)}
          className="site-spotlight"
        />
        <div className="site-nav-auth">
          <Link to="/login" state={{ from: location.pathname }} className="site-login">Log in</Link>
          <Link to="/register" className="btn btn-primary">Sign up</Link>
        </div>
        <button type="button" className="site-menu" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {open ? (
        <div className="site-mobile-menu">
          {LINKS.map((item) => (
            <button key={item.label} type="button" onClick={() => go(item.href)} aria-current={LINKS.indexOf(item) === current ? "page" : undefined}>
              {item.label}
            </button>
          ))}
          <div className="site-mobile-auth">
            <Link to="/login" state={{ from: location.pathname }} className="btn btn-secondary">Log in</Link>
            <Link to="/register" className="btn btn-primary">Sign up</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default SiteNav;
