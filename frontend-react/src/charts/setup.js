// Chart.js setup shared by every chart.
//
// Registering everything here keeps each chart file down to its own data.

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

// Shared chart palette, kept in step with App.css.
export const palette = {
  dark: '#1d1d1f',
  yellow: '#ffcc00',
  blue: '#0071e3',
  blueLight: '#f5f5f7',
  // Apple system colors, darkened where necessary to stay readable on #f5f5f7.
  teal: '#0066cc',
  spam: '#d70015',
  ham: '#1f7a37',
  warn: '#c93400',
  muted: '#636366',
  track: 'rgba(118, 118, 128, 0.2)',
  grid: 'rgba(60, 60, 67, 0.12)',
}

/** Shared options: no animation lag, readable fonts, light gridlines. */
export const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: 4 },
  animation: { duration: 350 },
  plugins: {
    legend: {
      labels: { font: { family: 'system-ui', size: 13 }, color: palette.dark },
    },
    tooltip: {
      backgroundColor: palette.dark,
      titleFont: { family: 'system-ui', size: 13 },
      bodyFont: { family: 'system-ui', size: 13 },
      padding: 10,
      cornerRadius: 10,
      displayColors: true,
      boxPadding: 4,
    },
  },
}

/** Semantic ring colours keyed by the app's verdicts so one colour means one thing. */
export const ringColors = {
  spam: palette.spam,
  ham: palette.ham,
  malware: palette.dark,
  benign: palette.warn,
}

/** Axis styling shared by the bar and line charts. */
export const axisOptions = {
  grid: { color: palette.grid },
  ticks: { color: palette.muted, font: { family: 'system-ui', size: 12 } },
}
