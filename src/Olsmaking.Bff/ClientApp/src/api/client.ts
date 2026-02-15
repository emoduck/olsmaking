export interface ApiProblemDetails {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

export class ApiClientError extends Error {
  readonly status: number
  readonly problem?: ApiProblemDetails

  constructor(status: number, message: string, problem?: ApiProblemDetails) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.problem = problem
  }
}

export interface CurrentUser {
  id: string
  subject: string
  email: string | null
  nickname: string | null
  isAdmin: boolean
}

export interface EventParticipant {
  userId: string
  role: number
  status: number
  joinedUtc: string
  removedUtc: string | null
  nickname: string | null
}

export interface EventDetails {
  id: string
  name: string
  status: number
  visibility: number
  isListed: boolean
  joinCode: string
  ownerUserId: string
  createdUtc: string
  updatedUtc: string
  currentUserRole: string
  participants: EventParticipant[]
}

export interface EventSummary {
  id: string
  name: string
  status: number
  visibility: number
  isListed: boolean
  ownerUserId: string
  updatedUtc: string
  createdUtc: string
}

export interface EventBeer {
  id: string
  eventId: string
  name: string
  brewery: string | null
  style: string | null
  abv: number | null
  createdUtc: string
}

export interface FavoriteBeerSummary {
  eventId: string
  eventName: string
  beerId: string
  beerName: string
  brewery: string | null
  style: string | null
  abv: number | null
  favoritedUtc: string
  eventStatus: number
}

export interface BeerReview {
  id: string
  eventId: string
  beerId: string
  userId: string
  colorScore: number
  smellScore: number
  tasteScore: number
  totalScore: number
  notes: string | null
  aromaNotes: string | null
  appearanceNotes: string | null
  flavorNotes: string | null
  createdUtc: string
  updatedUtc: string
}

export interface CreateEventBeerRequest {
  name: string
  brewery?: string | null
  style?: string | null
  abv?: number | null
}

export interface UpsertBeerReviewRequest {
  colorScore: number
  smellScore: number
  tasteScore: number
  totalScore: number
  notes?: string | null
  aromaNotes?: string | null
  appearanceNotes?: string | null
  flavorNotes?: string | null
}

interface CreateEventResponse {
  id: string
}

export interface JoinEventResponse {
  eventId: string
  userId: string
  joined: boolean
}

function getErrorMessage(status: number, problem?: ApiProblemDetails): string {
  if (problem?.detail) {
    return problem.detail
  }

  if (problem?.title) {
    return problem.title
  }

  if (status === 401) {
    return 'Du er ikke logget inn.'
  }

  if (status === 403) {
    return 'Du har ikke tilgang til denne handlingen.'
  }

  if (status >= 500) {
    return 'Tjenesten er midlertidig utilgjengelig.'
  }

  return 'Noe gikk galt. Prøv igjen.'
}

async function parseProblem(response: Response): Promise<ApiProblemDetails | undefined> {
  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    return undefined
  }

  try {
    return (await response.json()) as ApiProblemDetails
  } catch {
    return undefined
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    const problem = await parseProblem(response)
    throw new ApiClientError(response.status, getErrorMessage(response.status, problem), problem)
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    throw new ApiClientError(
      502,
      'Uventet svar fra serveren. Kontroller at backend er startet og at lokal proxy er aktiv.',
    )
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiClientError(502, 'Kunne ikke tolke svaret fra serveren. Prøv igjen.')
  }
}

async function requestVoid(url: string, init?: RequestInit): Promise<void> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    const problem = await parseProblem(response)
    throw new ApiClientError(response.status, getErrorMessage(response.status, problem), problem)
  }
}

export function buildLoginUrl(returnUrl = window.location.pathname + window.location.search): string {
  const safeReturnUrl = returnUrl === '/signin-oidc' || returnUrl === '/signout-callback-oidc' ? '/' : returnUrl
  const params = new URLSearchParams({ returnUrl: safeReturnUrl })
  return `/api/auth/login?${params.toString()}`
}

