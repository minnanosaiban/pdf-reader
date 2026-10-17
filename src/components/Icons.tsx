import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ViewIcon = () => (
  <Svg>
    <path d="M5 3l14 8-6 1.5L10 19z" />
  </Svg>
);

export const MarkerIcon = ({ color }: { color: string }) => (
  <Svg>
    <path d="M14 4l6 6-8 8H6v-6z" />
    <rect x="3" y="20" width="18" height="2.5" rx="1" fill={color} stroke="none" />
  </Svg>
);

export const LineIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M4 18c4-1 6-9 9-9s3 7 7 5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const TextIcon = () => (
  <Svg>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </Svg>
);

export const DisplayIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 5v14" />
  </Svg>
);

export const SettingsIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </Svg>
);
