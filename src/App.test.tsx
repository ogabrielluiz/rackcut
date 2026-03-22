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

  // Check the panel appears in the list
  expect(screen.getByText('8HP')).toBeInTheDocument()
  expect(screen.getByText('×1')).toBeInTheDocument()
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
  expect(screen.getByText('8HP')).toBeInTheDocument()

  // Click Clear all
  const clearButton = screen.getByRole('button', { name: /clear all/i })
  await user.click(clearButton)

  // Empty state should be back
  expect(screen.getByText('Add panels to preview your cut sheet')).toBeInTheDocument()
  expect(screen.queryByText('8HP')).not.toBeInTheDocument()
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
