// A number input for one model feature.
//
// The range the model was trained on is shown as a hint, and an entry outside
// it is flagged. The input is deliberately not restricted with the native
// min and max attributes: those block the form submit, and the training
// range is narrow (a process counter like utime only ever appears between
// 371782 and 421913 in the training data), so almost every real value would
// be refused and the form would silently do nothing.

/** Format a number for a placeholder without dragging in a formatting library. */
function formatNumber(value) {
  if (value === null || value === undefined) return 'n/a'
  if (Number.isInteger(value)) return value.toLocaleString()
  return value.toFixed(2)
}

/** Format the bounds of the training range, skipping the ones that are missing. */
function formatRange(info) {
  const low = info.min
  const high = info.max
  if (low === null || low === undefined) return null
  if (high === null || high === undefined) return `from ${formatNumber(low)}`
  if (low === high) return formatNumber(low)
  return `${formatNumber(low)} to ${formatNumber(high)}`
}

export default function NumberField({
  id,
  name,
  value,
  onChange,
  info,
  placeholder,
}) {
  const range = formatRange(info)
  const number = Number(value)
  const outOfRange =
    value !== '' &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(number) &&
    ((info.min !== null && info.min !== undefined && number < info.min) ||
      (info.max !== null && info.max !== undefined && number > info.max))

  const title = range ? `${name} - training range ${range}` : name

  return (
    <div className="numfield">
      <label htmlFor={id} title={title}>
        {name}
      </label>
      <input
        id={id}
        type="number"
        className={`textinput${outOfRange ? ' is-outofrange' : ''}`}
        value={value ?? ''}
        placeholder={placeholder ?? `median ${formatNumber(info.median)}`}
        onChange={(event) => onChange(event.target.value)}
      />
      {outOfRange ? (
        <span className="rangehint is-out" title={title}>
          outside the training range {range}
        </span>
      ) : null}
    </div>
  )
}
