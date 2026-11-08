import type { SVGProps } from "react";

/**
 * Векторный логотип «Рядом»:
 * - оранжевая закруглённая плашка с буквой «Р»;
 * - текст «ЯДОМ» справа от плашки (вместе читается как «РЯДОМ»).
 */
export function AppLogo({ className = "w-64 h-auto", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 430 146"
      className={className}
      aria-label="Рядом"
      role="img"
      {...props}
    >
      <defs>
        <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="5" floodColor="#263445" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Оранжевая плашка со скруглением */}
      <rect x="8" y="8" width="130" height="130" rx="32" ry="32" fill="#FFA000" filter="url(#logo-shadow)" />

      {/* Буква «Р» внутри плашки */}
      <path
        d="M 50 32 L 86 32 C 102 32 112 41 112 57 C 112 73 102 82 86 82 L 70 82 L 70 114 L 50 114 Z M 70 48 L 70 66 L 85 66 C 92 66 96 63 96 57 C 96 51 92 48 85 48 Z"
        fill="#111827"
      />

      {/* Текст «ЯДОМ» по центру плашки по вертикали */}
      <text
        x="152"
        y="103"
        fontFamily="system-ui, -apple-system, 'SF Pro Display', Roboto, 'Segoe UI', sans-serif"
        fontWeight="900"
        fontSize="82"
        textLength="262"
        lengthAdjust="spacingAndGlyphs"
        fill="#263445"
      >
        ЯДОМ
      </text>
    </svg>
  );
}
