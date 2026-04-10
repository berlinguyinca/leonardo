import mitt from 'mitt'

type PlayheadEvents = {
  position: number
}

export const playheadEmitter = mitt<PlayheadEvents>()
