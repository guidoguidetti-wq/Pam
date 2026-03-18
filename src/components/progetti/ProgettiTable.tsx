'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Committente = { id: number; ragioneSociale: string }
type Cliente = { id: number; ragioneSociale: string }
type TipoAttivita = { id: number; codice: string; descrizione: string }

type Stima = {
  id: number
  tipoAttivitaId: number
  giorniStimati: string
  orePerGiorno: string
  tipoAttivita: { id: number; codice: string; descrizione: string }
}

type Progetto = {
  id: number
  committenteId: number
  clienteId: number
  codice: string | null
  nome: string
  descrizione: string | null
  tipoBudget: 'STIMATO' | 'CONSUNTIVO'
  dataInizio: string | null
  dataFinePrevista: string | null
  attivo: boolean
  note: string | null
  committente: { id: number; ragioneSociale: string }
  cliente: { id: number; ragioneSociale: string }
  stime: Stima[]
  _count: { attivita: number }
}

const formSchema = z.object({
  committenteId: z.coerce.number().int().positive('Committente obbligatorio'),
  clienteId: z.coerce.number().int().positive('Cliente obbligatorio'),
  codice: z.string().max(50).optional(),
  nome: z.string().trim().min(1, 'Nome obbligatorio').max(200),
  descrizione: z.string().optional(),
  tipoBudget: z.enum(['STIMATO', 'CONSUNTIVO']).default('CONSUNTIVO'),
  dataInizio: z.string().optional(),
  dataFinePrevista: z.string().optional(),
  attivo: z.boolean().default(true),
  note: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT')
}

export default function ProgettiTable({
  committenti,
  tipiAttivita,
}: {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
}) {
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [filtroCommittente, setFiltroCommittente] = useState<number | null>(null)
  const [mostraInattivi, setMostraInattivi] = useState(false)
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Progetto | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Stime nel form: mappa tipoAttivitaId → { giorni, ore }
  const [stimeForm, setStimeForm] = useState<Record<number, { giorni: string; ore: string }>>({})

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { tipoBudget: 'CONSUNTIVO', attivo: true },
  })

  const watchCommittente = watch('committenteId')
  const watchTipoBudget = watch('tipoBudget')
  const watchAttivo = watch('attivo')

  // Carica progetti
  useEffect(() => {
    const url = filtroCommittente
      ? `/api/progetti?committente_id=${filtroCommittente}`
      : '/api/progetti'
    fetch(url).then(r => r.json()).then(setProgetti).catch(console.error)
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
      clienteId: undefined,
      codice: '',
      nome: '',
      descrizione: '',
      tipoBudget: 'CONSUNTIVO',
      dataInizio: '',
      dataFinePrevista: '',
      attivo: true,
      note: '',
    })
    setStimeForm({})
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(p: Progetto) {
    reset({
      committenteId: p.committenteId,
      clienteId: p.clienteId,
      codice: p.codice ?? '',
      nome: p.nome,
      descrizione: p.descrizione ?? '',
      tipoBudget: p.tipoBudget,
      dataInizio: p.dataInizio ? p.dataInizio.split('T')[0] : '',
      dataFinePrevista: p.dataFinePrevista ? p.dataFinePrevista.split('T')[0] : '',
      attivo: p.attivo,
      note: p.note ?? '',
    })
    // Precompila stime
    const sf: Record<number, { giorni: string; ore: string }> = {}
    p.stime.forEach(s => {
      sf[s.tipoAttivitaId] = {
        giorni: parseFloat(s.giorniStimati).toString(),
        ore: parseFloat(s.orePerGiorno).toString(),
      }
    })
    setStimeForm(sf)
    setEditing(p)
    setDialogOpen(true)
  }

  function buildStime() {
    return tipiAttivita
      .filter(t => {
        const g = parseFloat(stimeForm[t.id]?.giorni ?? '0')
        return g > 0
      })
      .map(t => ({
        tipoAttivitaId: t.id,
        giorniStimati: parseFloat(stimeForm[t.id].giorni),
        orePerGiorno: parseFloat(stimeForm[t.id]?.ore ?? '8') || 8,
      }))
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const stime = data.tipoBudget === 'STIMATO' ? buildStime() : []
      const payload = {
        ...data,
        codice: data.codice || null,
        descrizione: data.descrizione || null,
        dataInizio: data.dataInizio || null,
        dataFinePrevista: data.dataFinePrevista || null,
        note: data.note || null,
        stime,
      }

      const url = editing ? `/api/progetti/${editing.id}` : '/api/progetti'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Errore salvataggio')
        return
      }
      const saved: Progetto = await res.json()
      if (editing) {
        setProgetti(prev => prev.map(p => p.id === saved.id ? saved : p))
        toast.success('Progetto aggiornato')
      } else {
        setProgetti(prev => [...prev, saved])
        toast.success('Progetto creato')
      }
      setDialogOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(p: Progetto) {
    if (!confirm(`Eliminare il progetto "${p.nome}"?`)) return
    const res = await fetch(`/api/progetti/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setProgetti(prev => prev.filter(x => x.id !== p.id))
      toast.success('Progetto eliminato')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Errore durante l\'eliminazione')
    }
  }

  const progettiFiltrati = progetti.filter(p => mostraInattivi || p.attivo)

  return (
    <div className="space-y-4">
      {/* Filtri */}
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
        <div className="flex items-center gap-2 ml-2">
          <Switch checked={mostraInattivi} onCheckedChange={setMostraInattivi} id="inattivi" />
          <label htmlFor="inattivi" className="text-sm text-muted-foreground cursor-pointer">Mostra inattivi</label>
        </div>
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuovo progetto
        </Button>
      </div>

      {/* Tabella */}
      {progettiFiltrati.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nessun progetto trovato.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium w-8"></th>
                <th className="text-left px-3 py-2.5 font-medium">Progetto</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Committente › Cliente</th>
                <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Tipo</th>
                <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Date</th>
                <th className="text-center px-3 py-2.5 font-medium hidden sm:table-cell">Att.</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {progettiFiltrati.map(p => (
                <>
                  <tr
                    key={p.id}
                    className={cn('hover:bg-muted/30', !p.attivo && 'opacity-50')}
                  >
                    <td className="px-3 py-2.5">
                      {p.tipoBudget === 'STIMATO' && p.stime.length > 0 && (
                        <button
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.nome}</div>
                      {p.codice && <div className="text-xs text-muted-foreground">{p.codice}</div>}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <div className="text-xs">
                        <span className="font-medium">{p.committente.ragioneSociale}</span>
                        <span className="text-muted-foreground"> › {p.cliente.ragioneSociale}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <Badge variant={p.tipoBudget === 'STIMATO' ? 'default' : 'secondary'} className="text-xs">
                        {p.tipoBudget === 'STIMATO' ? 'Stimato' : 'Consuntivo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDate(p.dataInizio)} {p.dataFinePrevista && `→ ${formatDate(p.dataFinePrevista)}`}
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell text-center text-xs text-muted-foreground">
                      {p._count.attivita}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(p)}
                          disabled={p._count.attivita > 0}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Riga espansa: stime */}
                  {expandedId === p.id && (
                    <tr key={`${p.id}-stime`} className="bg-muted/20">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Stime per tipo attività</div>
                        <div className="flex flex-wrap gap-3">
                          {p.stime.map(s => (
                            <div key={s.id} className="bg-background border rounded px-3 py-2 text-xs">
                              <span className="font-medium">{s.tipoAttivita.codice}</span>
                              <span className="text-muted-foreground ml-1">· {s.tipoAttivita.descrizione}</span>
                              <div className="mt-0.5 text-muted-foreground">
                                {parseFloat(s.giorniStimati).toFixed(1)} gg × {parseFloat(s.orePerGiorno).toFixed(1)} h
                                <span className="ml-1 font-medium text-foreground">
                                  = {(parseFloat(s.giorniStimati) * parseFloat(s.orePerGiorno)).toFixed(1)} h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica progetto' : 'Nuovo progetto'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Committente */}
            <div className="space-y-1">
              <Label>Committente *</Label>
              <Select
                value={watchCommittente ? String(watchCommittente) : ''}
                onValueChange={v => {
                  setValue('committenteId', parseInt(v))
                  setValue('clienteId', 0)
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

            {/* Cliente */}
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Select
                value={watch('clienteId') ? String(watch('clienteId')) : ''}
                onValueChange={v => setValue('clienteId', parseInt(v))}
                disabled={!watchCommittente || clienti.length === 0}
              >
                <SelectTrigger className={errors.clienteId ? 'border-destructive' : ''}>
                  <SelectValue placeholder={!watchCommittente ? 'Prima seleziona committente' : 'Seleziona cliente…'} />
                </SelectTrigger>
                <SelectContent>
                  {clienti.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.ragioneSociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clienteId && <p className="text-xs text-destructive">{errors.clienteId.message}</p>}
            </div>

            {/* Codice + Nome */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Codice</Label>
                <Input placeholder="PRJ-001" {...register('codice')} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome progetto"
                  className={errors.nome ? 'border-destructive' : ''}
                  {...register('nome')}
                />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
              </div>
            </div>

            {/* Descrizione */}
            <div className="space-y-1">
              <Label>Descrizione</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                {...register('descrizione')}
              />
            </div>

            {/* Tipo budget */}
            <div className="space-y-1">
              <Label>Tipo budget</Label>
              <Select
                value={watchTipoBudget}
                onValueChange={v => setValue('tipoBudget', v as 'STIMATO' | 'CONSUNTIVO')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSUNTIVO">Consuntivo (solo accumulo ore)</SelectItem>
                  <SelectItem value="STIMATO">Stimato (con budget per tipo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stime (solo STIMATO) */}
            {watchTipoBudget === 'STIMATO' && (
              <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                <div className="text-sm font-medium">Giorni stimati per tipo attività</div>
                <div className="text-xs text-muted-foreground mb-2">Lascia vuoto i tipi non previsti in questo progetto.</div>
                <div className="space-y-2">
                  {tipiAttivita.map(t => (
                    <div key={t.id} className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs font-medium col-span-1">
                        {t.codice}
                        <span className="text-muted-foreground font-normal ml-1">{t.descrizione}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="gg"
                          className="h-7 text-xs"
                          value={stimeForm[t.id]?.giorni ?? ''}
                          onChange={e => setStimeForm(prev => ({
                            ...prev,
                            [t.id]: { giorni: e.target.value, ore: prev[t.id]?.ore ?? '8' }
                          }))}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">gg</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          placeholder="8"
                          className="h-7 text-xs"
                          value={stimeForm[t.id]?.ore ?? ''}
                          onChange={e => setStimeForm(prev => ({
                            ...prev,
                            [t.id]: { giorni: prev[t.id]?.giorni ?? '', ore: e.target.value }
                          }))}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">h/g</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data inizio</Label>
                <Input type="date" {...register('dataInizio')} />
              </div>
              <div className="space-y-1">
                <Label>Data fine prevista</Label>
                <Input type="date" {...register('dataFinePrevista')} />
              </div>
            </div>

            {/* Note + Attivo */}
            <div className="space-y-1">
              <Label>Note</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                {...register('note')}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={watchAttivo}
                onCheckedChange={v => setValue('attivo', v)}
                id="attivo"
              />
              <label htmlFor="attivo" className="text-sm">Progetto attivo</label>
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
