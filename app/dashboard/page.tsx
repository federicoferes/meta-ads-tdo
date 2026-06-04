'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { daysAgo, fmtARS, fmtNum, thisMonthStart, today } from '@/lib/meta'

interface Overview {
  spend: number; impressions: number; reach: number; clicks: number
  leads: number; msgs: number; cpl: number | null; cpm: number; ctr: number
}
interface Campaign {
  id: string; name: string; impressions: number; reach: number
  clicks: number; spend: number; cpm: number; ctr: number
  leads: number; msgs: number; cpl: number | null
}
interface TrendPoint { date: string; spend: number; impressions: number; leads: number; msgs: number }
interface MetaData { since: string; until: string; overview: Overview; campaigns: Campaign[]; trend: TrendPoint[] }

const PRESETS = [
  { label: 'Últimos 7 días',  since: () => daysAgo(7),        until: today },
  { label: 'Últimos 30 días', since: () => daysAgo(30),       until: today },
  { label: 'Este mes',        since: thisMonthStart,           until: today },
]

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function StatCard({ label, value, sub, accent = 'blue' }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  const colors: Record<string, string> = {
    blue:    'border-l-blue-500',
    emerald: 'border-l-emerald-500',
    violet:  'border-l-violet-500',
    amber:   'border-l-amber-500',
    rose:    'border-l-rose-500',
    sky:     'border-l-sky-400',
  }
  return (
    <div className={cn('bg-white rounded-xl border border-slate-100 border-l-4 p-5', colors[accent] ?? colors.blue)}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
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
      const res  = await fetch(`/api/meta-ads?since=${s}&until=${u}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(since, until) }, [load, since, until])

  function applyPreset(i: number) {
    setPreset(i)
    const p = PRESETS[i]
    const s = p.since()
    const u = p.until()
    setSince(s)
    setUntil(u)
  }

  const trendData = data?.trend.map((t) => ({
    ...t,
    label: new Date(t.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
  })) ?? []

  const o = data?.overview

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Meta Ads</h1>
          <p className="text-xs text-slate-400">Tierra de Oportunidades · Lead Ads</p>
        </div>
        <button
          onClick={() => load(since, until)}
          className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
        >
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Presets */}
        <div className="flex items-center gap-2 mb-8">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                preset === i
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {p.label}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-2">{since} → {until}</span>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {o && (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
              <StatCard label="Gasto" value={fmtARS(o.spend)} sub="período seleccionado" accent="rose" />
              <StatCard
                label="Leads totales"
                value={fmtNum(o.leads + o.msgs)}
                sub={`${o.leads} forms · ${o.msgs} msgs`}
                accent="emerald"
              />
              <StatCard
                label="CPL"
                value={o.cpl ? fmtARS(o.cpl) : '—'}
                sub="costo por lead"
                accent="violet"
              />
              <StatCard label="Impresiones" value={fmtNum(o.impressions)} sub={`Alcance ${fmtNum(o.reach)}`} accent="sky" />
              <StatCard label="CPM" value={fmtARS(o.cpm)} sub="por mil impresiones" accent="amber" />
              <StatCard label="CTR" value={`${o.ctr.toFixed(2)}%`} sub={`${fmtNum(o.clicks)} clics`} accent="blue" />
            </div>

            {/* Trend */}
            {trendData.length > 1 && (
              <div className="bg-white rounded-xl border border-slate-100 p-6 mb-8">
                <h2 className="text-sm font-semibold text-slate-700 mb-5">Evolución diaria</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v, name) => name === 'Gasto' ? [fmtARS(Number(v)), String(name)] : [v, name]} />
                    <Legend />
                    <Area yAxisId="l" type="monotone" dataKey="spend"  name="Gasto"       stroke="#3b82f6" fill="url(#gS)" strokeWidth={2} dot={false} />
                    <Area yAxisId="r" type="monotone" dataKey="leads"  name="Leads forms" stroke="#10b981" fill="url(#gL)" strokeWidth={2} dot={false} />
                    <Area yAxisId="r" type="monotone" dataKey="msgs"   name="Msgs leads"  stroke="#8b5cf6" fill="none"     strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Spend by campaign */}
            {data.campaigns.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-6 mb-8">
                <h2 className="text-sm font-semibold text-slate-700 mb-5">Gasto por campaña</h2>
                <ResponsiveContainer width="100%" height={Math.max(160, data.campaigns.slice(0, 8).length * 36)}>
                  <BarChart data={data.campaigns.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis
                      type="category" dataKey="name" tick={{ fontSize: 10 }} width={200}
                      tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 30) + '…' : v}
                    />
                    <Tooltip formatter={(v) => fmtARS(Number(v))} />
                    <Bar dataKey="spend" name="Gasto" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Campaign table */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Detalle de campañas</h2>
                <span className="text-xs text-slate-400">{data.campaigns.length} campañas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-6 py-3">Campaña</th>
                      <th className="text-right px-4 py-3">Gasto</th>
                      <th className="text-right px-4 py-3">Impr.</th>
                      <th className="text-right px-4 py-3">Clics</th>
                      <th className="text-right px-4 py-3">Leads</th>
                      <th className="text-right px-4 py-3">Msgs</th>
                      <th className="text-right px-4 py-3">CPL</th>
                      <th className="text-right px-4 py-3">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-700 max-w-[220px]">
                          <span className="block truncate" title={c.name}>{c.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{fmtARS(c.spend)}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">{fmtNum(c.impressions)}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">{fmtNum(c.clicks)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          <span className={c.leads > 0 ? 'text-emerald-600' : 'text-slate-300'}>{c.leads || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          <span className={c.msgs > 0 ? 'text-violet-600' : 'text-slate-300'}>{c.msgs || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{c.cpl ? fmtARS(c.cpl) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">{c.ctr.toFixed(2)}%</td>
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
