import React from 'react';
import './Hero.css';

interface HeroProps {
  scrollToSection: (sectionId: string) => void;
  onLogin: () => void;     // ← Add this line
  onSignup: () => void;    // ← Add this line
}

const Hero: React.FC<HeroProps> = ({  onLogin, onSignup }) => {
  return (
    <section id="home" className="hero-section">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            Manage.Protect.
            <br />
            Transform Lives.
          </h1>
          <h3>
            -------------------------------------------------------------
          </h3>
          <h2 className="hero-description">
            A smarter way to manage stray animal
            <br />
            welfare track cases, coordinate teams,
            <br />
            and take action faster.
          </h2>
          <div className="hero-buttons">
            <button 
              className="btn-login-hero"
              onClick={onLogin}
            >
              Login
            </button>
            <button 
              className="btn-signup-hero"
              onClick={onSignup}
            >
              Sign Up
            </button>
          </div>
        </div>
        <div className="hero-image">
          <div className="image-placeholder">
            🐕 🐈 🐾
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;