const PATH = "M70 660 C 170 600, 150 470, 290 440 S 470 380, 500 290 S 640 150, 740 110";

/** Decorative topo map with an animated flight path. Pure SVG (animateMotion); a static marker replaces it for prefers-reduced-motion. */
export function FlightArt({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <radialGradient id="fa-glow" cx="60%" cy="40%" r="70%">
            <stop offset="0" stopColor="#c2560c" stopOpacity="0.35" />
            <stop offset="1" stopColor="#101419" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fa-path" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#c2560c" />
          </linearGradient>
          <pattern id="fa-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="white" strokeOpacity="0.05" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="#101419" />
        <rect width="800" height="800" fill="url(#fa-grid)" />
        <rect width="800" height="800" fill="url(#fa-glow)" />
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M-20 ${140 + i * 70} C 180 ${90 + i * 74}, 330 ${210 + i * 62}, 520 ${130 + i * 70} S 760 ${170 + i * 66}, 840 ${120 + i * 72}`}
            fill="none"
            stroke="white"
            strokeOpacity={0.06 + (i % 3) * 0.02}
          />
        ))}
        <path d={PATH} fill="none" stroke="black" strokeOpacity="0.5" strokeWidth="9" strokeLinecap="round" />
        <path d={PATH} fill="none" stroke="url(#fa-path)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="70" cy="660" r="9" fill="#17803d" stroke="white" strokeWidth="3" />
        <circle cx="740" cy="110" r="9" fill="#d1302a" stroke="white" strokeWidth="3" />
        <g className="fa-drone">
          <circle r="22" fill="#c2560c" fillOpacity="0.25" />
          <circle r="11" fill="#c2560c" stroke="white" strokeWidth="4" />
          <animateMotion dur="14s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" path={PATH} />
        </g>
        <g className="fa-drone-static" transform="translate(500 290)">
          <circle r="22" fill="#c2560c" fillOpacity="0.25" />
          <circle r="11" fill="#c2560c" stroke="white" strokeWidth="4" />
        </g>
      </svg>
    </div>
  );
}
