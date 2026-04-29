import React from 'react';
import './Features.css';
import { FileText, Home, BarChart3, BookOpen } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <FileText size={32} />,
      title: <>Case<br/>Management</>,
      description: 'Efficiently track, update, and manage all reported stray animal cases in one place.'
    },
    {
      icon: <Home size={32} />,
      title: <>Volunteer<br/>Coordination</>,
      description: 'Assign tasks, monitor activity, and stay connected with your rescue team.'
    },
    {
      icon: <BarChart3 size={32} />,
      title: <>Dashboard<br/>Insights</>,
      description: 'Access real-time data and analytics to make faster, informed decisions.'
    },
    {
      icon: <BookOpen size={32} />,
      title: <>Centralized<br/>Records</>,
      description: 'Securely store and manage rescue, medical, and case history records.'
    }
  ];

  return (
    <section id="features" className="features-section">
      <div className="features-container">
        
        <div className="features-header-wrapper">
          <div className="line"></div>
          <h2 className="features-title">Powerful Tools for Better Management</h2>
          <div className="line"></div>
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