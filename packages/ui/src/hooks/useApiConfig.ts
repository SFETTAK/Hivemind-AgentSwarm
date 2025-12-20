// API configuration hook
// Provides API URL configuration to components

import { createContext, useContext } from 'react'

export interface ApiConfig {
  baseUrl: string
  apiUrl: string
}

export const ApiConfigContext = createContext<ApiConfig>({
  baseUrl: 'http://localhost:3001',
  apiUrl: 'http://localhost:3001/api'
})

export function useApiConfig(): ApiConfig {
  return useContext(ApiConfigContext)
}

export function createApiConfig(host: string = 'localhost', port: number = 3001): ApiConfig {
  const baseUrl = `http://${host}:${port}`
  return {
    baseUrl,
    apiUrl: `${baseUrl}/api`
  }
}

