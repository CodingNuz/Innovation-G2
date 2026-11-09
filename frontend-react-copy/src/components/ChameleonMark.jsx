// The brand mark: a chameleon's turret eye in the accent colour. Works on light and dark.
// Solid fills only, so every instance is self-contained (a gradient defined in a hidden
// copy of the SVG, such as the desktop sidebar on a phone, would not render).

export default function ChameleonMark({ size = 36 }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#0a84ff" />
      <rect x="2" y="2" width="44" height="22" rx="12" fill="#ffffff" fillOpacity="0.14" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#fff" strokeWidth="2.600" />
      <circle cx="24" cy="24" r="7.500" fill="#0b0b0f" />
      <rect x="19.500" y="22.600" width="9" height="2.800" rx="1.400" fill="#64b5ff" />
      <circle cx="28.500" cy="19.200" r="2" fill="#fff" />
    </svg>
  )
}

