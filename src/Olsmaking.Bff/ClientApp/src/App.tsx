import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addBeerFavorite,
  ApiClientError,
  buildLoginUrl,
  buildLogoutUrl,
  createBeerReview,
  createEvent,
  createEventBeer,
  deleteEvent,
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
  patchCurrentUserNickname,
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
import { EventListPanel, StarScoreSlider } from './components'
import type { OverviewFilter } from './components'
import { getEventRoleLabel } from './eventRole'
import styles from './App.module.css'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error'
type PrimaryTab = 'oversikt' | 'arrangement' | 'favoritter' | 'profil'

const TAB_ROUTES: Record<PrimaryTab, string> = {
  oversikt: '/oversikt',
  arrangement: '/arrangementer',
  favoritter: '/favoritter',
  profil: '/profil',
}

function normalizePath(pathname: string): string {
  if (pathname.endsWith('/') && pathname.length > 1) {
    return pathname.slice(0, -1)
  }

  return pathname
}

function getArrangementEventIdFromPath(pathname: string): string {
  const normalizedPath = normalizePath(pathname)

  if (!normalizedPath.startsWith('/arrangementer/')) {
    return ''
  }

  const segments = normalizedPath.split('/').filter(Boolean)

  if (segments.length !== 2 || segments[0] !== 'arrangementer') {
    return ''
  }

  return decodeURIComponent(segments[1] ?? '').trim()
}

function buildTabUrl(tab: PrimaryTab, options?: { eventId?: string }): string {
  const path = TAB_ROUTES[tab]

  if (tab !== 'arrangement') {
    return path
  }

  const eventId = options?.eventId?.trim()

  if (!eventId) {
    return path
  }

  return `${path}/${encodeURIComponent(eventId)}`
}

function getPrimaryTabFromPath(pathname: string): PrimaryTab {
  const normalizedPath = normalizePath(pathname)

  if (
    normalizedPath === '/arrangement' ||
    normalizedPath === '/arrangementer' ||
    normalizedPath.startsWith('/arrangementer/')
  ) {
    return 'arrangement'
  }

  switch (normalizedPath) {
    case '/oversikt':
      return 'oversikt'
    case '/favoritter':
      return 'favoritter'
    case '/profil':
      return 'profil'
    case '/':
      return 'oversikt'
    default:
      return 'oversikt'
  }
}

const STATUS_LABELS: Record<number, string> = {
  0: 'Utkast',
  1: 'Åpent',
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

  if (error instanceof Error && error.message) {
    if (error.message === 'Failed to fetch') {
      return 'Kunne ikke kontakte backend. Sjekk at BFF-prosessen kjører på localhost:5287.'
    }

    return error.message
  }

  return 'Noe gikk galt. Prøv igjen.'
}

