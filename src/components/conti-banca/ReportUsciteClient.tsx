'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type Conto = { id: number; banca: string; numeroConto: string }
type Riga = { categoria: string; totale: number }

function fmtEur(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Riga }[] }) {
  if (!active || !payload?.length) return null
  const { categoria, totale } = payload[0].payload
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{categoria}</div>
      <div className="text-red-700 dark:text-red-400 font-mono">{fmtEur(totale)}</div>
    </div>
  )
}

export function ReportUsciteClient() {
  const searchParams = useSearchParams()
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

  const [da, setDa] = useState(searchParams.get('da') ?? firstDay.toISOString().slice(0, 10))
  const [a, setA] = useState(searchParams.get('a') ?? today.toISOString().slice(0, 10))
  const [contoId, setContoId] = useState(searchParams.get('contoId') ?? 'all')
  const [conti, setConti] = useState<Conto[]>([])
  const [dati, setDati] = useState<Riga[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ da, a })
      if (contoId !== 'all') params.set('contoId', contoId)
      const res = await fetch(`/api/conti-banca/uscite-categoria?${params}`)
      if (!res.ok) throw new Error()
      setDati(await res.json())
    } catch {
      toast.error('Errore nel caricamento del report')
    } finally {
      setLoading(false)
    }
  }, [da, a, contoId])

  useEffect(() => {
    fetch('/api/conti-banca/conti').then(r => r.json()).then(setConti).catch(() => null)
  }, [])

  useEffect(() => { load() }, [load])

  const totale = dati.reduce((s, r) => s + r.totale, 0)
  const chartWidth = Math.max(640, dati.length * 90)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input type="date" value={da} onChange={e => setDa(e.target.value)} className="w-36 h-8 text-sm" />
        <span className="text-sm text-muted-foreground">–</span>
        <Input type="date" value={a} onChange={e => setA(e.target.value)} className="w-36 h-8 text-sm" />

        <Select value={contoId} onValueChange={setContoId}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Tutti i conti" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i conti</SelectItem>
            {conti.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.banca} – {c.numeroConto}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={load} disabled={loading}>
          {loading ? 'Carico…' : 'Applica'}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs text-muted-foreground">Totale uscite periodo</div>
        <div className="text-lg font-bold text-red-700 dark:text-red-400">{fmtEur(totale)}</div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Uscite per categoria ente</h2>
        {dati.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            {loading ? 'Caricamento…' : 'Nessuna uscita nel periodo selezionato'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveContainer width={chartWidth} height={360}>
              <BarChart data={dati} margin={{ top: 4, right: 16, left: 0, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="categoria"
                  tick={{ fontSize: 11 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                  height={70}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totale" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {dati.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-right">Totale uscite</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dati.map(r => (
                <tr key={r.categoria} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5">{r.categoria}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-700 dark:text-red-400">{fmtEur(r.totale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
