export const META_BASE = 'https://graph.facebook.com/v21.0'

export type MetaAction = { action_type: string; value: string }

// All messaging/lead action types
export const MSG_ACTIONS   = ['onsite_conversion.total_messaging_connection', 'onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply']
export const FORM_ACTIONS  = ['lead', 'offsite_complete_registration_add_meta_leads']
export const CLICK_ACTIONS = ['link_click', 'landing_page_view']

export function sumActions(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0
  return actions.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value), 0)
}

// Returns the primary "result" for a given campaign objective
export function getResult(objective: string, actions: MetaAction[] | undefined) {
  switch (objective) {
    case 'OUTCOME_LEADS':
      return {
        label: 'Leads',
        value: sumActions(actions, [...FORM_ACTIONS, ...MSG_ACTIONS]),
        forms: sumActions(actions, FORM_ACTIONS),
        msgs:  sumActions(actions, MSG_ACTIONS),
      }
    case 'OUTCOME_ENGAGEMENT':
      return {
        label: 'Mensajes',
        value: sumActions(actions, MSG_ACTIONS),
        forms: 0,
        msgs:  sumActions(actions, MSG_ACTIONS),
      }
    case 'LINK_CLICKS':
    case 'OUTCOME_TRAFFIC':
      return {
        label: 'Clics',
        value: sumActions(actions, CLICK_ACTIONS),
        forms: 0,
        msgs:  0,
      }
    default:
      return { label: 'Resultados', value: 0, forms: 0, msgs: 0 }
  }
}

export const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS:      'Lead Ads',
  OUTCOME_ENGAGEMENT: 'Mensajería',
  LINK_CLICKS:        'Tráfico',
  OUTCOME_TRAFFIC:    'Tráfico',
  OUTCOME_SALES:      'Ventas',
  OUTCOME_AWARENESS:  'Reconocimiento',
}

export function qs(token: string, extra: Record<string, string>) {
  return new URLSearchParams({ access_token: token, ...extra }).toString()
}

export function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

export function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

export function today() { return new Date().toISOString().slice(0, 10) }

export function thisMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
