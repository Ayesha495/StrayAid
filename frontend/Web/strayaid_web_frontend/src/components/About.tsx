import React from 'react';
import './About.css';

const About: React.FC = () => {
  return (
    <section id="about" className="about-section">
      <div className="about-container">
        <div className="about-header">
          <h2>About StrayAid</h2>
          <p>Our mission is to create a world where no stray animal is left behind</p>
        </div>
        <div className="about-content">
          <div className="about-card">
            <div className="about-icon">🎯</div>
            <h3>Our Mission</h3>
            <p>To provide a comprehensive platform that connects stray animals with caring individuals and organizations, ensuring they receive the care and love they deserve.</p>
          </div>
          <div className="about-card">
            <div className="about-icon">👥</div>
            <h3>Our Community</h3>
            <p>Join thousands of animal lovers, volunteers, and shelters working together to make a difference in the lives of stray animals.</p>
          </div>
          <div className="about-card">
            <div className="about-icon">🌍</div>
            <h3>Our Impact</h3>
            <p>Since our launch, we've helped connect over 10,000 stray animals with loving homes and provided medical care to thousands more.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;