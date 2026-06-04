export const META_BASE = 'https://graph.facebook.com/v21.0'

export const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.total_messaging_connection',
  'onsite_conversion.messaging_conversation_started_7d',
  'offsite_complete_registration_add_meta_leads',
]

export const MSG_ACTION_TYPES = [
  'onsite_conversion.total_messaging_connection',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
]

export type MetaAction = { action_type: string; value: string }

export function sumActions(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0)
}

export function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

export function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function thisMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
