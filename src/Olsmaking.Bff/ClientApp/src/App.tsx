import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiClientError,
  buildLoginUrl,
  createBeerReview,
  createEvent,
  createEventBeer,
  getCurrentUser,
  getEvent,
  getEventBeers,
  getMyEvents,
  joinEvent,
  patchMyBeerReview,
  type CurrentUser,
  type EventBeer,
  type EventDetails,
  type EventSummary,
} from './api/client'
import styles from './App.module.css'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
type PrimaryTab = 'oversikt' | 'arrangement'

const STATUS_LABELS: Record<number, string> = {
  0: 'Utkast',
  1: 'Apent',
  2: 'Lukket',
  3: 'Arkivert',
}

const PARTICIPANT_STATUS_LABELS: Record<number, string> = {
  0: 'Invitert',
  1: 'Aktiv',
  2: 'Fjernet',
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

function trimOptional(value: string): string | null {
  const next = value.trim()
  return next.length ? next : null
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
  const [eventList, setEventList] = useState<EventSummary[]>([])

  const [workspacePending, setWorkspacePending] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null)
  const [beerList, setBeerList] = useState<EventBeer[]>([])
  const [selectedBeerId, setSelectedBeerId] = useState('')

  const [beerName, setBeerName] = useState('')
  const [beerBrewery, setBeerBrewery] = useState('')
  const [beerStyle, setBeerStyle] = useState('')
  const [beerAbv, setBeerAbv] = useState('')
  const [addBeerPending, setAddBeerPending] = useState(false)

  const [reviewRating, setReviewRating] = useState(3)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewPending, setReviewPending] = useState(false)

  const queryValues = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      eventId: params.get('eventId') ?? '',
      joinCode: params.get('joinCode') ?? '',
    }
  }, [])

  const [joinEventId, setJoinEventId] = useState(queryValues.eventId)
  const [joinCode, setJoinCode] = useState(queryValues.joinCode)

  const selectedBeer = beerList.find((item) => item.id === selectedBeerId) ?? null

  function upsertEventSummary(eventItem: EventSummary) {
    setEventList((previous) => {
      const next = [eventItem, ...previous.filter((item) => item.id !== eventItem.id)]
      return next.sort((a, b) => b.updatedUtc.localeCompare(a.updatedUtc))
    })
  }

  function upsertEventSummaryFromDetails(eventItem: EventDetails) {
    upsertEventSummary({
      id: eventItem.id,
      name: eventItem.name,
      status: eventItem.status,
      visibility: eventItem.visibility,
      isListed: eventItem.isListed,
      ownerUserId: eventItem.ownerUserId,
      updatedUtc: eventItem.updatedUtc,
      createdUtc: eventItem.createdUtc,
    })
  }

  async function loadEventWorkspace(eventId: string) {
    setWorkspacePending(true)
    try {
      const [eventDetails, beers] = await Promise.all([getEvent(eventId), getEventBeers(eventId)])
      setSelectedEvent(eventDetails)
      setBeerList(beers)
      setSelectedBeerId((previous) => {
        if (previous && beers.some((item) => item.id === previous)) {
          return previous
        }

        return beers[0]?.id ?? ''
      })
      upsertEventSummaryFromDetails(eventDetails)
    } finally {
      setWorkspacePending(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function hydrate() {
      try {
        const [currentUser, myEvents] = await Promise.all([getCurrentUser(), getMyEvents()])

        if (!isMounted) {
          return
        }

        setUser(currentUser)
        setEventList(myEvents)
        setAuthState('authenticated')
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
      setCreateName('')
      setActiveTab('oversikt')
      setFeedbackMessage('Arrangementet er opprettet.')
      await loadEventWorkspace(created.id)
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
      await loadEventWorkspace(result.eventId)
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
      await loadEventWorkspace(eventId)
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    }
  }

  async function handleAddBeer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    if (!selectedEvent) {
      setErrorMessage('Velg et arrangement forst.')
      return
    }

    if (!beerName.trim()) {
      setErrorMessage('Skriv inn et navn pa ol.')
      return
    }

    let abvValue: number | null = null
    if (beerAbv.trim()) {
      const parsed = Number(beerAbv.replace(',', '.'))
      if (!Number.isFinite(parsed)) {
        setErrorMessage('ABV ma vare et gyldig tall, for eksempel 5.2.')
        return
      }

      abvValue = parsed
    }

    setAddBeerPending(true)
    try {
      const created = await createEventBeer(selectedEvent.id, {
        name: beerName.trim(),
        brewery: trimOptional(beerBrewery),
        style: trimOptional(beerStyle),
        abv: abvValue,
      })

      setBeerList((previous) => [...previous, created])
      setSelectedBeerId(created.id)
      setBeerName('')
      setBeerBrewery('')
      setBeerStyle('')
      setBeerAbv('')
      setFeedbackMessage('Ol lagt til i arrangementet.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setAddBeerPending(false)
    }
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    if (!selectedEvent || !selectedBeer) {
      setErrorMessage('Velg et arrangement og en ol forst.')
      return
    }

    const payload = {
      rating: reviewRating,
      notes: trimOptional(reviewNotes),
    }

    setReviewPending(true)
    try {
      await patchMyBeerReview(selectedEvent.id, selectedBeer.id, payload)
      setFeedbackMessage('Vurdering oppdatert.')
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        try {
          await createBeerReview(selectedEvent.id, selectedBeer.id, payload)
          setFeedbackMessage('Vurdering lagret.')
          return
        } catch (createError) {
          setErrorMessage(getApiMessage(createError))
          return
        }
      }

      setErrorMessage(getApiMessage(error))
    } finally {
      setReviewPending(false)
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

          {workspacePending ? (
            <section className={styles.panel}>
              <p className={styles.muted}>Laster arbeidsflate...</p>
            </section>
          ) : null}

          {selectedEvent ? (
            <>
              <section className={styles.panel}>
                <h2 className={styles.sectionTitle}>Arrangement</h2>
                <p className={styles.eventName}>{selectedEvent.name}</p>
                <p className={styles.eventMeta}>Arrangement-ID: {selectedEvent.id}</p>
                <p className={styles.eventMeta}>Bli-med-kode: {selectedEvent.joinCode}</p>
                <p className={styles.eventMeta}>Status: {STATUS_LABELS[selectedEvent.status] ?? 'Ukjent'}</p>
                <p className={styles.eventMeta}>Din rolle: {selectedEvent.currentUserRole}</p>
                <p className={styles.eventMeta}>Deltakere: {selectedEvent.participants.length}</p>
                <ul className={styles.participantList}>
                  {selectedEvent.participants.map((participant) => (
                    <li key={participant.userId} className={styles.participantRow}>
                      <span>{participant.nickname ?? 'Ukjent bruker'}</span>
                      <span className={styles.participantMeta}>
                        {PARTICIPANT_STATUS_LABELS[participant.status] ?? `Status ${participant.status}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.sectionTitle}>Ol i arrangementet</h2>
                {beerList.length ? (
                  <ul className={styles.beerList}>
                    {beerList.map((beer) => (
                      <li key={beer.id} className={beer.id === selectedBeerId ? styles.beerRowActive : styles.beerRow}>
                        <div>
                          <p className={styles.eventName}>{beer.name}</p>
                          <p className={styles.eventMeta}>
                            {[beer.brewery, beer.style, beer.abv !== null ? `${beer.abv}%` : null]
                              .filter(Boolean)
                              .join(' · ') || 'Ingen detaljer'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={styles.buttonSecondary}
                          onClick={() => {
                            setSelectedBeerId(beer.id)
                          }}
                        >
                          Velg
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>Ingen ol registrert enna.</p>
                )}

                <form className={styles.form} onSubmit={handleAddBeer}>
                  <label className={styles.label} htmlFor="beer-name">
                    Navn pa ol
                  </label>
                  <input
                    id="beer-name"
                    className={styles.input}
                    value={beerName}
                    onChange={(event) => {
                      setBeerName(event.target.value)
                    }}
                    maxLength={200}
                    placeholder="For eksempel Session IPA"
                  />

                  <label className={styles.label} htmlFor="beer-brewery">
                    Bryggeri (valgfritt)
                  </label>
                  <input
                    id="beer-brewery"
                    className={styles.input}
                    value={beerBrewery}
                    onChange={(event) => {
                      setBeerBrewery(event.target.value)
                    }}
                    maxLength={200}
                  />

                  <label className={styles.label} htmlFor="beer-style">
                    Stil (valgfritt)
                  </label>
                  <input
                    id="beer-style"
                    className={styles.input}
                    value={beerStyle}
                    onChange={(event) => {
                      setBeerStyle(event.target.value)
                    }}
                    maxLength={100}
                  />

                  <label className={styles.label} htmlFor="beer-abv">
                    ABV (valgfritt)
                  </label>
                  <input
                    id="beer-abv"
                    className={styles.input}
                    value={beerAbv}
                    onChange={(event) => {
                      setBeerAbv(event.target.value)
                    }}
                    inputMode="decimal"
                    placeholder="For eksempel 5.2"
                  />

                  <button type="submit" className={styles.buttonPrimary} disabled={addBeerPending}>
                    {addBeerPending ? 'Legger til...' : 'Legg til ol'}
                  </button>
                </form>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.sectionTitle}>Din vurdering</h2>
                {selectedBeer ? (
                  <form className={styles.form} onSubmit={handleReviewSubmit}>
                    <p className={styles.eventMeta}>Valgt ol: {selectedBeer.name}</p>

                    <label className={styles.label} htmlFor="review-rating">
                      Poeng: {reviewRating} / 6
                    </label>
                    <input
                      id="review-rating"
                      className={styles.rangeInput}
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={reviewRating}
                      onChange={(event) => {
                        setReviewRating(Number(event.target.value))
                      }}
                    />
                    <p className={styles.muted}>Flytt slideren for a velge poeng fra 1 til 6.</p>

                    <label className={styles.label} htmlFor="review-notes">
                      Notater
                    </label>
                    <textarea
                      id="review-notes"
                      className={styles.textArea}
                      value={reviewNotes}
                      onChange={(event) => {
                        setReviewNotes(event.target.value)
                      }}
                      maxLength={2000}
                      placeholder="Kort smaksvurdering"
                    />

                    <button type="submit" className={styles.buttonPrimary} disabled={reviewPending}>
                      {reviewPending ? 'Lagrer...' : 'Lagre vurdering'}
                    </button>
                  </form>
                ) : (
                  <p className={styles.muted}>Velg en ol for a registrere vurdering.</p>
                )}
              </section>
            </>
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
