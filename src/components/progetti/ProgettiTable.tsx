'use client'

import { Fragment, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { cn, formatOre } from '@/lib/utils'
import ProgettoAllegatiDialog from '@/components/progetti/ProgettoAllegatiDialog'

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

type OrePerTipo = {
  tipoAttivitaId: number
  codice: string
  descrizione: string
  oreErogate: number
  oreStimate: number
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
  tipiAttivita: { tipoAttivitaId: number; tipoAttivita: { id: number; codice: string; descrizione: string } }[]
  orePerTipo: OrePerTipo[]
  _count: { attivita: number; allegati: number }
  oreErogateTotale: number
  oreStimaTotale: number
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
  const [allegatiProgetto, setAllegatiProgetto] = useState<Progetto | null>(null)

  // Stime nel form: mappa tipoAttivitaId → { giorni, ore }
  const [stimeForm, setStimeForm] = useState<Record<number, { giorni: string; ore: string }>>({})
  // Tipi attività selezionati nel form
  const [tipiSel, setTipiSel] = useState<Set<number>>(new Set())

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
    setTipiSel(new Set())
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
    setTipiSel(new Set([...p.tipiAttivita.map(t => t.tipoAttivitaId), ...p.stime.map(s => s.tipoAttivitaId)]))
    setEditing(p)
    setDialogOpen(true)
  }

  function toggleTipo(id: number, on: boolean) {
    setTipiSel(prev => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function buildStime() {
    return tipiAttivita
      .filter(t => tipiSel.has(t.id))
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
      if (tipiSel.size === 0) {
        toast.error('Seleziona almeno un tipo attività')
        return
      }
      const stime = data.tipoBudget === 'STIMATO' ? buildStime() : []
      const payload = {
        ...data,
        codice: data.codice || null,
        descrizione: data.descrizione || null,
        dataInizio: data.dataInizio || null,
        dataFinePrevista: data.dataFinePrevista || null,
        note: data.note || null,
        tipiAttivitaIds: [...tipiSel],
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
                <th className="text-left px-3 py-1.5 font-medium w-8"></th>
                <th className="text-left px-3 py-1.5 font-medium">Progetto</th>
                <th className="text-left px-3 py-1.5 font-medium hidden md:table-cell">Committente › Cliente</th>
                <th className="text-left px-3 py-1.5 font-medium hidden sm:table-cell">Budget</th>
                <th className="text-left px-3 py-1.5 font-medium hidden lg:table-cell">Tipi attività</th>
                <th className="text-left px-3 py-1.5 font-medium hidden lg:table-cell">Date</th>
                <th className="text-right px-3 py-1.5 font-medium hidden md:table-cell">Stimate</th>
                <th className="text-right px-3 py-1.5 font-medium hidden md:table-cell">Erogate</th>
                <th className="text-center px-3 py-1.5 font-medium hidden sm:table-cell">Att.</th>
                <th className="px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {progettiFiltrati.map(p => (
                <Fragment key={p.id}>
                  <tr
                    className={cn('hover:bg-muted/30', !p.attivo && 'opacity-50')}
                  >
                    <td className="px-3 py-1.5">
                      {p.orePerTipo.length > 0 && (
                        <button
                          title="Dettaglio per tipo attività"
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{p.nome}</div>
                      {p.codice && <div className="text-xs text-muted-foreground">{p.codice}</div>}
                    </td>
                    <td className="px-3 py-1.5 hidden md:table-cell">
                      <div className="text-xs">
                        <span className="font-medium">{p.committente.ragioneSociale}</span>
                        <span className="text-muted-foreground"> › {p.cliente.ragioneSociale}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 hidden sm:table-cell">
                      <Badge variant={p.tipoBudget === 'STIMATO' ? 'default' : 'secondary'} className="text-xs">
                        {p.tipoBudget === 'STIMATO' ? 'Stimato' : 'Consuntivo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {p.tipiAttivita.map(t => (
                          <span
                            key={t.tipoAttivitaId}
                            title={t.tipoAttivita.descrizione}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                          >
                            {t.tipoAttivita.codice}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDate(p.dataInizio)} {p.dataFinePrevista && `→ ${formatDate(p.dataFinePrevista)}`}
                    </td>
                    <td className="px-3 py-1.5 hidden md:table-cell text-right text-xs text-muted-foreground">
                      {p.tipoBudget === 'STIMATO' && p.oreStimaTotale > 0 ? formatOre(p.oreStimaTotale) : '—'}
                    </td>
                    <td className={cn(
                      'px-3 py-1.5 hidden md:table-cell text-right text-xs font-medium',
                      p.tipoBudget === 'STIMATO' && p.oreStimaTotale > 0
                        ? p.oreErogateTotale >= p.oreStimaTotale
                          ? 'text-red-600 bg-red-50'
                          : p.oreErogateTotale >= p.oreStimaTotale * 0.8
                            ? 'text-yellow-700 bg-yellow-50'
                            : 'text-foreground'
                        : 'text-foreground'
                    )}>
                      {p.oreErogateTotale > 0 ? formatOre(p.oreErogateTotale) : '—'}
                    </td>
                    <td className="px-3 py-1.5 hidden sm:table-cell text-center text-xs text-muted-foreground">
                      {p._count.attivita}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setAllegatiProgetto(p)}
                          title="Allegati"
                          className="relative p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {p._count.allegati > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] leading-[14px] text-center">
                              {p._count.allegati}
                            </span>
                          )}
                        </button>
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
                  {/* Riga espansa: dettaglio per tipo attività */}
                  {expandedId === p.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={10} className="px-6 py-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Ore per tipo attività</div>
                        <table className="text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left font-medium pr-6 py-0.5">Tipo</th>
                              {p.tipoBudget === 'STIMATO' && <th className="text-right font-medium px-3 py-0.5">Stimate</th>}
                              <th className="text-right font-medium px-3 py-0.5">Erogate</th>
                              {p.tipoBudget === 'STIMATO' && <th className="text-right font-medium px-3 py-0.5">Residuo</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {p.orePerTipo.map(r => {
                              const residuo = r.oreStimate - r.oreErogate
                              const previsto = p.tipiAttivita.some(t => t.tipoAttivitaId === r.tipoAttivitaId)
                              return (
                                <tr key={r.tipoAttivitaId}>
                                  <td className="pr-6 py-0.5">
                                    <span className="font-medium">{r.codice}</span>
                                    <span className="text-muted-foreground ml-1">· {r.descrizione}</span>
                                    {!previsto && <span className="ml-1 text-yellow-700">(non previsto)</span>}
                                  </td>
                                  {p.tipoBudget === 'STIMATO' && (
                                    <td className="text-right px-3 py-0.5 text-muted-foreground">
                                      {r.oreStimate > 0 ? formatOre(r.oreStimate) : '—'}
                                    </td>
                                  )}
                                  <td className="text-right px-3 py-0.5 font-medium">
                                    {r.oreErogate > 0 ? formatOre(r.oreErogate) : '—'}
                                  </td>
                                  {p.tipoBudget === 'STIMATO' && (
                                    <td className={cn(
                                      'text-right px-3 py-0.5 font-medium',
                                      r.oreStimate > 0 && residuo < 0 ? 'text-red-600' : 'text-emerald-700'
                                    )}>
                                      {r.oreStimate > 0 ? (residuo < 0 ? '−' : '') + formatOre(Math.abs(residuo)) : '—'}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog allegati */}
      <ProgettoAllegatiDialog
        progetto={allegatiProgetto}
        open={allegatiProgetto !== null}
        onOpenChange={o => { if (!o) setAllegatiProgetto(null) }}
        onCountChange={(id, count) =>
          setProgetti(prev => prev.map(x => x.id === id ? { ...x, _count: { ...x._count, allegati: count } } : x))
        }
      />

      {/* Dialog form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica progetto' : 'Nuovo progetto'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 py-1">
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

            {/* Tipi attività del progetto (+ stime se STIMATO) */}
            <div className="space-y-2 border rounded-md p-3 bg-muted/20">
              <div className="text-sm font-medium">Tipi attività del progetto *</div>
              <div className="text-xs text-muted-foreground mb-2">
                {watchTipoBudget === 'STIMATO'
                  ? 'Seleziona i tipi previsti e indica i giorni stimati per ciascuno.'
                  : 'Seleziona i tipi di attività che possono essere registrati sul progetto.'}
              </div>
              <div className="space-y-1.5">
                {tipiAttivita.map(t => {
                  const checked = tipiSel.has(t.id)
                  return (
                    <div key={t.id} className="grid grid-cols-3 gap-2 items-center min-h-7">
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer col-span-1">
                        <Checkbox checked={checked} onCheckedChange={v => toggleTipo(t.id, v === true)} />
                        <span>
                          {t.codice}
                          <span className="text-muted-foreground font-normal ml-1">{t.descrizione}</span>
                        </span>
                      </label>
                      {watchTipoBudget === 'STIMATO' && checked && (
                        <>
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
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

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
