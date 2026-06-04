import { NextRequest, NextResponse } from 'next/server'
import {
  META_BASE, MetaAction, MetaCPR,
  deriveResult, sumActions,
  MSGS_STARTED, MSGS_CONNECTED, LEADS_FORM, CLICKS, PAGE_VIEWS,
  qs,
} from '@/lib/meta'

const TOKEN   = process.env.META_ACCESS_TOKEN!
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!

const OVERVIEW_FIELDS  = 'impressions,reach,clicks,spend,cpm,ctr,frequency,actions'
const CAMPAIGN_FIELDS  = 'campaign_name,campaign_id,objective,impressions,reach,clicks,spend,cpm,ctr,frequency,actions,cost_per_result'

export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams
  const since = sp.get('since') ?? thirtyDaysAgo()
  const until = sp.get('until') ?? today()
  const tr    = JSON.stringify({ since, until })

  const [overviewRes, campaignsRes, trendRes, platformRes] = await Promise.all([
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: OVERVIEW_FIELDS, time_range: tr, level: 'account' })}`),
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: CAMPAIGN_FIELDS,  time_range: tr, level: 'campaign', limit: '50', sort: 'spend_descending' })}`),
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: 'spend,impressions,actions', time_range: tr, level: 'account', time_increment: '1' })}`),
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields: 'spend,impressions,clicks', time_range: tr, level: 'account', breakdowns: 'publisher_platform' })}`),
  ])

  if (!overviewRes.ok) {
    return NextResponse.json({ error: await overviewRes.text() }, { status: 502 })
  }

  const [ovJson, cvJson, tvJson, pvJson] = await Promise.all([
    overviewRes.json(), campaignsRes.json(), trendRes.json(), platformRes.json(),
  ])

  const o       = ovJson.data?.[0] ?? {}
  const acts    = o.actions as MetaAction[] | undefined

  // Account-level breakdowns
  const msgsStarted   = sumActions(acts, MSGS_STARTED)
  const msgsConnected = sumActions(acts, MSGS_CONNECTED)
  const leadsForm     = sumActions(acts, LEADS_FORM)
  const clicks        = sumActions(acts, CLICKS)
  const pageViews     = sumActions(acts, PAGE_VIEWS)
  const totalSpend    = Number(o.spend ?? 0)

  const campaigns = (cvJson.data ?? []).map((c: Record<string, unknown>) => {
    const actions   = c.actions   as MetaAction[] | undefined
    const cprField  = c.cost_per_result as MetaCPR[] | undefined
    const objective = String(c.objective ?? '')
    const spend     = Number(c.spend ?? 0)
    const result    = deriveResult(spend, objective, actions, cprField)

    return {
      id:          c.campaign_id,
      name:        c.campaign_name,
      objective,
      impressions: Number(c.impressions ?? 0),
      reach:       Number(c.reach ?? 0),
      clicks:      Number(c.clicks ?? 0),
      spend,
      cpm:         Number(c.cpm ?? 0),
      ctr:         Number(c.ctr ?? 0),
      frequency:   Number(c.frequency ?? 0),
      // Primary result (from Meta's cost_per_result)
      resultLabel: result.label,
      results:     result.value,
      cpr:         result.cpr,
      isMsgs:      result.isMsgs,
      isLead:      result.isLead,
      // Secondary breakdowns (always available)
      msgsStarted:  sumActions(actions, MSGS_STARTED),
      msgsConnected: sumActions(actions, MSGS_CONNECTED),
      leadsForm:    sumActions(actions, LEADS_FORM),
    }
  })

  const trend = (tvJson.data ?? []).map((d: Record<string, unknown>) => {
    const da = d.actions as MetaAction[] | undefined
    return {
      date:         d.date_start as string,
      spend:        Number(d.spend ?? 0),
      impressions:  Number(d.impressions ?? 0),
      msgsStarted:  sumActions(da, MSGS_STARTED),
      leadsForm:    sumActions(da, LEADS_FORM),
    }
  })

  const platforms = (pvJson.data ?? [])
    .filter((p: Record<string, unknown>) => Number(p.spend ?? 0) > 0)
    .map((p: Record<string, unknown>) => ({
      platform:    p.publisher_platform,
      spend:       Number(p.spend ?? 0),
      impressions: Number(p.impressions ?? 0),
      clicks:      Number(p.clicks ?? 0),
    }))

  const byObjective: Record<string, number> = {}
  for (const c of campaigns) byObjective[c.objective] = (byObjective[c.objective] ?? 0) + c.spend

  return NextResponse.json({
    since, until,
    overview: {
      spend:        totalSpend,
      impressions:  Number(o.impressions ?? 0),
      reach:        Number(o.reach ?? 0),
      clicks,
      pageViews,
      msgsStarted,
      msgsConnected,
      leadsForm,
      totalLeads:   msgsStarted + leadsForm,
      cpm:          Number(o.cpm ?? 0),
      ctr:          Number(o.ctr ?? 0),
      frequency:    Number(o.frequency ?? 0),
      // Cost metrics
      cpmMsg:   msgsStarted > 0   ? totalSpend / msgsStarted   : null,
      cpmLead:  leadsForm > 0     ? totalSpend / leadsForm     : null,
    },
    byObjective,
    campaigns,
    trend,
    platforms,
  })
}

function today()         { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
