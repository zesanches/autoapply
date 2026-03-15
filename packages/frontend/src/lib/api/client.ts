import ky, { HTTPError } from 'ky'

export const api = ky.create({
  prefixUrl: `${import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001'}/api`,
  timeout: 30_000,
  credentials: 'include',
  retry: { limit: 2, statusCodes: [500, 502, 503, 504], methods: ['get'] },
  hooks: {
    afterResponse: [
      async (_req, _opts, res) => {
        if (res.status === 401) window.location.href = '/login'
      },
    ],
    beforeError: [
      (error) => {
        if (error instanceof HTTPError && error.response.status === 401) {
          window.location.href = '/login'
        }
        return error
      },
    ],
  },
})
