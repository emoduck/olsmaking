import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusBadge } from '.'

const meta = {
  title: 'View/StatusBadge',
  component: StatusBadge,
  args: {
    label: 'Storybook local',
    tone: 'accent',
  },
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Accent: Story = {}

export const Calm: Story = {
  args: {
    label: '.NET 10 LTS',
    tone: 'calm',
  },
}

export const Warning: Story = {
  args: {
    label: 'Azure F1-first',
    tone: 'warning',
  },
}
