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
import { Badge } from '@/components/ui/badge'
import { TipiAttivitaDialog } from './TipiAttivitaDialog'
import { AttivitaForm } from './AttivitaForm'
import { formatOre, calcolaDurata, coloreCommittente } from '@/lib/utils'
import { Plus, Settings2, Pencil, Loader2 } from 'lucide-react'

interface Committente { id: number; ragioneSociale: string }
interface TipoAttivita { id: number; codice: string; descrizione: string; attivo: boolean }
interface AttivitaRow {
  id: string
  dataAttivita: string
  oraInizio: string
  oraFine: string
  oreErogate: number | null
  committenteId: number
  clienteId: number
  progettoId: number | null
  tipoAttivitaId: number
  descrizione: string | null
  fatturabile: boolean
  committente: { ragioneSociale: string }
  cliente: { ragioneSociale: string }
  tipoAttivita: { codice: string }
  progetto: { nome: string } | null
}

interface AttivitaTableProps {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
}

function primoGiornoMese(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function oggi(): string {
  return new Date().toISOString().split('T')[0]
}

export function AttivitaTable({ committenti, tipiAttivita: initialTipi }: AttivitaTableProps) {
  const [tipiAttivita, setTipiAttivita] = useState(initialTipi)
  const [attivita, setAttivita] = useState<AttivitaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(primoGiornoMese())
  const [to, setTo] = useState(oggi())
  const [filterCommittente, setFilterCommittente] = useState('')
  const [tipiDialogOpen, setTipiDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | undefined>(undefined)

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
    setFormDialogOpen(false)
    caricaAttivita()
  }

  function onDeleted() {
    setFormDialogOpen(false)
    caricaAttivita()
  }

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
                <th className="text-left px-3 py-2 font-medium">Data</th>
                <th className="text-left px-3 py-2 font-medium">Ore erogate</th>
                <th className="text-left px-3 py-2 font-medium">Committente › Cliente</th>
                <th className="text-left px-3 py-2 font-medium">Progetto</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Descrizione</th>
                <th className="text-center px-3 py-2 font-medium">Fatt.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {attivita.map((row) => {
                const durata = row.oreErogate ?? calcolaDurata(row.oraInizio, row.oraFine)
                const colore = coloreCommittente(row.committenteId)
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(row.dataAttivita + 'T00:00:00').toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {formatOre(durata)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium" style={{ color: colore }}>
                        {row.committente.ragioneSociale}
                      </span>
                      <span className="text-muted-foreground"> › </span>
                      {row.cliente.ragioneSociale}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.progetto?.nome ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{row.tipoAttivita.codice}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                      {row.descrizione ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.fatturabile ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => apriModifica(row.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
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
