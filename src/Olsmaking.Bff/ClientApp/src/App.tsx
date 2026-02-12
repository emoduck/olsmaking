import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiClientError,
  buildLoginUrl,
  createEvent,
  getCurrentUser,
  getEvent,
  joinEvent,
  type CurrentUser,
  type EventDetails,
} from './api/client'
import styles from './App.module.css'

const EVENT_STORAGE_KEY = 'olsmaking:mvp:eventIds'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
type PrimaryTab = 'oversikt' | 'arrangement'

const STATUS_LABELS: Record<number, string> = {
  0: 'Utkast',
  1: 'Apent',
  2: 'Lukket',
  3: 'Arkivert',
}

function loadStoredEventIds(): string[] {
  const raw = window.localStorage.getItem(EVENT_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function persistEventIds(eventIds: string[]) {
  window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(eventIds))
}

function getApiMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.problem?.errors) {
      const firstGroup = Object.values(error.problem.errors)[0]
      if (firstGroup?.length) {
        return firstGroup[0]
      }
    }

    return error.message
  }

  return 'Noe gikk galt. Prov igjen.'
}

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activeTab, setActiveTab] = useState<PrimaryTab>('arrangement')
  const [createName, setCreateName] = useState('')
  const [createPending, setCreatePending] = useState(false)
  const [joinPending, setJoinPending] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [latestEvent, setLatestEvent] = useState<EventDetails | null>(null)
  const [eventList, setEventList] = useState<EventDetails[]>([])

  const queryValues = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      eventId: params.get('eventId') ?? '',
      joinCode: params.get('joinCode') ?? '',
    }
  }, [])

  const [joinEventId, setJoinEventId] = useState(queryValues.eventId)
  const [joinCode, setJoinCode] = useState(queryValues.joinCode)

  useEffect(() => {
    let isMounted = true

    async function hydrate() {
      try {
        const currentUser = await getCurrentUser()

        if (!isMounted) {
          return
        }

        setUser(currentUser)
        setAuthState('authenticated')

        const storedIds = loadStoredEventIds()
        if (!storedIds.length) {
          return
        }

        const loadedEvents = await Promise.allSettled(storedIds.map((id) => getEvent(id)))
        if (!isMounted) {
          return
        }

        const successfulEvents = loadedEvents
          .filter((item): item is PromiseFulfilledResult<EventDetails> => item.status === 'fulfilled')
          .map((item) => item.value)

        setEventList(successfulEvents)
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
          setAuthState('unauthenticated')
          return
        }

        setAuthState('error')
        setErrorMessage(getApiMessage(error))
      }
    }

    void hydrate()

    return () => {
      isMounted = false
    }
  }, [])

  const loginUrl = buildLoginUrl()

  function upsertEvent(event: EventDetails) {
    setEventList((previous) => {
      const next = [event, ...previous.filter((item) => item.id !== event.id)]
      const nextIds = next.map((item) => item.id)
      persistEventIds(nextIds)
      return next
    })
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    if (!createName.trim()) {
      setErrorMessage('Skriv inn et navn pa arrangementet.')
      return
    }

    setCreatePending(true)
    try {
      const created = await createEvent(createName.trim())
      setLatestEvent(created)
      upsertEvent(created)
      setCreateName('')
      setActiveTab('oversikt')
      setFeedbackMessage('Arrangementet er opprettet.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setCreatePending(false)
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    if (!joinEventId.trim() || !joinCode.trim()) {
      setErrorMessage('Fyll inn bade arrangement-ID og bli-med-kode.')
      return
    }

    setJoinPending(true)
    try {
      const result = await joinEvent(joinEventId.trim(), joinCode.trim())
      const eventDetails = await getEvent(result.eventId)
      setLatestEvent(eventDetails)
      upsertEvent(eventDetails)
      setActiveTab('oversikt')
      setFeedbackMessage(result.joined ? 'Du ble med i arrangementet.' : 'Du er allerede med i arrangementet.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setJoinPending(false)
    }
  }

  async function handleSelectEvent(eventId: string) {
    setFeedbackMessage(null)
    setErrorMessage(null)

    try {
      const eventDetails = await getEvent(eventId)
      setLatestEvent(eventDetails)
      upsertEvent(eventDetails)
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    }
  }

  if (authState === 'loading') {
    return (
      <main className={styles.appShell}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Laster Olsmaking</h1>
          <p className={styles.muted}>Henter brukerstatus...</p>
        </section>
      </main>
    )
  }

  if (authState === 'error') {
    return (
      <main className={styles.appShell}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Kunne ikke laste appen</h1>
          <p className={styles.error}>{errorMessage ?? 'Noe gikk galt. Prov igjen.'}</p>
          <a className={styles.buttonPrimary} href={loginUrl}>
            Logg inn pa nytt
          </a>
        </section>
      </main>
    )
  }

  if (authState === 'unauthenticated') {
    return (
      <main className={styles.appShell}>
        <section className={styles.panel}>
          <p className={styles.kicker}>Olsmaking</p>
          <h1 className={styles.title}>Logg inn for a starte smaking</h1>
          <p className={styles.muted}>Du ma vare innlogget for a opprette eller bli med i arrangement.</p>
          <a className={styles.buttonPrimary} href={loginUrl}>
            Logg inn
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.appShell}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}>Olsmaking</p>
          <h1 className={styles.title}>Hei {user?.nickname ?? 'smaker'}</h1>
        </div>
        <a className={styles.linkButton} href={loginUrl}>
          Bytt konto
        </a>
      </header>

      {feedbackMessage ? <p className={styles.success}>{feedbackMessage}</p> : null}
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

      {activeTab === 'oversikt' ? (
        <>
          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>Dine arrangementer</h2>
            {eventList.length ? (
              <ul className={styles.eventList}>
                {eventList.map((eventItem) => (
                  <li key={eventItem.id} className={styles.eventRow}>
                    <div>
                      <p className={styles.eventName}>{eventItem.name}</p>
                      <p className={styles.eventMeta}>
                        {STATUS_LABELS[eventItem.status] ?? 'Ukjent'} · {eventItem.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => {
                        void handleSelectEvent(eventItem.id)
                      }}
                    >
                      Vis
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Ingen arrangementer enna. Opprett et nytt for a starte.</p>
            )}
          </section>

          {latestEvent ? (
            <section className={styles.panel}>
              <h2 className={styles.sectionTitle}>Sammendrag</h2>
              <p className={styles.eventName}>{latestEvent.name}</p>
              <p className={styles.eventMeta}>Arrangement-ID: {latestEvent.id}</p>
              <p className={styles.eventMeta}>Bli-med-kode: {latestEvent.joinCode}</p>
              <p className={styles.eventMeta}>Status: {STATUS_LABELS[latestEvent.status] ?? 'Ukjent'}</p>
              <p className={styles.eventMeta}>Din rolle: {latestEvent.currentUserRole}</p>
              <p className={styles.eventMeta}>Deltakere: {latestEvent.participants.length}</p>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>Opprett arrangement</h2>
            <form className={styles.form} onSubmit={handleCreate}>
              <label className={styles.label} htmlFor="event-name">
                Navn pa arrangement
              </label>
              <input
                id="event-name"
                className={styles.input}
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value)
                }}
                placeholder="For eksempel Fredagssmaking"
                maxLength={200}
              />
              <button type="submit" className={styles.buttonPrimary} disabled={createPending}>
                {createPending ? 'Oppretter...' : 'Opprett'}
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>Bli med i arrangement</h2>
            <form className={styles.form} onSubmit={handleJoin}>
              <label className={styles.label} htmlFor="join-event-id">
                Arrangement-ID
              </label>
              <input
                id="join-event-id"
                className={styles.input}
                value={joinEventId}
                onChange={(event) => {
                  setJoinEventId(event.target.value)
                }}
                placeholder="GUID fra invitasjon"
              />

              <label className={styles.label} htmlFor="join-code">
                Bli-med-kode
              </label>
              <input
                id="join-code"
                className={styles.input}
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value)
                }}
                placeholder="Eksempel ABCD1234"
              />

              <button type="submit" className={styles.buttonPrimary} disabled={joinPending}>
                {joinPending ? 'Bli med...' : 'Bli med'}
              </button>
            </form>
          </section>
        </>
      )}

      <nav className={styles.bottomNav} aria-label="Hovednavigasjon">
        <button
          type="button"
          className={activeTab === 'oversikt' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            setActiveTab('oversikt')
          }}
        >
          Oversikt
        </button>
        <button
          type="button"
          className={activeTab === 'arrangement' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            setActiveTab('arrangement')
          }}
        >
          Arrangement
        </button>
        <button type="button" className={styles.navItemDisabled} disabled>
          Smakinger
        </button>
        <button type="button" className={styles.navItemDisabled} disabled>
          Favoritter
        </button>
        <button type="button" className={styles.navItemDisabled} disabled>
          Profil
        </button>
      </nav>

      <p className={styles.navHint}>Smakinger, favoritter og profil kommer snart.</p>
      <div className={styles.navSpacer} />
    </main>
  )
}

export default App
