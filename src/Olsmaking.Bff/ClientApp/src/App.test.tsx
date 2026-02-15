import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type QueuedResponse = {
  method?: string
  url: string
  response: Response
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function emptyResponse(status = 200): Response {
  return new Response(null, { status })
}

function responseKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function installFetchMock(queuedResponses: QueuedResponse[]) {
  const queue = new Map<string, Response[]>()

  for (const queuedResponse of queuedResponses) {
    const key = responseKey(queuedResponse.method ?? 'GET', queuedResponse.url)
    const bucket = queue.get(key) ?? []
    bucket.push(queuedResponse.response)
    queue.set(key, bucket)
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const url = requestUrl(input)
    const key = responseKey(method, url)
    const bucket = queue.get(key)

    if (!bucket?.length) {
      throw new Error(`Missing mock response for ${key}`)
    }

    const nextResponse = bucket.shift()
    if (!nextResponse) {
      throw new Error(`Response queue was empty for ${key}`)
    }

    return nextResponse
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function getCallByMethodAndPath(fetchMock: ReturnType<typeof vi.fn>, method: string, path: string) {
  return fetchMock.mock.calls.find((call) => {
    const url = requestUrl(call[0] as RequestInfo | URL)
    const init = call[1] as RequestInit | undefined
    return (init?.method ?? 'GET').toUpperCase() === method.toUpperCase() && url === path
  })
}

const currentUser = {
  id: 'user-1',
  subject: 'auth0|user-1',
  email: 'test@example.com',
  nickname: 'Testbruker',
  isAdmin: false,
}

const myEvent = {
  id: 'event-1',
  name: 'Min smaking',
  status: 1,
  visibility: 1,
  isListed: true,
  ownerUserId: 'user-1',
  updatedUtc: '2026-01-01T10:00:00Z',
  createdUtc: '2026-01-01T09:00:00Z',
}

const openEvent = {
  id: 'event-open-1',
  name: 'Åpen smaking',
  status: 1,
  visibility: 1,
  isListed: true,
  ownerUserId: 'user-2',
  updatedUtc: '2026-01-02T10:00:00Z',
  createdUtc: '2026-01-02T09:00:00Z',
}

const eventDetails = {
  id: 'event-1',
  name: 'Min smaking',
  status: 1,
  visibility: 1,
  isListed: true,
  joinCode: 'ABCD1234',
  ownerUserId: 'user-1',
  createdUtc: '2026-01-01T09:00:00Z',
  updatedUtc: '2026-01-01T10:00:00Z',
  currentUserRole: 'owner',
  participants: [
    {
      userId: 'user-1',
      role: 2,
      status: 1,
      joinedUtc: '2026-01-01T10:00:00Z',
      removedUtc: null,
      nickname: 'Testbruker',
    },
  ],
}

const managedEventDetails = {
  ...eventDetails,
  participants: [
    {
      userId: 'user-1',
      role: 2,
      status: 1,
      joinedUtc: '2026-01-01T10:00:00Z',
      removedUtc: null,
      nickname: 'Testbruker',
    },
    {
      userId: 'user-2',
      role: 1,
      status: 1,
      joinedUtc: '2026-01-01T10:10:00Z',
      removedUtc: null,
      nickname: 'Deltaker to',
    },
    {
      userId: 'user-3',
      role: 1,
      status: 2,
      joinedUtc: '2026-01-01T10:20:00Z',
      removedUtc: '2026-01-01T10:30:00Z',
      nickname: 'Deltaker tre',
    },
  ],
}

const beers = [
  {
    id: 'beer-1',
    eventId: 'event-1',
    name: 'Pale Ale',
    brewery: 'Bryggeri 1',
    style: 'Pale Ale',
    abv: 5.1,
    createdUtc: '2026-01-01T10:30:00Z',
  },
]

const beersWithTwoEntries = [
  ...beers,
  {
    id: 'beer-2',
    eventId: 'event-1',
    name: 'Amber Lager',
    brewery: 'Bryggeri 2',
    style: 'Lager',
    abv: 4.8,
    createdUtc: '2026-01-01T10:40:00Z',
  },
]

const favorites = [
  {
    eventId: 'event-1',
    eventName: 'Min smaking',
    beerId: 'beer-1',
    beerName: 'Pale Ale',
    brewery: 'Bryggeri 1',
    style: 'Pale Ale',
    abv: 5.1,
    favoritedUtc: '2026-01-03T12:15:00Z',
    eventStatus: 1,
  },
]

describe('App core flows', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('hydrates my events and shows open discovery filter', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    expect(await screen.findByText('Min smaking')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Åpne' }))
    expect(await screen.findByText('Åpen smaking')).toBeInTheDocument()
  })

  it('opens overview when app boots on /oversikt', async () => {
    window.history.pushState({}, '', '/oversikt')

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
    ])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Arrangementer' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/oversikt')
  })

  it('hydrates workspace when app boots on /arrangementer/<id>', async () => {
    window.history.pushState({}, '', '/arrangementer/event-1')

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
  })

  it('shows back button in single-event mode and returns to arrangement list', async () => {
    window.history.pushState({}, '', '/arrangementer/event-1')

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Tilbake til arrangementer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vis' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tilbake til arrangementer' }))

    expect(window.location.pathname).toBe('/arrangementer')
    expect(await screen.findByRole('heading', { name: 'Arrangementer' })).toBeInTheDocument()
  })

  it('renders plain overview when app boots on /oversikt?eventId=<id>', async () => {
    window.history.pushState({}, '', '/oversikt?eventId=event-1')

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
    ])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Arrangementer' })).toBeInTheDocument()
    expect(screen.queryByText('Bli-med-kode: ABCD1234')).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/oversikt')
    expect(window.location.search).toBe('')
  })

  it('shows dedicated error when deep-linked event is forbidden', async () => {
    window.history.pushState({}, '', '/arrangementer/event-1')

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse({ title: 'Forbidden' }, 403) },
      { url: '/api/events/event-1/beers', response: jsonResponse({ title: 'Forbidden' }, 403) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse({ title: 'Forbidden' }, 403) },
    ])

    render(<App />)

    expect(await screen.findByText('Du har ikke tilgang til arrangementet i lenken.')).toBeInTheDocument()
  })

  it('keeps deep-link returnUrl for unauthenticated users', async () => {
    window.history.pushState({}, '', '/arrangementer/event-1')

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse({ title: 'Unauthorized' }, 401) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
    ])

    render(<App />)

    const loginLink = await screen.findByRole('link', { name: 'Logg inn' })
    expect(loginLink).toHaveAttribute('href', '/api/auth/login?returnUrl=%2Farrangementer%2Fevent-1')
  })

  it('updates URL on tab click and syncs tab from popstate', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
    ])

    render(<App />)

    await screen.findByRole('heading', { name: 'Oversikt' })
    expect(screen.queryByRole('button', { name: 'Smakinger' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Oversikt' }))
    expect(window.location.pathname).toBe('/oversikt')
    expect(await screen.findByRole('heading', { name: 'Arrangementer' })).toBeInTheDocument()

    window.history.pushState({}, '', '/profil')
    fireEvent(window, new PopStateEvent('popstate'))

    expect(await screen.findByRole('heading', { name: 'Profil' })).toBeInTheDocument()
  })

  it('shows favorites from the global favorites endpoint', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse(favorites) },
      { url: '/api/favorites/mine', response: jsonResponse(favorites) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Favoritter' }))

    expect(await screen.findByText('Pale Ale')).toBeInTheDocument()
    expect(screen.getByText('Arrangement: Min smaking')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Åpne event' })).toBeInTheDocument()
  })

  it('refreshes favorites when opening favorites tab after initial hydrate', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse(favorites) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Favoritter' }))

    expect(await screen.findByText('Pale Ale')).toBeInTheDocument()
  })

  it('renders profile tab with read-only email and prefilled nickname', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Profil' }))

    expect(await screen.findByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Kallenavn')).toHaveValue('Testbruker')

    const logoutButton = screen.getByRole('button', { name: 'Logg ut' })
    const logoutForm = logoutButton.closest('form')
    expect(logoutForm).toHaveAttribute('method', 'post')
    expect(logoutForm).toHaveAttribute('action', '/api/auth/logout?returnUrl=%2Fprofil')
    expect(screen.queryByRole('link', { name: 'Bytt konto' })).not.toBeInTheDocument()
  })

  it('submits nickname update via PATCH and shows confirmation', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      {
        method: 'PATCH',
        url: '/api/users/me',
        response: jsonResponse({
          ...currentUser,
          nickname: 'Nytt navn',
        }),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Profil' }))
    fireEvent.change(await screen.findByLabelText('Kallenavn'), { target: { value: 'Nytt navn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lagre profil' }))

    expect(await screen.findByText('Profil oppdatert.')).toBeInTheDocument()

    const patchCall = getCallByMethodAndPath(fetchMock, 'PATCH', '/api/users/me')
    expect(patchCall).toBeTruthy()
    expect((patchCall?.[1] as RequestInit | undefined)?.body).toBe(
      JSON.stringify({
        nickname: 'Nytt navn',
      }),
    )
  })

  it('opens event workspace from selected favorite card', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse(favorites) },
      { url: '/api/favorites/mine', response: jsonResponse(favorites) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse(['beer-1']) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Favoritter' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Åpne event' }))

    expect(window.location.pathname).toBe('/arrangementer/event-1')
    expect(window.location.search).toBe('')

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'GET', '/api/events/event-1')).toBeTruthy()
      expect(getCallByMethodAndPath(fetchMock, 'GET', '/api/events/event-1/beers')).toBeTruthy()
      expect(getCallByMethodAndPath(fetchMock, 'GET', '/api/events/event-1/favorites/me')).toBeTruthy()
    })

    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
  })

  it('joins an event and loads workspace', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      {
        method: 'POST',
        url: '/api/events/event-1/join',
        response: jsonResponse({ eventId: 'event-1', userId: 'user-1', joined: true }),
      },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.change(screen.getByLabelText('Arrangement-ID'), { target: { value: 'event-1' } })
    fireEvent.change(screen.getByLabelText('Bli-med-kode'), { target: { value: 'ABCD1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bli med' }))

    expect(await screen.findByText('Du ble med i arrangementet.')).toBeInTheDocument()
    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/arrangementer/event-1')
    expect(window.location.search).toBe('')
  })

  it('loads workspace when event favorites endpoint returns 500', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse({ title: 'Server error' }, 500) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
    expect(screen.queryByText('Tjenesten er midlertidig utilgjengelig.')).not.toBeInTheDocument()
  })

  it('does not show global error when review lookup returns 500', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      { url: '/api/events/event-1/beers/beer-1/reviews/me', response: jsonResponse({ title: 'Server error' }, 500) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Tjenesten er midlertidig utilgjengelig.')).not.toBeInTheDocument()
    })
  })

  it('sends POST then DELETE when toggling favorite', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'POST',
        url: '/api/events/event-1/beers/beer-1/favorite',
        response: emptyResponse(204),
      },
      {
        method: 'DELETE',
        url: '/api/events/event-1/beers/beer-1/favorite',
        response: emptyResponse(204),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/arrangementer/event-1')
      expect(window.location.search).toBe('')
    })

    const addButton = await screen.findByRole('button', { name: 'Lagre Pale Ale som favoritt' })
    expect(addButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers/beer-1/favorite')).toBeTruthy()
    })

    expect(await screen.findByRole('button', { name: 'Fjern favoritt for Pale Ale' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(await screen.findByRole('button', { name: 'Fjern favoritt for Pale Ale' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1/beers/beer-1/favorite')).toBeTruthy()
    })

    expect(await screen.findByRole('button', { name: 'Lagre Pale Ale som favoritt' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets owner close event via status endpoint', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'PATCH',
        url: '/api/events/event-1/status',
        response: emptyResponse(200),
      },
      {
        url: '/api/events/event-1',
        response: jsonResponse({
          ...managedEventDetails,
          status: 2,
        }),
      },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Lukk arrangement' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'PATCH', '/api/events/event-1/status')).toBeTruthy()
    })
  })

  it('deletes event when confirmed', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'DELETE',
        url: '/api/events/event-1',
        response: emptyResponse(204),
      },
    ])

    const confirmMock = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmMock)
    window.history.pushState({}, '', '/arrangementer/event-1')

    render(<App />)

    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Slett arrangement' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1')).toBeTruthy()
    })

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Arrangementet er slettet.')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/arrangementer')
    expect(window.location.search).toBe('')
    await waitFor(() => {
      expect(screen.queryByText('Bli-med-kode: ABCD1234')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Arrangementet i lenken finnes ikke lenger.')).not.toBeInTheDocument()
  })

  it('does not delete event when confirmation is cancelled', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    const confirmMock = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Slett arrangement' }))

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1')).toBeFalsy()
    expect(screen.getByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
  })

  it('removes beer for event owner when confirmed', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'DELETE',
        url: '/api/events/event-1/beers/beer-1',
        response: emptyResponse(204),
      },
    ])

    const confirmMock = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fjern Pale Ale fra arrangementet' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1/beers/beer-1')).toBeTruthy()
    })

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Pale Ale er fjernet fra arrangementet.')).toBeInTheDocument()
    expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument()
  })

  it('does not remove beer when confirmation is cancelled', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    const confirmMock = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fjern Pale Ale fra arrangementet' }))

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1/beers/beer-1')).toBeFalsy()
    expect(screen.getByText('Pale Ale')).toBeInTheDocument()
  })

  it('hides remove beer action for members', async () => {
    const memberEventDetails = {
      ...eventDetails,
      ownerUserId: 'owner-user-2',
      currentUserRole: 'member',
      participants: [
        {
          userId: 'user-1',
          role: 1,
          status: 1,
          joinedUtc: '2026-01-01T10:00:00Z',
          removedUtc: null,
          nickname: 'Testbruker',
        },
      ],
    }

    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(memberEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    expect(screen.queryByRole('button', { name: /Fjern .* fra arrangementet/i })).not.toBeInTheDocument()
  })

  it('shows inline error when delete is blocked by reviews', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'DELETE',
        url: '/api/events/event-1/beers/beer-1',
        response: jsonResponse({ title: 'Beer cannot be removed' }, 409),
      },
    ])

    const confirmMock = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fjern Pale Ale fra arrangementet' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1/beers/beer-1')).toBeTruthy()
    })

    expect(await screen.findByText('Kan ikke fjerne ølet fordi det allerede har vurderinger.')).toBeInTheDocument()
  })

  it('lets owner remove and restore participants', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(managedEventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'DELETE',
        url: '/api/events/event-1/participants/user-2',
        response: emptyResponse(204),
      },
      {
        url: '/api/events/event-1',
        response: jsonResponse(managedEventDetails),
      },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        method: 'POST',
        url: '/api/events/event-1/participants/user-3/restore',
        response: emptyResponse(204),
      },
      {
        url: '/api/events/event-1',
        response: jsonResponse(managedEventDetails),
      },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fjern' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1/participants/user-2')).toBeTruthy()
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Gjenopprett' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/participants/user-3/restore')).toBeTruthy()
    })
  })

  it('falls back to POST review when PATCH returns 404', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'PATCH',
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'POST',
        url: '/api/events/event-1/beers/beer-1/reviews',
        response: jsonResponse({
          id: 'review-1',
          eventId: 'event-1',
          beerId: 'beer-1',
          userId: 'user-1',
          colorScore: 5,
          smellScore: 5,
          tasteScore: 5,
          totalScore: 5,
          notes: 'God balanse',
          aromaNotes: 'Sitrus',
          appearanceNotes: 'Gylden',
          flavorNotes: 'Frisk avslutning',
          createdUtc: '2026-01-01T12:00:00Z',
          updatedUtc: '2026-01-01T12:00:00Z',
        }),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    fireEvent.click(await screen.findByRole('radio', { name: 'Farge 5 av 6' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Lukt 5 av 6' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Smak 5 av 6' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Total 5 av 6' }))
    fireEvent.change(screen.getByLabelText('Notater'), { target: { value: 'God balanse' } })
    fireEvent.change(screen.getByLabelText('Aroma (valgfritt)'), { target: { value: 'Sitrus' } })
    fireEvent.change(screen.getByLabelText('Utseende (valgfritt)'), { target: { value: 'Gylden' } })
    fireEvent.change(screen.getByLabelText('Smak (valgfritt)'), { target: { value: 'Frisk avslutning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lagre vurdering' }))

    expect(await screen.findByText('Vurdering lagret.')).toBeInTheDocument()

    const patchCall = getCallByMethodAndPath(fetchMock, 'PATCH', '/api/events/event-1/beers/beer-1/reviews/me')
    const postCall = getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers/beer-1/reviews')

    expect(patchCall).toBeTruthy()
    expect(postCall).toBeTruthy()

    const patchBody = (patchCall?.[1] as RequestInit | undefined)?.body
    const postBody = (postCall?.[1] as RequestInit | undefined)?.body

    expect(patchBody).toBe(
      JSON.stringify({
        colorScore: 5,
        smellScore: 5,
        tasteScore: 5,
        totalScore: 5,
        notes: 'God balanse',
        aromaNotes: 'Sitrus',
        appearanceNotes: 'Gylden',
        flavorNotes: 'Frisk avslutning',
      }),
    )
    expect(postBody).toBe(
      JSON.stringify({
        colorScore: 5,
        smellScore: 5,
        tasteScore: 5,
        totalScore: 5,
        notes: 'God balanse',
        aromaNotes: 'Sitrus',
        appearanceNotes: 'Gylden',
        flavorNotes: 'Frisk avslutning',
      }),
    )
  })

  it('allows zero-open beer accordion with max one panel open', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beersWithTwoEntries) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        url: '/api/events/event-1/beers/beer-2/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    expect(await screen.findByRole('button', { name: /Pale Ale[\s\S]*Skjul vurdering/i })).toBeInTheDocument()
    expect(document.getElementById('beer-review-panel-beer-1')).toBeInTheDocument()
    expect(document.getElementById('beer-review-panel-beer-2')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Amber Lager[\s\S]*Vis vurdering/i }))

    await waitFor(() => {
      expect(document.getElementById('beer-review-panel-beer-1')).not.toBeInTheDocument()
      expect(document.getElementById('beer-review-panel-beer-2')).toBeInTheDocument()
    })

    fireEvent.click(await screen.findByRole('button', { name: /Amber Lager[\s\S]*Skjul vurdering/i }))

    await waitFor(() => {
      expect(document.getElementById('beer-review-panel-beer-1')).not.toBeInTheDocument()
      expect(document.getElementById('beer-review-panel-beer-2')).not.toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Lagre vurdering' })).not.toBeInTheDocument()
  })

  it('toggles add beer form with + and X and keeps it open after add', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'POST',
        url: '/api/events/event-1/beers',
        response: jsonResponse({
          id: 'beer-2',
          eventId: 'event-1',
          name: 'New IPA',
          brewery: null,
          style: null,
          abv: null,
          createdUtc: '2026-01-01T11:00:00Z',
        }),
      },
      {
        url: '/api/events/event-1/beers/beer-2/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    expect(screen.queryByLabelText('Navn på øl')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Vis legg til øl' }))

    expect(await screen.findByLabelText('Navn på øl')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skjul legg til øl' }))
    expect(screen.queryByLabelText('Navn på øl')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vis legg til øl' }))
    fireEvent.change(await screen.findByLabelText('Navn på øl'), { target: { value: 'New IPA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Legg til øl' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers')).toBeTruthy()
    })

    expect(await screen.findByRole('button', { name: 'Skjul legg til øl' })).toBeInTheDocument()
    expect(screen.getByLabelText('Navn på øl')).toHaveValue('')
  })

  it('submits selected preset style when adding beer', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'POST',
        url: '/api/events/event-1/beers',
        response: jsonResponse({
          id: 'beer-2',
          eventId: 'event-1',
          name: 'Ny surøl',
          brewery: null,
          style: 'Surøl',
          abv: null,
          createdUtc: '2026-01-01T11:00:00Z',
        }),
      },
      {
        url: '/api/events/event-1/beers/beer-2/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Vis legg til øl' }))
    fireEvent.change(await screen.findByLabelText('Navn på øl'), { target: { value: 'Ny surøl' } })
    fireEvent.change(screen.getByLabelText('Stil (valgfritt)'), { target: { value: 'Surøl' } })
    fireEvent.click(screen.getByRole('button', { name: 'Legg til øl' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers')).toBeTruthy()
    })

    const createBeerCall = getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers')
    const requestBody = JSON.parse((((createBeerCall?.[1] as RequestInit | undefined)?.body ?? '{}') as string)) as {
      style?: string | null
    }

    expect(requestBody.style).toBe('Surøl')
  })

  it('submits custom style when Annet is selected', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'POST',
        url: '/api/events/event-1/beers',
        response: jsonResponse({
          id: 'beer-2',
          eventId: 'event-1',
          name: 'Funky one-off',
          brewery: null,
          style: 'Farmhouse Hybrid',
          abv: null,
          createdUtc: '2026-01-01T11:00:00Z',
        }),
      },
      {
        url: '/api/events/event-1/beers/beer-2/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Vis legg til øl' }))
    fireEvent.change(await screen.findByLabelText('Navn på øl'), { target: { value: 'Funky one-off' } })
    fireEvent.change(screen.getByLabelText('Stil (valgfritt)'), { target: { value: 'Annet' } })
    fireEvent.change(await screen.findByLabelText('Egendefinert stil'), { target: { value: 'Farmhouse Hybrid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Legg til øl' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers')).toBeTruthy()
    })

    const createBeerCall = getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers')
    const requestBody = JSON.parse((((createBeerCall?.[1] as RequestInit | undefined)?.body ?? '{}') as string)) as {
      style?: string | null
    }

    expect(requestBody.style).toBe('Farmhouse Hybrid')
  })

  it('shows validation error when Annet is selected without custom style', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
      { url: '/api/favorites/mine', response: jsonResponse([]) },
      { url: '/api/events/event-1', response: jsonResponse(eventDetails) },
      { url: '/api/events/event-1/beers', response: jsonResponse(beers) },
      { url: '/api/events/event-1/favorites/me', response: jsonResponse([]) },
      {
        url: '/api/events/event-1/beers/beer-1/reviews/me',
        response: jsonResponse({ title: 'Fant ikke vurdering' }, 404),
      },
      {
        method: 'POST',
        url: '/api/events/event-1/beers',
        response: jsonResponse({
          id: 'beer-2',
          eventId: 'event-1',
          name: 'Skal ikke opprettes',
          brewery: null,
          style: 'Ugyldig',
          abv: null,
          createdUtc: '2026-01-01T11:00:00Z',
        }),
      },
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangementer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Vis legg til øl' }))
    fireEvent.change(await screen.findByLabelText('Navn på øl'), { target: { value: 'Udefinert stil' } })
    fireEvent.change(screen.getByLabelText('Stil (valgfritt)'), { target: { value: 'Annet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Legg til øl' }))

    expect(await screen.findByText('Skriv inn en stil når du velger Annet.')).toBeInTheDocument()
    expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers')).toBeFalsy()
  })
})
