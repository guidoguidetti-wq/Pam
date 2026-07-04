'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, Pencil, Check, X, Building2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Ente = { id: number; nome: string; categoria: string | null; _count: { movimenti: number } }
type Conto = { id: number; banca: string; numeroConto: string; iban: string | null }
type Movimento = {
  id: number
  dataOperazione: string
  dataValuta: string | null
  descrizione: string
  importo: number
  categoria: string | null
  stato: string | null
  ente: { id: number; nome: string; categoria: string | null } | null
  conto: { id: number; banca: string; numeroConto: string }
}

function fmtData(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

export function ContiBancaClient() {
  const [movimenti, setMovimenti] = useState<Movimento[]>([])
  const [enti, setEnti] = useState<Ente[]>([])
  const [conti, setConti] = useState<Conto[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const [da, setDa] = useState(firstDay.toISOString().slice(0, 10))
  const [a, setA] = useState(today.toISOString().slice(0, 10))
  const [enteId, setEnteId] = useState<string>('all')
  const [contoId, setContoId] = useState<string>('all')
  const [tipo, setTipo] = useState<string>('all')
  const [categoriaEnte, setCategoriaEnte] = useState<string>('all')


  // Inline ente edit
  const [editEnteId, setEditEnteId] = useState<number | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCategoriaEnte, setEditCategoriaEnte] = useState('')

  const categorieEnti = Array.from(new Set(enti.map(e => e.categoria).filter(Boolean) as string[])).sort()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (da) params.set('da', da)
      if (a) params.set('a', a)
      if (enteId !== 'all') params.set('enteId', enteId)
      if (contoId !== 'all') params.set('contoId', contoId)
      if (tipo !== 'all') params.set('tipo', tipo)
      if (categoriaEnte !== 'all') params.set('categoriaEnte', categoriaEnte)

      const res = await fetch(`/api/conti-banca/movimenti?${params}`)
      if (!res.ok) throw new Error()
      setMovimenti(await res.json())
    } catch {
      toast.error('Errore nel caricamento movimenti')
    } finally {
      setLoading(false)
    }
  }, [da, a, enteId, contoId, tipo, categoriaEnte])

  useEffect(() => {
    fetch('/api/conti-banca/enti').then(r => r.json()).then(setEnti).catch(() => null)
    fetch('/api/conti-banca/conti').then(r => r.json()).then(setConti).catch(() => null)
  }, [])

  useEffect(() => { load() }, [load])

  const totEntrate = movimenti.filter(m => m.importo > 0).reduce((s, m) => s + m.importo, 0)
  const totUscite = movimenti.filter(m => m.importo < 0).reduce((s, m) => s + m.importo, 0)

  async function saveEnte(id: number) {
    try {
      const categoria = editCategoriaEnte.trim() || null
      const res = await fetch(`/api/conti-banca/enti?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome, categoria }),
      })
      if (!res.ok) throw new Error()
      setEnti(prev => prev.map(e => e.id === id ? { ...e, nome: editNome, categoria } : e))
      setMovimenti(prev => prev.map(m =>
        m.ente?.id === id ? { ...m, ente: { ...m.ente, nome: editNome, categoria } } : m
      ))
      setEditEnteId(null)
      toast.success('Ente aggiornato')
    } catch {
      toast.error('Errore aggiornamento ente')
    }
  }

  function reportUrl(ord: string) {
    const p = new URLSearchParams({ da, a, ordinamento: ord })
    if (contoId !== 'all') p.set('contoId', contoId)
    if (enteId !== 'all') p.set('enteId', enteId)
    return `/api/conti-banca/report?${p}`
  }

  async function resetImport() {
    if (!confirm('Eliminare TUTTI i movimenti bancari e gli enti associati? Operazione irreversibile.')) return
    try {
      const url = contoId !== 'all' ? `/api/conti-banca/reset?contoId=${contoId}` : '/api/conti-banca/reset'
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error()
      toast.success(`Eliminati ${data.deleted} movimenti e ${data.entiRemoved} enti`)
      setMovimenti([])
      setEnti([])
    } catch {
      toast.error('Errore durante il reset')
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
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

          <Select value={enteId} onValueChange={setEnteId}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Tutti gli enti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli enti</SelectItem>
              {enti.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Tutti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="entrate">Solo Entrate</SelectItem>
              <SelectItem value="uscite">Solo Uscite</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoriaEnte} onValueChange={setCategoriaEnte}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Cat. ente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {categorieEnti.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={load} disabled={loading}>
            {loading ? 'Carico…' : 'Applica'}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <a href={reportUrl('data')} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1" />PDF per Data</Button>
          </a>
          <a href={reportUrl('ente')} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1" />PDF per Ente</Button>
          </a>
          <a href={reportUrl('categoria')} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1" />PDF per Categoria</Button>
          </a>
          <Link href="/conti-banca/enti">
            <Button size="sm" variant="outline"><Building2 className="h-4 w-4 mr-1" />Gestione Enti</Button>
          </Link>
          <Link href="/conti-banca/import">
            <Button size="sm"><Upload className="h-4 w-4 mr-1" />Importa Excel</Button>
          </Link>
          <Button size="sm" variant="destructive" onClick={resetImport}>
            <Trash2 className="h-4 w-4 mr-1" />Reset
          </Button>
        </div>
      </div>

      {/* Totali */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-3">
          <div className="text-xs text-muted-foreground">Entrate</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-400">{fmtEur(totEntrate)}</div>
        </div>
        <div className="rounded-lg border bg-red-50 dark:bg-red-950 p-3">
          <div className="text-xs text-muted-foreground">Uscite</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-400">{fmtEur(totUscite)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Saldo periodo</div>
          <div className={cn('text-lg font-bold', totEntrate + totUscite >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
            {fmtEur(totEntrate + totUscite)}
          </div>
        </div>
      </div>

      <datalist id="categorie-ente-datalist">
        {categorieEnti.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* Tabella */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Data Op.</th>
              <th className="px-3 py-2 text-left">Ente</th>
              <th className="px-3 py-2 text-left">Cat. Ente</th>
              <th className="px-3 py-2 text-left">Descrizione</th>
              <th className="px-3 py-2 text-left">Categoria</th>
              <th className="px-3 py-2 text-right">Importo</th>
              <th className="px-3 py-2 text-left">Conto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movimenti.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{loading ? 'Caricamento…' : 'Nessun movimento trovato'}</td></tr>
            )}
            {movimenti.map(m => (
              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-1.5 whitespace-nowrap text-xs text-muted-foreground">{fmtData(m.dataOperazione)}</td>
                <td className="px-3 py-1.5 min-w-32 max-w-48">
                  {editEnteId === m.ente?.id ? (
                    <div className="flex gap-1 items-center">
                      <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-6 text-xs w-32" onKeyDown={e => { if (e.key === 'Enter') saveEnte(editEnteId!) }} />
                      <button onClick={() => saveEnte(editEnteId!)} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditEnteId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className="truncate font-medium text-xs">{m.ente?.nome ?? '—'}</span>
                      {m.ente && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditEnteId(m.ente!.id); setEditNome(m.ente!.nome); setEditCategoriaEnte(m.ente!.categoria ?? '') }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 min-w-[130px]">
                  {editEnteId === m.ente?.id ? (
                    <Input
                      value={editCategoriaEnte}
                      onChange={e => setEditCategoriaEnte(e.target.value)}
                      placeholder="Categoria…"
                      className="h-6 text-xs w-28"
                      list="categorie-ente-datalist"
                      onKeyDown={e => { if (e.key === 'Enter') saveEnte(editEnteId!) }}
                    />
                  ) : (
                    m.ente?.categoria
                      ? <Badge variant="outline" className="text-[10px]">{m.ente.categoria}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 max-w-xs">
                  <span className="text-xs text-muted-foreground line-clamp-2" title={m.descrizione}>{m.descrizione}</span>
                </td>
                <td className="px-3 py-1.5">
                  {m.categoria && <Badge variant="outline" className="text-[10px]">{m.categoria}</Badge>}
                </td>
                <td className={cn('px-3 py-1.5 text-right font-mono font-medium text-xs whitespace-nowrap', m.importo >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                  {fmtEur(m.importo)}
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{m.conto.banca}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground text-right">{movimenti.length} movimenti</div>
    </div>
  )
}
