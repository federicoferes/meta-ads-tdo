import { createOpenAI } from '@ai-sdk/openai'
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { TDO_SYSTEM_PROMPT } from '@/lib/tdo-context'
import { META_BASE, MetaAction, MetaCPR, deriveResult, sumActions, MSGS_STARTED, MSGS_CONNECTED, LEADS_FORM, qs, daysAgo } from '@/lib/meta'

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

export async function POST(req: Request) {
  const { messages: uiMessages, model: requestedModel } = await req.json()
  const modelId  = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL
  const messages = await convertToModelMessages(uiMessages ?? [])
  const nowDate  = today()
  const system   = `${TDO_SYSTEM_PROMPT}\n\nFecha de hoy: ${nowDate}. Usá esta fecha como referencia para calcular rangos (ej: "últimos 30 días" = desde ${daysAgo(30)} hasta ${nowDate}).`

  const result = streamText({
    model: openrouter(modelId),
    system,
    messages,
    stopWhen: stepCountIs(2),
    tools: {
      get_campaign_data: tool({
        description: `Obtiene métricas reales de Meta Ads de Tierra de Oportunidades. Llamá esta herramienta UNA SOLA VEZ por consulta. Hoy es ${nowDate}. Para "últimos 30 días" usá since="${daysAgo(30)}" until="${nowDate}".`,
        inputSchema: z.object({
          since: z.string().optional(),
          until: z.string().optional(),
          level: z.enum(['account', 'campaign']).optional(),
        }),
        execute: async ({ since, until, level = 'campaign' }: { since?: string; until?: string; level?: 'account' | 'campaign' }) => {
          const s = since ?? daysAgo(30)
          const u = until ?? today()
          const tr = JSON.stringify({ since: s, until: u })

          try {
            const [overviewRes, campaignsRes] = await Promise.all([
              fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: 'impressions,reach,spend,cpm,ctr,frequency,actions', time_range: tr, level: 'account' })}`),
              fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: 'campaign_name,objective,spend,impressions,reach,cpm,ctr,frequency,actions,cost_per_result', time_range: tr, level: 'campaign', limit: '30', sort: 'spend_descending' })}`),
            ])

            const [ov, cv] = await Promise.all([overviewRes.json(), campaignsRes.json()])
            const o    = ov.data?.[0] ?? {}
            const acts = o.actions as MetaAction[] | undefined

            const overview = {
              periodo:           `${s} → ${u}`,
              gasto_total_ars:   Number(o.spend ?? 0).toFixed(0),
              impresiones:       Number(o.impressions ?? 0),
              alcance:           Number(o.reach ?? 0),
              mensajes_iniciados: sumActions(acts, MSGS_STARTED),
              msgs_conectados:   sumActions(acts, MSGS_CONNECTED),
              clientes_potenciales: sumActions(acts, LEADS_FORM),
              cpm_ars:           Number(o.cpm ?? 0).toFixed(0),
              ctr_pct:           Number(o.ctr ?? 0).toFixed(2),
              frecuencia:        Number(o.frequency ?? 0).toFixed(2),
            }

            const campaigns = (cv.data ?? []).map((c: Record<string, unknown>) => {
              const actions  = c.actions as MetaAction[] | undefined
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
                tipo_resultado:       result.label,
                resultados:           result.value,
                costo_por_resultado:  result.cpr ? Number(result.cpr).toFixed(0) : null,
              }
            })

            return { ok: true, overview, campaigns: level === 'campaign' ? campaigns : undefined }
          } catch (e) {
            return { ok: false, error: String(e) }
          }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}

function today() { return new Date().toISOString().slice(0, 10) }
