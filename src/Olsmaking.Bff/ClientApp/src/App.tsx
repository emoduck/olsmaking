import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addBeerFavorite,
  ApiClientError,
  buildLoginUrl,
  createBeerReview,
  createEvent,
  createEventBeer,
  getCurrentUser,
  getEvent,
  getEventBeers,
  getMyFavorites,
  getMyBeerReview,
  getMyEventFavorites,
  getMyEvents,
  getOpenEvents,
  joinEvent,
  patchEventStatus,
  patchMyBeerReview,
  removeParticipant,
  restoreParticipant,
  removeBeerFavorite,
  type CurrentUser,
  type EventBeer,
  type EventDetails,
  type EventSummary,
  type FavoriteBeerSummary,
} from './api/client'
import styles from './App.module.css'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
type PrimaryTab = 'oversikt' | 'arrangement' | 'favoritter'
type OverviewFilter = 'mine' | 'open'

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
  const [myEventList, setMyEventList] = useState<EventSummary[]>([])
  const [openEventList, setOpenEventList] = useState<EventSummary[]>([])
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>('mine')
  const [favoriteList, setFavoriteList] = useState<FavoriteBeerSummary[]>([])
  const [favoritesPending, setFavoritesPending] = useState(false)
  const [favoritesHydrated, setFavoritesHydrated] = useState(false)

  const [workspacePending, setWorkspacePending] = useState(false)
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false)
  const [participantActionPendingUserId, setParticipantActionPendingUserId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null)
  const [beerList, setBeerList] = useState<EventBeer[]>([])
  const [favoriteBeerIds, setFavoriteBeerIds] = useState<string[]>([])
  const [favoritePendingBeerIds, setFavoritePendingBeerIds] = useState<string[]>([])
  const [selectedBeerId, setSelectedBeerId] = useState('')

  const [beerName, setBeerName] = useState('')
  const [beerBrewery, setBeerBrewery] = useState('')
  const [beerStyle, setBeerStyle] = useState('')
  const [beerAbv, setBeerAbv] = useState('')
  const [addBeerPending, setAddBeerPending] = useState(false)

  const [reviewRating, setReviewRating] = useState(3)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewAromaNotes, setReviewAromaNotes] = useState('')
  const [reviewAppearanceNotes, setReviewAppearanceNotes] = useState('')
  const [reviewFlavorNotes, setReviewFlavorNotes] = useState('')
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
  const selectedEventId = selectedEvent?.id ?? ''
  const selectedBeerReviewId = selectedBeer?.id ?? ''
  const favoriteBeerIdSet = useMemo(() => new Set(favoriteBeerIds), [favoriteBeerIds])
  const favoritePendingBeerIdSet = useMemo(() => new Set(favoritePendingBeerIds), [favoritePendingBeerIds])
  const overviewList = overviewFilter === 'mine' ? myEventList : openEventList
  const currentUserRole = selectedEvent?.currentUserRole.toLowerCase() ?? ''
  const canManageEvent = currentUserRole === 'owner' || currentUserRole === 'admin'
  const favoritesDateFormatter = useMemo(
    () => new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }),
    [],
  )

  function formatFavoriteTime(value: string): string {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return favoritesDateFormatter.format(parsed)
  }

  useEffect(() => {
    let isActive = true

    if (!selectedEventId || !selectedBeerReviewId) {
      setReviewRating(3)
      setReviewNotes('')
      setReviewAromaNotes('')
      setReviewAppearanceNotes('')
      setReviewFlavorNotes('')
      return () => {
        isActive = false
      }
    }

    async function hydrateReview() {
      try {
        const review = await getMyBeerReview(selectedEventId, selectedBeerReviewId)

        if (!isActive) {
          return
        }

        setReviewRating(review.rating)
        setReviewNotes(review.notes ?? '')
        setReviewAromaNotes(review.aromaNotes ?? '')
        setReviewAppearanceNotes(review.appearanceNotes ?? '')
        setReviewFlavorNotes(review.flavorNotes ?? '')
      } catch (error) {
        if (!isActive) {
          return
        }

        if (error instanceof ApiClientError && error.status === 404) {
          setReviewRating(3)
          setReviewNotes('')
          setReviewAromaNotes('')
          setReviewAppearanceNotes('')
          setReviewFlavorNotes('')
          return
        }

        setReviewRating(3)
        setReviewNotes('')
        setReviewAromaNotes('')
        setReviewAppearanceNotes('')
        setReviewFlavorNotes('')
        setErrorMessage(getApiMessage(error))
      }
    }

    void hydrateReview()

    return () => {
      isActive = false
    }
  }, [selectedBeerReviewId, selectedEventId])

  function upsertEventSummary(eventItem: EventSummary) {
    setMyEventList((previous) => {
      const next = [eventItem, ...previous.filter((item) => item.id !== eventItem.id)]
      return next.sort((a, b) => b.updatedUtc.localeCompare(a.updatedUtc))
    })
    setOpenEventList((previous) => previous.filter((item) => item.id !== eventItem.id))
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
    setFavoritePendingBeerIds([])
    try {
      const [eventDetails, beers, favorites] = await Promise.all([
        getEvent(eventId),
        getEventBeers(eventId),
        getMyEventFavorites(eventId),
      ])
      setSelectedEvent(eventDetails)
      setBeerList(beers)
      setFavoriteBeerIds(favorites)
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

  async function handleToggleFavorite(beerId: string, beerName: string) {
    if (!selectedEvent || favoritePendingBeerIdSet.has(beerId)) {
      return
    }

    setFeedbackMessage(null)
    setErrorMessage(null)

    const isFavorite = favoriteBeerIdSet.has(beerId)

    setFavoritePendingBeerIds((previous) => {
      if (previous.includes(beerId)) {
        return previous
      }

      return [...previous, beerId]
    })

    try {
      if (isFavorite) {
        await removeBeerFavorite(selectedEvent.id, beerId)
        setFavoriteBeerIds((previous) => previous.filter((item) => item !== beerId))
        setFeedbackMessage(`${beerName} er fjernet fra favoritter.`)
      } else {
        await addBeerFavorite(selectedEvent.id, beerId)
        setFavoriteBeerIds((previous) => {
          if (previous.includes(beerId)) {
            return previous
          }

          return [...previous, beerId]
        })
        setFeedbackMessage(`${beerName} er lagret som favoritt.`)
      }
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setFavoritePendingBeerIds((previous) => previous.filter((item) => item !== beerId))
    }
  }

  async function handleEventStatusChange(nextStatus: 'open' | 'closed') {
    if (!selectedEvent || workspaceActionPending) {
      return
    }

    setFeedbackMessage(null)
    setErrorMessage(null)
    setWorkspaceActionPending(true)

    try {
      await patchEventStatus(selectedEvent.id, nextStatus)
      await loadEventWorkspace(selectedEvent.id)
      setFeedbackMessage(nextStatus === 'closed' ? 'Arrangementet er na lukket.' : 'Arrangementet er na apent.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setWorkspaceActionPending(false)
    }
  }

  async function handleParticipantAction(userId: string, status: number, nickname: string | null) {
    if (!selectedEvent || workspaceActionPending || participantActionPendingUserId) {
      return
    }

    setFeedbackMessage(null)
    setErrorMessage(null)
    setWorkspaceActionPending(true)
    setParticipantActionPendingUserId(userId)

    const displayName = nickname ?? 'Bruker'

    try {
      if (status === 2) {
        await restoreParticipant(selectedEvent.id, userId)
        setFeedbackMessage(`${displayName} er gjenopprettet i arrangementet.`)
      } else {
        await removeParticipant(selectedEvent.id, userId)
        setFeedbackMessage(`${displayName} er fjernet fra arrangementet.`)
      }

      await loadEventWorkspace(selectedEvent.id)
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setWorkspaceActionPending(false)
      setParticipantActionPendingUserId('')
    }
  }

  useEffect(() => {
    let isMounted = true

    async function hydrate() {
      try {
        const [currentUser, myEvents, openEvents, favorites] = await Promise.all([
          getCurrentUser(),
          getMyEvents(),
          getOpenEvents(),
          getMyFavorites(),
        ])

        if (!isMounted) {
          return
        }

        setUser(currentUser)
        setMyEventList(myEvents)
        setOpenEventList(openEvents.filter((item) => !myEvents.some((myEvent) => myEvent.id === item.id)))
        setFavoriteList(favorites)
        setFavoritesHydrated(true)
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

  useEffect(() => {
    let isMounted = true

    if (activeTab !== 'favoritter' || favoritesHydrated || favoritesPending) {
      return () => {
        isMounted = false
      }
    }

    async function hydrateFavorites() {
      setFavoritesPending(true)
      try {
        const favorites = await getMyFavorites()

        if (!isMounted) {
          return
        }

        setFavoriteList(favorites)
        setFavoritesHydrated(true)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(getApiMessage(error))
      } finally {
        setFavoritesPending(false)
      }
    }

    void hydrateFavorites()

    return () => {
      isMounted = false
    }
  }, [activeTab, favoritesHydrated, favoritesPending])

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

  async function handleOpenFavoriteWorkspace(eventId: string, eventName: string) {
    setFeedbackMessage(null)
    setErrorMessage(null)
    setActiveTab('oversikt')

    try {
      await loadEventWorkspace(eventId)
      setFeedbackMessage(`Arbeidsflate apnet for ${eventName}.`)
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
      aromaNotes: trimOptional(reviewAromaNotes),
      appearanceNotes: trimOptional(reviewAppearanceNotes),
      flavorNotes: trimOptional(reviewFlavorNotes),
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
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Arrangementer</h2>
              <div className={styles.filterTabs} role="tablist" aria-label="Arrangementfilter">
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewFilter === 'mine'}
                  className={overviewFilter === 'mine' ? styles.filterTabActive : styles.filterTab}
                  onClick={() => {
                    setOverviewFilter('mine')
                  }}
                >
                  Mine
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewFilter === 'open'}
                  className={overviewFilter === 'open' ? styles.filterTabActive : styles.filterTab}
                  onClick={() => {
                    setOverviewFilter('open')
                  }}
                >
                  Apne
                </button>
              </div>
            </div>

            {overviewList.length ? (
              <ul className={styles.eventList}>
                {overviewList.map((eventItem) => (
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
              <p className={styles.muted}>
                {overviewFilter === 'mine'
                  ? 'Ingen arrangementer enna. Opprett et nytt for a starte.'
                  : 'Ingen apne arrangementer akkurat na.'}
              </p>
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
                {canManageEvent ? (
                  <div className={styles.workspaceActions}>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => {
                        void handleEventStatusChange('open')
                      }}
                      disabled={workspaceActionPending || selectedEvent.status === 1}
                    >
                      Apne arrangement
                    </button>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => {
                        void handleEventStatusChange('closed')
                      }}
                      disabled={workspaceActionPending || selectedEvent.status === 2}
                    >
                      Lukk arrangement
                    </button>
                  </div>
                ) : null}
                <ul className={styles.participantList}>
                  {selectedEvent.participants.map((participant) => (
                    <li key={participant.userId} className={styles.participantRow}>
                      <div className={styles.participantBody}>
                        <span>{participant.nickname ?? 'Ukjent bruker'}</span>
                        <span className={styles.participantMeta}>
                          {PARTICIPANT_STATUS_LABELS[participant.status] ?? `Status ${participant.status}`}
                        </span>
                      </div>
                      {canManageEvent && participant.userId !== selectedEvent.ownerUserId ? (
                        participant.status === 1 || participant.status === 2 ? (
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => {
                              void handleParticipantAction(participant.userId, participant.status, participant.nickname)
                            }}
                            disabled={workspaceActionPending}
                          >
                            {participantActionPendingUserId === participant.userId
                              ? 'Lagrer...'
                              : participant.status === 2
                                ? 'Gjenopprett'
                                : 'Fjern'}
                          </button>
                        ) : null
                      ) : null}
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
                        <div className={styles.beerRowBody}>
                          <p className={styles.eventName}>{beer.name}</p>
                          <p className={styles.eventMeta}>
                            {[beer.brewery, beer.style, beer.abv !== null ? `${beer.abv}%` : null]
                              .filter(Boolean)
                              .join(' · ') || 'Ingen detaljer'}
                          </p>
                          {favoriteBeerIdSet.has(beer.id) ? <p className={styles.favoriteMeta}>Favoritt</p> : null}
                        </div>
                        <div className={styles.beerActions}>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => {
                              void handleToggleFavorite(beer.id, beer.name)
                            }}
                            disabled={favoritePendingBeerIdSet.has(beer.id)}
                            aria-label={
                              favoriteBeerIdSet.has(beer.id)
                                ? `Fjern favoritt for ${beer.name}`
                                : `Lagre ${beer.name} som favoritt`
                            }
                          >
                            {favoritePendingBeerIdSet.has(beer.id)
                              ? 'Lagrer...'
                              : favoriteBeerIdSet.has(beer.id)
                                ? 'Fjern favoritt'
                                : 'Lagre favoritt'}
                          </button>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => {
                              setSelectedBeerId(beer.id)
                            }}
                          >
                            Velg
                          </button>
                        </div>
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

                    <label className={styles.label} htmlFor="review-aroma-notes">
                      Aroma (valgfritt)
                    </label>
                    <textarea
                      id="review-aroma-notes"
                      className={styles.textArea}
                      value={reviewAromaNotes}
                      onChange={(event) => {
                        setReviewAromaNotes(event.target.value)
                      }}
                      maxLength={2000}
                      placeholder="Hva lukter du?"
                    />

                    <label className={styles.label} htmlFor="review-appearance-notes">
                      Utseende (valgfritt)
                    </label>
                    <textarea
                      id="review-appearance-notes"
                      className={styles.textArea}
                      value={reviewAppearanceNotes}
                      onChange={(event) => {
                        setReviewAppearanceNotes(event.target.value)
                      }}
                      maxLength={2000}
                      placeholder="Skum, farge og klarhet"
                    />

                    <label className={styles.label} htmlFor="review-flavor-notes">
                      Smak (valgfritt)
                    </label>
                    <textarea
                      id="review-flavor-notes"
                      className={styles.textArea}
                      value={reviewFlavorNotes}
                      onChange={(event) => {
                        setReviewFlavorNotes(event.target.value)
                      }}
                      maxLength={2000}
                      placeholder="Smaksnotater og avslutning"
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
      ) : activeTab === 'favoritter' ? (
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Favoritter</h2>
          {favoritesPending ? (
            <p className={styles.muted}>Laster favoritter...</p>
          ) : favoriteList.length ? (
            <ul className={styles.favoriteList}>
              {favoriteList.map((favorite) => (
                <li key={`${favorite.eventId}-${favorite.beerId}`} className={styles.favoriteCard}>
                  <div className={styles.favoriteCardBody}>
                    <p className={styles.eventName}>{favorite.beerName}</p>
                    <p className={styles.eventMeta}>
                      {[favorite.brewery, favorite.style, favorite.abv !== null ? `${favorite.abv}%` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Ingen detaljer'}
                    </p>
                    <p className={styles.eventMeta}>Arrangement: {favorite.eventName}</p>
                    <p className={styles.eventMeta}>Lagt til: {formatFavoriteTime(favorite.favoritedUtc)}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => {
                      void handleOpenFavoriteWorkspace(favorite.eventId, favorite.eventName)
                    }}
                  >
                    Apen arbeidsflate
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Ingen favoritter enna.</p>
          )}
        </section>
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
        <button
          type="button"
          className={activeTab === 'favoritter' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            setActiveTab('favoritter')
          }}
        >
          Favoritter
        </button>
        <button type="button" className={styles.navItemDisabled} disabled>
          Profil
        </button>
      </nav>

      <p className={styles.navHint}>Smakinger og profil kommer snart.</p>
      <div className={styles.navSpacer} />
    </main>
  )
}

export default App
