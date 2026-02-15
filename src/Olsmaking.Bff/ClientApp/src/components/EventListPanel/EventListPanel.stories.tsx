import type { Meta, StoryObj } from '@storybook/react-vite'
import { EventListPanel } from '.'

const meta = {
  title: 'View/EventListPanel',
  component: EventListPanel,
  args: {
    title: 'Arrangementer',
    filter: 'mine',
    events: [
      {
        id: 'evt-001',
        name: 'Fredagssmaking',
        status: 1,
        visibility: 1,
        isListed: true,
        ownerUserId: 'user-1',
        createdUtc: '2026-02-10T18:00:00Z',
        updatedUtc: '2026-02-12T18:00:00Z',
      },
      {
        id: 'evt-002',
        name: 'IPA-kveld',
        status: 2,
        visibility: 1,
        isListed: true,
        ownerUserId: 'user-2',
        createdUtc: '2026-02-09T18:00:00Z',
        updatedUtc: '2026-02-11T18:00:00Z',
      },
    ],
    onFilterChange: () => undefined,
    onOpenEvent: () => undefined,
    getStatusLabel: (status: number) => (status === 1 ? 'Aktiv' : 'Avsluttet'),
    emptyMineText: 'Du har ingen arrangementer ennå.',
    emptyOpenText: 'Ingen åpne arrangementer akkurat nå.',
    openButtonLabel: 'Vis',
    classes: {
      sectionHeader: '',
      sectionTitle: '',
      filterTabs: '',
      filterTab: '',
      filterTabActive: '',
      eventList: '',
      eventRow: '',
      eventName: '',
      eventMeta: '',
      buttonSecondary: '',
      muted: '',
    },
  },
} satisfies Meta<typeof EventListPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Mine: Story = {}

export const Open: Story = {
  args: {
    filter: 'open',
  },
}

export const EmptyState: Story = {
  args: {
    events: [],
  },
}
