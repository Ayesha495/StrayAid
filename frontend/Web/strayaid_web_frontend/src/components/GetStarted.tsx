import React from 'react';
import './GetStarted.css';

interface GetStartedProps {
  onLogin: () => void;
}

const GetStarted: React.FC<GetStartedProps> = ({ onLogin }) => {
  return (
    <section id="get-started" className="getstarted-section">
      <div className="getstarted-container">
        <div className="getstarted-content">
          <h2>Ready to Make a Difference?</h2>
          
          <p className="getstarted-description">
            Join StrayAid today and take the first step toward a 
            more organized and impactful animal welfare system.
          </p>
          
          <div className="getstarted-buttons">
            <button className="btn-getstarted" onClick={onLogin}>
              Register as Organization
            </button>
            <button
              className="btn-contact"
              onClick={() => window.location.href = 'mailto:info@strayaid.com'}
            >
              Contact Us
            </button>
          </div>

          <div className="stats">
            <div className="stat">
              <h3>10K+</h3>
              <p>Animals Helped</p>
            </div>
            <div className="stat">
              <h3>500+</h3>
              <p>Active Volunteers</p>
            </div>
            <div className="stat">
              <h3>50+</h3>
              <p>Partner Shelters</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GetStarted;