/**
 * Static illustration of the Aeroxpress player: aerial "video" with burned-in widgets, the synced map,
 * the timeline and the altitude profile. Pure HTML/SVG, so it stays sharp and weighs nothing.
 */
const ROUTE = "M40 250 C 90 210, 110 150, 170 140 S 260 120, 290 80 S 350 40, 380 30";
const ALT = "M0 70 C 40 68, 60 40, 100 34 S 170 20, 210 22 S 280 12, 320 16 S 380 30, 400 26";

function Terrain() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35506b" />
          <stop offset="0.45" stopColor="#6d8aa0" />
          <stop offset="0.46" stopColor="#4e6a45" />
          <stop offset="1" stopColor="#2f4430" />
        </linearGradient>
        <linearGradient id="pm-sun" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbbf77" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#fbbf77" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#pm-sky)" />
      <path d="M0 122 L60 96 L110 112 L170 84 L230 106 L300 78 L350 98 L400 86 L400 130 L0 130 Z" fill="#415a55" opacity="0.9" />
      <path d="M0 140 C 80 126, 160 150, 240 132 S 360 146, 400 136 L400 260 L0 260 Z" fill="#3d5a3a" />
      <path d="M-10 260 C 90 200, 150 180, 220 160 S 330 140, 410 150" stroke="#c9b48a" strokeWidth="10" fill="none" opacity="0.75" />
      <path d="M-10 260 C 90 200, 150 180, 220 160 S 330 140, 410 150" stroke="#f3e6c4" strokeWidth="1.2" strokeDasharray="6 8" fill="none" opacity="0.8" />
      {[70, 120, 300, 340].map((x, i) => (
        <rect key={x} x={x} y={170 + (i % 2) * 20} width="26" height="18" rx="2" fill="#d9d4c7" opacity="0.8" />
      ))}
      <rect width="400" height="260" fill="url(#pm-sun)" />
    </svg>
  );
}

export function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-x-8 -top-8 -bottom-10 -z-10 rounded-[40px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-2xl" aria-hidden="true" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-20px_rgba(20,24,31,0.35)]">
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate rounded-md bg-card px-3 py-0.5 text-[11px] text-muted-foreground">aeroxpress.app/s/ring-road-survey</span>
        </div>

        <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
          {/* Video with burned-in widgets */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-[#1d2a22]">
            <Terrain />
            <div className="absolute top-3 left-3 text-white drop-shadow">
              <div className="text-[8px] font-semibold tracking-[0.18em] text-white/70 sm:text-[9px]">PROJECT</div>
              <div className="text-[11px] font-bold tracking-wide sm:text-sm">RING ROAD SURVEY</div>
            </div>
            <div className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-2.5 py-2 font-mono text-[9px] leading-relaxed text-white backdrop-blur-sm sm:text-[11px]">
              {[
                ["ALT", "84.2", "m"],
                ["SPD", "31.6", "km/h"],
                ["LAT", "17.385044", ""],
                ["LON", "78.486671", ""],
              ].map(([k, v, u]) => (
                <div key={k} className="flex gap-3">
                  <span className="w-6 font-sans font-semibold text-white/60">{k}</span>
                  <span className="ml-auto">{v}</span>
                  <span className="w-7 font-sans text-white/60">{u}</span>
                </div>
              ))}
            </div>
            <div className="absolute top-3 right-3 h-[38%] w-[34%] rounded-lg bg-black/45 backdrop-blur-sm">
              <svg viewBox="0 0 400 260" className="h-full w-full p-1" aria-hidden="true">
                <path d={ROUTE} fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="10" strokeLinecap="round" />
                <path d="M40 250 C 90 210, 110 150, 170 140 S 260 120, 290 80" fill="none" stroke="#f59e0b" strokeWidth="12" strokeLinecap="round" />
                <circle cx="290" cy="80" r="20" fill="#f59e0b" stroke="white" strokeWidth="7" />
              </svg>
            </div>
            <div className="absolute right-0 bottom-0 left-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2">
              <span className="size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
              <div className="h-1 flex-1 rounded-full bg-white/30">
                <div className="h-1 w-[62%] rounded-full bg-white" />
              </div>
              <span className="font-mono text-[9px] text-white/80">02:41 / 04:18</span>
            </div>
          </div>

          {/* Interactive map */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-[#e8ece4]">
            <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <rect width="400" height="260" fill="#eef1ea" />
              <path d="M0 60 L400 110" stroke="#fff" strokeWidth="14" />
              <path d="M0 60 L400 110" stroke="#f6d38a" strokeWidth="8" />
              <path d="M120 0 L180 260" stroke="#fff" strokeWidth="10" />
              <path d="M300 0 L260 260" stroke="#fff" strokeWidth="8" />
              <path d="M0 200 C 100 190, 200 230, 400 200" stroke="#a9d3ee" strokeWidth="14" fill="none" />
              <rect x="200" y="140" width="60" height="40" rx="4" fill="#cfe6c3" />
              <rect x="30" y="100" width="50" height="34" rx="3" fill="#dcd8cf" />
              <rect x="310" y="150" width="50" height="30" rx="3" fill="#dcd8cf" />
              <path d={ROUTE} fill="none" stroke="#14181f" strokeOpacity="0.25" strokeWidth="7" strokeLinecap="round" />
              <path d={ROUTE} fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <path d="M40 250 C 90 210, 110 150, 170 140 S 260 120, 290 80" fill="none" stroke="#c2560c" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="40" cy="250" r="7" fill="#17803d" stroke="white" strokeWidth="3" />
              <circle cx="380" cy="30" r="7" fill="#d1302a" stroke="white" strokeWidth="3" />
              <circle cx="290" cy="80" r="18" fill="#c2560c" opacity="0.2" />
              <circle cx="290" cy="80" r="9" fill="#c2560c" stroke="white" strokeWidth="3" />
            </svg>
            <div className="absolute right-2 bottom-2 flex overflow-hidden rounded-md border border-border bg-card text-[9px] font-medium shadow-sm">
              <span className="bg-muted px-2 py-1">Map</span>
              <span className="px-2 py-1 text-muted-foreground">Satellite</span>
            </div>
          </div>

          {/* Altitude profile + stats */}
          <div className="rounded-xl border border-border p-3 md:col-span-2">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">Altitude</span>
              <span className="font-mono">
                84.2 <span className="text-muted-foreground">m</span>
              </span>
            </div>
            <div className="relative h-14 overflow-hidden rounded-lg bg-muted/60">
              <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                <path d={ALT} fill="none" stroke="#5b6675" strokeOpacity="0.4" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                <clipPath id="pm-flown">
                  <rect width="248" height="80" />
                </clipPath>
                <g clipPath="url(#pm-flown)">
                  <path d={`${ALT} L400 80 L0 80 Z`} fill="#c2560c" fillOpacity="0.14" />
                  <path d={ALT} fill="none" stroke="#c2560c" strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
                </g>
              </svg>
              <div className="absolute inset-y-0 left-[62%] w-px bg-foreground/60" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["GPS points", "1,248"],
                ["Distance", "4.82 km"],
                ["Duration", "18m 42s"],
                ["Altitude", "12 m — 96 m"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted/60 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">{k}</div>
                  <div className="text-sm font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
