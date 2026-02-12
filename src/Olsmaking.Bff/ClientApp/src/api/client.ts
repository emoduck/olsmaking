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

  return (await response.json()) as ApiProblemDetails
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

  return (await response.json()) as T
}

export function buildLoginUrl(returnUrl = window.location.pathname + window.location.search): string {
  const params = new URLSearchParams({ returnUrl })
  return `/api/auth/login?${params.toString()}`
}

export function getCurrentUser(): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/users/me', { method: 'GET' })
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
