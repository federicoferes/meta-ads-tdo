'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { daysAgo, fmtARS, fmtNum, thisMonthStart, today, OBJECTIVE_LABELS } from '@/lib/meta'
import { RefreshCw, ChevronRight, MessageCircle, FileText, MousePointerClick, Eye, DollarSign, Activity } from 'lucide-react'

interface Overview {
  spend: number; impressions: number; reach: number
  clicks: number; pageViews: number
  msgsStarted: number; msgsConnected: number
  leadsForm: number; totalLeads: number
  cpm: number; ctr: number; frequency: number
  cpmMsg: number | null; cpmLead: number | null
}
interface Campaign {
  id: string; name: string; objective: string
  impressions: number; reach: number; clicks: number; spend: number
  cpm: number; ctr: number; frequency: number
  resultLabel: string; results: number; cpr: number | null
  isMsgs: boolean; isLead: boolean
  msgsStarted: number; msgsConnected: number; leadsForm: number
}
interface TrendPoint { date: string; spend: number; impressions: number; msgsStarted: number; leadsForm: number }
interface Platform   { platform: string; spend: number; impressions: number; clicks: number }
interface Prev {
  spend: number; impressions: number; reach: number
  msgsStarted: number; leadsForm: number
  cpm: number; ctr: number; frequency: number
  cpmMsg: number | null; cpmLead: number | null
}
interface MetaData {
  since: string; until: string; prevSince: string; prevUntil: string
  overview: Overview; prev: Prev
  byObjective: Record<string, number>; campaigns: Campaign[]
  trend: TrendPoint[]; platforms: Platform[]
}

const PRESETS = [
  { label: 'Últimos 7d',  since: () => daysAgo(7),  until: today },
  { label: 'Últimos 30d', since: () => daysAgo(30), until: today },
  { label: 'Este mes',    since: thisMonthStart,     until: today },
]

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', whatsapp: '#25D366', threads: '#000',
}
const OBJ_COLORS: Record<string, string> = {
  OUTCOME_LEADS: '#3b82f6', OUTCOME_ENGAGEMENT: '#8b5cf6',
  LINK_CLICKS: '#f59e0b', OUTCOME_TRAFFIC: '#f59e0b', OUTCOME_SALES: '#10b981',
}

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(' ') }

