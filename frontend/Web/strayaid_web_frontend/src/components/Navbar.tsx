import React, { useState } from 'react';
import './Navbar.css';

interface NavbarProps {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
  onLogin: () => void;
  onSignup: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  activeSection, 
  scrollToSection, 
  onLogin, 
  onSignup 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'features', label: 'Features' },
    { id: 'get-started', label: 'Get Started' },
  ];

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          <h2>🐾 StrayAid</h2>
        </div>

        <div className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  className={`nav-link ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="nav-buttons">
            <button className="btn-login" onClick={onLogin}>
              Login
            </button>
            <button className="btn-signup" onClick={onSignup}>
              Sign Up
            </button>
          </div>
        </div>

        <div className="menu-icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}></span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;