import { useRef, useCallback, useState, useEffect } from 'react'
import { useRecordingStore } from '../../stores/recording-store'
import { RecordingControls } from './RecordingControls'

export function RecordingBrowser(): React.ReactNode {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const [urlInput, setUrlInput] = useState('https://example.com')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [webviewPreloadPath, setWebviewPreloadPath] = useState<string | null>(null)
  const [preloadError, setPreloadError] = useState<string | null>(null)
  const setCurrentUrl = useRecordingStore((s) => s.setCurrentUrl)
  const targetResolution = useRecordingStore((s) => s.targetResolution)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.leonardo?.recording?.getWebviewPreloadPath) {
      window.leonardo.recording.getWebviewPreloadPath()
        .then(setWebviewPreloadPath)
        .catch(() => setPreloadError('Unable to load browser preload script'))
    }
  }, [])

  const navigateTo = useCallback(
    (url: string) => {
      const webview = webviewRef.current
      if (!webview) return
      let normalized = url.trim()
      if (!normalized.match(/^https?:\/\//)) {
        normalized = 'https://' + normalized
      }
      webview.loadURL(normalized)
      setUrlInput(normalized)
    },
    [],
  )

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      navigateTo(urlInput)
    },
    [urlInput, navigateTo],
  )

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const onNavigate = () => {
      const url = webview.getURL()
      setUrlInput(url)
      setCurrentUrl(url)
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
    }

    const onStartLoading = () => setIsLoading(true)
    const onStopLoading = () => {
      setIsLoading(false)
      onNavigate()
    }

    const onIpcMessage = (e: Event): void => {
      const ipcEvent = e as Electron.IpcMessageEvent
      if (ipcEvent.channel === 'dom-event') {
        window.leonardo.recording.relayDomEvent(ipcEvent.args[0])
      }
    }

    webview.addEventListener('did-navigate', onNavigate)
    webview.addEventListener('did-navigate-in-page', onNavigate)
    webview.addEventListener('did-start-loading', onStartLoading)
    webview.addEventListener('did-stop-loading', onStopLoading)
    webview.addEventListener('ipc-message', onIpcMessage)

    return () => {
      webview.removeEventListener('did-navigate', onNavigate)
      webview.removeEventListener('did-navigate-in-page', onNavigate)
      webview.removeEventListener('did-start-loading', onStartLoading)
      webview.removeEventListener('did-stop-loading', onStopLoading)
      webview.removeEventListener('ipc-message', onIpcMessage)
    }
  }, [setCurrentUrl, webviewPreloadPath])

  return (
    <div className="recording-browser">
      {/* Navigation Bar */}
      <div className="browser-nav">
        <button
          className="nav-btn"
          disabled={!canGoBack}
          onClick={() => webviewRef.current?.goBack()}
          title="Back"
        >
          &#x25C0;
        </button>
        <button
          className="nav-btn"
          disabled={!canGoForward}
          onClick={() => webviewRef.current?.goForward()}
          title="Forward"
        >
          &#x25B6;
        </button>
        <button
          className="nav-btn"
          onClick={() =>
            isLoading ? webviewRef.current?.stop() : webviewRef.current?.reload()
          }
          title={isLoading ? 'Stop' : 'Reload'}
        >
          {isLoading ? '\u2715' : '\u21BB'}
        </button>

        <form className="url-bar" onSubmit={handleUrlSubmit}>
          <input
            type="text"
            className="url-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter URL..."
          />
        </form>
      </div>

      {/* Webview Container */}
      <div
        className="webview-container"
        style={{
          width: targetResolution.width,
          height: targetResolution.height,
          maxWidth: '100%',
          maxHeight: 'calc(100% - 80px)',
          overflow: 'hidden',
        }}
      >
        {webviewPreloadPath ? (
          <webview
            ref={webviewRef as React.Ref<Electron.WebviewTag>}
            src="https://example.com"
            className="recording-webview"
            style={{ width: '100%', height: '100%' }}
            /* @ts-expect-error webview attributes are not fully typed */
            allowpopups="false"
            preload={webviewPreloadPath}
          />
        ) : (
          <div className="browser-loading">
            {preloadError ?? 'Loading browser...'}
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <RecordingControls webviewRef={webviewRef} />
    </div>
  )
}
