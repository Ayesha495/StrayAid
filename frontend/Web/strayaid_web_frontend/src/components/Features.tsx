import React from 'react';
import './Features.css';

const Features: React.FC = () => {
  const features = [
    {
      icon: '📍',
      title: 'Report Stray Animals',
      description: 'Easily report stray animals in your area with location tracking and photos.'
    },
    {
      icon: '🏥',
      title: 'Medical Assistance',
      description: 'Connect with nearby vets and animal hospitals for emergency care.'
    },
    {
      icon: '🏠',
      title: 'Adoption Services',
      description: 'Find loving homes for stray animals through our adoption network.'
    },
    {
      icon: '👥',
      title: 'Volunteer Network',
      description: 'Join our volunteer community and help make a difference.'
    },
    {
      icon: '💰',
      title: 'Donation Platform',
      description: 'Support animal shelters and rescue organizations directly.'
    },
    {
      icon: '📱',
      title: 'Mobile App',
      description: 'Access all features on the go with our mobile application.'
    }
  ];

  return (
    <section id="features" className="features-section">
      <div className="features-container">
        <div className="features-header">
          <h2>Powerful Features</h2>
          <p>Everything you need to help stray animals in one place</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;