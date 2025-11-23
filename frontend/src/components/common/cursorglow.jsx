// src/components/common/CursorGlow.jsx
import React, { useEffect, useRef } from "react";

export default function CursorGlow() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // comet tail variables
    let currentX = window.innerWidth / 2;
    let currentY = window.innerHeight / 2;
    let targetX = currentX;
    let targetY = currentY;

    const speed = 0.15; // lower = longer tail
    const animate = () => {
      currentX += (targetX - currentX) * speed;
      currentY += (targetY - currentY) * speed;

      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1)`;
      requestAnimationFrame(animate);
    };
    animate();

    const move = (e) => {
      targetX = e.clientX - 40;
      targetY = e.clientY - 40;

      el.style.opacity = "1";
      el.style.transform += " scale(1.15)"; // slight pulse while moving
    };

    const leave = () => {
      el.style.opacity = "0";
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseout", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseout", leave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[9999] w-24 h-24 rounded-full blur-3xl"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        transform: "translate3d(-9999px,-9999px,0)",
        transition: "opacity 0.3s ease-out",

        // brighter + comet-like intense center
        background:
          "radial-gradient(circle at 30% 30%, rgba(147,197,253,1), rgba(59,130,246,0.55) 40%, rgba(59,130,246,0.25) 70%, transparent 100%)",
      }}
    />
  );
}
