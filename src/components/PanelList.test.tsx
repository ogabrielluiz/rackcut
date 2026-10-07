import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import PanelList from './PanelList'
import type { PanelEntry } from '@/lib/types'

const mockPanels: PanelEntry[] = [
  { id: '1', hp: 8, format: '3u', holeStyle: 'slot', quantity: 2, pattern: 'none', patternSeed: 42 },
  { id: '2', hp: 4, format: '1u-intellijel', holeStyle: 'circle', quantity: 1, pattern: 'waveform', patternSeed: 99 },
]

describe('PanelList', () => {
  const onUpdatePanel = vi.fn()
  const onRandomizeSeed = vi.fn()
  const onDuplicate = vi.fn()
  const onRemove = vi.fn()
  const onClear = vi.fn()

  function renderList(panels = mockPanels) {
    return render(
      <PanelList
        panels={panels}
        onUpdatePanel={onUpdatePanel}
        onRandomizeSeed={onRandomizeSeed}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onClear={onClear}
      />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays all panels with quantity', () => {
    renderList()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('increments quantity when + clicked', async () => {
    const user = userEvent.setup()
    renderList()

    const increaseBtn = screen.getByRole('button', {
      name: 'Increase quantity of 8HP 3U',
    })
    await user.click(increaseBtn)

    expect(onUpdatePanel).toHaveBeenCalledWith('1', { quantity: 3 })
  })

  it('decrements quantity when - clicked', async () => {
    const user = userEvent.setup()
    renderList()

    const decreaseBtn = screen.getByRole('button', {
      name: 'Decrease quantity of 8HP 3U',
    })
    await user.click(decreaseBtn)

    expect(onUpdatePanel).toHaveBeenCalledWith('1', { quantity: 1 })
  })

  it('calls onRemove when remove button clicked', async () => {
    const user = userEvent.setup()
    renderList()

    const removeBtn = screen.getByRole('button', {
      name: 'Remove 8HP 3U',
    })
    await user.click(removeBtn)

    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('calls onClear when clear all clicked', async () => {
    const user = userEvent.setup()
    renderList()

    const clearBtn = screen.getByRole('button', { name: 'Clear all panels' })
    await user.click(clearBtn)

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('hides clear all button when list is empty', () => {
    renderList([])

    expect(
      screen.queryByRole('button', { name: 'Clear all panels' })
    ).not.toBeInTheDocument()
  })

  it('can change panel format', async () => {
    const user = userEvent.setup()
    renderList()

    const formatSelect = screen.getByLabelText('Format for 8HP 3U')
    await user.selectOptions(formatSelect, '1u-intellijel')

    expect(onUpdatePanel).toHaveBeenCalledWith('1', { format: '1u-intellijel' })
  })

  it('can change hole style', async () => {
    const user = userEvent.setup()
    renderList()

    const holeSelect = screen.getByLabelText('Hole style for 8HP 3U')
    await user.selectOptions(holeSelect, 'circle')

    expect(onUpdatePanel).toHaveBeenCalledWith('1', { holeStyle: 'circle' })
  })

  it('calls onDuplicate when duplicate button clicked', async () => {
    const user = userEvent.setup()
    renderList()

    const dupBtn = screen.getByRole('button', { name: 'Duplicate 8HP 3U' })
    await user.click(dupBtn)

    expect(onDuplicate).toHaveBeenCalledWith('1')
  })

  it('shows editable seed input', () => {
    renderList()
    const seedInputs = screen.getAllByLabelText(/^Seed for /i)
    expect(seedInputs).toHaveLength(2)
    expect(seedInputs[0]).toHaveValue(42)
    expect(seedInputs[1]).toHaveValue(99)
  })

  it('groups the pattern choices by kind', () => {
    renderList()
    const select = screen.getAllByLabelText(/^Pattern for /i)[0]
    expect(within(select).getAllByRole('group').map((g) => g.getAttribute('label'))).toEqual([
      'Line art',
      'Relief (3D print)',
      'Two-tone bands (3D print)',
    ])
    // None, 21 line patterns, 8 fields in each of two surface styles
    expect(within(select).getAllByRole('option')).toHaveLength(1 + 21 + 16)
    expect(within(select).getAllByRole('option')[0]).toHaveValue('none')
  })

  it('selects a surface pattern like any other', async () => {
    const user = userEvent.setup()
    renderList()
    await user.selectOptions(screen.getAllByLabelText(/^Pattern for /i)[0], 'bands-cells')
    expect(onUpdatePanel).toHaveBeenCalledWith('1', { pattern: 'bands-cells' })
  })
})
