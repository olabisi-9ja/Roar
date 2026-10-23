const PATHS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  live: (<><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></>),
  cam: (<><path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13.5" r="3.5" /></>),
  play: (<><path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5v1.2a3 3 0 0 1-5.3 1.9L15 14H9l-1.7 1.6A3 3 0 0 1 2 13.7v-1.2A4.5 4.5 0 0 1 6.5 8z" /><path d="M7.5 10v4M5.5 12h4" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  heart: <path d="M12 21s-7.5-4.6-9.6-9.2A5.4 5.4 0 0 1 12 6.3a5.4 5.4 0 0 1 9.6 5.5C19.5 16.4 12 21 12 21z" />,
  share: <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />,
  back: <path d="M15 18l-6-6 6-6" />,
  chev: <path d="M9 6l6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  pin: (<><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  glasses: (<><circle cx="6.5" cy="14" r="3.5" /><circle cx="17.5" cy="14" r="3.5" /><path d="M10 14h4M3 13l2.2-6M21 13l-2.2-6" /></>),
  ext: (<><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10.5l6-3.5v10l-6-3.5z" /></>),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  timer: (<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  sound: (<><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>),
  mute: (<><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9.5l5 5M22 9.5l-5 5" /></>),
};

const FILLED: Record<string, React.ReactNode> = {
  crown: <path d="M3 7l5 4 4-6 4 6 5-4-2 11H5z" />,
  go: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />,
  ai: (<><path d="M12 2l2.1 6.1L20 10l-5.9 1.9L12 18l-2.1-6.1L4 10l5.9-1.9z" /><path d="M19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6z" /></>),
};

export type IconName = keyof typeof PATHS | keyof typeof FILLED;

export function Icon({ name, size = "", style }: { name: IconName; size?: "" | "s" | "l"; style?: React.CSSProperties }) {
  const filled = name in FILLED;
  return (
    <svg
      className={`i ${size}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {filled ? FILLED[name] : PATHS[name]}
    </svg>
  );
}
