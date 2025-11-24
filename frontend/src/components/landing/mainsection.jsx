import React from 'react';
import Spline from '@splinetool/react-spline';

const Mainsection = () => {
  return (
    <main className="relative flex flex-col-reverse lg:flex-row items-center justify-between min-h-[calc(100vh-6rem)] overflow-hidden px-6 sm:px-10 lg:px-20 py-10 lg:py-16 mt-34 ">

      {/* Background Gradient Image */}
      <img
        className="absolute top-0 right-0 opacity-100 -z-20"
        src="/gradient.png"
        alt="Gradient-img"
      />

      {/* Blur/Glow Effect */}
      <div className="absolute top-[20%] right-[-5%] w-[40rem] h-90 -rotate-[30deg] bg-[#95c0ff]/30 blur-[150px] shadow-[0_0_900px_20px_#95c0ff] -z-10"></div>

      {/* -------- Left Text Section -------- */}
      <div className="relative z-10 flex flex-col items-start text-center lg:text-left max-w-2xl w-full mt-10 lg:mt-0">

        {/* Tag bubble */}
        <div className="relative w-full sm:w-48 h-10 mx-auto lg:mx-0 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#7da7fc] to-[#c4b5fd] shadow-[0_0_18px_rgba(150,130,255,0.5)] flex items-center justify-center">
          <div className="absolute inset-[2px] bg-black rounded-full flex items-center justify-center gap-2 px-4 transition-transform duration-300 ease-out hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            <link
              href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css"
              rel="stylesheet"
            />
            <i className="bx bx-diamond text-[#b0a9ff]"></i>
            <span className="text-white font-medium text-sm sm:text-base tracking-wider">
              DECODE:
            </span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-wider my-6 sm:my-8 bg-gradient-to-r from-[#3b82f6] via-[#7da7fc] to-[#d1b8ff] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(140,120,255,0.7)]">
          TURN LOGS <br className="hidden sm:block" />
          INTO INSIGHTS
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base md:text-lg tracking-wider text-gray-400 mx-auto lg:mx-0 max-w-md sm:max-w-lg">
          Transform raw logs into actionable insights instantly. Identify errors, warnings, and patterns in your code, so you can debug faster and keep your applications running smoothly.
        </p>

        {/* Button */}
        <div className="py-6">
          <a
            className="border text-gray-300 border-[#2a2a2a] py-2 sm:py-2.5 px-5 sm:px-6 rounded-full sm:text-lg text-sm font-semibold tracking-wider transition-all duration-300 hover:bg-[#1a1a1a] hover:text-white"
            href="https://github.com/irikaishani/InsightLogs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation <i className="bx bx-link-external align-middle"></i>
          </a>

        </div>
      </div>

      {/* -------- Right 3D Spline Section -------- */}
      <div
        className="
          w-full
          h-[45vh] sm:h-[55vh] md:h-[65vh] lg:h-[75vh] xl:h-[80vh]
          relative flex justify-center items-center
          lg:-mt-8 xl:-mt-12
        "
      >
        <Spline
          className="
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[130%] sm:w-[110%] md:w-[100%] lg:w-full
            h-full
            scale-[1.2] sm:scale-[1.4] md:scale-[1]
            object-contain 
          "
          scene="https://prod.spline.design/257jhJ22I0EpFd2X/scene.splinecode"
        />
      </div>
    </main>
  );
};

export default Mainsection;
