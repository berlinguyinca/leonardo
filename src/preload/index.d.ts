import type { LeonardoAPI } from './index'

declare global {
  interface Window {
    leonardo: LeonardoAPI
  }
}
