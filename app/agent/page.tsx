'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, BarChart2, Lightbulb, TrendingUp, Users, DollarSign, Zap } from 'lucide-react'

const MODELS = [
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', tag: 'Recomendado', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'anthropic/claude-opus-4.8',   label: 'Claude Opus 4.8',   tag: 'Más potente',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'openai/gpt-4.1',              label: 'GPT-4.1',           tag: 'OpenAI',       color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'google/gemini-2.5-pro',       label: 'Gemini 2.5 Pro',    tag: 'Google',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'google/gemini-2.5-flash',     label: 'Gemini 2.5 Flash',  tag: 'Rápido',       color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'deepseek/deepseek-v4-pro',    label: 'DeepSeek V4 Pro',   tag: 'Económico',    color: 'bg-slate-50 text-slate-700 border-slate-200' },
]

const STARTERS = [
  { icon: TrendingUp,  label: 'Diagnóstico de performance', prompt: 'Traé los datos de los últimos 30 días y decime cuáles campañas están bien y cuáles hay que revisar.' },
  { icon: Lightbulb,   label: 'Ideas creativas',             prompt: 'Necesito ideas de anuncios nuevos para Estilo Casares. Dame 5 hooks y conceptos creativos para video.' },
  { icon: Users,       label: 'Estrategia de audiencias',    prompt: '¿Cómo mejorarías las audiencias de CBO_GO_FOR_WHATSAPP? Explicame qué capas de audiencia armar.' },
  { icon: DollarSign,  label: 'Distribución de presupuesto', prompt: 'Tengo $1.000.000 ARS para invertir este mes. ¿Cómo los distribuirías entre campañas y objetivos?' },
  { icon: BarChart2,   label: 'Análisis de embudo',          prompt: 'Analizá el embudo completo: TOFU, MOFU y BOFU. ¿Qué falta y qué mejorarías?' },
  { icon: Zap,         label: 'Quick wins',                  prompt: 'Dame los 3 cambios que más impacto van a tener en la cuenta esta semana, en orden de prioridad.' },
]

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(' ') }

function applyInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-black/10 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    return part
  })
}

function MarkdownText({ content }: { content: string }) {
  return (
    <div className="space-y-1">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <p key={i} className="font-bold text-base mt-3 mb-1">{line.slice(4)}</p>
        if (line.startsWith('## '))  return <p key={i} className="font-bold text-base mt-4 mb-1">{line.slice(3)}</p>
        if (line.startsWith('# '))   return <p key={i} className="font-bold text-lg mt-4 mb-1">{line.slice(2)}</p>
        if (line.startsWith('- ') || line.startsWith('* ')) return (
          <div key={i} className="flex gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
            <span>{applyInline(line.slice(2))}</span>
          </div>
        )
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\.\s/)?.[1]
          return (
            <div key={i} className="flex gap-2">
              <span className="font-semibold shrink-0 opacity-70">{num}.</span>
              <span>{applyInline(line.replace(/^\d+\.\s/, ''))}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{applyInline(line)}</p>
      })}
    </div>
  )
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-3 mb-6', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
        isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
      )}>
        {isUser ? 'V' : 'TdO'}
      </div>
      <div className={cn(
        'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
      )}>
        <MarkdownText content={content} />
      </div>
    </div>
  )
}

export default function AgentPage() {
  const [model, setModel] = useState(MODELS[0].id)
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat', body: { model } }),
  })
  const [input, setInput]   = useState('')
  const [showModels, setShowModels] = useState(false)

  const busy       = status === 'streaming' || status === 'submitted'
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const [rows, setRows] = useState(1)

  const activeModel = MODELS.find(m => m.id === model) ?? MODELS[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function submit() {
    const text = input.trim()
    if (!text || busy) return
    sendMessage({ text })
    setInput('')
    setRows(1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    setRows(Math.min(e.target.value.split('\n').length, 5))
  }

  function sendStarter(prompt: string) {
    setInput(prompt)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">TdO</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Estratega de Ads</p>
            <p className="text-[10px] text-slate-400">Tierra de Oportunidades · Meta Ads</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModels(v => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                activeModel.color
              )}
            >
              <span>{activeModel.label}</span>
              <span className="text-[9px] opacity-60">▾</span>
            </button>
            {showModels && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-100 rounded-xl shadow-lg z-20 overflow-hidden">
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => { setModel(m.id); setShowModels(false) }}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors',
                      m.id === model && 'bg-slate-50'
                    )}>
                    <span className="text-xs font-medium text-slate-700">{m.label}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', m.color)}>{m.tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', busy ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400')} />
            <span className="text-xs text-slate-400">{busy ? 'Pensando…' : 'Online'}</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">

          {!hasMessages && (
            <div className="text-center pt-12 pb-8">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-bold">TdO</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Estratega de Ads</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-10">
                Conoce tu cuenta de Meta Ads, tus proyectos y tu embudo completo. Preguntá sobre performance, creatividad, audiencias o presupuesto.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STARTERS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => sendStarter(prompt)}
                    className="flex flex-col items-start gap-2 p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group"
                  >
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === 'system') return null
            const text = m.parts
              .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map(p => p.text)
              .join('')
            if (!text) return null
            return <MessageBubble key={m.id} role={m.role} content={text} />
          })}

          {busy && (
            <div className="flex gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">TdO</div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={rows}
              placeholder="Preguntá sobre performance, ideas, audiencias, presupuesto…"
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50"
              disabled={busy}
            />
            <p className="absolute bottom-2 right-3 text-[10px] text-slate-300 pointer-events-none">⏎ enviar · ⇧⏎ nueva línea</p>
          </div>
          <button
            onClick={submit}
            disabled={!input.trim() || busy}
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
