// Chart.js setup shared by every chart.
//
// Registering everything here keeps each chart file down to its own data. Colours are
// read from the CSS tokens (styles/tokens.css) when a chart is built, so the charts follow
// the system light/dark appearance and the palette has one source of truth.

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js'

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  // The malware radar chart needs the radial scale. Without it Chart.js throws
  // "radialLinear is not a registered scale" and the whole app goes blank.
  RadialLinearScale,
  Title,
  Tooltip,
)

const token = (name, fallback) => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

// Getters, so a value read while building a chart reflects the current appearance.
export const palette = {
  get ink() {
    return token('--label', '#1d1d1f')
  },
  get mute() {
    return token('--label-2', '#6e6e73')
  },
  get accent() {
    return token('--accent', '#0071e3')
  },
  get threat() {
    return token('--threat', '#ff3b30')
  },
  get safe() {
    return token('--safe', '#34c759')
  },
  get warn() {
    return token('--warn', '#ff9500')
  },
  get card() {
    return token('--surface', '#ffffff')
  },
  get track() {
    return token('--fill', 'rgba(120, 120, 128, 0.12)')
  },
  get grid() {
    return token('--chart-grid', 'rgba(60, 60, 67, 0.07)')
  },
}

export const FONT = token('--font', 'system-ui, sans-serif')

/** Point Chart.js defaults at the current appearance. Call again when the system appearance changes. */
export function refreshChartTheme() {
  ChartJS.defaults.font.family = FONT
  ChartJS.defaults.color = palette.mute
  ChartJS.defaults.borderColor = palette.grid
}
refreshChartTheme()

/** Shared options: short animation, readable fonts. Colours come from the Chart.js defaults. */
export const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: {
      labels: { font: { family: FONT, size: 13 }, boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true, padding: 14 },
    },
    tooltip: {
      backgroundColor: 'rgba(28, 28, 30, 0.92)',
      titleFont: { family: FONT, size: 13, weight: '600' },
      bodyFont: { family: FONT, size: 13 },
      padding: 10,
      cornerRadius: 10,
    },
  },
}

/** Axis styling shared by the bar and line charts. */
export const axisOptions = {
  border: { display: false },
  ticks: { font: { family: FONT, size: 12 } },
}

