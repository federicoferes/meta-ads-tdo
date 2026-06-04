import { createOpenAI } from '@ai-sdk/openai'
import { streamText, convertToModelMessages } from 'ai'
import { TDO_SYSTEM_PROMPT } from '@/lib/tdo-context'
import { META_BASE, MetaAction, MetaCPR, deriveResult, sumActions, MSGS_STARTED, MSGS_CONNECTED, LEADS_FORM, qs, daysAgo, today } from '@/lib/meta'

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const ALLOWED_MODELS = new Set([
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.8',
  'openai/gpt-4.1',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-v4-pro',
  'x-ai/grok-4.3',
])
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6'

const TOKEN   = process.env.META_ACCESS_TOKEN!
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!

export const maxDuration = 60

// Fetch Meta Ads data server-side and return structured context string
async function fetchMetaContext(since: string, until: string): Promise<string> {
  try {
    const tr = JSON.stringify({ since, until })
    const [ovRes, cvRes] = await Promise.all([
      fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: 'impressions,reach,spend,cpm,ctr,frequency,actions', time_range: tr, level: 'account' })}`),
      fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: 'campaign_name,objective,spend,impressions,cpm,ctr,frequency,actions,cost_per_result', time_range: tr, level: 'campaign', limit: '30', sort: 'spend_descending' })}`),
    ])
    const [ovJson, cvJson] = await Promise.all([ovRes.json(), cvRes.json()])
    const o    = ovJson.data?.[0] ?? {}
    const acts = o.actions as MetaAction[] | undefined

    const overview = {
      periodo:              `${since} → ${until}`,
      gasto_ars:            Number(o.spend ?? 0).toFixed(0),
      impresiones:          Number(o.impressions ?? 0),
      alcance:              Number(o.reach ?? 0),
      mensajes_iniciados:   sumActions(acts, MSGS_STARTED),
      msgs_conectados:      sumActions(acts, MSGS_CONNECTED),
      clientes_potenciales: sumActions(acts, LEADS_FORM),
      cpm_ars:              Number(o.cpm ?? 0).toFixed(0),
      ctr_pct:              Number(o.ctr ?? 0).toFixed(2),
      frecuencia:           Number(o.frequency ?? 0).toFixed(2),
      costo_x_mensaje:      sumActions(acts, MSGS_STARTED) > 0 ? (Number(o.spend ?? 0) / sumActions(acts, MSGS_STARTED)).toFixed(0) : null,
      costo_x_lead:         sumActions(acts, LEADS_FORM)   > 0 ? (Number(o.spend ?? 0) / sumActions(acts, LEADS_FORM)).toFixed(0)   : null,
    }

    const campaigns = (cvJson.data ?? []).map((c: Record<string, unknown>) => {
      const actions  = c.actions  as MetaAction[] | undefined
      const cprField = c.cost_per_result as MetaCPR[] | undefined
      const obj      = String(c.objective ?? '')
      const spend    = Number(c.spend ?? 0)
      const result   = deriveResult(spend, obj, actions, cprField)
      return {
        nombre:               c.campaign_name,
        objetivo:             obj,
        gasto_ars:            spend.toFixed(0),
        impresiones:          Number(c.impressions ?? 0),
        cpm_ars:              Number(c.cpm ?? 0).toFixed(0),
        ctr_pct:              Number(c.ctr ?? 0).toFixed(2),
        frecuencia:           Number(c.frequency ?? 0).toFixed(2),
        mensajes_iniciados:   sumActions(actions, MSGS_STARTED),
        clientes_potenciales: sumActions(actions, LEADS_FORM),
        resultado_principal:  result.label,
        resultados:           result.value,
        costo_por_resultado:  result.cpr ? Number(result.cpr).toFixed(0) : null,
      }
    })

    return `\n\n---\nDATOS ACTUALES DE META ADS (${since} → ${until})\n\nOVERVIEW DE LA CUENTA:\n${JSON.stringify(overview, null, 2)}\n\nCAMPAÑAS (ordenadas por gasto):\n${JSON.stringify(campaigns, null, 2)}\n---\n`
  } catch {
    return '\n\n[No se pudieron cargar datos de Meta Ads en este momento]\n'
  }
}

export async function POST(req: Request) {
  const { messages: uiMessages, model: requestedModel, since, until } = await req.json()
  const modelId  = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL
  const messages = await convertToModelMessages(uiMessages ?? [])
  const nowDate  = today()

  // Pre-fetch Meta data server-side (no tool calls needed)
  const dataSince  = since ?? daysAgo(30)
  const dataUntil  = until ?? nowDate
  const metaContext = await fetchMetaContext(dataSince, dataUntil)

  const system = `${TDO_SYSTEM_PROMPT}\n\nFecha de hoy: ${nowDate}.${metaContext}`

  const result = streamText({
    model: openrouter(modelId),
    system,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
