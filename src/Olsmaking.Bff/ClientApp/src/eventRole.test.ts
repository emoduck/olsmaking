import { describe, expect, it } from 'vitest'
import { getEventRoleLabel } from './eventRole'

describe('getEventRoleLabel', () => {
  it('maps owner to Arrangør', () => {
    expect(getEventRoleLabel('owner')).toBe('Arrangør')
  })

  it('maps admin to Administrator', () => {
    expect(getEventRoleLabel('admin')).toBe('Administrator')
  })

  it('maps member to Deltaker', () => {
    expect(getEventRoleLabel('member')).toBe('Deltaker')
  })

  it('normalizes case and whitespace', () => {
    expect(getEventRoleLabel('  OwNeR  ')).toBe('Arrangør')
  })

  it('returns fallback for unknown roles', () => {
    expect(getEventRoleLabel('guest')).toBe('Ukjent rolle')
  })
})
