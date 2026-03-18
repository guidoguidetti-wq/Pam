'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Trash2, Clock, RefreshCw } from 'lucide-react'
import { formatOre } from '@/lib/utils'

// ── utilità ore ────────────────────────────────────────────────────────────

/** Parsa "H:MM" o "H.D" in minuti. Restituisce null se non valido. */
function parseOreInput(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    if (parts.length !== 2) return null
    const h = parseInt(parts[0])
    const m = parseInt(parts[1])
    if (isNaN(h) || isNaN(m) || m < 0 || m > 59 || h < 0) return null
    return h * 60 + m
  }
  const h = parseFloat(trimmed.replace(',', '.'))
  if (isNaN(h) || h <= 0) return null
  return Math.round(h * 60)
}

function minsToInput(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// ── schema react-hook-form ─────────────────────────────────────────────────

const schema = z.object({
  dataAttivita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido'),
  oraInizio: z.string().optional(),
  oraFine: z.string().optional(),
  oreErogateTesto: z.string().optional(), // "H:MM" digitato dall'utente
  committenteId: z.string().min(1, 'Obbligatorio'),
  clienteId: z.string().optional(),
  progettoId: z.string().optional(),
  tipoAttivitaId: z.string().min(1, 'Obbligatorio'),
  descrizione: z.string().optional(),
  noteInterne: z.string().optional(),
  fatturabile: z.boolean().default(true),
  prezzoUnitarioTesto: z.string().optional(),
  valoreAttivitaTesto: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ── types ──────────────────────────────────────────────────────────────────

interface Committente { id: number; ragioneSociale: string }
interface TipoAttivita { id: number; codice: string; descrizione: string }
interface Cliente { id: number; ragioneSociale: string }
interface Progetto { id: number; nome: string }

interface DefaultSlot {
  dataAttivita: string
  oraInizio: string
  oraFine: string
}

interface AttivitaFormProps {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
  eventId?: string
  defaultSlot?: DefaultSlot
  onSaved: () => void
  onDeleted?: () => void
}

// ── componente ─────────────────────────────────────────────────────────────

export function AttivitaForm({
  committenti,
  tipiAttivita,
  eventId,
  defaultSlot,
  onSaved,
  onDeleted,
}: AttivitaFormProps) {
  const [modoOrari, setModoOrari] = useState(true) // true = specifica inizio/fine, false = specifica ore erogate
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [loadingClienti, setLoadingClienti] = useState(false)
  const [loadingProgetti, setLoadingProgetti] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingEvent, setLoadingEvent] = useState(false)
  const [loadingPrezzo, setLoadingPrezzo] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataAttivita: defaultSlot?.dataAttivita ?? today,
      oraInizio: defaultSlot?.oraInizio ?? '09:00',
      oraFine: defaultSlot?.oraFine ?? '10:00',
      fatturabile: true,
    },
  })

  const watchCommittenteId = watch('committenteId')
  const watchClienteId = watch('clienteId')
  const watchTipoAttivitaId = watch('tipoAttivitaId')
  const watchDataAttivita = watch('dataAttivita')
  const watchOraInizio = watch('oraInizio')
  const watchOraFine = watch('oraFine')
  const watchOreErogateTesto = watch('oreErogateTesto')
  const watchPrezzoUnitarioTesto = watch('prezzoUnitarioTesto')

  // Ore calcolate da inizio/fine (solo se modoOrari=true)
  const oreCalcolate = (() => {
    if (!modoOrari || !watchOraInizio || !watchOraFine) return null
    const [hi, mi] = watchOraInizio.split(':').map(Number)
    const [hf, mf] = watchOraFine.split(':').map(Number)
    const mins = (hf * 60 + mf) - (hi * 60 + mi)
    return mins > 0 ? mins : null
  })()

  // Carica clienti al cambio committente (solo carica lista, non resetta i valori)
  useEffect(() => {
    if (!watchCommittenteId) { setClienti([]); setProgetti([]); return }
    setLoadingClienti(true)
    fetch(`/api/clienti?committente_id=${watchCommittenteId}`)
      .then((r) => r.json())
      .then((data: Cliente[]) => setClienti(data))
      .finally(() => setLoadingClienti(false))
  }, [watchCommittenteId])

  // Carica progetti al cambio cliente (solo carica lista, non resetta i valori)
  useEffect(() => {
    if (!watchClienteId || !watchCommittenteId) { setProgetti([]); return }
    setLoadingProgetti(true)
    fetch(`/api/progetti?committente_id=${watchCommittenteId}&cliente_id=${watchClienteId}`)
      .then((r) => r.json())
      .then((data: Progetto[]) => setProgetti(data))
      .finally(() => setLoadingProgetti(false))
  }, [watchClienteId, watchCommittenteId])

  // Funzione riutilizzabile per fetch prezzo dal listino
  async function fetchPrezzo() {
    if (!watchCommittenteId) return
    const params = new URLSearchParams({ committente_id: watchCommittenteId })
    if (watchClienteId) params.set('cliente_id', watchClienteId)
    if (watchTipoAttivitaId) params.set('tipo_attivita_id', watchTipoAttivitaId)
    if (watchDataAttivita) params.set('data', watchDataAttivita)
    setLoadingPrezzo(true)
    try {
      const res = await fetch(`/api/listino/prezzo?${params}`)
      const data: { tariffa: number | null } = await res.json()
      setValue('prezzoUnitarioTesto', data.tariffa != null ? String(data.tariffa) : '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPrezzo(false)
    }
  }

  // Fetch prezzo dal listino quando cambiano committente/cliente/tipo/data
  useEffect(() => {
    fetchPrezzo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchCommittenteId, watchClienteId, watchTipoAttivitaId, watchDataAttivita])

  // Calcola valoreAttivita automaticamente al cambio di prezzo o ore
  useEffect(() => {
    const prezzo = parseFloat(watchPrezzoUnitarioTesto ?? '')
    if (isNaN(prezzo) || prezzo <= 0) return
    let oreMin: number | null = null
    if (modoOrari && watchOraInizio && watchOraFine) {
      const [hi, mi] = watchOraInizio.split(':').map(Number)
      const [hf, mf] = watchOraFine.split(':').map(Number)
      const d = (hf * 60 + mf) - (hi * 60 + mi)
      if (d > 0) oreMin = d
    } else if (!modoOrari && watchOreErogateTesto) {
      oreMin = parseOreInput(watchOreErogateTesto)
    }
    if (oreMin !== null && oreMin > 0) {
      setValue('valoreAttivitaTesto', (prezzo * (oreMin / 60)).toFixed(2))
    }
  }, [watchPrezzoUnitarioTesto, watchOraInizio, watchOraFine, watchOreErogateTesto, modoOrari, setValue])

  // Se eventId: carica dati e pre-popola form
  useEffect(() => {
    if (!eventId) return
    setLoadingEvent(true)
    fetch(`/api/attivita/${eventId}`)
      .then((r) => r.json())
      .then(async (ev) => {
        const clientiRes = await fetch(`/api/clienti?committente_id=${ev.committenteId}`)
        const clientiData: Cliente[] = await clientiRes.json()
        setClienti(clientiData)

        if (ev.clienteId) {
          const progettiRes = await fetch(
            `/api/progetti?committente_id=${ev.committenteId}&cliente_id=${ev.clienteId}`
          )
          const progettiData: Progetto[] = await progettiRes.json()
          setProgetti(progettiData)
        }

        setModoOrari(true) // sempre mode orari in modifica
        reset({
          dataAttivita: ev.dataAttivita,
          oraInizio: ev.oraInizio,
          oraFine: ev.oraFine,
          oreErogateTesto: ev.oreErogate ? minsToInput(ev.oreErogate) : '',
          committenteId: String(ev.committenteId),
          clienteId: ev.clienteId ? String(ev.clienteId) : '',
          progettoId: ev.progettoId ? String(ev.progettoId) : '',
          tipoAttivitaId: String(ev.tipoAttivitaId),
          descrizione: ev.descrizione ?? '',
          noteInterne: ev.noteInterne ?? '',
          fatturabile: ev.fatturabile,
          prezzoUnitarioTesto: ev.prezzoUnitario != null ? String(ev.prezzoUnitario) : '',
          valoreAttivitaTesto: ev.valoreAttivita != null ? String(ev.valoreAttivita) : '',
        })
      })
      .finally(() => setLoadingEvent(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // ── submit ──────────────────────────────────────────────────────────────

  async function onSubmit(data: FormData) {
    // Validazione mode-specifica
    if (modoOrari) {
      if (!data.oraInizio || !data.oraFine) {
        toast.error('Specificare ora inizio e ora fine')
        return
      }
      if (!/^\d{2}:\d{2}$/.test(data.oraInizio) || !/^\d{2}:\d{2}$/.test(data.oraFine)) {
        toast.error('Formato ora non valido')
        return
      }
      if (data.oraFine <= data.oraInizio) {
        toast.error('Ora fine deve essere successiva a ora inizio')
        return
      }
    } else {
      const mins = parseOreInput(data.oreErogateTesto ?? '')
      if (!mins || mins <= 0) {
        toast.error('Specificare ore erogate in formato H:MM (es. 2:30)')
        return
      }
    }

    setSubmitting(true)
    try {
      const prezzoNum = parseFloat(data.prezzoUnitarioTesto ?? '')
      const valoreNum = parseFloat(data.valoreAttivitaTesto ?? '')
      const base = {
        dataAttivita: data.dataAttivita,
        committenteId: parseInt(data.committenteId),
        clienteId: data.clienteId ? parseInt(data.clienteId) : null,
        progettoId: data.progettoId ? parseInt(data.progettoId) : null,
        tipoAttivitaId: parseInt(data.tipoAttivitaId),
        descrizione: data.descrizione || null,
        noteInterne: data.noteInterne || null,
        fatturabile: data.fatturabile,
        prezzoUnitario: !isNaN(prezzoNum) && prezzoNum > 0 ? prezzoNum : null,
        valoreAttivita: !isNaN(valoreNum) && valoreNum > 0 ? valoreNum : null,
      }

      const payload = modoOrari
        ? { ...base, oraInizio: data.oraInizio, oraFine: data.oraFine }
        : { ...base, oreErogate: parseOreInput(data.oreErogateTesto ?? '')! }

      const url = eventId ? `/api/attivita/${eventId}` : '/api/attivita'
      const method = eventId ? 'PUT' : 'POST'
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
      toast.success(eventId ? 'Attività aggiornata' : 'Attività creata')
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!eventId) return
    if (!confirm('Eliminare questa attività?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/attivita/${eventId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Errore eliminazione')
        return
      }
      toast.success('Attività eliminata')
      onDeleted?.()
    } finally {
      setDeleting(false)
    }
  }

  // ── render ──────────────────────────────────────────────────────────────

  if (loadingEvent) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const fatturabile = watch('fatturabile')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 px-1">

      {/* Data */}
      <div className="space-y-1">
        <Label htmlFor="dataAttivita">Data</Label>
        <Input id="dataAttivita" type="date" {...register('dataAttivita')} />
        {errors.dataAttivita && <p className="text-xs text-destructive">{errors.dataAttivita.message}</p>}
      </div>

      {/* Toggle modo */}
      <div className="flex items-center gap-3 py-1">
        <Switch
          id="modoOrari"
          checked={modoOrari}
          onCheckedChange={setModoOrari}
        />
        <Label htmlFor="modoOrari" className="cursor-pointer">
          {modoOrari ? 'Specifica ora inizio e fine' : 'Specifica solo ore erogate'}
        </Label>
      </div>

      {modoOrari ? (
        /* Modo orari: inizio + fine, ore calcolate */
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="oraInizio">Inizio</Label>
            <Input id="oraInizio" type="time" {...register('oraInizio')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="oraFine">Fine</Label>
            <Input id="oraFine" type="time" {...register('oraFine')} />
          </div>
          <div className="space-y-1">
            <Label>Ore erogate</Label>
            <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">
                {oreCalcolate != null ? formatOre(oreCalcolate) : '—'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Modo ore erogate: input libero, inizio/fine calcolati dal server */
        <div className="space-y-1">
          <Label htmlFor="oreErogateTesto">Ore erogate</Label>
          <Input
            id="oreErogateTesto"
            placeholder="es. 2:30 oppure 2.5"
            {...register('oreErogateTesto')}
            className="max-w-40"
          />
          <p className="text-xs text-muted-foreground">
            L&apos;ora di inizio sarà calcolata dalla fine dell&apos;ultima attività della giornata (default 09:00)
          </p>
        </div>
      )}

      {/* Committente */}
      <div className="space-y-1">
        <Label>Committente</Label>
        <Select
          value={watchCommittenteId ?? ''}
          onValueChange={(v) => {
            setValue('committenteId', v, { shouldValidate: true })
            setValue('clienteId', '')
            setValue('progettoId', '')
            setProgetti([])
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleziona committente..." />
          </SelectTrigger>
          <SelectContent>
            {committenti.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.ragioneSociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.committenteId && <p className="text-xs text-destructive">{errors.committenteId.message}</p>}
      </div>

      {/* Cliente */}
      <div className="space-y-1">
        <Label>Cliente <span className="text-muted-foreground text-xs">(opzionale)</span></Label>
        <Select
          value={watchClienteId || '__none__'}
          onValueChange={(v) => {
            setValue('clienteId', v === '__none__' ? '' : v, { shouldValidate: true })
            setValue('progettoId', '')
          }}
          disabled={!watchCommittenteId || loadingClienti}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingClienti ? 'Caricamento...' : 'Nessun cliente'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Nessun cliente —</SelectItem>
            {clienti.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.ragioneSociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progetto */}
      <div className="space-y-1">
        <Label>Progetto (opzionale)</Label>
        <Select
          value={watch('progettoId') ?? ''}
          onValueChange={(v) => setValue('progettoId', v === '__none__' ? '' : v)}
          disabled={!watchClienteId || loadingProgetti}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingProgetti ? 'Caricamento...' : 'Nessun progetto'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Nessun progetto —</SelectItem>
            {progetti.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tipo attività */}
      <div className="space-y-1">
        <Label>Tipo attività</Label>
        <Select
          value={watch('tipoAttivitaId') ?? ''}
          onValueChange={(v) => setValue('tipoAttivitaId', v, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleziona tipo..." />
          </SelectTrigger>
          <SelectContent>
            {tipiAttivita.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.codice} — {t.descrizione}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.tipoAttivitaId && <p className="text-xs text-destructive">{errors.tipoAttivitaId.message}</p>}
      </div>

      {/* Descrizione */}
      <div className="space-y-1">
        <Label htmlFor="descrizione">Descrizione</Label>
        <textarea
          id="descrizione"
          {...register('descrizione')}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Descrizione attività..."
        />
      </div>

      {/* Note interne */}
      <div className="space-y-1">
        <Label htmlFor="noteInterne">Note interne</Label>
        <textarea
          id="noteInterne"
          {...register('noteInterne')}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Note non visibili nel report..."
        />
      </div>

      {/* Fatturabile */}
      <div className="flex items-center gap-3">
        <Switch
          id="fatturabile"
          checked={fatturabile}
          onCheckedChange={(v) => setValue('fatturabile', v)}
        />
        <Label htmlFor="fatturabile">Fatturabile</Label>
      </div>

      {/* Prezzo unitario + Valore attività */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="prezzoUnitarioTesto">Prezzo €/h</Label>
          <div className="flex gap-1">
            <Input
              id="prezzoUnitarioTesto"
              type="number"
              step="0.01"
              min="0"
              placeholder="Da listino"
              className="flex-1"
              {...register('prezzoUnitarioTesto')}
            />
            <button
              type="button"
              onClick={fetchPrezzo}
              disabled={loadingPrezzo || !watchCommittenteId}
              title="Ricalcola da listino"
              className="px-2 rounded border bg-muted hover:bg-accent disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingPrezzo ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="valoreAttivitaTesto">Valore €</Label>
          <Input
            id="valoreAttivitaTesto"
            type="number"
            step="0.01"
            min="0"
            placeholder="Auto"
            {...register('valoreAttivitaTesto')}
          />
        </div>
      </div>

      {/* Azioni */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {eventId ? 'Salva modifiche' : 'Crea attività'}
        </Button>
        {eventId && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </form>
  )
}
