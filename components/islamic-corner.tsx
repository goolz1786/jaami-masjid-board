type IslamicCornerProps = {
  className?: string;
};

export function IslamicCorner({ className = '' }: IslamicCornerProps) {
  return (
    <svg
      className={`islamic-corner-art ${className}`.trim()}
      viewBox="0 0 360 260"
      preserveAspectRatio="xMaxYMin meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="corner-metallic-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f6917" />
          <stop offset="0.24" stopColor="#f5d873" />
          <stop offset="0.5" stopColor="#c99c28" />
          <stop offset="0.76" stopColor="#fff0a6" />
          <stop offset="1" stopColor="#9a7019" />
        </linearGradient>
        <pattern
          id="corner-lattice"
          width="92"
          height="92"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M46 2 57 25 82 10 68 35 90 46 68 57 82 82 57 67 46 90 35 67 10 82 24 57 2 46 24 35 10 10 35 25Z"
            fill="none"
            stroke="#e7c55d"
            strokeWidth="5.5"
            strokeLinejoin="miter"
          />
          <path
            d="M28 28 46 20 64 28 72 46 64 64 46 72 28 64 20 46ZM46 2V20M90 46H72M46 90V72M2 46H20"
            fill="none"
            stroke="#f4d875"
            strokeWidth="3.5"
          />
        </pattern>
        <clipPath id="corner-sweep">
          <path d="M360 0H80c9 34 26 58 54 72-19 31-19 62 0 93 24 39 44 67 58 95h168Z" />
        </clipPath>
        <filter id="corner-shadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="-5" dy="6" stdDeviation="6" floodColor="#000" floodOpacity=".38" />
        </filter>
      </defs>

      <path
        d="M360 0H80c9 34 26 58 54 72-19 31-19 62 0 93 24 39 44 67 58 95h168Z"
        fill="#101112"
        filter="url(#corner-shadow)"
      />
      <rect
        width="360"
        height="260"
        fill="url(#corner-lattice)"
        clipPath="url(#corner-sweep)"
      />
      <path
        d="M80 0c9 34 26 58 54 72-19 31-19 62 0 93 24 39 44 67 58 95"
        fill="none"
        stroke="#2b1d05"
        strokeWidth="18"
        strokeLinecap="square"
      />
      <path
        d="M80 0c9 34 26 58 54 72-19 31-19 62 0 93 24 39 44 67 58 95"
        fill="none"
        stroke="url(#corner-metallic-gold)"
        strokeWidth="12"
        strokeLinecap="square"
      />
      <path
        d="M86 0c9 32 25 54 51 68-18 33-17 62 2 92 23 37 42 65 56 100"
        fill="none"
        stroke="#fff0a6"
        strokeWidth="2"
        opacity=".82"
      />
    </svg>
  );
}
