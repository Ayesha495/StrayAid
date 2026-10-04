import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import About from '../components/About';
import Features from '../components/Features';
import GetStarted from '../components/GetStarted';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');
  // After a nav click, ignore scroll events while the smooth scroll plays out so
  // the highlight doesn't flicker through every section on the way.
  const lockUntil = useRef(0);

  useEffect(() => {
    const sections = ['home', 'about', 'features', 'get-started'];
    const NAVBAR_OFFSET = 120;

    const updateActiveSection = () => {
      // The last section can be shorter than the screen, so its top may never
      // reach the top of the page. At the bottom of the page it is the active one.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActiveSection(sections[sections.length - 1]);
        return;
      }

      const marker = window.scrollY + NAVBAR_OFFSET;
      let current = sections[0];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element && element.getBoundingClientRect().top + window.scrollY <= marker) {
          current = section;
        }
      }
      setActiveSection(current);
    };

    const handleScroll = () => {
      if (Date.now() < lockUntil.current) {
        return;
      }
      updateActiveSection();
    };

    updateActiveSection();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      setActiveSection(sectionId);
      lockUntil.current = Date.now() + 900;
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
        <GetStarted onLogin={handleLogin} />
      </main>
    </div>
  );
};

export default LandingPage;