// Calls the FastAPI backend.
//
// In development Vite proxies /api to the backend (see vite.config.js), so the
// browser only ever sees one origin and no CORS setup is needed.  The same
// relative paths work in production when the built files are served by the
// FastAPI app itself.

const BASE = import.meta.env.VITE_API_BASE ?? ''

/** An API call that failed, with a message worth showing to the user. */
export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Turn a failed response into an ApiError.
 *
 * The backend answers with {"detail": "..."} for its own errors and with a
 * list of validation errors for a malformed body, so both shapes are handled.
 */
async function toError(response) {
  let detail = null
  let message = `Request failed (HTTP ${response.status})`

  try {
    const body = await response.json()
    detail = body
    if (typeof body.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body.detail) && body.detail.length > 0) {
      // FastAPI's validation errors: point at the first broken field.
      const first = body.detail[0]
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null
      message = field ? `${field}: ${first.msg}` : first.msg
    } else if (body.detail) {
      message = String(body.detail)
    }
  } catch {
    // A response without a JSON body (a proxy error, a crash) keeps the
    // generic message, which still says which status came back.
  }

  return new ApiError(message, response.status, detail)
}

/** Fetch JSON from the API, with the same error handling everywhere. */
async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(options.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
    })
  } catch (error) {
    // fetch only rejects when the request never reached the server.
    throw new ApiError(
      'Cannot reach the backend. Is it running on port 3000?',
      0,
      error,
    )
  }

  if (!response.ok) throw await toError(response)
  return response.json()
}

/** GET a path from the API. */
export function apiGet(path) {
  return request(path, { method: 'GET' })
}

/** POST a JSON body to the API. */
export function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}


/** POST a PDF file to the API. */
export async function apiUpload(path, file) {
  const formData = new FormData()
  formData.append('file', file)

  return request(path, {
    method: 'POST',
    headers: {},
    body: formData,
  })
}

/**
 * POST a body and read the reply as server-sent events.
 *
 * The chat route answers with one `event: name` / `data: json` block per
 * step, because a tool round on the local model takes long enough that a
 * silent spinner looks broken.  `onEvent(name, payload)` is called for each
 * block as it arrives, and the promise resolves with the final `done` payload.
 */
export async function apiStream(path, body, onEvent) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new ApiError(
      'Cannot reach the backend. Is it running on port 3000?',
      0,
      error,
    )
  }

  if (!response.ok) throw await toError(response)
  if (!response.body) throw new ApiError('This browser cannot stream replies', 0, null)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Events are separated by a blank line; the last piece may be partial.
    let split
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      const event = parseEvent(block)
      if (!event) continue
      if (event.name === 'error') {
        throw new ApiError(event.data.detail ?? 'The model failed', 0, event.data)
      }
      if (event.name === 'done') result = event.data
      onEvent?.(event.name, event.data)
    }
  }

  if (!result) throw new ApiError('The reply ended before it was complete', 0, null)
  return result
}

/** One `event:`/`data:` block from the stream, or null for a comment. */
function parseEvent(block) {
  let name = 'message'
  const data = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trim())
  }
  if (data.length === 0) return null
  try {
    return { name, data: JSON.parse(data.join('\n')) }
  } catch {
    return { name, data: { detail: data.join('\n') } }
  }
}

// The endpoints the app uses, one function each.
export const api = {
  health: () => apiGet('/api/health'),
  model: () => apiGet('/api/model'),
  spam: (text) => apiPost('/api/spam', { text }),
  spamUpload: (file) => apiUpload('/api/spam/upload', file),
  malwarePlatforms: () => apiGet('/api/malware/platforms'),
  malwareFeatures: (platform) =>
    apiGet(`/api/malware/features?platform=${encodeURIComponent(platform)}`),
  malwareSchema: (platform) =>
    apiGet(`/api/malware/schema?platform=${encodeURIComponent(platform)}`),
  malware: (platform, features) =>
    apiPost('/api/malware', { platform, features }),
  malwareUpload: (file) => apiUpload('/api/malware/upload', file),
  processFeatures: () => apiGet('/api/process/features'),
  processSchema: () => apiGet('/api/process/schema'),
  process: (features) => apiPost('/api/process', { features }),
  agentInfo: () => apiGet('/api/agent/info'),
  chat: (prompt, history, onEvent, attachment) =>
    apiStream(
      '/api/chat/stream',
      { prompt, history, ...(attachment ? { attachment } : {}) },
      onEvent,
    ),
}