export function buildLogoutUrl(returnUrl = window.location.pathname + window.location.search): string {
  const safeReturnUrl = returnUrl === '/signin-oidc' || returnUrl === '/signout-callback-oidc' ? '/' : returnUrl
  const params = new URLSearchParams({ returnUrl: safeReturnUrl })
  return `/api/auth/logout?${params.toString()}`
}

export function getCurrentUser(): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/users/me', { method: 'GET' })
}

export function patchCurrentUserNickname(nickname: string): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ nickname }),
  })
}

export async function createEvent(name: string): Promise<EventDetails> {
  const created = await requestJson<CreateEventResponse>('/api/events', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })

  return getEvent(created.id)
}

export function joinEvent(eventId: string, joinCode: string): Promise<JoinEventResponse> {
  return requestJson<JoinEventResponse>(`/api/events/${encodeURIComponent(eventId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ joinCode }),
  })
}

export function getEvent(eventId: string): Promise<EventDetails> {
  return requestJson<EventDetails>(`/api/events/${encodeURIComponent(eventId)}`, { method: 'GET' })
}

export function deleteEvent(eventId: string): Promise<void> {
  return requestVoid(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  })
}

export function patchEventStatus(eventId: string, status: 'open' | 'closed'): Promise<void> {
  return requestVoid(`/api/events/${encodeURIComponent(eventId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function removeParticipant(eventId: string, userId: string): Promise<void> {
  return requestVoid(`/api/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

export function restoreParticipant(eventId: string, userId: string): Promise<void> {
  return requestVoid(`/api/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(userId)}/restore`, {
    method: 'POST',
  })
}

export function getMyEvents(): Promise<EventSummary[]> {
  return requestJson<EventSummary[]>('/api/events/mine', { method: 'GET' })
}

export function getOpenEvents(): Promise<EventSummary[]> {
  return requestJson<EventSummary[]>('/api/events/open', { method: 'GET' })
}

export function getEventBeers(eventId: string): Promise<EventBeer[]> {
  return requestJson<EventBeer[]>(`/api/events/${encodeURIComponent(eventId)}/beers`, { method: 'GET' })
}

export function getMyEventFavorites(eventId: string): Promise<string[]> {
  return requestJson<string[]>(`/api/events/${encodeURIComponent(eventId)}/favorites/me`, { method: 'GET' })
}

export function getMyFavorites(): Promise<FavoriteBeerSummary[]> {
  return requestJson<FavoriteBeerSummary[]>('/api/favorites/mine', { method: 'GET' })
}

export function createEventBeer(eventId: string, payload: CreateEventBeerRequest): Promise<EventBeer> {
  return requestJson<EventBeer>(`/api/events/${encodeURIComponent(eventId)}/beers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createBeerReview(eventId: string, beerId: string, payload: UpsertBeerReviewRequest): Promise<BeerReview> {
  return requestJson<BeerReview>(`/api/events/${encodeURIComponent(eventId)}/beers/${encodeURIComponent(beerId)}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function addBeerFavorite(eventId: string, beerId: string): Promise<void> {
  return requestVoid(`/api/events/${encodeURIComponent(eventId)}/beers/${encodeURIComponent(beerId)}/favorite`, {
    method: 'POST',
  })
}

export function removeBeerFavorite(eventId: string, beerId: string): Promise<void> {
  return requestVoid(`/api/events/${encodeURIComponent(eventId)}/beers/${encodeURIComponent(beerId)}/favorite`, {
    method: 'DELETE',
  })
}

export function patchMyBeerReview(eventId: string, beerId: string, payload: UpsertBeerReviewRequest): Promise<BeerReview> {
  return requestJson<BeerReview>(`/api/events/${encodeURIComponent(eventId)}/beers/${encodeURIComponent(beerId)}/reviews/me`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getMyBeerReview(eventId: string, beerId: string): Promise<BeerReview> {
  return requestJson<BeerReview>(`/api/events/${encodeURIComponent(eventId)}/beers/${encodeURIComponent(beerId)}/reviews/me`, {
    method: 'GET',
  })
}
