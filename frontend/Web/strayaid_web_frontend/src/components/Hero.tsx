import React from 'react';
import './Hero.css';
import '../assets/Group1.jpg'; // Ensure you have an image at this path or update accordingly

interface HeroProps {
  scrollToSection: (sectionId: string) => void;
  onLogin: () => void;
  onSignup: () => void;
}

const Hero: React.FC<HeroProps> = ({ onLogin, onSignup }) => {
  return (
    <section id="home" className="hero-section">
      <div className="hero-container">
        <div className="hero-content">
          <div className="header-text-container">
            <h1 className="hero-title animate-text">
              Manage. Protect.
              <br />
              Transform Lives.
            </h1>
            <div className="hero-divider animate-text"></div>
          </div>
          
          <p className="hero-description animate-text">
            A smarter way to manage stray animal welfare. Track cases, 
            coordinate teams, and take action faster for a better world.
          </p>
          
          <div className="hero-buttons animate-text">
            <button className="btn-login-hero" onClick={onLogin}>
              Login
            </button>
            <button className="btn-signup-hero" onClick={onSignup}>
              Sign Up
            </button>
          </div>
        </div>
        
        <div className="hero-image-side">
          <div className="hero-full-bg"></div>
          <img src="../assets/Group1.jpg" alt="Hero" className="hero-image" />
        </div>
      </div>
    </section>
  );
};

export default Hero;