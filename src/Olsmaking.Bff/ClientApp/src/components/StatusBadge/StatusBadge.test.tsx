import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from '.'

describe('StatusBadge', () => {
  it('renders the provided label', () => {
    render(<StatusBadge label="Storybook local" tone="accent" />)
    expect(screen.getByLabelText('Storybook local')).toBeInTheDocument()
  })
})
