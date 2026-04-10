/// <reference types="vite/client" />

declare module '*.css' {
  const content: string
  export default content
}

import type { LeonardoAPI } from '../preload/index'

declare global {
  interface Window {
    leonardo: LeonardoAPI
  }
}
