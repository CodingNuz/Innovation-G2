// Semicircular gauge for one probability (a half doughnut, number drawn over the arc).

import { Doughnut } from 'react-chartjs-2'
import { baseOptions, palette } from '../charts/setup'

export default function GaugeChart({
  value,
  caption,
  color = palette.spam,
  label = 'Probability',
}) {
  const percent = Math.max(0, Math.min(100, (value ?? 0) * 100))
  const filled = percent > 0 ? percent : 0.001 // keep the arc visible at zero

  const data = {
    labels: [label, 'remaining'],
    datasets: [
      {
        data: [filled, 100 - filled],
        backgroundColor: [color, 'rgba(39, 35, 67, 0.08)'],
        borderWidth: 0,
        borderRadius: 12,
        circumference: 180,
        rotation: -90,
        cutout: '72%',
      },
    ],
  }

  const options = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (item) => `${item.label}: ${percent.toFixed(1)}%`,
        },
      },
    },
  }

  return (
    <div className="gauge">
      <div className="gauge-chart">
        <Doughnut data={data} options={options} />
        <div className="gauge-readout">
          <span className="gauge-value" style={{ color }}>
            {percent.toFixed(1)}%
          </span>
          {caption ? <span className="gauge-caption">{caption}</span> : null}
        </div>
      </div>
    </div>
  )
}
