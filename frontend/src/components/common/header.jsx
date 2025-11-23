import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  // Toggle mobile menu
  const togglemobilemenu = () => {
    const mobilemenu = document.getElementById('mobilemenu');
    if (mobilemenu) {
      mobilemenu.classList.toggle('-translate-x-full');
    }
  };

  // Scroll listener for transparency
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 backdrop-blur-md ${
        scrolled ? 'bg-gray-900/90 shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="flex flex-wrap justify-between items-center py-0 sm:py-9 px-4 sm:px-6 md:px-8 lg:px-10 lg:py-0">
        {/* Boxicons */}
        <link
          href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css"
          rel="stylesheet"
        />

        {/* Logo + Title */}
        <div className="flex items-center flex-shrink-0 min-w-0">
          <img
            src="/logo.png"
            alt="InsightLogs Logo"
            className="w-35 h-35 object-contain block m-0 p-0 -mr-[12px] -ml-[27px] sm:-ml-[40px] md:-ml-[50px] lg:-ml-[57px] align-middle pl-1.5"
          />
          <h2 className="text-2xl md:text-2xl lg:text-5xl font-semibold m-0 leading-none truncate lg:my-3 lg:py-1.5 text-[#dfe9ff] drop-shadow-[0_0_8px_rgba(125,211,252,0.6)]">
            InsightLogs
          </h2>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-wrap items-center justify-end gap-6 sm:gap-8 lg:gap-12 text-base text-nowrap pr-2 sm:pr-4 lg:pr-10">
          <Link
            to="/"
            className="tracking-wider transition-all duration-300 hover:text-[#c4b5fd] hover:scale-105 hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] z-50"
          >
            HOME
          </Link>

          <Link
            to="/features"
            className="tracking-wider transition-all duration-300 hover:text-[#c4b5fd] hover:scale-105 hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] z-50"
          >
            FEATURES
          </Link>

          <a
            href="https://github.com/irikaishani/InsightLogs"
            target="_blank"
            rel="noopener noreferrer"
            className="tracking-wider transition-all duration-300 hover:text-[#c4b5fd] hover:scale-105 hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] z-50"
          >
            DOCS
          </a>

          <Link
            to="/signup"
            className="tracking-wider transition-all duration-300 hover:text-[#c4b5fd] hover:scale-105 hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] z-50"
          >
            SIGN UP
          </Link>
        </nav>

        {/* Desktop Login */}
        <div className="hidden md:block">
          <Link
            to="/login"
            className="bg-[#6299f1] text-white py-2.5 px-8 rounded-full border-b-4 border-[#2563eb] font-medium transition-all duration-300 hover:bg-[#60a5fa] hover:border-[#93c5fd] hover:drop-shadow-[0_0_12px_rgba(125,211,252,0.6)] cursor-pointer z-50"
          >
            LOG IN
          </Link>
        </div>

        {/* Mobile Menu Icon */}
        <button
          onClick={togglemobilemenu}
          className="md:hidden text-3xl p-2 z-50"
        >
          <i className="bx bx-menu text-2xl"></i>
        </button>

        {/* Mobile Sidebar */}
        <div
          id="mobilemenu"
          className="fixed inset-0 z-50 h-screen w-screen bg-gray-800 transform -translate-x-full transition-transform duration-100 ease-in-out"
        >
          <div className="flex items-center justify-between px-6 py-6 w-full bg-gray-900">
            <h1 className="text-gray-300 text-4xl font-semibold">Menu</h1>
          </div>

          <nav className="flex flex-col items-start justify-start flex-1 gap-6 px-6 pt-6 w-full">
            <Link
              to="/"
              onClick={togglemobilemenu}
              className="py-3 text-gray-300 text-xl font-medium rounded-md hover:bg-gray-500 hover:text-[#95c0ff] transition-all w-full"
            >
              HOME
            </Link>

            <Link
              to="/features"
              onClick={togglemobilemenu}
              className="py-3 text-gray-300 text-xl font-medium rounded-md hover:bg-gray-500 hover:text-[#95c0ff] transition-all w-full"
            >
              FEATURES
            </Link>

            <a
              href="https://github.com/irikaishani/InsightLogs"
              target="_blank"
              rel="noopener noreferrer"
              onClick={togglemobilemenu}
              className="py-3 text-gray-300 text-xl font-medium rounded-md hover:bg-gray-500 hover:text-[#95c0ff] transition-all w-full"
            >
              DOCS
            </a>

            <Link
              to="/signup"
              onClick={togglemobilemenu}
              className="py-3 text-gray-300 text-xl font-medium rounded-md hover:bg-gray-500 hover:text-[#95c0ff] transition-all w-full"
            >
              SIGN UP
            </Link>

            <Link
              to="/login"
              onClick={togglemobilemenu}
              className="py-3 text-gray-300 text-xl font-medium rounded-md hover:bg-gray-500 hover:text-[#95c0ff] transition-all w-full"
            >
              LOG IN
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