function trimOptional(value: string): string | null {
  const next = value.trim()
  return next.length ? next : null
}

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activeTab, setActiveTab] = useState<PrimaryTab>(() => {
    if (typeof window === 'undefined') {
      return 'arrangement'
    }

    return getPrimaryTabFromPath(window.location.pathname)
  })
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === 'undefined') {
      return TAB_ROUTES.arrangement
    }

    return window.location.pathname
  })
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
  const [profileNickname, setProfileNickname] = useState('')
  const [profilePending, setProfilePending] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : false,
  )

  const [workspacePending, setWorkspacePending] = useState(false)
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false)
  const [deleteEventPending, setDeleteEventPending] = useState(false)
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
  const [isAddBeerFormOpen, setIsAddBeerFormOpen] = useState(false)

  const [reviewColorScore, setReviewColorScore] = useState(3)
  const [reviewSmellScore, setReviewSmellScore] = useState(3)
  const [reviewTasteScore, setReviewTasteScore] = useState(3)
  const [reviewTotalScore, setReviewTotalScore] = useState(3)
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
  const arrangementEventId = getArrangementEventIdFromPath(currentPath)
  const isArrangementEventRoute = activeTab === 'arrangement' && arrangementEventId.length > 0
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

  function navigateToTab(nextTab: PrimaryTab, options?: { replace?: boolean; eventId?: string }) {
    setActiveTab(nextTab)

    if (typeof window === 'undefined') {
      return
    }

    const targetUrl = buildTabUrl(nextTab, { eventId: options?.eventId })
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl === targetUrl) {
      setCurrentPath(window.location.pathname)
      return
    }

    if (options?.replace) {
      window.history.replaceState(window.history.state, '', targetUrl)
      setCurrentPath(new URL(targetUrl, window.location.origin).pathname)
      return
    }

    window.history.pushState(window.history.state, '', targetUrl)
    setCurrentPath(new URL(targetUrl, window.location.origin).pathname)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const initialTab = getPrimaryTabFromPath(window.location.pathname)
    const initialEventId = getArrangementEventIdFromPath(window.location.pathname)
    let canonicalUrl: string

    if (initialTab === 'arrangement') {
      canonicalUrl = buildTabUrl('arrangement', { eventId: initialEventId })
    } else if (initialTab === 'oversikt') {
      canonicalUrl = TAB_ROUTES.oversikt
    } else {
      canonicalUrl = TAB_ROUTES[initialTab]
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== canonicalUrl) {
      window.history.replaceState(window.history.state, '', canonicalUrl)
    }

    setActiveTab(initialTab)
    setCurrentPath(window.location.pathname)

    const handlePopState = () => {
      setActiveTab(getPrimaryTabFromPath(window.location.pathname))
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (authState !== 'authenticated' || activeTab !== 'arrangement') {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const deepLinkEventId = getArrangementEventIdFromPath(currentPath)

    if (!deepLinkEventId || deepLinkEventId === selectedEventId) {
      return
    }

    let isActive = true

    setFeedbackMessage(null)
    setErrorMessage(null)

    async function hydrateDeepLinkedWorkspace() {
      try {
        await loadEventWorkspace(deepLinkEventId)
      } catch (error) {
        if (!isActive) {
          return
        }

        if (error instanceof ApiClientError && error.status === 403) {
          setErrorMessage('Du har ikke tilgang til arrangementet i lenken.')
          return
        }

        if (error instanceof ApiClientError && error.status === 404) {
          setErrorMessage('Arrangementet i lenken finnes ikke lenger.')
          return
        }

        setErrorMessage(getApiMessage(error))
      }
    }

    void hydrateDeepLinkedWorkspace()

    return () => {
      isActive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoids re-trigger loops from function identity changes.
  }, [activeTab, authState, currentPath, selectedEventId])

  useEffect(() => {
    if (isArrangementEventRoute) {
      return
    }

    setSelectedEvent(null)
    setBeerList([])
    setFavoriteBeerIds([])
    setFavoritePendingBeerIds([])
    setSelectedBeerId('')
  }, [isArrangementEventRoute])

  useEffect(() => {
    let isActive = true

    if (!selectedEventId || !selectedBeerReviewId) {
      setReviewColorScore(3)
      setReviewSmellScore(3)
      setReviewTasteScore(3)
      setReviewTotalScore(3)
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

        setReviewColorScore(review.colorScore)
        setReviewSmellScore(review.smellScore)
        setReviewTasteScore(review.tasteScore)
        setReviewTotalScore(review.totalScore)
        setReviewNotes(review.notes ?? '')
        setReviewAromaNotes(review.aromaNotes ?? '')
        setReviewAppearanceNotes(review.appearanceNotes ?? '')
        setReviewFlavorNotes(review.flavorNotes ?? '')
      } catch (error) {
        if (!isActive) {
          return
        }

        if (error instanceof ApiClientError && error.status === 404) {
          setReviewColorScore(3)
          setReviewSmellScore(3)
          setReviewTasteScore(3)
          setReviewTotalScore(3)
          setReviewNotes('')
          setReviewAromaNotes('')
          setReviewAppearanceNotes('')
          setReviewFlavorNotes('')
          return
        }

        setReviewColorScore(3)
        setReviewSmellScore(3)
        setReviewTasteScore(3)
        setReviewTotalScore(3)
        setReviewNotes('')
        setReviewAromaNotes('')
        setReviewAppearanceNotes('')
        setReviewFlavorNotes('')

        if (error instanceof ApiClientError && error.status >= 500) {
          return
        }

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
      const [eventDetails, beers] = await Promise.all([getEvent(eventId), getEventBeers(eventId)])
      let favorites: string[] = []

      try {
        favorites = await getMyEventFavorites(eventId)
      } catch (error) {
        if (error instanceof ApiClientError && error.status < 500) {
          throw error
        }
      }

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
      setFeedbackMessage(nextStatus === 'closed' ? 'Arrangementet er nå lukket.' : 'Arrangementet er nå åpent.')
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

  async function handleDeleteEvent() {
    if (!selectedEvent || workspaceActionPending) {
      return
    }

    const eventId = selectedEvent.id
    const eventName = selectedEvent.name
    const isConfirmed = window.confirm(
      `Er du sikker på at du vil slette arrangementet "${eventName}"? Dette sletter også registrerte øl, favoritter og vurderinger.`,
    )

    if (!isConfirmed) {
      return
    }

    setFeedbackMessage(null)
    setErrorMessage(null)
    setWorkspaceActionPending(true)
    setDeleteEventPending(true)

    try {
      await deleteEvent(eventId)
      setSelectedEvent(null)
      setBeerList([])
      setFavoriteBeerIds([])
      setFavoritePendingBeerIds([])
      setSelectedBeerId('')
      setMyEventList((previous) => previous.filter((item) => item.id !== eventId))
      setOpenEventList((previous) => previous.filter((item) => item.id !== eventId))
      setFavoriteList((previous) => previous.filter((favorite) => favorite.eventId !== eventId))
      navigateToTab('arrangement', { replace: true })
      setFeedbackMessage('Arrangementet er slettet.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setWorkspaceActionPending(false)
      setDeleteEventPending(false)
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

    if (authState !== 'authenticated' || activeTab !== 'favoritter' || favoritesPending) {
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
  }, [activeTab, authState]) // eslint-disable-line react-hooks/exhaustive-deps -- favoritesPending is intentionally excluded to avoid refresh loops.

  useEffect(() => {
    setProfileNickname(user?.nickname ?? '')
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsLargeScreen(event.matches)
    }

    setIsLargeScreen(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange)

      return () => {
        mediaQuery.removeEventListener('change', handleMediaChange)
      }
    }

    mediaQuery.addListener(handleMediaChange)

    return () => {
      mediaQuery.removeListener(handleMediaChange)
    }
  }, [])

  const loginUrl = buildLoginUrl()
  const logoutUrl = buildLogoutUrl()

  function renderPrimaryNavItems() {
    return (
      <>
        <button
          type="button"
          className={activeTab === 'oversikt' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            navigateToTab('oversikt')
          }}
        >
          Oversikt
        </button>
        <button
          type="button"
          className={activeTab === 'arrangement' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            navigateToTab('arrangement')
          }}
        >
          Arrangementer
        </button>
        <button
          type="button"
          className={activeTab === 'favoritter' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            navigateToTab('favoritter')
          }}
        >
          Favoritter
        </button>
        <button
          type="button"
          className={activeTab === 'profil' ? styles.navItemActive : styles.navItem}
          onClick={() => {
            navigateToTab('profil')
          }}
        >
          Profil
        </button>
      </>
    )
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    if (!createName.trim()) {
      setErrorMessage('Skriv inn et navn på arrangementet.')
      return
    }

    setCreatePending(true)
    try {
      const created = await createEvent(createName.trim())
      setCreateName('')
      navigateToTab('arrangement', { eventId: created.id })
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
      setErrorMessage('Fyll inn både arrangement-ID og bli-med-kode.')
      return
    }

    setJoinPending(true)
    try {
      const result = await joinEvent(joinEventId.trim(), joinCode.trim())
      await loadEventWorkspace(result.eventId)
      navigateToTab('arrangement', { eventId: result.eventId })
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
      navigateToTab('arrangement', { eventId })
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    }
  }

  async function handleOpenFavoriteWorkspace(eventId: string) {
    setFeedbackMessage(null)
    setErrorMessage(null)
    navigateToTab('arrangement', { eventId })

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
      setErrorMessage('Velg et arrangement først.')
      return
    }

    if (!beerName.trim()) {
      setErrorMessage('Skriv inn et navn på øl.')
      return
    }

    let abvValue: number | null = null
    if (beerAbv.trim()) {
      const parsed = Number(beerAbv.replace(',', '.'))
      if (!Number.isFinite(parsed)) {
        setErrorMessage('ABV må være et gyldig tall, for eksempel 5.2.')
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
      setFeedbackMessage('Øl lagt til i arrangementet.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setAddBeerPending(false)
    }
  }

  function handleToggleBeerPanel(beerId: string) {
    setSelectedBeerId((previous) => (previous === beerId ? '' : beerId))
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    if (!selectedEvent || !selectedBeer) {
      setErrorMessage('Velg et arrangement og en øl først.')
      return
    }

    const payload = {
      colorScore: reviewColorScore,
      smellScore: reviewSmellScore,
      tasteScore: reviewTasteScore,
      totalScore: reviewTotalScore,
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

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage(null)
    setErrorMessage(null)

    const trimmedNickname = profileNickname.trim()

    if (!trimmedNickname) {
      setErrorMessage('Kallenavn kan ikke være tomt.')
      return
    }

    if (trimmedNickname.length > 100) {
      setErrorMessage('Kallenavn kan ikke være lengre enn 100 tegn.')
      return
    }

    setProfilePending(true)
    try {
      const updatedUser = await patchCurrentUserNickname(trimmedNickname)
      setUser(updatedUser)
      setProfileNickname(updatedUser.nickname ?? trimmedNickname)
      setFeedbackMessage('Profil oppdatert.')
    } catch (error) {
      setErrorMessage(getApiMessage(error))
    } finally {
      setProfilePending(false)
    }
  }

  function renderArrangementWorkspace() {
    if (workspacePending) {
      return (
        <section className={styles.panel}>
          <p className={styles.muted}>Laster arbeidsflate...</p>
        </section>
      )
    }

    if (!selectedEvent) {
      return null
    }

    return (
      <>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Arrangement</h2>
            <button
              type="button"
              className={styles.iconButtonSecondary}
              aria-label="Tilbake til arrangementer"
              title="Tilbake til arrangementer"
              onClick={() => {
                navigateToTab('arrangement')
              }}
            >
              <svg className={styles.iconButtonArrow} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 6 9 12l6 6" />
              </svg>
            </button>
          </div>
          <p className={styles.eventName}>{selectedEvent.name}</p>
          <p className={styles.eventMeta}>Arrangement-ID: {selectedEvent.id}</p>
          <p className={styles.eventMeta}>Bli-med-kode: {selectedEvent.joinCode}</p>
          <p className={styles.eventMeta}>Status: {STATUS_LABELS[selectedEvent.status] ?? 'Ukjent'}</p>
          <p className={styles.eventMeta}>Din rolle: {getEventRoleLabel(selectedEvent.currentUserRole)}</p>
          <p className={styles.eventMeta}>Deltakere: {selectedEvent.participants.length}</p>
          {canManageEvent ? (
            <div className={styles.workspaceActions}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  void handleEventStatusChange(selectedEvent.status === 2 ? 'open' : 'closed')
                }}
                disabled={workspaceActionPending}
              >
                {selectedEvent.status === 2 ? 'Åpne arrangement' : 'Lukk arrangement'}
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  void handleDeleteEvent()
                }}
                disabled={workspaceActionPending}
              >
                {deleteEventPending ? 'Sletter...' : 'Slett arrangement'}
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
          <h2 className={styles.sectionTitle}>Øl i arrangementet</h2>
          {beerList.length ? (
            <ul className={styles.beerList}>
              {beerList.map((beer) => (
                <li key={beer.id} className={beer.id === selectedBeerId ? styles.beerRowActive : styles.beerRow}>
                  <div className={styles.beerRowHeader}>
                    <button
                      type="button"
                      className={styles.beerAccordionTrigger}
                      id={`beer-review-trigger-${beer.id}`}
                      aria-expanded={beer.id === selectedBeerId}
                      aria-controls={`beer-review-panel-${beer.id}`}
                      onClick={() => {
                        handleToggleBeerPanel(beer.id)
                      }}
                    >
                      <span className={styles.beerRowBody}>
                        <span className={styles.eventName}>{beer.name}</span>
                        <span className={styles.eventMeta}>
                          {[beer.brewery, beer.style, beer.abv !== null ? `${beer.abv}%` : null]
                            .filter(Boolean)
                            .join(' · ') || 'Ingen detaljer'}
                        </span>
                        {favoriteBeerIdSet.has(beer.id) ? <span className={styles.favoriteMeta}>Favoritt</span> : null}
                      </span>
                      <span className={styles.beerAccordionHint}>{beer.id === selectedBeerId ? 'Skjul vurdering' : 'Vis vurdering'}</span>
                    </button>

                    <button
                      type="button"
                      className={styles.favoriteButton}
                      onClick={() => {
                        void handleToggleFavorite(beer.id, beer.name)
                      }}
                      disabled={favoritePendingBeerIdSet.has(beer.id)}
                      aria-label={favoriteBeerIdSet.has(beer.id) ? `Fjern favoritt for ${beer.name}` : `Lagre ${beer.name} som favoritt`}
                      aria-pressed={favoriteBeerIdSet.has(beer.id)}
                      aria-busy={favoritePendingBeerIdSet.has(beer.id)}
                      title={favoriteBeerIdSet.has(beer.id) ? 'Markert som favoritt' : 'Ikke markert som favoritt'}
                    >
                      <svg className={styles.favoriteIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.96 5.96 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
                      </svg>
                      {favoritePendingBeerIdSet.has(beer.id) ? <span className={styles.srOnly}>Lagrer...</span> : null}
                    </button>
                  </div>

                  {beer.id === selectedBeerId ? (
                    <div
                      id={`beer-review-panel-${beer.id}`}
                      className={styles.beerAccordionPanel}
                      role="region"
                      aria-labelledby={`beer-review-trigger-${beer.id}`}
                    >
                      <form className={styles.form} onSubmit={handleReviewSubmit}>
                        <StarScoreSlider
                          id="review-color-score"
                          label="Farge"
                          value={reviewColorScore}
                          onChange={setReviewColorScore}
                          disabled={reviewPending}
                        />

                        <StarScoreSlider
                          id="review-smell-score"
                          label="Lukt"
                          value={reviewSmellScore}
                          onChange={setReviewSmellScore}
                          disabled={reviewPending}
                        />

                        <StarScoreSlider
                          id="review-taste-score"
                          label="Smak"
                          value={reviewTasteScore}
                          onChange={setReviewTasteScore}
                          disabled={reviewPending}
                        />

                        <StarScoreSlider
                          id="review-total-score"
                          label="Total"
                          value={reviewTotalScore}
                          onChange={setReviewTotalScore}
                          disabled={reviewPending}
                        />

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
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Ingen øl registrert ennå.</p>
          )}

          <div className={styles.addBeerHeader}>
            <p className={styles.label}>Legg til øl</p>
            <button
              type="button"
              className={styles.addBeerToggle}
              aria-expanded={isAddBeerFormOpen}
              aria-controls="add-beer-form"
              aria-label={isAddBeerFormOpen ? 'Skjul legg til øl' : 'Vis legg til øl'}
              onClick={() => {
                setIsAddBeerFormOpen((previous) => !previous)
              }}
            >
              {isAddBeerFormOpen ? (
                <svg className={styles.addBeerToggleIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M5 12H19" />
                </svg>
              ) : (
                <svg className={styles.addBeerToggleIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 5V19M5 12H19" />
                </svg>
              )}
            </button>
          </div>

          {isAddBeerFormOpen ? (
            <form id="add-beer-form" className={styles.form} onSubmit={handleAddBeer}>
              <label className={styles.label} htmlFor="beer-name">
                Navn på øl
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
                {addBeerPending ? 'Legger til...' : 'Legg til øl'}
              </button>
            </form>
          ) : null}
        </section>
      </>
    )
  }

  if (authState === 'loading') {
    return (
      <main className={styles.appShell}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Laster Ølsmaking</h1>
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
          <p className={styles.error}>{errorMessage ?? 'Noe gikk galt. Prøv igjen.'}</p>
          <a className={styles.buttonPrimary} href={loginUrl}>
            Logg inn på nytt
          </a>
        </section>
      </main>
    )
  }

  if (authState === 'unauthenticated') {
    return (
      <main className={styles.appShell}>
        <section className={styles.panel}>
          <p className={styles.kicker}>Ølsmaking</p>
          <h1 className={styles.title}>Logg inn for å starte smaking</h1>
          <p className={styles.muted}>Du må være innlogget for å opprette eller bli med i arrangement.</p>
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
          <p className={styles.kicker}>Ølsmaking</p>
          <h1 className={styles.title}>Hei {user?.nickname ?? 'smaker'}</h1>
        </div>
      </header>

      {isLargeScreen ? <nav className={styles.desktopNav} aria-label="Hovednavigasjon">{renderPrimaryNavItems()}</nav> : null}

      {feedbackMessage ? <p className={styles.success}>{feedbackMessage}</p> : null}
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

      {activeTab === 'oversikt' ? (
        <>
          <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>Oversikt</h2>
            <p className={styles.muted}>Du har {myEventList.length} egne arrangementer og {favoriteList.length} favoritter.</p>
            <div className={styles.workspaceActions}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  navigateToTab('arrangement')
                }}
              >
                Se arrangementer
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  navigateToTab('favoritter')
                }}
              >
                Se favoritter
              </button>
            </div>
          </section>

          <section className={styles.panel}>
            <EventListPanel
              title="Arrangementer"
              filter={overviewFilter}
              events={overviewList}
              onFilterChange={setOverviewFilter}
              onOpenEvent={(eventId) => {
                void handleSelectEvent(eventId)
              }}
              getStatusLabel={(status) => STATUS_LABELS[status] ?? 'Ukjent'}
              emptyMineText="Ingen arrangementer ennå. Gå til Arrangementer for å opprette et nytt."
              emptyOpenText="Ingen åpne arrangementer akkurat nå."
              classes={{
                sectionHeader: styles.sectionHeader,
                sectionTitle: styles.sectionTitle,
                filterTabs: styles.filterTabs,
                filterTab: styles.filterTab,
                filterTabActive: styles.filterTabActive,
                eventList: styles.eventList,
                eventRow: styles.eventRow,
                eventName: styles.eventName,
                eventMeta: styles.eventMeta,
                buttonSecondary: styles.buttonSecondary,
                muted: styles.muted,
              }}
            />
          </section>
        </>
      ) : activeTab === 'arrangement' ? (
        isArrangementEventRoute ? (
          renderArrangementWorkspace()
        ) : (
          <>
            <section className={styles.panel}>
              <EventListPanel
                title="Arrangementer"
                filter={overviewFilter}
                events={overviewList}
                onFilterChange={setOverviewFilter}
                onOpenEvent={(eventId) => {
                  void handleSelectEvent(eventId)
                }}
                getStatusLabel={(status) => STATUS_LABELS[status] ?? 'Ukjent'}
                emptyMineText="Ingen arrangementer ennå. Opprett et nytt for å starte."
                emptyOpenText="Ingen åpne arrangementer akkurat nå."
                classes={{
                  sectionHeader: styles.sectionHeader,
                  sectionTitle: styles.sectionTitle,
                  filterTabs: styles.filterTabs,
                  filterTab: styles.filterTab,
                  filterTabActive: styles.filterTabActive,
                  eventList: styles.eventList,
                  eventRow: styles.eventRow,
                  eventName: styles.eventName,
                  eventMeta: styles.eventMeta,
                  buttonSecondary: styles.buttonSecondary,
                  muted: styles.muted,
                }}
              />
            </section>

            <section className={styles.panel}>
              <h2 className={styles.sectionTitle}>Opprett arrangement</h2>
              <form className={styles.form} onSubmit={handleCreate}>
                <label className={styles.label} htmlFor="event-name">
                  Navn på arrangement
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
        )
      ) : activeTab === 'favoritter' ? (
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Favoritter</h2>
          {favoritesPending && favoriteList.length ? <p className={styles.refreshHint}>Oppdaterer favoritter...</p> : null}
          {favoritesPending && !favoriteList.length ? (
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
                      void handleOpenFavoriteWorkspace(favorite.eventId)
                    }}
                  >
                    Åpne event
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Ingen favoritter ennå.</p>
          )}
        </section>
      ) : activeTab === 'profil' ? (
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Profil</h2>
          <div className={styles.profileField}>
            <p className={styles.label}>E-post</p>
            <p className={styles.readOnlyValue}>{user?.email ?? 'Ingen e-post registrert'}</p>
          </div>

          <form className={styles.form} onSubmit={handleProfileSubmit}>
            <label className={styles.label} htmlFor="profile-nickname">
              Kallenavn
            </label>
            <input
              id="profile-nickname"
              className={styles.input}
              value={profileNickname}
              onChange={(event) => {
                setProfileNickname(event.target.value)
              }}
              maxLength={100}
              placeholder="Slik vises navnet ditt i appen"
            />

            <button type="submit" className={styles.buttonPrimary} disabled={profilePending}>
              {profilePending ? 'Lagrer...' : 'Lagre profil'}
            </button>
          </form>

          <form className={styles.form} method="post" action={logoutUrl}>
            <button type="submit" className={styles.buttonSecondary}>
              Logg ut
            </button>
          </form>
        </section>
      ) : null}

      {!isLargeScreen ? <nav className={styles.bottomNav} aria-label="Hovednavigasjon">{renderPrimaryNavItems()}</nav> : null}

      {!isLargeScreen ? <div className={styles.navSpacer} /> : null}
    </main>
  )
}

export default App
