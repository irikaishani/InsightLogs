import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-100 pt-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Top Section */}
        <div className="flex flex-wrap gap-10 md:gap-20">

          {/* Logo + Newsletter Section */}
          <div className="flex-1 min-w-[250px]">
            {/* Logo and Heading inline */}
            <div className="flex items-center gap-4 mb-4">
              <a href="/" aria-label="Go to homepage" className="inline-block">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto transition-all duration-300 brightness-110"
                />
              </a>
              <h3 className="text-lg sm:text-xl font-semibold">
                Subscribe to our Plans
              </h3>
            </div>

            <p className="text-gray-400 mb-3 max-w-sm">
              Get tips, technical guides, and real-time log insights!
            </p>

            {/* Newsletter input + button */}
            <form className="flex flex-col sm:flex-row items-center gap-3 mt-4">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full sm:w-auto flex-1 px-4 py-2 rounded-full bg-gray-800 border border-gray-700 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => alert("We don't have any subscription plans yet.")}
                className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:opacity-90 transition-all duration-300"
              >
                Subscribe
              </button>

            </form>
          </div>

          {/* Links Section */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 flex-1 min-w-[250px]">
            <div>
              <h4 className="font-semibold text-gray-400 mb-2">Links</h4>
              <ul className="space-y-1 text-gray-300">
                <li><a href="https://github.com/irikaishani/InsightLogs" className="hover:text-white">Demo</a></li>

                <li><a href="https://github.com/irikaishani/InsightLogs" className="hover:text-white">Docs</a></li>
                <li><a href="https://github.com/irikaishani" className="hover:text-white">GitHub</a></li>
                <li><a href="https://www.linkedin.com/in/irika-ishani-828267307/" className="hover:text-white">LinkedIn</a></li>
                <li>
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=ishaniirika5@gmail.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    Gmail
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-700 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-sm lg:py-4">
          <p>© 2025 InsightLogs. All Rights Reserved.</p>



          <div className="flex gap-3 mt-3 md:mt-0">
            <a href="https://www.linkedin.com/in/irika-ishani-828267307/" className="hover:text-white">LinkedIn</a>
            <a href="https://x.com" className="hover:text-white">X</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
