// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { EventChip } from '../../src/renderer/components/compose/EventChip'

function renderChip(props?: Partial<Parameters<typeof EventChip>[0]>) {
  const defaultProps = {
    eventId: 'evt-1',
    eventType: 'click',
    label: 'Submit button',
    ...props,
  }
  return render(
    <DndContext>
      <EventChip {...defaultProps} />
    </DndContext>,
  )
}

describe('EventChip', () => {
  it('renders event type and label', () => {
    renderChip({ eventType: 'submit', label: 'Login form' })
    expect(screen.getByText('submit')).toBeTruthy()
    expect(screen.getByText('Login form')).toBeTruthy()
  })

  it('shows remove button when onRemove provided', () => {
    const onRemove = vi.fn()
    renderChip({ onRemove })
    expect(screen.getByRole('button', { name: 'Remove event' })).toBeTruthy()
  })

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn()
    renderChip({ onRemove })
    fireEvent.click(screen.getByRole('button', { name: 'Remove event' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('does not show remove button when no onRemove', () => {
    renderChip({ onRemove: undefined })
    expect(screen.queryByRole('button', { name: 'Remove event' })).toBeNull()
  })
})
