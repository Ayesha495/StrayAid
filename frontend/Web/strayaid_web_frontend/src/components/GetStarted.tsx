import React from 'react';
import './GetStarted.css';
import { Mail, PawPrint, Users, Building2 } from 'lucide-react';

interface GetStartedProps {
  onLogin: () => void;
}

const GetStarted: React.FC<GetStartedProps> = ({ onLogin }) => {
  return (
    <section id="get-started" className="lp-section lp-section--brand">
      <div className="lp-container">
        <div className="getstarted-content">
          <span className="eyebrow-pill getstarted-eyebrow">Join The Movement</span>
          <h2 className="lp-section-title">Ready to Make a Difference?</h2>

          <p className="lp-section-lead">
            Join StrayAid today and take the first step toward a
            more organized and impactful animal welfare system.
          </p>

          <div className="getstarted-buttons">
            <button className="btn btn-light" onClick={onLogin}>
              Register as Organization
            </button>
            <button
              className="btn btn-outline-light"
              onClick={() => window.location.href = 'mailto:info@strayaid.com'}
            >
              <Mail size={16} /> Contact Us
            </button>
          </div>

          <div className="gs-stats">
            <div className="gs-stat">
              <span className="gs-stat-icon"><PawPrint size={18} /></span>
              <div>
                <h3>10K+</h3>
                <p>Animals Helped</p>
              </div>
            </div>
            <div className="gs-stat">
              <span className="gs-stat-icon"><Users size={18} /></span>
              <div>
                <h3>500+</h3>
                <p>Active Volunteers</p>
              </div>
            </div>
            <div className="gs-stat">
              <span className="gs-stat-icon"><Building2 size={18} /></span>
              <div>
                <h3>50+</h3>
                <p>Partner Shelters</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GetStarted;
