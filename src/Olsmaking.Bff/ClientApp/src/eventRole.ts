const EVENT_ROLE_LABELS: Record<string, string> = {
  owner: 'Arrangør',
  admin: 'Administrator',
  member: 'Deltaker',
}

export function getEventRoleLabel(role: string): string {
  const normalizedRole = role.trim().toLowerCase()
  return EVENT_ROLE_LABELS[normalizedRole] ?? 'Ukjent rolle'
}
