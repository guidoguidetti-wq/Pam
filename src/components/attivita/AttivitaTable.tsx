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
import { Plus, Settings2, Pencil, Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'

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

export function AttivitaTable({ committenti: _committenti, tipiAttivita: initialTipi }: AttivitaTableProps) {
  const [tipiAttivita, setTipiAttivita] = useState(initialTipi)
  const [attivita, setAttivita] = useState<AttivitaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(primoGiornoAnno())
  const [to, setTo] = useState(fineAnno())
  const [tipiDialogOpen, setTipiDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Filtri colonna (client-side)
  const [fCommittente, setFCommittente] = useState('')
  const [fProgetto, setFProgetto] = useState('')
  const [fTipo, setFTipo] = useState('')

  const caricaAttivita = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/attivita?${params}`)
      if (!res.ok) { toast.error('Errore caricamento attività'); return }
      const data: AttivitaRow[] = await res.json()
      setAttivita(data)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { caricaAttivita() }, [caricaAttivita])

  function apriNuova() {
    setEditId(undefined)
    setFormDialogOpen(true)
  }

  function apriModifica(id: string) {
    setEditId(id)
    setFormDialogOpen(true)
  }

  function onSaved() { caricaAttivita() }
  function onClose() { setFormDialogOpen(false); caricaAttivita() }
  function onNuova() { setEditId(undefined) }
  function onDeleted() { setFormDialogOpen(false); caricaAttivita() }

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

  // Ordinamento
  const attivitaOrdinata = [...attivita].sort((a, b) => {
    const cmp = a.dataAttivita.localeCompare(b.dataAttivita)
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Filtri colonna client-side
  const attivitaFiltrata = attivitaOrdinata.filter(row => {
    if (fCommittente) {
      const q = fCommittente.toLowerCase()
      const matchComm = row.committente.ragioneSociale.toLowerCase().includes(q)
      const matchCliente = row.cliente?.ragioneSociale.toLowerCase().includes(q) ?? false
      if (!matchComm && !matchCliente) return false
    }
    if (fProgetto && !row.progetto?.nome.toLowerCase().includes(fProgetto.toLowerCase())) return false
    if (fTipo && row.tipoAttivita.codice !== fTipo) return false
    return true
  })

  const hasColFilter = fCommittente || fProgetto || fTipo

  // Totali sulla lista filtrata
  const totaleOreMin = attivitaFiltrata.reduce((acc, row) =>
    acc + (row.oreErogate ?? calcolaDurata(row.oraInizio, row.oraFine)), 0)
  const totaleValore = attivitaFiltrata.reduce((acc, row) => acc + (row.valoreAttivita ?? 0), 0)
  const totaleSpese = attivitaFiltrata.reduce((acc, row) => acc + (row.totaleSpese ?? 0), 0)
  const totaleGenerale = totaleValore + totaleSpese

  return (
    <div className="space-y-4">
      {/* Barra filtri data */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dal</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Al</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
        </div>

        <div className="flex gap-2 ml-auto">
          {hasColFilter && (
            <Button variant="outline" size="sm" onClick={() => { setFCommittente(''); setFProgetto(''); setFTipo('') }}>
              <X className="h-3.5 w-3.5 mr-1" /> Reset filtri
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setTipiDialogOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Gestisci tipi
          </Button>
          <Button size="sm" onClick={apriNuova}>
            <Plus className="h-4 w-4 mr-1" /> Nuova attività
          </Button>
        </div>
      </div>

      {/* Totali */}
      {!loading && attivita.length > 0 && (
        <div className="flex gap-4 text-sm px-1">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{attivitaFiltrata.length}</span>
            {attivitaFiltrata.length !== attivita.length && (
              <span className="text-muted-foreground"> / {attivita.length}</span>
            )}{' '}attività
          </span>
          <span className="text-muted-foreground">
            Ore: <span className="font-medium text-foreground tabular-nums">{formatOre(totaleOreMin)}</span>
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
              {/* Intestazioni colonne */}
              <tr>
                <th className="text-left px-3 py-1 font-medium">
                  <button
                    onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1 hover:text-foreground text-foreground"
                  >
                    Data
                    {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
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
                <th className="text-center px-3 py-1 font-medium hidden lg:table-cell">Spese</th>
                <th className="px-1 py-1" />
              </tr>
              {/* Filtri colonna */}
              <tr className="border-t bg-muted/20">
                <th className="px-1 py-1" />
                <th className="px-1 py-1" />
                <th className="px-1 py-1">
                  <Input
                    className="h-6 text-xs px-1.5"
                    placeholder="Filtra…"
                    value={fCommittente}
                    onChange={e => setFCommittente(e.target.value)}
                  />
                </th>
                <th className="px-1 py-1 hidden md:table-cell">
                  <Input
                    className="h-6 text-xs px-1.5"
                    placeholder="Filtra…"
                    value={fProgetto}
                    onChange={e => setFProgetto(e.target.value)}
                  />
                </th>
                <th className="px-1 py-1">
                  <Select value={fTipo || '__all__'} onValueChange={v => setFTipo(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-6 text-xs px-1.5 w-full">
                      <SelectValue placeholder="Tutti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tutti</SelectItem>
                      {tipiAttivita.map(t => (
                        <SelectItem key={t.id} value={t.codice}>{t.codice}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </th>
                <th className="px-1 py-1 hidden md:table-cell" />
                <th className="px-1 py-1 hidden lg:table-cell" />
                <th className="px-1 py-1 hidden lg:table-cell" />
                <th className="px-1 py-1" />
                <th className="px-1 py-1 hidden lg:table-cell" />
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {attivitaFiltrata.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center text-muted-foreground py-6 text-sm">
                    Nessuna attività corrisponde ai filtri
                  </td>
                </tr>
              ) : attivitaFiltrata.map((row) => {
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
                      {row.fatturabile ? <span className="text-green-600 text-xs">✓</span> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-1 text-center hidden lg:table-cell">
                      {row.totaleSpese > 0 && <span className="text-blue-600 text-xs font-medium">✓</span>}
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => apriModifica(row.id)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          disabled={deletingId === row.id}
                          onClick={() => handleDeleteRow(row.id)}
                        >
                          {deletingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
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
              committenti={_committenti}
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
