// Main dashboard config - API on port 3001
export const API_PORT = 3001
export const API_HOST = '192.168.1.133'  // Linux server IP (use 'localhost' if running locally)

export function getApiBase() {
  return `http://${API_HOST}:${API_PORT}`
}

export function getApiUrl() {
  return `${getApiBase()}/api`
}

