// One inline-SVG icon set (outline, round caps). Replaces the Font Awesome CDN:
// no network request, no flash of missing glyphs, and colour follows currentColor.

const PATHS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  bug: (
    <>
      <path d="M8 2l1.9 1.9M14.1 3.9L16 2M9 7.1v-1a3 3 0 0 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9" />
      <path d="M6.5 9C4.6 8.800 3 7.100 3 5M6 13H2M3 21c0-2.100 1.700-3.900 3.800-4M21 5c0 2.100-1.600 3.800-3.500 4M22 13h-4M17.200 17c2.100.1 3.800 1.900 3.800 4" />
    </>
  ),
  chip: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.700L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.500l3 3 5-6" />
    </>
  ),
  alert: (
    <path d="M10.300 3.900L1.800 18a2 2 0 0 0 1.700 3h17a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0zM12 9v4M12 17h.01" />
  ),
  flag: <path d="M4 22V4M4 4h13l-2 4 2 4H4" />,
  gauge: <path d="M12 14l4-4M3.300 19a10 10 0 1 1 17.400 0" />,
  paperclip: (
    <path d="M21.400 11.100l-9.200 9.200a6 6 0 0 1-8.500-8.500l9.200-9.200a4 4 0 0 1 5.700 5.700l-9.200 9.200a2 2 0 0 1-2.800-2.800l8.500-8.500" />
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  bot: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <path d="M12 8V4M8 14h.01M16 14h.01M10 17h4" />
      <circle cx="12" cy="3.500" r="1" />
    </>
  ),
  terminal: <path d="M4 17l6-6-6-6M12 19h8" />,
  arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  arrowUpRight: <path d="M7 17L17 7M8 7h9v9" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  upload: <path d="M12 15V3M7 8l5-5 5 5M4 21h16" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6" />,
  layers: <path d="M12 2l10 5-10 5L2 7l10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  filter: <path d="M3 4h18l-7 9v6l-4 2v-8L3 4z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.300-4.300" />
    </>
  ),
  file: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
}

export default function Icon({ name, size = 20, className = '', title }) {
  const body = PATHS[name]
  if (!body) return null
  return (
    <svg
      className={className ? 'icon ' + className : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {body}
    </svg>
  )
}

