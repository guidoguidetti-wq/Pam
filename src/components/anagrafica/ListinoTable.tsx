'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Committente = { id: number; ragioneSociale: string }
type Cliente = { id: number; ragioneSociale: string }
type TipoAttivita = { id: number; codice: string; descrizione: string }

type RigaListino = {
  id: number
  committenteId: number
  clienteId: number | null
  tipoAttivitaId: number | null
  tipoVoce: 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO'
  tariffa: string
  valuta: string
  oreGiornata: string
  dataInizio: string
  dataFine: string | null
  note: string | null
  committente: { id: number; ragioneSociale: string }
  cliente: { id: number; ragioneSociale: string } | null
  tipoAttivita: { id: number; codice: string; descrizione: string } | null
}

const TIPI_VOCE = [
  { value: 'ORARIO', label: 'Orario (€/h)' },
  { value: 'GIORNALIERO', label: 'Giornaliero (€/g)' },
  { value: 'KM', label: 'Chilometrico (€/km)' },
  { value: 'RIMBORSO', label: 'Rimborso forfettario' },
]

const formSchema = z.object({
  committenteId: z.coerce.number().int().positive('Committente obbligatorio'),
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  tipoAttivitaId: z.coerce.number().int().positive().nullable().optional(),
  tipoVoce: z.enum(['ORARIO', 'GIORNALIERO', 'KM', 'RIMBORSO']),
  tariffa: z.coerce.number().positive('Tariffa obbligatoria'),
  oreGiornata: z.coerce.number().positive().default(8),
  dataInizio: z.string().min(1, 'Data inizio obbligatoria'),
  dataFine: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

type FormData = z.infer<typeof formSchema>

function scopeLabel(row: RigaListino) {
  if (row.cliente && row.tipoAttivita)
    return { label: `${row.cliente.ragioneSociale} · ${row.tipoAttivita.codice}`, priority: 1 }
  if (row.cliente)
    return { label: row.cliente.ragioneSociale, priority: 2 }
  if (row.tipoAttivita)
    return { label: `Tipo: ${row.tipoAttivita.codice}`, priority: 3 }
  return { label: 'Default committente', priority: 4 }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT')
}

function tipoVoceLabel(tv: string) {
  return TIPI_VOCE.find(t => t.value === tv)?.label ?? tv
}

const PRIORITY_COLORS = ['', 'bg-purple-100 text-purple-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-gray-100 text-gray-700']

export default function ListinoTable({
  committenti,
  tipiAttivita,
}: {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
}) {
  const [righe, setRighe] = useState<RigaListino[]>([])
  const [filtroCommittente, setFiltroCommittente] = useState<number | null>(null)
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RigaListino | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { tipoVoce: 'ORARIO', oreGiornata: 8 },
  })

  const watchCommittente = watch('committenteId')
  const watchCliente = watch('clienteId')

  // Carica listino
  useEffect(() => {
    const url = filtroCommittente
      ? `/api/listino?committente_id=${filtroCommittente}`
      : '/api/listino'
    fetch(url).then(r => r.json()).then(setRighe).catch(console.error)
  }, [filtroCommittente])

  // Carica clienti quando cambia committente nel form
  useEffect(() => {
    if (!watchCommittente) { setClienti([]); return }
    fetch(`/api/clienti?committente_id=${watchCommittente}`)
      .then(r => r.json())
      .then(setClienti)
      .catch(console.error)
  }, [watchCommittente])

  function openNew() {
    reset({
      committenteId: filtroCommittente ?? undefined,
      clienteId: null,
      tipoAttivitaId: null,
      tipoVoce: 'ORARIO',
      tariffa: undefined,
      oreGiornata: 8,
      dataInizio: '',
      dataFine: null,
      note: null,
    })
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(row: RigaListino) {
    reset({
      committenteId: row.committenteId,
      clienteId: row.clienteId ?? null,
      tipoAttivitaId: row.tipoAttivitaId ?? null,
      tipoVoce: row.tipoVoce,
      tariffa: parseFloat(row.tariffa),
      oreGiornata: parseFloat(row.oreGiornata),
      dataInizio: row.dataInizio ? row.dataInizio.split('T')[0] : '',
      dataFine: row.dataFine ? row.dataFine.split('T')[0] : null,
      note: row.note ?? null,
    })
    setEditing(row)
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const url = editing ? `/api/listino/${editing.id}` : '/api/listino'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, valuta: 'EUR' }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Errore salvataggio')
        return
      }
      const saved: RigaListino = await res.json()
      if (editing) {
        setRighe(prev => prev.map(r => r.id === saved.id ? saved : r))
        toast.success('Tariffa aggiornata')
      } else {
        setRighe(prev => [...prev, saved])
        toast.success('Tariffa aggiunta')
      }
      setDialogOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(row: RigaListino) {
    if (!confirm(`Eliminare la tariffa per "${scopeLabel(row).label}"?`)) return
    const res = await fetch(`/api/listino/${row.id}`, { method: 'DELETE' })
    if (res.ok) {
      setRighe(prev => prev.filter(r => r.id !== row.id))
      toast.success('Tariffa eliminata')
    } else {
      toast.error('Errore durante l\'eliminazione')
    }
  }

  const righeFiltrate = filtroCommittente
    ? righe.filter(r => r.committenteId === filtroCommittente)
    : righe

  return (
    <div className="space-y-4">
      {/* Filtro + Pulsante */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFiltroCommittente(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filtroCommittente === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            Tutti
          </button>
          {committenti.map(c => (
            <button
              key={c.id}
              onClick={() => setFiltroCommittente(c.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filtroCommittente === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {c.ragioneSociale}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuova tariffa
        </Button>
      </div>

      {/* Tabella */}
      {righeFiltrate.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nessuna tariffa. Seleziona un committente e aggiungi la prima riga.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Committente</th>
                <th className="text-left px-3 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-3 py-2.5 font-medium">Scope</th>
                <th className="text-left px-3 py-2.5 font-medium">Tipo voce</th>
                <th className="text-right px-3 py-2.5 font-medium">Tariffa</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Dal</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Al</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {righeFiltrate.map(row => {
                const { label, priority } = scopeLabel(row)
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-xs">{row.committente.ragioneSociale}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.cliente?.ragioneSociale ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', PRIORITY_COLORS[priority])}>
                        P{priority} · {label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{tipoVoceLabel(row.tipoVoce)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm">
                      € {parseFloat(row.tariffa).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{formatDate(row.dataInizio)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{formatDate(row.dataFine)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(row)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDelete(row)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica tariffa' : 'Nuova tariffa'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Committente */}
            <div className="space-y-1">
              <Label>Committente *</Label>
              <Select
                value={watchCommittente ? String(watchCommittente) : ''}
                onValueChange={v => {
                  setValue('committenteId', parseInt(v))
                  setValue('clienteId', null)
                }}
              >
                <SelectTrigger className={errors.committenteId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Seleziona committente…" />
                </SelectTrigger>
                <SelectContent>
                  {committenti.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.ragioneSociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.committenteId && <p className="text-xs text-destructive">{errors.committenteId.message}</p>}
            </div>

            {/* Cliente (opzionale) */}
            <div className="space-y-1">
              <Label>Cliente <span className="text-muted-foreground text-xs">(lascia vuoto per tariffa default committente)</span></Label>
              <Select
                value={watchCliente ? String(watchCliente) : 'null'}
                onValueChange={v => setValue('clienteId', v === 'null' ? null : parseInt(v))}
                disabled={!watchCommittente || clienti.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i clienti (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">— Tutti i clienti (default) —</SelectItem>
                  {clienti.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.ragioneSociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo attività (opzionale) */}
            <div className="space-y-1">
              <Label>Tipo attività <span className="text-muted-foreground text-xs">(lascia vuoto per tutti i tipi)</span></Label>
              <Select
                value={watch('tipoAttivitaId') ? String(watch('tipoAttivitaId')) : 'null'}
                onValueChange={v => setValue('tipoAttivitaId', v === 'null' ? null : parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i tipi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">— Tutti i tipi —</SelectItem>
                  {tipiAttivita.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.codice} · {t.descrizione}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo voce + Tariffa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo voce *</Label>
                <Select
                  value={watch('tipoVoce')}
                  onValueChange={v => setValue('tipoVoce', v as 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPI_VOCE.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tariffa (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className={errors.tariffa ? 'border-destructive' : ''}
                  {...register('tariffa')}
                />
                {errors.tariffa && <p className="text-xs text-destructive">{errors.tariffa.message}</p>}
              </div>
            </div>

            {/* Ore giornata */}
            <div className="space-y-1">
              <Label>Ore per giornata</Label>
              <Input type="number" step="0.5" min="1" max="24" {...register('oreGiornata')} />
            </div>

            {/* Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data inizio *</Label>
                <Input
                  type="date"
                  className={errors.dataInizio ? 'border-destructive' : ''}
                  {...register('dataInizio')}
                />
                {errors.dataInizio && <p className="text-xs text-destructive">{errors.dataInizio.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Data fine <span className="text-muted-foreground text-xs">(opzionale)</span></Label>
                <Input type="date" {...register('dataFine')} />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1">
              <Label>Note</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                {...register('note')}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Salvataggio…' : 'Salva'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
