import { NextRequest, NextResponse } from 'next/server'
import { META_BASE, LEAD_ACTION_TYPES, MSG_ACTION_TYPES, sumActions, MetaAction } from '@/lib/meta'

const TOKEN = process.env.META_ACCESS_TOKEN!
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!

function qs(extra: Record<string, string>) {
  return new URLSearchParams({ access_token: TOKEN, ...extra }).toString()
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const since = sp.get('since') ?? thirtyDaysAgo()
  const until = sp.get('until') ?? today()

  const timeRange = JSON.stringify({ since, until })
  const leadsFilter = JSON.stringify([
    { field: 'campaign.objective', operator: 'IN', value: ['OUTCOME_LEADS'] },
  ])
  const fields = 'campaign_name,campaign_id,impressions,reach,clicks,spend,cpm,ctr,actions'

  const [overviewRes, campaignsRes, trendRes] = await Promise.all([
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs({ fields: 'impressions,reach,clicks,spend,cpm,ctr,actions', time_range: timeRange, filtering: leadsFilter, level: 'account' })}`),
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs({ fields, time_range: timeRange, filtering: leadsFilter, level: 'campaign', limit: '30', sort: 'spend_descending' })}`),
    fetch(`${META_BASE}/${ACCOUNT}/insights?${qs({ fields: 'impressions,spend,actions', time_range: timeRange, filtering: leadsFilter, level: 'account', time_increment: '1' })}`),
  ])

  if (!overviewRes.ok) {
    const err = await overviewRes.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }

  const [ov, cv, tv] = await Promise.all([overviewRes.json(), campaignsRes.json(), trendRes.json()])

  const o = ov.data?.[0] ?? {}
  const totalSpend = Number(o.spend ?? 0)
  const totalLeads = sumActions(o.actions as MetaAction[], LEAD_ACTION_TYPES)
  const totalMsgs = sumActions(o.actions as MetaAction[], MSG_ACTION_TYPES)

  const campaigns = (cv.data ?? []).map((c: Record<string, unknown>) => {
    const actions = c.actions as MetaAction[] | undefined
    const leads = sumActions(actions, LEAD_ACTION_TYPES)
    const msgs = sumActions(actions, MSG_ACTION_TYPES)
    const spend = Number(c.spend ?? 0)
    return {
      id: c.campaign_id,
      name: c.campaign_name,
      impressions: Number(c.impressions ?? 0),
      reach: Number(c.reach ?? 0),
      clicks: Number(c.clicks ?? 0),
      spend,
      cpm: Number(c.cpm ?? 0),
      ctr: Number(c.ctr ?? 0),
      leads,
      msgs,
      cpl: leads > 0 ? spend / leads : null,
    }
  })

  const trend = (tv.data ?? []).map((d: Record<string, unknown>) => ({
    date: d.date_start as string,
    spend: Number(d.spend ?? 0),
    impressions: Number(d.impressions ?? 0),
    leads: sumActions(d.actions as MetaAction[], LEAD_ACTION_TYPES),
    msgs: sumActions(d.actions as MetaAction[], MSG_ACTION_TYPES),
  }))

  return NextResponse.json({
    since,
    until,
    overview: {
      spend: totalSpend,
      impressions: Number(o.impressions ?? 0),
      reach: Number(o.reach ?? 0),
      clicks: Number(o.clicks ?? 0),
      leads: totalLeads,
      msgs: totalMsgs,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : null,
      cpm: Number(o.cpm ?? 0),
      ctr: Number(o.ctr ?? 0),
    },
    campaigns,
    trend,
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
