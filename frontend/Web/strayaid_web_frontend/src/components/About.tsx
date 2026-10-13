import React from 'react';
import './About.css';
import { Target, Users, Globe } from 'lucide-react';
import missionImage from '../assets/Group2.jpg';
import Reveal from './Reveal';

const About: React.FC = () => {
  return (
    <section id="about" className="lp-section about-section">
      {/* Half-screen photo on the left; fades into the page (see .lp-split) */}
      <Reveal className="about-image-side lp-split lp-split--left">
        <img className="lp-split-img" src={missionImage} alt="Rescue volunteer comforting a stray dog" />
      </Reveal>

      <div className="lp-container">
        <div className="about-body">
          <Reveal className="about-intro-text">
            <span className="eyebrow-pill">Why StrayAid</span>
            <h2 className="lp-section-title">Our mission is a world where no stray is left behind</h2>
            <p className="lp-section-lead">
              StrayAid connects reporters, rescue organizations, and volunteers on one
              platform, so every case gets seen, every animal gets tracked, and every
              act of care counts.
            </p>
          </Reveal>

        <div className="about-content">
          <Reveal tilt className="lp-card" data-tone="green">
            <span className="lp-icon">
              <Target size={22} />
            </span>
            <h3>Our Mission</h3>
            <p>
              To provide a comprehensive platform that connects stray animals with caring individuals and organizations, ensuring they receive the care and love they deserve.
            </p>
          </Reveal>

          <Reveal tilt className="lp-card" data-tone="blue" delay={120}>
            <span className="lp-icon">
              <Users size={22} />
            </span>
            <h3>Our Community</h3>
            <p>
              Join thousands of animal lovers, volunteers, and shelters working together to make a difference in the lives of stray animals.
            </p>
          </Reveal>

          <Reveal tilt className="lp-card" data-tone="violet" delay={240}>
            <span className="lp-icon">
              <Globe size={22} />
            </span>
            <h3>Our Impact</h3>
            <p>
              Since our launch, we've helped connect over 10,000 stray animals with loving homes and provided medical care to thousands more.
            </p>
          </Reveal>
        </div>
        </div>
      </div>
    </section>
  );
};

export default About;
