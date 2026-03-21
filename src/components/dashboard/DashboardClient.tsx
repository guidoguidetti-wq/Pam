'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatValuta, formatOre } from '@/lib/utils'
import { cn } from '@/lib/utils'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

interface MeseStats {
  mese: number
  oreErogate: number
  valoreAttivita: number
  valoreSpese: number
}

interface Progetto {
  id: number
  nome: string
  codice: string | null
  tipoBudget: 'STIMATO' | 'CONSUNTIVO'
  attivo: boolean
  dataInizio: string | null
  dataFinePrevista: string | null
  committente: string
  cliente: string
  oreStimate: number | null
  oreErogate: number
}

interface DashboardData {
  mesiStats: MeseStats[]
  progetti: Progetto[]
}

function formatOreDecimal(ore: number): string {
  const h = Math.floor(ore)
  const m = Math.round((ore - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function ProgressBar({ oreErogate, oreStimate }: { oreErogate: number; oreStimate: number }) {
  const pct = oreStimate > 0 ? (oreErogate / oreStimate) * 100 : 0
  const capped = Math.min(pct, 100)
  const color =
    pct >= 90 ? 'bg-red-500' :
    pct >= 80 ? 'bg-yellow-400' :
    'bg-emerald-500'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-0">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={cn(
        'text-xs tabular-nums shrink-0 font-medium',
        pct >= 90 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-emerald-600'
      )}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-sm">{label}</p>
      {payload.map((p: { color: string; name: string; value: number; unit?: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {p.unit === 'h' ? formatOreDecimal(p.value) : formatValuta(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardClient() {
  const [anno, setAnno] = useState(new Date().getFullYear())
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard?anno=${anno}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [anno])

  const chartData = (data?.mesiStats ?? []).map((m) => ({
    name: MESI[m.mese - 1],
    'Competenze €': m.valoreAttivita,
    'Spese €': m.valoreSpese,
    'Ore': m.oreErogate,
  }))

  const totOre = data?.mesiStats.reduce((s, m) => s + m.oreErogate, 0) ?? 0
  const totValore = data?.mesiStats.reduce((s, m) => s + m.valoreAttivita, 0) ?? 0
  const totSpese = data?.mesiStats.reduce((s, m) => s + m.valoreSpese, 0) ?? 0

  return (
    <div className="p-4 space-y-6">

      {/* Header + Anno */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnno((a) => a - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold tabular-nums w-14 text-center">{anno}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAnno((a) => a + 1)}
            disabled={anno >= new Date().getFullYear()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Ore erogate</p>
              <p className="text-xl font-bold tabular-nums">{formatOreDecimal(totOre)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Competenze</p>
              <p className="text-xl font-bold tabular-nums">{formatValuta(totValore)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Spese</p>
              <p className="text-xl font-bold tabular-nums">{formatValuta(totSpese)}</p>
            </div>
          </div>

          {/* Grafico mensile */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Andamento mensile {anno}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="eur"
                  orientation="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <YAxis
                  yAxisId="ore"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}h`}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="eur" dataKey="Competenze €" fill="#4f46e5" radius={[3, 3, 0, 0]} unit="" />
                <Bar yAxisId="eur" dataKey="Spese €" fill="#06b6d4" radius={[3, 3, 0, 0]} unit="" />
                <Line
                  yAxisId="ore"
                  type="monotone"
                  dataKey="Ore"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  unit="h"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Lista progetti */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Progetti</h2>
            </div>
            {(data?.progetti ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nessun progetto</p>
            ) : (
              <div className="divide-y">
                {(data?.progetti ?? []).map((p) => {
                  const pct = p.oreStimate && p.oreStimate > 0
                    ? (p.oreErogate / p.oreStimate) * 100
                    : null

                  return (
                    <div key={p.id} className="px-4 py-2.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 items-center">
                      {/* Left: nome + meta */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'font-medium text-sm truncate',
                            !p.attivo && 'text-muted-foreground line-through'
                          )}>
                            {p.codice ? `[${p.codice}] ` : ''}{p.nome}
                          </span>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                            p.tipoBudget === 'STIMATO'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-slate-100 text-slate-600'
                          )}>
                            {p.tipoBudget}
                          </span>
                          {!p.attivo && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                              Chiuso
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.committente} › {p.cliente}
                          {p.dataFinePrevista && (
                            <span className="ml-2">
                              scadenza {new Date(p.dataFinePrevista + 'T00:00:00').toLocaleDateString('it-IT')}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Right: ore */}
                      <div className="text-right text-xs tabular-nums shrink-0">
                        {p.oreStimate != null ? (
                          <span>
                            <span className={cn(
                              'font-medium',
                              pct != null && pct >= 90 ? 'text-red-600' :
                              pct != null && pct >= 80 ? 'text-yellow-600' : ''
                            )}>
                              {formatOre(Math.round(p.oreErogate * 60))}
                            </span>
                            <span className="text-muted-foreground"> / {formatOre(Math.round(p.oreStimate * 60))}</span>
                          </span>
                        ) : (
                          <span className="font-medium">{formatOre(Math.round(p.oreErogate * 60))}</span>
                        )}
                      </div>

                      {/* Progress bar — full width sotto */}
                      {p.oreStimate != null && p.oreStimate > 0 && (
                        <div className="col-span-2">
                          <ProgressBar oreErogate={p.oreErogate} oreStimate={p.oreStimate} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
