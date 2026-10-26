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
      headers: { 'Content-Type': 'application/json' },
      ...options,
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

/** POST a file as multipart form data (the browser sets the boundary header). */
export function apiUpload(path, file) {
  const form = new FormData()
  form.append('file', file)
  return request(path, { method: 'POST', body: form, headers: {} })
}

// The endpoints the app uses, one function each.
export const api = {
  health: () => apiGet('/api/health'),
  model: () => apiGet('/api/model'),
  spam: (text) => apiPost('/api/spam', { text }),
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
}
