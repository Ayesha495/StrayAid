import React from 'react';
import './Features.css';
import { FileText, Home, BarChart3, BookOpen } from 'lucide-react';
import Reveal from './Reveal';

const Features: React.FC = () => {
  const features = [
    {
      icon: <FileText size={22} />,
      tone: 'blue',
      title: 'Case Management',
      description: 'Efficiently track, update, and manage all reported stray animal cases in one place.'
    },
    {
      icon: <Home size={22} />,
      tone: 'amber',
      title: 'Volunteer Coordination',
      description: 'Assign tasks, monitor activity, and stay connected with your rescue team.'
    },
    {
      icon: <BarChart3 size={22} />,
      tone: 'green',
      title: 'Dashboard Insights',
      description: 'Access real-time data and analytics to make faster, informed decisions.'
    },
    {
      icon: <BookOpen size={22} />,
      tone: 'violet',
      title: 'Centralized Records',
      description: 'Securely store and manage rescue, medical, and case history records.'
    }
  ];

  return (
    <section id="features" className="lp-section lp-section--surface">
      <div className="lp-container">

        <Reveal className="lp-section-header">
          <span className="eyebrow-pill">What You Get</span>
          <h2 className="lp-section-title">Powerful Tools for Better Management</h2>
          <p className="lp-section-lead">
            Everything a rescue team needs to go from a reported sighting to a safe, recovered animal.
          </p>
        </Reveal>

        <div className="features-grid">
          {features.map((feature, index) => (
            <Reveal key={feature.title} tilt className="lp-card" data-tone={feature.tone} delay={index * 100}>
              <span className="lp-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </Reveal>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Features;
