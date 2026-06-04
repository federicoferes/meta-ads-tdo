import { NextRequest, NextResponse } from 'next/server'
import { META_BASE, MetaAction, MetaCPR, deriveResult, sumActions, MSGS_STARTED, MSGS_CONNECTED, LEADS_FORM, qs } from '@/lib/meta'

const TOKEN   = process.env.META_ACCESS_TOKEN!
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!

export async function GET(req: NextRequest) {
  const sp         = req.nextUrl.searchParams
  const campaignId = sp.get('campaign_id')
  const objective  = sp.get('objective') ?? 'OUTCOME_LEADS'
  const since      = sp.get('since') ?? thirtyDaysAgo()
  const until      = sp.get('until') ?? today()

  if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

  const tr     = JSON.stringify({ since, until })
  const filter = JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: [campaignId] }])
  const fields = 'ad_name,ad_id,adset_name,spend,impressions,reach,clicks,cpm,ctr,frequency,actions,cost_per_result'

  const res = await fetch(
    `${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields, time_range: tr, level: 'ad', filtering: filter, limit: '50', sort: 'spend_descending' })}`
  )
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 })

  const json = await res.json()
  const ads  = (json.data ?? []).map((a: Record<string, unknown>) => {
    const actions  = a.actions  as MetaAction[] | undefined
    const cprField = a.cost_per_result as MetaCPR[] | undefined
    const spend    = Number(a.spend ?? 0)
    const result   = deriveResult(spend, objective, actions, cprField)
    return {
      id:            a.ad_id,
      name:          a.ad_name,
      adsetName:     a.adset_name,
      spend,
      impressions:   Number(a.impressions ?? 0),
      reach:         Number(a.reach ?? 0),
      clicks:        Number(a.clicks ?? 0),
      cpm:           Number(a.cpm ?? 0),
      ctr:           Number(a.ctr ?? 0),
      frequency:     Number(a.frequency ?? 0),
      resultLabel:   result.label,
      results:       result.value,
      cpr:           result.cpr,
      isMsgs:        result.isMsgs,
      isLead:        result.isLead,
      msgsStarted:   sumActions(actions, MSGS_STARTED),
      msgsConnected: sumActions(actions, MSGS_CONNECTED),
      leadsForm:     sumActions(actions, LEADS_FORM),
    }
  })

  return NextResponse.json({ ads })
}

function today()         { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
