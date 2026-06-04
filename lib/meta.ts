export const META_BASE = 'https://graph.facebook.com/v21.0'

export type MetaAction = { action_type: string; value: string }
export type MetaCPR    = { indicator: string; values: Array<{ value: string }> }

// ─── Action type buckets ────────────────────────────────────────────────────

// "Mensajes iniciados" — Meta's primary messaging result (used in cost_per_result)
export const MSGS_STARTED   = ['onsite_conversion.messaging_conversation_started_7d']
// Messaging depth signals (not primary result)
export const MSGS_CONNECTED = ['onsite_conversion.total_messaging_connection']
export const MSGS_REPLIED   = ['onsite_conversion.messaging_first_reply']
// "Clientes potenciales" — lead form submissions
export const LEADS_FORM     = ['lead', 'onsite_conversion.lead_grouped', 'offsite_complete_registration_add_meta_leads']
// Traffic
export const CLICKS         = ['link_click']
export const PAGE_VIEWS     = ['landing_page_view', 'omni_landing_page_view']

export function sumActions(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0
  return actions.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value), 0)
}

// ─── Primary result per campaign ────────────────────────────────────────────
// Uses Meta's own cost_per_result indicator (most accurate).
// Falls back to objective heuristics if cost_per_result is missing.

export type ResultSummary = {
  label:   string      // human label
  value:   number      // result count
  cpr:     number|null // cost per result (from Meta — exact match to Ads Manager)
  isMsgs:  boolean
  isLead:  boolean
}

export function deriveResult(
  spend:    number,
  objective: string,
  actions:  MetaAction[] | undefined,
  cprField: MetaCPR[]   | undefined,
): ResultSummary {

  // ── 1. Use Meta's cost_per_result indicator when available ──
  if (cprField && cprField.length > 0) {
    const { indicator, values } = cprField[0]
    const cpr   = values && values[0] ? Number(values[0].value) : null
    const atype = indicator.startsWith('actions:') ? indicator.slice('actions:'.length) : null

    const isMsgs = !!atype && (
      atype.includes('messaging_conversation_started') ||
      atype.includes('messaging_connection')
    )
    const isLead = !!atype && (
      atype === 'lead' ||
      atype.includes('lead_grouped') ||
      atype.includes('add_meta_leads') ||
      atype.includes('fb_pixel_lead') ||
      atype.includes('web_lead')
    )

    // Count from actions array when possible; estimate from spend/cpr otherwise
    let value = 0
    if (atype) {
      value = sumActions(actions, [atype])
      // Some indicators like "offsite_contact_website_add_meta_leads" aren't in actions[]
      // Fall back to the lead bucket
      if (value === 0 && isLead) value = sumActions(actions, LEADS_FORM)
    } else if (cpr && cpr > 0) {
      // Non-action indicators (total_profile_visits, etc.) — derive count from spend/cpr
      value = Math.round(spend / cpr)
    }

    const label = isLead
      ? 'Clientes potenciales'
      : isMsgs
        ? 'Mensajes iniciados'
        : indicator.includes('profile_visit') || indicator.includes('profile_view')
          ? 'Visitas al perfil'
          : indicator.includes('landing_page') || indicator.includes('omni_landing')
            ? 'Vistas de página'
            : 'Resultados'

    return { label, value, cpr, isMsgs, isLead }
  }

  // ── 2. Objective fallback ────────────────────────────────────────────────
  switch (objective) {
    case 'OUTCOME_LEADS': {
      const msgs  = sumActions(actions, MSGS_STARTED)
      const forms = sumActions(actions, LEADS_FORM)
      // Prefer forms; if none, fall back to messaging
      if (forms > 0) return { label: 'Clientes potenciales', value: forms, cpr: forms > 0 ? spend / forms : null, isMsgs: false, isLead: true }
      return { label: 'Mensajes iniciados', value: msgs, cpr: msgs > 0 ? spend / msgs : null, isMsgs: true, isLead: false }
    }
    case 'OUTCOME_ENGAGEMENT': {
      const msgs = sumActions(actions, MSGS_STARTED)
      return { label: 'Mensajes iniciados', value: msgs, cpr: msgs > 0 ? spend / msgs : null, isMsgs: true, isLead: false }
    }
    default: {
      const clicks = sumActions(actions, CLICKS)
      return { label: 'Clics', value: clicks, cpr: clicks > 0 ? spend / clicks : null, isMsgs: false, isLead: false }
    }
  }
}

// ─── Objective labels ────────────────────────────────────────────────────────
export const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS:      'Lead Ads',
  OUTCOME_ENGAGEMENT: 'Mensajería',
  LINK_CLICKS:        'Tráfico',
  OUTCOME_TRAFFIC:    'Tráfico',
  OUTCOME_SALES:      'Ventas',
  OUTCOME_AWARENESS:  'Reconocimiento',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

export function today()           { return new Date().toISOString().slice(0, 10) }
export function thisMonthStart()  {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
