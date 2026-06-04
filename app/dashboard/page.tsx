'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { daysAgo, fmtARS, fmtNum, thisMonthStart, today, OBJECTIVE_LABELS } from '@/lib/meta'
import { RefreshCw, ChevronRight } from 'lucide-react'

interface Overview {
  spend: number; impressions: number; reach: number; clicks: number
  msgs: number; forms: number; cpm: number; ctr: number; frequency: number
}
interface Campaign {
  id: string; name: string; objective: string
  impressions: number; reach: number; clicks: number; spend: number
  cpm: number; ctr: number; frequency: number
  resultLabel: string; results: number; forms: number; msgs: number; cpr: number | null
}
interface TrendPoint { date: string; spend: number; impressions: number; msgs: number; clicks: number }
interface Platform   { platform: string; spend: number; impressions: number; clicks: number }
interface MetaData {
  since: string; until: string; overview: Overview
  byObjective: Record<string, number>; campaigns: Campaign[]
  trend: TrendPoint[]; platforms: Platform[]
}

const PRESETS = [
  { label: 'Últimos 7d',  since: () => daysAgo(7),   until: today },
  { label: 'Últimos 30d', since: () => daysAgo(30),  until: today },
  { label: 'Este mes',    since: thisMonthStart,      until: today },
]

const PLATFORM_COLORS: Record<string, string> = {
  facebook:  '#1877F2',
  instagram: '#E1306C',
  whatsapp:  '#25D366',
  threads:   '#000000',
}

const OBJ_COLORS: Record<string, string> = {
  OUTCOME_LEADS:      '#3b82f6',
  OUTCOME_ENGAGEMENT: '#8b5cf6',
  LINK_CLICKS:        '#f59e0b',
  OUTCOME_TRAFFIC:    '#f59e0b',
  OUTCOME_SALES:      '#10b981',
}

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(' ') }

