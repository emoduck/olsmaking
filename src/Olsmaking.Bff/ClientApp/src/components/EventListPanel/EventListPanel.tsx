import type { EventSummary } from '../../api/client'

export type OverviewFilter = 'mine' | 'open'

type EventListPanelProps = {
  title: string
  filter: OverviewFilter
  events: EventSummary[]
  onFilterChange: (nextFilter: OverviewFilter) => void
  onOpenEvent: (eventId: string) => void
  getStatusLabel: (status: number) => string
  emptyMineText: string
  emptyOpenText: string
  openButtonLabel?: string
  classes: {
    sectionHeader: string
    sectionTitle: string
    filterTabs: string
    filterTab: string
    filterTabActive: string
    eventList: string
    eventRow: string
    eventName: string
    eventMeta: string
    buttonSecondary: string
    muted: string
  }
}

export function EventListPanel({
  title,
  filter,
  events,
  onFilterChange,
  onOpenEvent,
  getStatusLabel,
  emptyMineText,
  emptyOpenText,
  openButtonLabel = 'Vis',
  classes,
}: EventListPanelProps) {
  return (
    <section>
      <div className={classes.sectionHeader}>
        <h2 className={classes.sectionTitle}>{title}</h2>
        <div className={classes.filterTabs} role="tablist" aria-label="Arrangementfilter">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'mine'}
            className={filter === 'mine' ? classes.filterTabActive : classes.filterTab}
            onClick={() => {
              onFilterChange('mine')
            }}
          >
            Mine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'open'}
            className={filter === 'open' ? classes.filterTabActive : classes.filterTab}
            onClick={() => {
              onFilterChange('open')
            }}
          >
            Åpne
          </button>
        </div>
      </div>

      {events.length ? (
        <ul className={classes.eventList}>
          {events.map((eventItem) => (
            <li key={eventItem.id} className={classes.eventRow}>
              <div>
                <p className={classes.eventName}>{eventItem.name}</p>
                <p className={classes.eventMeta}>
                  {getStatusLabel(eventItem.status)} · {eventItem.id}
                </p>
              </div>
              <button
                type="button"
                className={classes.buttonSecondary}
                onClick={() => {
                  onOpenEvent(eventItem.id)
                }}
              >
                {openButtonLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={classes.muted}>{filter === 'mine' ? emptyMineText : emptyOpenText}</p>
      )}
    </section>
  )
}
