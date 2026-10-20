// Chart.js setup, shared by every chart in the app.
//
// Registering the pieces here keeps each chart file down to its own data.

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
  // The radar chart in the malware view needs the radial scale. Without it
  // Chart.js throws "radialLinear is not a registered scale" and the whole
  // app goes blank.
  RadialLinearScale,
  Title,
  Tooltip,
)

// The palette, taken from the original SpamChameleon stylesheet so the React
// version and the static page look like the same product.
export const palette = {
  dark: '#272343',
  yellow: '#ffd803',
  blue: '#bae8e8',
  blueLight: '#e3f6f5',
  spam: '#d40202',
  ham: '#3dd402',
  muted: '#8b88a8',
}

/** Shared options: no animation lag, readable fonts, gridlines kept light. */
export const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 350 },
  plugins: {
    legend: {
      labels: { font: { family: 'Noto Sans', size: 13 }, color: palette.dark },
    },
    tooltip: {
      backgroundColor: palette.dark,
      titleFont: { family: 'Noto Sans', size: 13 },
      bodyFont: { family: 'Noto Sans', size: 13 },
      padding: 10,
      cornerRadius: 10,
    },
  },
}

/** Axis styling shared by the bar and line charts. */
export const axisOptions = {
  grid: { color: 'rgba(39, 35, 67, 0.08)' },
  ticks: { color: palette.dark, font: { family: 'Noto Sans', size: 12 } },
}
