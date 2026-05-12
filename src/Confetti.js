/**
 * src/Confetti.js
 * Emoji confetti that explodes upward from the bottom of the viewport on win.
 * Mount with active=true to trigger; unmounts itself after the animation.
 */
import { useEffect, useState } from "react";

const EMOJIS = ["🎉", "🎊", "🏆", "🎖️", "🏅", "🥉", "🥈", "🥇"];
const COUNT  = 28;

function rand(min, max) { return min + Math.random() * (max - min); }

export default function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }

    const ps = Array.from({ length: COUNT }, (_, i) => ({
      id:       i,
      emoji:    EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      x:        rand(5, 95),           // % from left edge
      xDrift:   rand(-120, 120),       // px horizontal drift during flight
      duration: rand(1.4, 2.4),        // seconds
      delay:    rand(0, 0.35),         // stagger
      size:     Math.floor(rand(22, 40)),
      rotate:   rand(-540, 540),       // total rotation in deg
      rise:     rand(55, 95),          // % of vh to travel upward
    }));
    setParticles(ps);

    // Remove particles after longest possible animation finishes
    const timeout = setTimeout(() => setParticles([]), 3500);
    return () => clearTimeout(timeout);
  }, [active]);

  if (!particles.length) return null;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      <style>{`
        @keyframes confetti-rise {
          0%   { opacity: 1;   transform: translateY(0px)      translateX(0px)          rotate(0deg); }
          70%  { opacity: 1; }
          100% { opacity: 0;   transform: translateY(var(--rise)) translateX(var(--drift)) rotate(var(--rot)); }
        }
      `}</style>
      {particles.map(p => (
        <span
          key={p.id}
          style={{
            position:  "absolute",
            bottom:    "-40px",
            left:      `${p.x}%`,
            fontSize:  p.size,
            lineHeight: 1,
            display:   "block",
            "--rise":  `-${p.rise}vh`,
            "--drift": `${p.xDrift}px`,
            "--rot":   `${p.rotate}deg`,
            animation: `confetti-rise ${p.duration}s cubic-bezier(.25,.46,.45,.94) ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
