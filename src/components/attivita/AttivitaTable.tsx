'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TipiAttivitaDialog } from './TipiAttivitaDialog'
import { AttivitaForm } from './AttivitaForm'
import { cn, formatOre, calcolaDurata, coloreCommittente, formatValuta } from '@/lib/utils'
import { Plus, Settings2, Pencil, Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

const TIPO_COLORS: Record<string, string> = {
  COM: 'bg-blue-100 text-blue-700',
  PRE: 'bg-violet-100 text-violet-700',
  PMG: 'bg-amber-100 text-amber-700',
  BAN: 'bg-cyan-100 text-cyan-700',
  SVI: 'bg-emerald-100 text-emerald-700',
  OPS: 'bg-rose-100 text-rose-700',
}

interface Committente { id: number; ragioneSociale: string }
interface TipoAttivita { id: number; codice: string; descrizione: string; attivo: boolean }
interface AttivitaRow {
  id: string
  dataAttivita: string
  oraInizio: string
  oraFine: string
  oreErogate: number | null
  committenteId: number
  clienteId: number | null
  progettoId: number | null
  tipoAttivitaId: number
  descrizione: string | null
  fatturabile: boolean
  prezzoUnitario: number | null
  valoreAttivita: number | null
  totaleSpese: number
  committente: { ragioneSociale: string }
  cliente: { ragioneSociale: string } | null
  tipoAttivita: { codice: string }
  progetto: { nome: string } | null
}

interface AttivitaTableProps {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
}

function primoGiornoAnno(): string {
  return `${new Date().getFullYear()}-01-01`
}

function fineAnno(): string {
  return `${new Date().getFullYear()}-12-31`
}

export function AttivitaTable({ committenti, tipiAttivita: initialTipi }: AttivitaTableProps) {
  const [tipiAttivita, setTipiAttivita] = useState(initialTipi)
  const [attivita, setAttivita] = useState<AttivitaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(primoGiornoAnno())
  const [to, setTo] = useState(fineAnno())
  const [filterCommittente, setFilterCommittente] = useState('')
  const [tipiDialogOpen, setTipiDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const caricaAttivita = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (filterCommittente) params.set('committente_id', filterCommittente)
      const res = await fetch(`/api/attivita?${params}`)
      if (!res.ok) { toast.error('Errore caricamento attività'); return }
      const data: AttivitaRow[] = await res.json()
      setAttivita(data)
    } finally {
      setLoading(false)
    }
  }, [from, to, filterCommittente])

  useEffect(() => { caricaAttivita() }, [caricaAttivita])

  function apriNuova() {
    setEditId(undefined)
    setFormDialogOpen(true)
  }

  function apriModifica(id: string) {
    setEditId(id)
    setFormDialogOpen(true)
  }

  function onSaved() {
    caricaAttivita()
  }

  function onClose() {
    setFormDialogOpen(false)
    caricaAttivita()
  }

  function onNuova() {
    setEditId(undefined)
  }

  function onDeleted() {
    setFormDialogOpen(false)
    caricaAttivita()
  }

  async function handleDeleteRow(id: string) {
    if (!confirm('Eliminare questa attività?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/attivita/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Errore durante l\'eliminazione'); return }
      toast.success('Attività eliminata')
      caricaAttivita()
    } finally {
      setDeletingId(null)
    }
  }

  const attivitaOrdinata = [...attivita].sort((a, b) => {
    const cmp = a.dataAttivita.localeCompare(b.dataAttivita)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totaleOreMin = attivita.reduce((acc, row) => {
    return acc + (row.oreErogate ?? calcolaDurata(row.oraInizio, row.oraFine))
  }, 0)
  const totaleValore = attivita.reduce((acc, row) => acc + (row.valoreAttivita ?? 0), 0)
  const totaleSpese = attivita.reduce((acc, row) => acc + (row.totaleSpese ?? 0), 0)
  const totaleGenerale = totaleValore + totaleSpese

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dal</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Al</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Committente</label>
          <Select
            value={filterCommittente || '__all__'}
            onValueChange={(v) => setFilterCommittente(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              {committenti.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.ragioneSociale}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTipiDialogOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-1" /> Gestisci tipi
          </Button>
          <Button size="sm" onClick={apriNuova}>
            <Plus className="h-4 w-4 mr-1" /> Nuova attività
          </Button>
        </div>
      </div>

      {/* Totali selezione */}
      {!loading && attivita.length > 0 && (
        <div className="flex gap-4 text-sm px-1">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{attivita.length}</span> attività
          </span>
          <span className="text-muted-foreground">
            Ore erogate: <span className="font-medium text-foreground tabular-nums">{formatOre(totaleOreMin)}</span>
          </span>
          <span className="text-muted-foreground">
            Competenze: <span className="font-medium text-foreground tabular-nums">{formatValuta(totaleValore)}</span>
          </span>
          <span className="text-muted-foreground">
            Spese: <span className="font-medium text-foreground tabular-nums">{formatValuta(totaleSpese)}</span>
          </span>
          <span className="text-muted-foreground font-medium">
            Totale: <span className="text-foreground tabular-nums">{formatValuta(totaleGenerale)}</span>
          </span>
        </div>
      )}

      {/* Tabella */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : attivita.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">
          Nessuna attività nel periodo selezionato
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-1 font-medium">
                  <button
                    onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1 hover:text-foreground text-foreground"
                  >
                    Data
                    {sortDir === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : sortDir === 'desc' ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="text-left px-3 py-1 font-medium">Ore</th>
                <th className="text-left px-3 py-1 font-medium">Committente › Cliente</th>
                <th className="text-left px-3 py-1 font-medium hidden md:table-cell">Progetto</th>
                <th className="text-left px-3 py-1 font-medium">Tipo</th>
                <th className="text-left px-3 py-1 font-medium hidden md:table-cell">Descrizione</th>
                <th className="text-right px-3 py-1 font-medium hidden lg:table-cell">€/h</th>
                <th className="text-right px-3 py-1 font-medium hidden lg:table-cell">Valore</th>
                <th className="text-center px-3 py-1 font-medium">Fatt.</th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {attivitaOrdinata.map((row) => {
                const durata = row.oreErogate ?? calcolaDurata(row.oraInizio, row.oraFine)
                const colore = coloreCommittente(row.committenteId)
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-1 whitespace-nowrap text-xs">
                      {new Date(row.dataAttivita + 'T00:00:00').toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap tabular-nums text-xs">
                      {formatOre(durata)}
                    </td>
                    <td className="px-3 py-1 text-sm">
                      <span className="font-medium" style={{ color: colore }}>
                        {row.committente.ragioneSociale}
                      </span>
                      {row.cliente && (
                        <>
                          <span className="text-muted-foreground"> › </span>
                          {row.cliente.ragioneSociale}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-1 text-muted-foreground text-xs hidden md:table-cell">
                      {row.progetto?.nome ?? '—'}
                    </td>
                    <td className="px-3 py-1">
                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', TIPO_COLORS[row.tipoAttivita.codice] ?? 'bg-muted text-muted-foreground')}>
                        {row.tipoAttivita.codice}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-muted-foreground text-xs max-w-xs truncate hidden md:table-cell">
                      {row.descrizione ?? '—'}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-xs hidden lg:table-cell">
                      {row.prezzoUnitario != null ? formatValuta(row.prezzoUnitario) : '—'}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-xs hidden lg:table-cell">
                      {row.valoreAttivita != null ? formatValuta(row.valoreAttivita) : '—'}
                    </td>
                    <td className="px-3 py-1 text-center">
                      {row.fatturabile ? (
                        <span className="text-green-600 text-xs">✓</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => apriModifica(row.id)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          disabled={deletingId === row.id}
                          onClick={() => handleDeleteRow(row.id)}
                        >
                          {deletingId === row.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog crea/modifica */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifica attività' : 'Nuova attività'}</DialogTitle>
          </DialogHeader>
          {formDialogOpen && (
            <AttivitaForm
              committenti={committenti}
              tipiAttivita={tipiAttivita.filter((t) => t.attivo)}
              eventId={editId}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onClose={onClose}
              onNuova={onNuova}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog gestione tipi */}
      <TipiAttivitaDialog
        open={tipiDialogOpen}
        onOpenChange={setTipiDialogOpen}
        onChanged={async () => {
          const res = await fetch('/api/tipo-attivita')
          if (res.ok) setTipiAttivita(await res.json())
        }}
      />
    </div>
  )
}