function KPI({ label, value, sub, accent = 'blue' }: { label: string; value: string; sub?: string; accent?: string }) {
  const border: Record<string, string> = {
    blue: 'border-l-blue-500', emerald: 'border-l-emerald-500',
    violet: 'border-l-violet-500', amber: 'border-l-amber-500',
    rose: 'border-l-rose-500', sky: 'border-l-sky-400', slate: 'border-l-slate-400',
  }
  return (
    <div className={cn('bg-white rounded-xl border border-slate-100 border-l-4 p-4', border[accent] ?? border.blue)}>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData]       = useState<MetaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset]   = useState(1)
  const [since, setSince]     = useState(() => daysAgo(30))
  const [until, setUntil]     = useState(today)

  const load = useCallback(async (s: string, u: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/meta-ads?since=${s}&until=${u}`)
      setData(await r.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(since, until) }, [load, since, until])

  function applyPreset(i: number) {
    setPreset(i)
    const p = PRESETS[i]
    const s = p.since(); const u = p.until()
    setSince(s); setUntil(u)
  }

  const o = data?.overview
  const trendData = data?.trend.map((t) => ({
    ...t,
    label: new Date(t.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
  })) ?? []

  const platformData = (data?.platforms ?? [])
    .filter(p => p.spend > 0)
    .sort((a, b) => b.spend - a.spend)

  const objectiveData = Object.entries(data?.byObjective ?? {})
    .map(([obj, spend]) => ({ name: OBJECTIVE_LABELS[obj] ?? obj, spend, obj }))
    .sort((a, b) => b.spend - a.spend)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-800">Tierra de Oportunidades — Meta Ads</h1>
          <p className="text-xs text-slate-400 mt-0.5">{since} → {until}</p>
        </div>
        <button onClick={() => load(since, until)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Actualizar
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Presets */}
        <div className="flex items-center gap-2 mb-8">
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => applyPreset(i)}
              className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                preset === i ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}>
              {p.label}
            </button>
          ))}
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {o && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-8">
              <KPI label="Gasto total" value={fmtARS(o.spend)} sub="todas las campañas" accent="rose" />
              <KPI label="Mensajes" value={fmtNum(o.msgs)} sub="conv. iniciadas" accent="violet" />
              <KPI label="Leads form" value={fmtNum(o.forms)} sub="formularios" accent="emerald" />
              <KPI label="Clics" value={fmtNum(o.clicks)} sub={`CTR ${o.ctr.toFixed(2)}%`} accent="blue" />
              <KPI label="Impresiones" value={fmtNum(o.impressions)} sub={`Alcance ${fmtNum(o.reach)}`} accent="sky" />
              <KPI label="CPM" value={fmtARS(o.cpm)} sub="por mil impr." accent="amber" />
              <KPI label="Frecuencia" value={o.frequency.toFixed(2)} sub="veces por persona" accent="slate" />
            </div>

            {/* Trend + Platform split */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
              {/* Trend */}
              {trendData.length > 1 && (
                <div className="xl:col-span-2 bg-white rounded-xl border border-slate-100 p-6">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Gasto diario</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => fmtARS(Number(v))} />
                      <Area type="monotone" dataKey="spend" name="Gasto" stroke="#3b82f6" fill="url(#gS)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Platform + Objective */}
              <div className="flex flex-col gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Por plataforma</h2>
                  <div className="space-y-3">
                    {platformData.map((p) => {
                      const pct = (p.spend / o.spend) * 100
                      const color = PLATFORM_COLORS[p.platform] ?? '#94a3b8'
                      return (
                        <div key={p.platform}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-600 capitalize">{p.platform}</span>
                            <span className="text-xs font-semibold text-slate-700">{fmtARS(p.spend)}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(1)}% del gasto</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Por objetivo</h2>
                  <div className="space-y-2">
                    {objectiveData.map((od) => {
                      const pct = (od.spend / o.spend) * 100
                      const color = OBJ_COLORS[od.obj] ?? '#94a3b8'
                      return (
                        <div key={od.obj}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-600">{od.name}</span>
                            <span className="text-xs font-semibold text-slate-700">{fmtARS(od.spend)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Spend by campaign bar */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 mb-8">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top campañas por gasto</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, Math.min(data.campaigns.length, 10) * 34)}>
                <BarChart data={data.campaigns.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={220}
                    tickFormatter={(v: string) => v.length > 32 ? v.slice(0, 32) + '…' : v} />
                  <Tooltip formatter={(v) => fmtARS(Number(v))} />
                  <Bar dataKey="spend" name="Gasto" radius={[0, 4, 4, 0]}>
                    {data.campaigns.slice(0, 10).map((c) => (
                      <Cell key={c.id} fill={OBJ_COLORS[c.objective] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {objectiveData.map((od) => (
                  <div key={od.obj} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OBJ_COLORS[od.obj] ?? '#94a3b8' }} />
                    <span className="text-xs text-slate-500">{od.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign table */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Todas las campañas</h2>
                <span className="text-xs text-slate-400">{data.campaigns.length} campañas · click para ver detalle</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Campaña</th>
                      <th className="text-left px-3 py-3">Objetivo</th>
                      <th className="text-right px-3 py-3">Gasto</th>
                      <th className="text-right px-3 py-3">Impr.</th>
                      <th className="text-right px-3 py-3">Frec.</th>
                      <th className="text-right px-3 py-3">CTR</th>
                      <th className="text-right px-3 py-3">CPM</th>
                      <th className="text-right px-3 py-3">Result.</th>
                      <th className="text-right px-3 py-3">Costo/R</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-5 py-3 font-medium text-slate-700 max-w-[200px]">
                          <span className="block truncate text-xs" title={c.name}>{c.name}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: (OBJ_COLORS[c.objective] ?? '#94a3b8') + '20', color: OBJ_COLORS[c.objective] ?? '#64748b' }}>
                            {OBJECTIVE_LABELS[c.objective] ?? c.objective}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-slate-700 font-semibold">{fmtARS(c.spend)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{fmtNum(c.impressions)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{c.frequency.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{c.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-3 text-right text-xs font-mono text-slate-500">{fmtARS(c.cpm)}</td>
                        <td className="px-3 py-3 text-right">
                          {c.results > 0 ? (
                            <span className="text-xs font-bold text-emerald-600">{fmtNum(c.results)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-slate-600">
                          {c.cpr ? fmtARS(c.cpr) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/dashboard/campaign/${c.id}?objective=${c.objective}&name=${encodeURIComponent(c.name)}&since=${since}&until=${until}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap">
                            Ver <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
