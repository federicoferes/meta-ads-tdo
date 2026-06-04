import { NextRequest, NextResponse } from 'next/server'
import { META_BASE, MetaAction, getResult, qs } from '@/lib/meta'

const TOKEN  = process.env.META_ACCESS_TOKEN!
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
  const fields = 'adset_name,adset_id,spend,impressions,reach,clicks,cpm,ctr,frequency,actions'

  const res = await fetch(
    `${META_BASE}/${ACCOUNT}/insights?${qs(TOKEN, { fields, time_range: tr, level: 'adset', filtering: filter, limit: '50', sort: 'spend_descending' })}`
  )
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 })

  const json   = await res.json()
  const adsets = (json.data ?? []).map((a: Record<string, unknown>) => {
    const acts   = a.actions as MetaAction[] | undefined
    const result = getResult(objective, acts)
    const spend  = Number(a.spend ?? 0)
    return {
      id:          a.adset_id,
      name:        a.adset_name,
      spend,
      impressions: Number(a.impressions ?? 0),
      reach:       Number(a.reach ?? 0),
      clicks:      Number(a.clicks ?? 0),
      cpm:         Number(a.cpm ?? 0),
      ctr:         Number(a.ctr ?? 0),
      frequency:   Number(a.frequency ?? 0),
      resultLabel: result.label,
      results:     result.value,
      forms:       result.forms,
      msgs:        result.msgs,
      cpr:         result.value > 0 ? spend / result.value : null,
    }
  })

  return NextResponse.json({ adsets })
}

function today()        { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo(){ const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
