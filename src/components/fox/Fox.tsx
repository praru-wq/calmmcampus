import React, { useId } from "react";

type Pose = "wave" | "study" | "books" | "point" | "breathe" | "cheer" | "card" | "sleepy" | "proud" | "sit";

interface FoxProps {
  pose?: Pose;
  size?: number;
  className?: string;
  smile?: boolean;
}

/**
 * Cute pink-hoodie fox mascot, fully inline SVG (no external assets).
 * The same base body is reused; arms/eyes/props change per pose.
 * `smile` swaps in a happy curved smile + closed-eye smiles (overrides eye/mouth).
 */
export function Fox({ pose = "sit", size = 220, className = "", smile = false }: FoxProps) {
  const uid = useId().replace(/:/g, "");
  const hoodieId = `${uid}-hoodie`;
  const furId = `${uid}-fur`;
  const cheekId = `${uid}-cheek`;

  return (
    <svg
      viewBox="0 0 240 260"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ overflow: "visible" }}
      aria-label={`Fox mascot ${pose}`}
      role="img"
    >
      <defs>
        <linearGradient id={hoodieId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.86 0.1 5)" />
          <stop offset="1" stopColor="oklch(0.76 0.13 5)" />
        </linearGradient>
        <linearGradient id={furId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.82 0.13 45)" />
          <stop offset="1" stopColor="oklch(0.72 0.16 35)" />
        </linearGradient>
        <radialGradient id={cheekId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="oklch(0.82 0.18 15 / 0.7)" />
          <stop offset="1" stopColor="oklch(0.82 0.18 15 / 0)" />
        </radialGradient>
      </defs>

      {/* prop: book / desk depending on pose */}
      {pose === "study" && (
        <g>
          <rect x="40" y="200" width="160" height="14" rx="4" fill="oklch(0.85 0.06 60)" />
          <rect x="55" y="178" width="50" height="22" rx="3" fill="oklch(0.78 0.12 350)" />
          <rect x="130" y="172" width="55" height="28" rx="3" fill="oklch(0.78 0.13 200)" />
        </g>
      )}

      {/* body / hoodie */}
      <g className="animate-floaty">
        <ellipse cx="120" cy="200" rx="78" ry="46" fill={`url(#${hoodieId})`} />
        {/* hood ring */}
        <path d="M55,148 Q120,90 185,148 Q170,170 120,170 Q70,170 55,148Z" fill={`url(#${hoodieId})`} />
        {/* hood inner */}
        <path d="M70,150 Q120,108 170,150 Q150,158 120,158 Q90,158 70,150Z" fill="oklch(0.66 0.14 5)" opacity="0.6" />
        {/* head */}
        <ellipse cx="120" cy="120" rx="62" ry="56" fill={`url(#${furId})`} />
        {/* ears */}
        <path d="M70,82 L60,40 L100,72 Z" fill={`url(#${furId})`} />
        <path d="M170,82 L180,40 L140,72 Z" fill={`url(#${furId})`} />
        <path d="M75,76 L70,52 L92,72 Z" fill="oklch(0.55 0.16 30)" />
        <path d="M165,76 L170,52 L148,72 Z" fill="oklch(0.55 0.16 30)" />
        {/* face cream */}
        <path d="M80,118 Q120,170 160,118 Q140,148 120,148 Q100,148 80,118 Z" fill="oklch(0.97 0.02 70)" />
        <ellipse cx="120" cy="138" rx="34" ry="22" fill="oklch(0.97 0.02 70)" />
        {/* cheeks */}
        <ellipse cx="86" cy="138" rx="14" ry="9" fill={`url(#${cheekId})`} />
        <ellipse cx="154" cy="138" rx="14" ry="9" fill={`url(#${cheekId})`} />
        {/* eyes */}
        {smile ? (
          <>
            {/* happy closed-eye smiles */}
            <path d="M94,129 Q104,120 114,129" stroke="oklch(0.22 0.05 20)" strokeWidth="3.6" fill="none" strokeLinecap="round" />
            <path d="M126,129 Q136,120 146,129" stroke="oklch(0.22 0.05 20)" strokeWidth="3.6" fill="none" strokeLinecap="round" />
            {/* extra rosy blush for happy mood */}
            <ellipse cx="86" cy="142" rx="11" ry="5" fill="oklch(0.78 0.18 15 / 0.55)" />
            <ellipse cx="154" cy="142" rx="11" ry="5" fill="oklch(0.78 0.18 15 / 0.55)" />
          </>
        ) : pose === "sleepy" ? (
          <>
            <path d="M95,128 Q104,134 113,128" stroke="oklch(0.25 0.06 20)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M127,128 Q136,134 145,128" stroke="oklch(0.25 0.06 20)" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : pose === "cheer" || pose === "proud" ? (
          <>
            <path d="M95,130 Q104,122 113,130" stroke="oklch(0.25 0.06 20)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M127,130 Q136,122 145,130" stroke="oklch(0.25 0.06 20)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="104" cy="130" rx="5.5" ry="6.5" fill="oklch(0.2 0.04 20)" style={{ animation: "blink 5s infinite" }} />
            <ellipse cx="136" cy="130" rx="5.5" ry="6.5" fill="oklch(0.2 0.04 20)" style={{ animation: "blink 5s infinite" }} />
            <circle cx="106" cy="128" r="1.6" fill="white" />
            <circle cx="138" cy="128" r="1.6" fill="white" />
          </>
        )}
        {/* nose + mouth */}
        <ellipse cx="120" cy="146" rx="4" ry="3" fill="oklch(0.3 0.05 20)" />
        {smile ? (
          <>
            {/* curved happy smile with little tongue */}
            <path d="M108,154 Q120,168 132,154" stroke="oklch(0.25 0.05 20)" strokeWidth="2.4" fill="oklch(0.32 0.05 20)" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M118,161 Q120,166 122,161 Z" fill="oklch(0.78 0.16 15)" />
          </>
        ) : (
          <path d="M120,150 Q120,156 114,158 M120,150 Q120,156 126,158" stroke="oklch(0.3 0.05 20)" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {/* heart on hoodie */}
        <path d="M120,212 q-9,-10 -16,-3 q-5,5 0,11 q5,6 16,12 q11,-6 16,-12 q5,-6 0,-11 q-7,-7 -16,3 z" fill="oklch(0.95 0.04 25)" opacity="0.85" />

        {/* paws / props per pose */}
        {pose === "wave" && (
          <g style={{ transformOrigin: "180px 200px", animation: "floaty 1.6s ease-in-out infinite" }}>
            <ellipse cx="186" cy="170" rx="14" ry="16" fill={`url(#${furId})`} />
          </g>
        )}
        {pose === "point" && (
          <g>
            <ellipse cx="60" cy="200" rx="16" ry="14" fill={`url(#${hoodieId})`} />
            <ellipse cx="190" cy="200" rx="16" ry="14" fill={`url(#${hoodieId})`} />
            <ellipse cx="206" cy="196" rx="9" ry="7" fill={`url(#${furId})`} />
          </g>
        )}
        {pose === "books" && (
          <g>
            <rect x="86" y="208" width="68" height="22" rx="3" fill="oklch(0.78 0.12 350)" />
            <rect x="92" y="200" width="56" height="12" rx="3" fill="oklch(0.78 0.13 200)" />
          </g>
        )}
        {pose === "card" && (
          <g>
            <rect x="80" y="206" width="80" height="40" rx="8" fill="white" stroke="oklch(0.78 0.13 10)" strokeWidth="2" />
            <path d="M120,228 q-6,-7 -11,-2 q-3,3 0,7 q3,4 11,8 q8,-4 11,-8 q3,-4 0,-7 q-5,-5 -11,2 z" fill="oklch(0.78 0.14 10)" />
          </g>
        )}
        {pose === "breathe" && (
          <g>
            <circle cx="120" cy="218" r="22" fill="oklch(0.9 0.06 200 / 0.4)" />
            <circle cx="120" cy="218" r="14" fill="oklch(0.9 0.08 200 / 0.6)" />
          </g>
        )}
      </g>

      {/* sparkles */}
      <g opacity="0.7">
        <path d="M40,50 l3,7 l7,3 l-7,3 l-3,7 l-3,-7 l-7,-3 l7,-3 z" fill="oklch(0.85 0.1 350)" />
        <path d="M210,40 l2,5 l5,2 l-5,2 l-2,5 l-2,-5 l-5,-2 l5,-2 z" fill="oklch(0.85 0.1 50)" />
      </g>
    </svg>
  );
}

export function FoxScene({ variant = "study", className = "" }: { variant?: "study" | "login"; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`} style={{ background: "var(--gradient-warm)" }}>
      {/* shelf / window */}
      <svg viewBox="0 0 480 360" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="oklch(0.95 0.05 30)" />
            <stop offset="1" stopColor="oklch(0.92 0.07 350)" />
          </linearGradient>
        </defs>
        <rect width="480" height="360" fill="url(#sky)" />
        {/* window */}
        <rect x="40" y="40" width="170" height="160" rx="14" fill="oklch(0.95 0.04 220)" stroke="oklch(0.78 0.06 30)" strokeWidth="4" />
        <line x1="125" y1="40" x2="125" y2="200" stroke="oklch(0.78 0.06 30)" strokeWidth="3" />
        <line x1="40" y1="120" x2="210" y2="120" stroke="oklch(0.78 0.06 30)" strokeWidth="3" />
        {/* plants */}
        <ellipse cx="260" cy="240" rx="40" ry="14" fill="oklch(0.85 0.04 60)" />
        <path d="M250,240 q-6,-40 0,-60 q6,20 0,60 z" fill="oklch(0.6 0.12 150)" />
        <path d="M270,240 q-10,-30 -2,-50 q10,20 2,50 z" fill="oklch(0.55 0.13 145)" />
        {/* fairy lights */}
        <path d="M0,30 Q120,70 240,30 Q360,70 480,30" stroke="oklch(0.85 0.06 60)" strokeWidth="1.5" fill="none" />
        {[20,80,140,200,260,320,380,440].map((x,i)=>(
          <circle key={i} cx={x} cy={36 + (i%2?8:0)} r="3" fill="oklch(0.92 0.12 80)" />
        ))}
        {/* note */}
        <g transform="translate(360,60) rotate(-6)">
          <rect width="90" height="80" rx="6" fill="oklch(0.95 0.05 80)" stroke="oklch(0.78 0.06 30)" />
          <text x="45" y="36" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fill="oklch(0.45 0.1 15)">Small steps</text>
          <text x="45" y="52" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fill="oklch(0.45 0.1 15)">every day lead</text>
          <text x="45" y="68" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fill="oklch(0.45 0.1 15)">to big changes ✿</text>
        </g>
        {/* desk */}
        <rect x="0" y="290" width="480" height="70" fill="oklch(0.82 0.06 50)" />
        <rect x="0" y="290" width="480" height="6" fill="oklch(0.75 0.08 40)" />
        {/* books */}
        <rect x="50" y="260" width="70" height="30" rx="3" fill="oklch(0.78 0.13 200)" />
        <rect x="60" y="240" width="50" height="22" rx="3" fill="oklch(0.78 0.12 350)" />
      </svg>
      <div className="absolute bottom-0 right-4">
        <Fox pose={variant === "login" ? "wave" : "study"} size={260} />
      </div>
    </div>
  );
}
