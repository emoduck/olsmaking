import type { Meta, StoryObj } from '@storybook/react-vite'
import { InfoCard } from './InfoCard'

const meta = {
  title: 'View/InfoCard',
  component: InfoCard,
  args: {
    title: 'BFF Host',
    subtitle: 'ASP.NET Core Web API serves API and static assets as one deployment unit.',
    footer: 'App Service friendly',
  },
} satisfies Meta<typeof InfoCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StorybookCard: Story = {
  args: {
    title: 'Component Workflow',
    subtitle: 'Storybook runs locally and targets simple, presentational components.',
    footer: 'No hosted Storybook yet',
  },
}
