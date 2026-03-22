import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import PanelList from './PanelList'
import type { PanelEntry } from '@/lib/types'

const mockPanels: PanelEntry[] = [
  { id: '1', hp: 8, format: '3u', holeStyle: 'slot', quantity: 2 },
  { id: '2', hp: 4, format: '1u-intellijel', holeStyle: 'circle', quantity: 1 },
]

describe('PanelList', () => {
  const onUpdate = vi.fn()
  const onRemove = vi.fn()
  const onClear = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays all panels with HP, format, and quantity', () => {
    render(
      <PanelList
        panels={mockPanels}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    expect(screen.getByText('8HP')).toBeInTheDocument()
    expect(screen.getByText('3U')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()

    expect(screen.getByText('4HP')).toBeInTheDocument()
    expect(screen.getByText('1U Intellijel')).toBeInTheDocument()
    expect(screen.getByText('×1')).toBeInTheDocument()
  })

  it('increments quantity when + clicked', async () => {
    const user = userEvent.setup()
    render(
      <PanelList
        panels={mockPanels}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    const increaseBtn = screen.getByRole('button', {
      name: 'Increase quantity of 8HP 3U',
    })
    await user.click(increaseBtn)

    expect(onUpdate).toHaveBeenCalledWith('1', 3)
  })

  it('decrements quantity when - clicked', async () => {
    const user = userEvent.setup()
    render(
      <PanelList
        panels={mockPanels}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    const decreaseBtn = screen.getByRole('button', {
      name: 'Decrease quantity of 8HP 3U',
    })
    await user.click(decreaseBtn)

    expect(onUpdate).toHaveBeenCalledWith('1', 1)
  })

  it('does not decrement quantity below 1', async () => {
    const user = userEvent.setup()
    render(
      <PanelList
        panels={mockPanels}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    const decreaseBtn = screen.getByRole('button', {
      name: 'Decrease quantity of 4HP 1U Intellijel',
    })
    await user.click(decreaseBtn)

    expect(onUpdate).toHaveBeenCalledWith('2', 1)
  })

  it('calls onRemove when remove button clicked', async () => {
    const user = userEvent.setup()
    render(
      <PanelList
        panels={mockPanels}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    const removeBtn = screen.getByRole('button', {
      name: 'Remove 8HP 3U',
    })
    await user.click(removeBtn)

    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('calls onClear when clear all clicked', async () => {
    const user = userEvent.setup()
    render(
      <PanelList
        panels={mockPanels}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    const clearBtn = screen.getByRole('button', { name: 'Clear all panels' })
    await user.click(clearBtn)

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('hides clear all button when list is empty', () => {
    render(
      <PanelList
        panels={[]}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Clear all panels' })
    ).not.toBeInTheDocument()
  })
})
