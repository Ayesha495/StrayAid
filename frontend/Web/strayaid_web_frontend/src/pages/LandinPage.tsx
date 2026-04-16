import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import About from '../components/About';
import Features from '../components/Features';
import GetStarted from '../components/GetStarted';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'about', 'features', 'get-started'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignup = () => {
    navigate('/register');
  };

  return (
    <div className="landing-page">
      <Navbar 
        activeSection={activeSection} 
        scrollToSection={scrollToSection}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
      <main>
        <Hero 
          scrollToSection={scrollToSection} 
          onLogin={handleLogin}
          onSignup={handleSignup}
        />
        <About />
        <Features />
        <GetStarted onGetStarted={handleSignup} />
      </main>
    </div>
  );
};

export default LandingPage;