// Returns % change. lowerIsBetter = true for cost metrics (lower = green)
function delta(current: number, prev: number, lowerIsBetter = false): { pct: number; up: boolean; color: string } | null {
  if (!prev || prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  const up  = pct > 0
  const good = lowerIsBetter ? !up : up
  return { pct, up, color: good ? 'text-emerald-600' : 'text-rose-500' }
}

function Delta({ current, prev, lowerIsBetter = false }: { current: number; prev: number; lowerIsBetter?: boolean }) {
  const d = delta(current, prev, lowerIsBetter)
  if (!d) return null
  return (
    <span className={cn('text-[10px] font-semibold ml-1.5', d.color)}>
      {d.up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%
    </span>
  )
}

function KPI({ label, value, sub, accent = 'blue', icon, current, prev, lowerIsBetter }: {
  label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode
  current?: number; prev?: number; lowerIsBetter?: boolean
}) {
  const border: Record<string, string> = {
    blue: 'border-l-blue-500', emerald: 'border-l-emerald-500',
    violet: 'border-l-violet-500', amber: 'border-l-amber-500',
    rose: 'border-l-rose-500', sky: 'border-l-sky-400', slate: 'border-l-slate-300',
    green: 'border-l-green-500',
  }
  return (
    <div className={cn('bg-white rounded-xl border border-slate-100 border-l-4 p-4', border[accent] ?? border.blue)}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-400">{icon}</span>}
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      </div>
      <div className="flex items-baseline gap-0">
        <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>
        {current !== undefined && prev !== undefined && prev > 0 && (
          <Delta current={current} prev={prev} lowerIsBetter={lowerIsBetter} />
        )}
      </div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData]       = useState<MetaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset]   = useState(1)
  const [since, setSince]         = useState(() => daysAgo(30))
  const [until, setUntil]         = useState(today)
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [showCustom, setShowCustom]   = useState(false)

  const load = useCallback(async (s: string, u: string) => {
    setLoading(true)
    try { setData(await (await fetch(`/api/meta-ads?since=${s}&until=${u}`)).json()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(since, until) }, [load, since, until])

  function applyPreset(i: number) {
    setPreset(i)
    setShowCustom(false)
    const s = PRESETS[i].since(); const u = PRESETS[i].until()
    setSince(s); setUntil(u)
  }

  function applyCustom() {
    if (!customSince || !customUntil) return
    if (customSince > customUntil) return
    setPreset(-1)
    setSince(customSince)
    setUntil(customUntil)
    setShowCustom(false)
  }

  const o = data?.overview
  const trendData = data?.trend.map((t) => ({
    ...t,
    label: new Date(t.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
  })) ?? []

  const platformData  = (data?.platforms ?? []).filter(p => p.spend > 0).sort((a, b) => b.spend - a.spend)
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
        <div className="flex items-center gap-3">
          <Link href="/agent"
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
            Estratega IA
          </Link>
          <button onClick={() => load(since, until)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Presets + filtro personalizado */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => applyPreset(i)}
              className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                preset === i ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}>
              {p.label}
            </button>
          ))}

          {/* Botón / panel de rango personalizado */}
          <div className="relative">
            <button
              onClick={() => setShowCustom(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border transition-colors',
                preset === -1
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {preset === -1 ? `${since} → ${until}` : 'Personalizado'}
              <span className="opacity-60 text-[10px]">▾</span>
            </button>

            {showCustom && (
              <div className="absolute left-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-20 min-w-[260px]">
                <p className="text-xs font-semibold text-slate-600 mb-3">Rango personalizado</p>
                <div className="flex flex-col gap-2 mb-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">Desde</label>
                    <input
                      type="date"
                      value={customSince}
                      onChange={e => setCustomSince(e.target.value)}
                      max={customUntil || today()}
                      className="w-full mt-0.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">Hasta</label>
                    <input
                      type="date"
                      value={customUntil}
                      onChange={e => setCustomUntil(e.target.value)}
                      min={customSince}
                      max={today()}
                      className="w-full mt-0.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={applyCustom}
                    disabled={!customSince || !customUntil || customSince > customUntil}
                    className="flex-1 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-lg transition-colors"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => setShowCustom(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {o && (
          <>
            {/* Período de comparación */}
            {data.prev && (
              <p className="text-[11px] text-slate-400 mb-4 -mt-4">
                vs. período anterior: {data.prevSince} → {data.prevUntil}
              </p>
            )}

            {/* ── KPIs: Inversión ── */}
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Inversión</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <KPI label="Gasto total" value={fmtARS(o.spend)} sub="todas las campañas" accent="rose"
                  icon={<DollarSign className="w-3 h-3" />}
                  current={o.spend} prev={data.prev?.spend} lowerIsBetter />
                <KPI label="CPM" value={fmtARS(o.cpm)} sub="por mil impresiones" accent="amber"
                  icon={<Activity className="w-3 h-3" />}
                  current={o.cpm} prev={data.prev?.cpm} lowerIsBetter />
                <KPI label="Impresiones" value={fmtNum(o.impressions)} sub={`Alcance ${fmtNum(o.reach)}`} accent="sky"
                  icon={<Eye className="w-3 h-3" />}
                  current={o.impressions} prev={data.prev?.impressions} />
                <KPI label="Frecuencia" value={o.frequency.toFixed(2)} sub={`CTR ${o.ctr.toFixed(2)}%`} accent="slate"
                  icon={<Activity className="w-3 h-3" />}
                  current={o.frequency} prev={data.prev?.frequency} lowerIsBetter />
              </div>
            </div>

            {/* ── KPIs: Resultados ── */}
            <div className="mb-8">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Resultados por tipo</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI
                  label="Mensajes iniciados"
                  value={fmtNum(o.msgsStarted)}
                  sub={o.cpmMsg ? `Costo: ${fmtARS(o.cpmMsg)}` : 'resultado principal de messaging'}
                  accent="violet" icon={<MessageCircle className="w-3 h-3" />}
                  current={o.msgsStarted} prev={data.prev?.msgsStarted}
                />
                <KPI
                  label="Clientes potenciales"
                  value={fmtNum(o.leadsForm)}
                  sub={o.cpmLead ? `Costo: ${fmtARS(o.cpmLead)}` : 'leads por formulario'}
                  accent="emerald" icon={<FileText className="w-3 h-3" />}
                  current={o.leadsForm} prev={data.prev?.leadsForm}
                />
                <KPI
                  label="Costo x mensaje"
                  value={o.cpmMsg ? fmtARS(o.cpmMsg) : '—'}
                  sub="vs período anterior"
                  accent="blue" icon={<MessageCircle className="w-3 h-3" />}
                  current={o.cpmMsg ?? undefined} prev={data.prev?.cpmMsg ?? undefined} lowerIsBetter
                />
                <KPI
                  label="Costo x lead"
                  value={o.cpmLead ? fmtARS(o.cpmLead) : '—'}
                  sub="vs período anterior"
                  accent="sky" icon={<MousePointerClick className="w-3 h-3" />}
                  current={o.cpmLead ?? undefined} prev={data.prev?.cpmLead ?? undefined} lowerIsBetter
                />
              </div>
            </div>

            {/* ── Trend + Platform ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
              {trendData.length > 1 && (
                <div className="xl:col-span-2 bg-white rounded-xl border border-slate-100 p-6">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Gasto y resultados diarios</h2>
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="l" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v, name) => name === 'Gasto' ? [fmtARS(Number(v)), name] : [v, name]} />
                      <Legend />
                      <Area yAxisId="l" type="monotone" dataKey="spend"       name="Gasto"             stroke="#3b82f6" fill="url(#gS)" strokeWidth={2} dot={false} />
                      <Area yAxisId="r" type="monotone" dataKey="msgsStarted" name="Mensajes iniciados" stroke="#8b5cf6" fill="none"     strokeWidth={2} dot={false} />
                      <Area yAxisId="r" type="monotone" dataKey="leadsForm"   name="Clientes potenciales" stroke="#10b981" fill="none"   strokeWidth={2} strokeDasharray="4 2" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Por plataforma</h2>
                  <div className="space-y-3">
                    {platformData.map((p) => {
                      const pct   = (p.spend / o.spend) * 100
                      const color = PLATFORM_COLORS[p.platform] ?? '#94a3b8'
                      return (
                        <div key={p.platform}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-600 capitalize">{p.platform}</span>
                            <span className="text-xs font-semibold text-slate-700">{fmtARS(p.spend)}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(1)}%</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Por objetivo</h2>
                  <div className="space-y-2">
                    {objectiveData.map((od) => {
                      const pct   = (od.spend / o.spend) * 100
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

            {/* ── Bar chart top campañas ── */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 mb-8">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top campañas por gasto</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, Math.min(data.campaigns.length, 10) * 34)}>
                <BarChart data={data.campaigns.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
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

            {/* ── Campaign table ── */}
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
                      <th className="text-right px-3 py-3 text-violet-600">Msgs</th>
                      <th className="text-right px-3 py-3 text-emerald-600">Cli. Pot.</th>
                      <th className="text-right px-3 py-3">Resultado</th>
                      <th className="text-right px-3 py-3">Costo/R</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-5 py-3 max-w-[200px]">
                          <span className="block truncate text-xs font-medium text-slate-700" title={c.name}>{c.name}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: (OBJ_COLORS[c.objective] ?? '#94a3b8') + '20', color: OBJ_COLORS[c.objective] ?? '#64748b' }}>
                            {OBJECTIVE_LABELS[c.objective] ?? c.objective}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-slate-700">{fmtARS(c.spend)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{fmtNum(c.impressions)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{c.frequency.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{c.ctr.toFixed(2)}%</td>
                        {/* Mensajes iniciados */}
                        <td className="px-3 py-3 text-right">
                          <span className={cn('text-xs font-semibold', c.msgsStarted > 0 ? 'text-violet-600' : 'text-slate-200')}>
                            {c.msgsStarted > 0 ? fmtNum(c.msgsStarted) : '—'}
                          </span>
                        </td>
                        {/* Clientes potenciales */}
                        <td className="px-3 py-3 text-right">
                          <span className={cn('text-xs font-semibold', c.leadsForm > 0 ? 'text-emerald-600' : 'text-slate-200')}>
                            {c.leadsForm > 0 ? fmtNum(c.leadsForm) : '—'}
                          </span>
                        </td>
                        {/* Resultado principal de Meta */}
                        <td className="px-3 py-3 text-right">
                          {c.results > 0 ? (
                            <div>
                              <span className="text-xs font-bold text-slate-700">{fmtNum(c.results)}</span>
                              <p className="text-[9px] text-slate-400 leading-none mt-0.5">{c.resultLabel}</p>
                            </div>
                          ) : <span className="text-xs text-slate-200">—</span>}
                        </td>
                        {/* Costo por resultado (de Meta — igual al Ads Manager) */}
                        <td className="px-3 py-3 text-right font-mono text-xs text-slate-600">
                          {c.cpr ? fmtARS(c.cpr) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/dashboard/campaign/${c.id}?objective=${c.objective}&name=${encodeURIComponent(c.name as string)}&since=${since}&until=${until}`}
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
