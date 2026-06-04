import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { TDO_SYSTEM_PROMPT } from '@/lib/tdo-context'
import { META_BASE, MetaAction, MetaCPR, deriveResult, sumActions, MSGS_STARTED, MSGS_CONNECTED, LEADS_FORM, qs } from '@/lib/meta'

const TOKEN   = process.env.META_ACCESS_TOKEN!
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system: TDO_SYSTEM_PROMPT,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      get_campaign_data: tool({
        description: 'Obtiene métricas reales de Meta Ads para Tierra de Oportunidades. Usa esta herramienta cuando el usuario pregunta por datos actuales, rendimiento, gasto o resultados de campañas.',
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

function today()    { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
