import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import './Hero.css';
import heroImage from '../assets/1.jpg';

interface HeroProps {
  scrollToSection: (sectionId: string) => void;
  onLogin: () => void;
  onSignup: () => void;
}

const Hero: React.FC<HeroProps> = ({ onLogin, onSignup }) => {
  return (
    <section id="home" className="hero-section">
      {/* Half-screen photo on the right; fades into the page (see .lp-split) */}
      <div className="hero-image-side lp-split lp-split--right">
        <img src={heroImage} alt="Volunteer caring for a rescued dog" className="lp-split-img" />
      </div>

      <div className="hero-container">
        <div className="hero-content">
          <span className="eyebrow-pill animate-text">
            <Sparkles size={13} /> Stray Welfare, Organized
          </span>

          <h1 className="hero-title animate-text">
            Manage.
            <br />
            Protect.
            <br />
            Transform Lives.
          </h1>

          <p className="hero-description animate-text">
            A smarter way to manage stray animal welfare. Track cases,
            coordinate teams, and take action faster for a better world.
          </p>

          <div className="hero-buttons animate-text">
            <button className="btn btn-primary" onClick={onSignup}>
              Sign Up
            </button>
            <button className="btn btn-secondary" onClick={onLogin}>
              Login
            </button>
          </div>

          <div className="hero-trust animate-text">
            <div className="hero-trust-icon">
              <ShieldCheck size={16} />
            </div>
            <p>
              Trusted by rescue organizations and volunteers <br />
              working together across the community.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
