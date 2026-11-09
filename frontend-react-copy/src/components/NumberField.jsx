// Number input for one model feature. The training range is a hint and an entry
// outside it is flagged; native min/max would block submit, since ranges are narrow.

/** Format a number for a placeholder without pulling in a formatting library. */
function formatNumber(value) {
  if (value === null || value === undefined) return 'n/a'
  if (Number.isInteger(value)) return value.toLocaleString()
  return value.toFixed(2)
}

/** Format the bounds of the training range, skipping missing ones. */
function formatRange(info) {
  const low = info.min
  const high = info.max
  if (low === null || low === undefined) return null
  if (high === null || high === undefined) return 'from ' + formatNumber(low)
  if (low === high) return formatNumber(low)
  return formatNumber(low) + ' to ' + formatNumber(high)
}

export default function NumberField({ id, name, value, onChange, info, placeholder }) {
  const range = formatRange(info)
  const number = Number(value)
  const outOfRange =
    value !== '' &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(number) &&
    ((info.min !== null && info.min !== undefined && number < info.min) ||
      (info.max !== null && info.max !== undefined && number > info.max))

  const title = range ? name + ' - training range ' + range : name
  const hintId = id + '-hint'

  return (
    <div className="numfield">
      <label htmlFor={id} title={title}>
        {name}
      </label>
      <input
        id={id}
        type="number"
        className={'textinput' + (outOfRange ? ' is-outofrange' : '')}
        value={value ?? ''}
        placeholder={placeholder ?? 'median ' + formatNumber(info.median)}
        aria-invalid={outOfRange ? 'true' : undefined}
        aria-describedby={outOfRange ? hintId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {outOfRange ? (
        <span className="rangehint" id={hintId} title={title}>
          Outside the training range {range}
        </span>
      ) : null}
    </div>
  )
}

