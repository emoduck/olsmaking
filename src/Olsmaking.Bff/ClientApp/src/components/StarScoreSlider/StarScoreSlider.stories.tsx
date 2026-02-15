import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StarScoreSlider } from '.'

const meta = {
  title: 'View/StarScoreSlider',
  component: StarScoreSlider,
  args: {
    id: 'color-score',
    label: 'Farge',
    value: 4,
    disabled: false,
    onChange: () => undefined,
  },
} satisfies Meta<typeof StarScoreSlider>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <StarScoreSlider {...args} value={value} onChange={setValue} />
  },
}

export const Disabled: Story = {
  args: {
    value: 2,
    disabled: true,
  },
  render: (args) => <StarScoreSlider {...args} onChange={() => undefined} />,
}
