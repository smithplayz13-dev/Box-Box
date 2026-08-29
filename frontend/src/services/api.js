import axios from 'axios'

const defaultHeaders = {
  "X-API-Key": import.meta.env.VITE_API_KEY || "fallback_dev_key",
  "Content-Type": "application/json"
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 120000,
  headers: defaultHeaders
})

let activeRequests = 0;
let timeoutTimer = null;

const startSlowRequestNotice = () => {
  activeRequests++;
  if (typeof window !== 'undefined' && activeRequests === 1) {
    timeoutTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('slow-api', { detail: true }));
    }, 5000);
  }
};

const stopSlowRequestNotice = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  if (typeof window !== 'undefined' && activeRequests === 0) {
    clearTimeout(timeoutTimer);
    window.dispatchEvent(new CustomEvent('slow-api', { detail: false }));
  }
};

const toApiError = (err) => {
  const status = err.response?.status;
  const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
  let message = err.response?.data?.detail || "SERVER_ERROR"

  if (isTimeout) message = "REQUEST_TIMEOUT"
  else if (status === 429) message = "RATE_LIMIT"
  else if (status === 403) message = "AUTH_ERROR"
  else if (status === 404) message = "NO_DATA"

  const apiError = new Error(message)
  apiError.response = err.response
  apiError.code = err.code
  apiError.originalError = err
  return apiError
}

const attachInterceptors = (client) => {
  client.interceptors.request.use(config => {
    startSlowRequestNotice();
    return config;
  });

  client.interceptors.response.use(
    res => {
      stopSlowRequestNotice();
      return res;
    },
    err => {
      stopSlowRequestNotice();
      throw toApiError(err)
    }
  )
}

attachInterceptors(api)

export const slowApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 120000,
  headers: defaultHeaders
})

attachInterceptors(slowApi)

export const getAvailableRaces = (year) => 
  api.get(`/api/races?year=${year}`)

export const getDrivers = (year) =>
  api.get(`/api/drivers?year=${year}`)

export const getLapTimes = (year, race, session) =>
  api.get(`/api/lap-times?year=${year}&race=${race}&session=${session}`)

export const getTireStrategy = (year, race) =>
  api.get(`/api/tire-strategy?year=${year}&race=${race}`)

export const getRivalryStats = (year, d1, d2) =>
  slowApi.get(`/api/rivalry?year=${year}&driver1=${d1}&driver2=${d2}`)

export const getTelemetry = (year, race, driver, lap) =>
  slowApi.get(`/api/telemetry?year=${year}&race=${race}&driver=${driver}&lap=${lap}`)

export const getFantasyPicks = (race, year) =>
  slowApi.post('/api/fantasy-picks', { race, year })

export const getDriverStandings = (year) =>
  api.get(`/api/standings/drivers?year=${year}`)

export const getConstructorStandings = (year) =>
  api.get(`/api/standings/constructors?year=${year}`)

export const getPitWallAlert = (circuit) =>
  api.get(`/api/pitwall-alert?circuit=${encodeURIComponent(circuit)}`)

export const getCurrentForm = () =>
  api.get(`/api/current-form`)

export const fetchCareerStats = async (driverId) => {
  const response = await api.get(`/api/career?driver=${driverId}`, { timeout: 120000 })
  return response.data
}

export const fetchCareerComparison = async (driver1Id, driver2Id) => {
  const response = await slowApi.post('/api/career-compare', {
    driver1_id: driver1Id,
    driver2_id: driver2Id
  })
  return response.data
}

export const getLiveSessions = (year) => api.get(`/api/live/sessions?year=${year}`)
export const getLiveDiscover = (year) => api.get(`/api/live/discover${year ? `?year=${year}` : ''}`)
export const getLiveTiming = (sessionKey) => api.get(`/api/live/timing?session_key=${sessionKey}`)
export const getLiveTimingByMeta = (year, meetingName, sessionType) => api.get(`/api/live/timing?year=${year}&meeting_name=${encodeURIComponent(meetingName)}&session_type=${encodeURIComponent(sessionType)}`)
