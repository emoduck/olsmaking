import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InfoCard } from './InfoCard'

describe('InfoCard', () => {
  it('renders title and descriptive content', () => {
    render(
      <InfoCard
        title="BFF Host"
        subtitle="Static and API in one deployable unit."
        footer="App Service"
      />,
    )

    expect(screen.getByRole('heading', { name: 'BFF Host' })).toBeInTheDocument()
    expect(screen.getByText('Static and API in one deployable unit.')).toBeInTheDocument()
    expect(screen.getByText('App Service')).toBeInTheDocument()
  })
})
