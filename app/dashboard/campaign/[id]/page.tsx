'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { fmtARS, fmtNum, OBJECTIVE_LABELS } from '@/lib/meta'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

interface Row {
  id: string; name: string; spend: number; impressions: number; reach: number
  clicks: number; cpm: number; ctr: number; frequency: number
  resultLabel: string; results: number; cpr: number | null
  isMsgs: boolean; isLead: boolean
  msgsStarted: number; msgsConnected: number; leadsForm: number
}
interface AdRow extends Row { adsetName: string }
type Tab = 'adsets' | 'ads'

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(' ') }

function Table({ rows, type }: { rows: Row[]; type: Tab }) {
  const [sortKey, setSortKey] = useState<keyof Row>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(k: keyof Row) {
    if (sortKey === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey] as number | null ?? 0
    const vb = b[sortKey] as number | null ?? 0
    return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number)
  })

  function Th({ label, k, className }: { label: string; k: keyof Row; className?: string }) {
    const active = sortKey === k
    return (
      <th className={cn('text-right px-3 py-3 cursor-pointer select-none hover:text-slate-700 text-[11px] font-semibold text-slate-500 uppercase tracking-wide', className)}
        onClick={() => toggleSort(k)}>
        <span className="flex items-center justify-end gap-1">
          {label}
          {active ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
        </span>
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {type === 'adsets' ? 'Ad Set' : 'Anuncio'}
            </th>
            {type === 'ads' && (
              <th className="text-left px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Ad Set</th>
            )}
            <Th label="Gasto"   k="spend" />
            <Th label="Impr."   k="impressions" />
            <Th label="Frec."   k="frequency" />
            <Th label="CTR"     k="ctr" />
            <Th label="CPM"     k="cpm" />
            <Th label="Msgs"    k="msgsStarted"   className="text-violet-600" />
            <Th label="Cli.Pot" k="leadsForm"      className="text-emerald-600" />
            <Th label="Result." k="results" />
            <Th label="Costo/R" k="cpr" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
              <td className="px-5 py-3 max-w-[220px]">
                <span className="block truncate text-xs font-medium text-slate-700" title={r.name}>{r.name}</span>
              </td>
              {type === 'ads' && (
                <td className="px-3 py-3 text-xs text-slate-400 max-w-[160px]">
                  <span className="block truncate" title={(r as AdRow).adsetName}>{(r as AdRow).adsetName}</span>
                </td>
              )}
              <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-slate-700">{fmtARS(r.spend)}</td>
              <td className="px-3 py-3 text-right text-xs text-slate-500">{fmtNum(r.impressions)}</td>
              <td className="px-3 py-3 text-right text-xs text-slate-500">{r.frequency.toFixed(2)}</td>
              <td className="px-3 py-3 text-right text-xs text-slate-500">{r.ctr.toFixed(2)}%</td>
              <td className="px-3 py-3 text-right font-mono text-xs text-slate-500">{fmtARS(r.cpm)}</td>
              {/* Mensajes iniciados */}
              <td className="px-3 py-3 text-right">
                <span className={cn('text-xs font-semibold', r.msgsStarted > 0 ? 'text-violet-600' : 'text-slate-200')}>
                  {r.msgsStarted > 0 ? fmtNum(r.msgsStarted) : '—'}
                </span>
              </td>
              {/* Clientes potenciales */}
              <td className="px-3 py-3 text-right">
                <span className={cn('text-xs font-semibold', r.leadsForm > 0 ? 'text-emerald-600' : 'text-slate-200')}>
                  {r.leadsForm > 0 ? fmtNum(r.leadsForm) : '—'}
                </span>
              </td>
              {/* Resultado principal (de Meta) */}
              <td className="px-3 py-3 text-right">
                {r.results > 0 ? (
                  <div>
                    <span className="text-xs font-bold text-slate-700">{fmtNum(r.results)}</span>
                    <p className="text-[9px] text-slate-400 leading-none mt-0.5">{r.resultLabel}</p>
                  </div>
                ) : <span className="text-xs text-slate-200">—</span>}
              </td>
              {/* CPR exacto de Meta */}
              <td className="px-3 py-3 text-right font-mono text-xs text-slate-600">
                {r.cpr ? fmtARS(r.cpr) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CampaignPage() {
  const { id }     = useParams<{ id: string }>()
  const sp         = useSearchParams()
  const objective  = sp.get('objective') ?? 'OUTCOME_LEADS'
  const name       = sp.get('name') ?? id
  const since      = sp.get('since') ?? ''
  const until      = sp.get('until') ?? ''

  const [tab, setTab]             = useState<Tab>('adsets')
  const [adsets, setAdsets]       = useState<Row[]>([])
  const [ads, setAds]             = useState<AdRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadedAds, setLoadedAds] = useState(false)

  const dateParams = since && until ? `&since=${since}&until=${until}` : ''

  const loadAdsets = useCallback(async () => {
    setLoading(true)
    try {
      const j = await (await fetch(`/api/meta-ads/adsets?campaign_id=${id}&objective=${objective}${dateParams}`)).json()
      setAdsets(j.adsets ?? [])
    } finally { setLoading(false) }
  }, [id, objective, dateParams])

  const loadAds = useCallback(async () => {
    if (loadedAds) return
    setLoading(true)
    try {
      const j = await (await fetch(`/api/meta-ads/ads?campaign_id=${id}&objective=${objective}${dateParams}`)).json()
      setAds(j.ads ?? [])
      setLoadedAds(true)
    } finally { setLoading(false) }
  }, [id, objective, dateParams, loadedAds])

  useEffect(() => { loadAdsets() }, [loadAdsets])

  function switchTab(t: Tab) { setTab(t); if (t === 'ads') loadAds() }

  const activeRows     = tab === 'adsets' ? adsets : ads
  const totalSpend     = activeRows.reduce((s, r) => s + r.spend, 0)
  const totalResults   = activeRows.reduce((s, r) => s + r.results, 0)
  const totalMsgs      = activeRows.reduce((s, r) => s + r.msgsStarted, 0)
  const totalLeads     = activeRows.reduce((s, r) => s + r.leadsForm, 0)

  const objColor: Record<string, string> = {
    OUTCOME_LEADS: '#3b82f6', OUTCOME_ENGAGEMENT: '#8b5cf6',
    LINK_CLICKS: '#f59e0b', OUTCOME_TRAFFIC: '#f59e0b',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
          <span className="text-slate-200">/</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: (objColor[objective] ?? '#94a3b8') + '20', color: objColor[objective] ?? '#64748b' }}>
              {OBJECTIVE_LABELS[objective] ?? objective}
            </span>
            <h1 className="text-sm font-bold text-slate-800 truncate max-w-md" title={name}>{name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Gasto', value: fmtARS(totalSpend), accent: 'border-l-rose-500' },
            { label: 'Mensajes iniciados', value: fmtNum(totalMsgs), accent: 'border-l-violet-500' },
            { label: 'Clientes potenciales', value: fmtNum(totalLeads), accent: 'border-l-emerald-500' },
            { label: activeRows[0]?.resultLabel ?? 'Resultado Meta', value: fmtNum(totalResults), accent: 'border-l-blue-500' },
            {
              label: 'Costo / resultado',
              value: totalResults > 0 ? fmtARS(totalSpend / totalResults) : '—',
              accent: 'border-l-amber-400',
            },
          ].map(({ label, value, accent }) => (
            <div key={label} className={cn('bg-white rounded-xl border border-slate-100 border-l-4 p-4', accent)}>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-xl font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 px-5 flex items-center gap-1 pt-3">
            {(['adsets', 'ads'] as Tab[]).map((t) => (
              <button key={t} onClick={() => switchTab(t)}
                className={cn('px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors',
                  tab === t
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}>
                {t === 'adsets' ? 'Ad Sets' : 'Anuncios'}&nbsp;
                ({t === 'adsets' ? adsets.length : (loadedAds ? ads.length : '…')})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeRows.length > 0 ? (
            <Table rows={activeRows} type={tab} />
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Sin datos para el período seleccionado
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
