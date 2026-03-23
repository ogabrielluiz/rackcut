import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

test('renders app title and empty state', () => {
  render(<App />)
  expect(screen.getByText('rackcut')).toBeInTheDocument()
  expect(screen.getByText('Add panels to preview your cut sheet')).toBeInTheDocument()
})

test('adds a panel and shows it in the list', async () => {
  const user = userEvent.setup()
  render(<App />)

  // Set HP to 8 (it's already 8 by default in PanelForm)
  const hpInput = screen.getByLabelText('HP')
  await user.clear(hpInput)
  await user.type(hpInput, '8')

  // Click Add button
  const addButton = screen.getByRole('button', { name: /add/i })
  await user.click(addButton)

  // Check the panel appears in the list — HP is now an input
  const hpInputs = screen.getAllByLabelText(/^HP for /i)
  expect(hpInputs.length).toBeGreaterThan(0)
  expect(hpInputs[0]).toHaveValue(8)
})

test('shows SVG preview after adding a panel', async () => {
  const user = userEvent.setup()
  render(<App />)

  // Empty state should be visible
  expect(screen.getByText('Add panels to preview your cut sheet')).toBeInTheDocument()

  // Add a panel
  const addButton = screen.getByRole('button', { name: /add/i })
  await user.click(addButton)

  // SVG element should now be in the document
  const svgEl = document.querySelector('svg')
  expect(svgEl).toBeInTheDocument()

  // Empty state message should be gone
  expect(screen.queryByText('Add panels to preview your cut sheet')).not.toBeInTheDocument()
})

test('clears all panels and returns to empty state', async () => {
  const user = userEvent.setup()
  render(<App />)

  // Add a panel
  const addButton = screen.getByRole('button', { name: /add/i })
  await user.click(addButton)

  // Confirm panel added
  expect(screen.getAllByLabelText(/^HP for /i).length).toBeGreaterThan(0)

  // Click Clear all
  const clearButton = screen.getByRole('button', { name: /clear all/i })
  await user.click(clearButton)

  // Empty state should be back
  expect(screen.getByText('Add panels to preview your cut sheet')).toBeInTheDocument()
  expect(screen.queryAllByLabelText(/^HP for /i)).toHaveLength(0)
})

test('download button is present when panels exist', async () => {
  const user = userEvent.setup()
  render(<App />)

  // Download button should not be there initially (or disabled)
  // After adding a panel, it should be present and enabled
  const addButton = screen.getByRole('button', { name: /add/i })
  await user.click(addButton)

  const downloadButton = screen.getByRole('button', { name: /download svg/i })
  expect(downloadButton).toBeInTheDocument()
  expect(downloadButton).not.toBeDisabled()
})

test('each panel keeps its own pattern when adding new panels with different patterns', async () => {
  const user = userEvent.setup()
  render(<App />)

  const addButton = screen.getByRole('button', { name: /add/i })
  const defaultPatternSelect = screen.getByLabelText('Default pattern')

  // Add first panel with "waveform" pattern
  await user.selectOptions(defaultPatternSelect, 'waveform')
  await user.click(addButton)

  // Add second panel with "lissajous" pattern
  await user.selectOptions(defaultPatternSelect, 'lissajous')
  await user.click(addButton)

  // Both panels should be in the list with their own patterns
  const patternSelects = screen.getAllByLabelText(/^Pattern for /i)
  expect(patternSelects).toHaveLength(2)

  // First panel should still be waveform, second should be lissajous
  expect(patternSelects[0]).toHaveValue('waveform')
  expect(patternSelects[1]).toHaveValue('lissajous')
})

test('changing default pattern does not affect existing panels', async () => {
  const user = userEvent.setup()
  render(<App />)

  const addButton = screen.getByRole('button', { name: /add/i })
  const defaultPatternSelect = screen.getByLabelText('Default pattern')

  // Add panel with "flow-field"
  await user.selectOptions(defaultPatternSelect, 'flow-field')
  await user.click(addButton)

  // Change global pattern to something else
  await user.selectOptions(defaultPatternSelect, 'sierpinski-full')

  // Existing panel should still be flow-field
  const patternSelects = screen.getAllByLabelText(/^Pattern for /i)
  expect(patternSelects[0]).toHaveValue('flow-field')
})

test('per-panel pattern can be changed independently', async () => {
  const user = userEvent.setup()
  render(<App />)

  const addButton = screen.getByRole('button', { name: /add/i })

  // Add two panels
  await user.click(addButton)
  await user.click(addButton)

  const patternSelects = screen.getAllByLabelText(/^Pattern for /i)
  expect(patternSelects).toHaveLength(2)

  // Change only the first panel's pattern
  await user.selectOptions(patternSelects[0], 'voronoi')

  // First should be voronoi, second should be unchanged (default "none")
  expect(patternSelects[0]).toHaveValue('voronoi')
  expect(patternSelects[1]).toHaveValue('none')
})
