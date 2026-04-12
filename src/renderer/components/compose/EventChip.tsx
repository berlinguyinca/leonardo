import { useDraggable } from '@dnd-kit/core'

interface EventChipProps {
  eventId: string
  eventType: string
  label: string
  onRemove?: () => void
}

export function EventChip({ eventId, eventType, label, onRemove }: EventChipProps): React.ReactNode {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-chip-${eventId}`,
    data: { type: 'event-chip', eventId },
  })

  return (
    <span
      ref={setNodeRef}
      className="event-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        background: '#333',
        border: '1px solid #444',
        color: '#d0d0d0',
        fontSize: 11,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        whiteSpace: 'nowrap',
        maxWidth: 140,
      }}
      {...listeners}
      {...attributes}
    >
      <span className="event-chip-type" style={{ color: '#4a9eff', fontWeight: 600 }}>
        {eventType}
      </span>
      <span
        className="event-chip-label"
        style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {label}
      </span>
      {onRemove && (
        <button
          className="event-chip-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 12,
            lineHeight: 1,
          }}
          aria-label="Remove event"
        >
          x
        </button>
      )}
    </span>
  )
}
