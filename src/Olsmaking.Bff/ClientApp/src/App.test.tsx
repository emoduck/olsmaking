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
  name: 'Apen smaking',
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
  currentUserRole: 'Owner',
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
    ])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Oversikt' }))
    expect(await screen.findByText('Min smaking')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Apne' }))
    expect(await screen.findByText('Apen smaking')).toBeInTheDocument()
  })

  it('joins an event and loads workspace', async () => {
    installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([openEvent]) },
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

    fireEvent.click(await screen.findByRole('button', { name: 'Arrangement' }))
    fireEvent.change(screen.getByLabelText('Arrangement-ID'), { target: { value: 'event-1' } })
    fireEvent.change(screen.getByLabelText('Bli-med-kode'), { target: { value: 'ABCD1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bli med' }))

    expect(await screen.findByText('Du ble med i arrangementet.')).toBeInTheDocument()
    expect(await screen.findByText('Bli-med-kode: ABCD1234')).toBeInTheDocument()
  })

  it('sends POST then DELETE when toggling favorite', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
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

    fireEvent.click(await screen.findByRole('button', { name: 'Oversikt' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    const addButton = await screen.findByRole('button', { name: 'Lagre Pale Ale som favoritt' })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'POST', '/api/events/event-1/beers/beer-1/favorite')).toBeTruthy()
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Fjern favoritt for Pale Ale' }))

    await waitFor(() => {
      expect(getCallByMethodAndPath(fetchMock, 'DELETE', '/api/events/event-1/beers/beer-1/favorite')).toBeTruthy()
    })
  })

  it('falls back to POST review when PATCH returns 404', async () => {
    const fetchMock = installFetchMock([
      { url: '/api/users/me', response: jsonResponse(currentUser) },
      { url: '/api/events/mine', response: jsonResponse([myEvent]) },
      { url: '/api/events/open', response: jsonResponse([]) },
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
          rating: 5,
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

    fireEvent.click(await screen.findByRole('button', { name: 'Oversikt' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vis' }))

    fireEvent.change(await screen.findByLabelText('Poeng: 3 / 6'), { target: { value: '5' } })
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
        rating: 5,
        notes: 'God balanse',
        aromaNotes: 'Sitrus',
        appearanceNotes: 'Gylden',
        flavorNotes: 'Frisk avslutning',
      }),
    )
    expect(postBody).toBe(
      JSON.stringify({
        rating: 5,
        notes: 'God balanse',
        aromaNotes: 'Sitrus',
        appearanceNotes: 'Gylden',
        flavorNotes: 'Frisk avslutning',
      }),
    )
  })
})
