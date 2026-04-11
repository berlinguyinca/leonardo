import { useState, useEffect } from 'react'

const THUMB_WIDTH_PX = 60

interface ThumbnailStripProps {
  clipId: string
  widthPx: number
}

export function ThumbnailStrip({ clipId, widthPx }: ThumbnailStripProps): React.ReactNode {
  const count = Math.max(1, Math.ceil(widthPx / THUMB_WIDTH_PX))
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    if (!window.leonardo?.clip?.getThumbnails) return
    window.leonardo.clip.getThumbnails(clipId, count).then(setUrls)
  }, [clipId, count])

  if (urls.length === 0) return null

  return (
    <div className="thumbnail-strip" aria-hidden>
      {urls.map((url, i) => (
        <img key={i} src={url} className="thumbnail-frame" draggable={false} />
      ))}
    </div>
  )
}
