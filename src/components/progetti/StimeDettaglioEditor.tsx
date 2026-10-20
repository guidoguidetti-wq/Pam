'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Save, Trash2, Loader2, FileSpreadsheet, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type TipoAttivita = { id: number; codice: string; descrizione: string }

type ProgettoInfo = {
  id: number
  nome: string
  codice: string | null
  committente: string
  cliente: string
  tipiProgetto: number[]
}

// Normalizza a stringa valori null/undefined/numerici (es. da reset o campi non montati)
const testo = (max: number) =>
  z.preprocess(v => (v == null ? '' : typeof v === 'number' ? String(v) : v), z.string().max(max))
const flag = z.preprocess(v => v === true, z.boolean())

const rigaSchema = z.object({
  tipoAttivitaId: testo(20),
  descrizione: testo(5000),
  giorni: testo(20),
  inviata: flag,
  accettata: flag,
})

function num(v: string | undefined) {
  const n = parseFloat((v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// Riga vuota (senza descrizione né giornate): viene ignorata al salvataggio,
// anche se ha il tipo preimpostato dalla riga precedente
function rigaVuota(r: { descrizione?: string | null; giorni?: string | number | null }) {
  return !String(r.descrizione ?? '').trim() && !String(r.giorni ?? '').trim()
}

const formSchema = z
  .object({
    righe: z.array(rigaSchema),
    stimeNote: testo(10000),
  })
  .superRefine((data, ctx) => {
    data.righe.forEach((r, i) => {
      if (rigaVuota(r)) return
      if (!r.tipoAttivitaId)
        ctx.addIssue({ code: 'custom', message: 'Tipo obbligatorio', path: ['righe', i, 'tipoAttivitaId'] })
      // Giornate facoltative: vuoto o 0 = riga di nota
      const g = parseFloat(r.giorni.replace(',', '.'))
      if (r.giorni.trim() && (isNaN(g) || g < 0))
        ctx.addIssue({ code: 'custom', message: 'Valore non valido', path: ['righe', i, 'giorni'] })
    })
  })

type FormData = z.infer<typeof formSchema>
type RigaForm = FormData['righe'][number]

const nuovaRiga = (tipoAttivitaId = ''): RigaForm => ({
  tipoAttivitaId,
  descrizione: '',
  giorni: '',
  inviata: false,
  accettata: false,
})

function fmtGg(n: number) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n)
}

export default function StimeDettaglioEditor({
  progetto,
  tipiAttivita,
  righeIniziali,
  noteIniziali,
}: {
  progetto: ProgettoInfo
  tipiAttivita: TipoAttivita[]
  righeIniziali: RigaForm[]
  noteIniziali: string
}) {
  const [saving, setSaving] = useState(false)
  const tipiProgetto = useMemo(() => new Set(progetto.tipiProgetto), [progetto.tipiProgetto])
  const tipiMap = useMemo(() => new Map(tipiAttivita.map(t => [String(t.id), t])), [tipiAttivita])

  const { register, control, handleSubmit, watch, setValue, setFocus, reset, trigger, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    // Pagina vuota: parte già con una riga pronta per l'inserimento
    defaultValues: { righe: righeIniziali.length > 0 ? righeIniziali : [nuovaRiga()], stimeNote: noteIniziali },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'righe' })
  const righe = watch('righe')

  // Righe in modifica (per id del field). Le righe esistenti partono in sola lettura,
  // quelle aggiunte si aprono già in modifica.
  const [inModifica, setInModifica] = useState<Set<string>>(
    () => new Set(righeIniziali.length > 0 ? [] : fields.map(f => f.id))
  )
  const conosciuti = useRef(new Set(fields.map(f => f.id)))
  const dopoReset = useRef(false)
  useEffect(() => {
    const nuovi = fields.filter(f => !conosciuti.current.has(f.id)).map(f => f.id)
    nuovi.forEach(id => conosciuti.current.add(id))
    if (dopoReset.current) {
      dopoReset.current = false
      setInModifica(new Set())
      return
    }
    if (nuovi.length > 0) setInModifica(prev => new Set([...prev, ...nuovi]))
  }, [fields])

  function apri(i: number, campo: 'descrizione' | 'giorni' = 'descrizione') {
    setInModifica(prev => new Set(prev).add(fields[i].id))
    setTimeout(() => setFocus(`righe.${i}.${campo}`), 0)
  }

  async function chiudi(i: number) {
    const r = righe[i]
    if (r && !rigaVuota(r)) {
      const ok = await trigger([`righe.${i}.tipoAttivitaId`, `righe.${i}.giorni`])
      if (!ok || !r.tipoAttivitaId) {
        toast.error('Completa la riga prima di chiuderla (il tipo attività è obbligatorio)')
        return
      }
    }
    setInModifica(prev => {
      const next = new Set(prev)
      next.delete(fields[i].id)
      return next
    })
  }

  // Avvisa se si esce dalla pagina con modifiche non salvate
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Nuove righe: ripropongono il tipo dell'ultima riga, per inserimenti in sequenza
  function aggiungiRighe(n = 1) {
    const ultimoTipo = righe?.[righe.length - 1]?.tipoAttivitaId ?? ''
    append(Array.from({ length: n }, () => nuovaRiga(ultimoTipo)), {
      focusName: `righe.${fields.length}.descrizione`,
    })
  }

  // Invio non salva: passa al campo/riga successiva (creandola se serve). Ctrl+Invio salva.
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement
    if (e.key === 'Escape') {
      const m = target.getAttribute('name')?.match(/^righe\.(\d+)\./)
      if (m) { e.preventDefault(); void chiudi(parseInt(m[1])) }
      return
    }
    if (e.key !== 'Enter') return
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      void handleSubmit(onSubmit, onInvalid)()
      return
    }
    if (target.tagName === 'TEXTAREA' && e.shiftKey) return // a capo nella descrizione
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return
    e.preventDefault()
    const m = target.getAttribute('name')?.match(/^righe\.(\d+)\.(\w+)$/)
    if (!m) return
    const i = parseInt(m[1])
    if (m[2] === 'descrizione') {
      setFocus(`righe.${i}.giorni`)
    } else if (i === fields.length - 1) {
      aggiungiRighe()
    } else if (inModifica.has(fields[i + 1].id)) {
      setFocus(`righe.${i + 1}.descrizione`)
    } else {
      void chiudi(i)
    }
  }

  // Totali per tipo attività, nell'ordine della tabella tipi
  const totaliPerTipo = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of righe ?? []) {
      if (!r.tipoAttivitaId) continue
      const id = parseInt(r.tipoAttivitaId)
      map.set(id, (map.get(id) ?? 0) + num(r.giorni))
    }
    return tipiAttivita.filter(t => map.has(t.id)).map(t => ({ ...t, giorni: map.get(t.id)! }))
  }, [righe, tipiAttivita])
  const totale = totaliPerTipo.reduce((acc, t) => acc + t.giorni, 0)
  const totaleAccettato = (righe ?? []).filter(r => r.accettata).reduce((acc, r) => acc + num(r.giorni), 0)

  // In caso di errori: apre le righe da correggere, le scorre in vista e spiega cosa non va
  function onInvalid(errs: typeof errors) {
    const righeErr = fields.flatMap((f, i) => (errs.righe?.[i] ? [{ id: f.id, i }] : []))
    setInModifica(prev => new Set([...prev, ...righeErr.map(r => r.id)]))

    const dettagli: string[] = righeErr.slice(0, 3).map(({ i }) => {
      const e = errs.righe?.[i]
      const msg = e?.tipoAttivitaId?.message ?? e?.giorni?.message ?? e?.descrizione?.message ?? 'dato non valido'
      return `riga ${i + 1}: ${msg}`
    })
    if (righeErr.length > 3) dettagli.push(`e altre ${righeErr.length - 3}`)
    if (errs.stimeNote?.message) dettagli.push(`note: ${errs.stimeNote.message}`)
    if (errs.righe?.root?.message) dettagli.push(errs.righe.root.message)
    if (!dettagli.length && errs.righe?.message) dettagli.push(errs.righe.message)

    if (righeErr.length > 0)
      setTimeout(() => document.getElementById(`riga-stima-${righeErr[0].i}`)?.scrollIntoView({ block: 'center' }), 0)
    toast.error('Impossibile salvare', { description: dettagli.join(' · ') || 'Dati non validi' })
  }

  // Annulla tutte le modifiche non salvate e torna all'ultimo salvataggio
  function annullaModifiche() {
    if (!confirm('Annullare tutte le modifiche non salvate?')) return
    dopoReset.current = true
    reset()
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/progetti/${progetto.id}/stime-dettaglio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          righe: data.righe.filter(r => !rigaVuota(r)).map(r => ({
            tipoAttivitaId: parseInt(r.tipoAttivitaId),
            descrizione: r.descrizione || null,
            giorni: num(r.giorni),
            inviata: r.inviata,
            accettata: r.accettata,
          })),
          stimeNote: data.stimeNote || null,
        }),
      })
      if (!res.ok) {
        toast.error((await res.json()).error ?? 'Errore salvataggio')
        return
      }
      const saved: {
        righe: { tipoAttivitaId: number; descrizione: string | null; giorni: string; inviata: boolean; accettata: boolean }[]
        stimeNote: string | null
      } = await res.json()
      dopoReset.current = true
      reset({
        stimeNote: saved.stimeNote ?? '',
        righe: saved.righe.map(r => ({
          tipoAttivitaId: String(r.tipoAttivitaId),
          descrizione: r.descrizione ?? '',
          giorni: String(parseFloat(r.giorni)),
          inviata: r.inviata,
          accettata: r.accettata,
        })),
      })
      toast.success('Stime salvate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} onKeyDown={onKeyDown} className="space-y-2">
      {/* Barra superiore fissa: progetto + azioni */}
      <div className="sticky top-0 z-20 -mx-3 -mt-3 px-3 h-11 flex items-center gap-2 bg-background/95 backdrop-blur border-b">
        <Link
          href="/progetti"
          title="Torna ai progetti"
          onClick={e => { if (isDirty && !confirm('Ci sono modifiche non salvate. Uscire senza salvare?')) e.preventDefault() }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex items-baseline gap-2 truncate">
          <h1 className="text-base font-semibold shrink-0">Stime</h1>
          <span className="text-sm truncate">
            {progetto.codice && <span className="text-muted-foreground">[{progetto.codice}] </span>}
            <span className="font-medium">{progetto.nome}</span>
            <span className="text-xs text-muted-foreground"> · {progetto.committente} › {progetto.cliente}</span>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="hidden md:inline text-sm font-semibold tabular-nums mr-2">
            {fmtGg(totale)} gg
            {totaleAccettato > 0 && (
              <span className="ml-1.5 text-xs font-normal text-emerald-700">({fmtGg(totaleAccettato)} acc.)</span>
            )}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              if (isDirty) { toast.warning('Salva le modifiche prima di esportare'); return }
              window.location.href = `/api/progetti/${progetto.id}/stime-dettaglio/export`
            }}
          >
            <FileSpreadsheet className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          {isDirty && (
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={annullaModifiche}>
              Annulla modifiche
            </Button>
          )}
          <Button type="submit" size="sm" className="h-8" disabled={saving || !isDirty}>
            {saving ? <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" /> : <Save className="h-4 w-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">{saving ? 'Salvataggio…' : 'Salva'}</span>
          </Button>
        </div>
      </div>

      {/* Note stime: una riga, si allarga se serve */}
      <textarea
        rows={1}
        placeholder="Note sulle stime…"
        className="w-full min-h-8 px-3 py-1.5 border rounded-md text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        {...register('stimeNote')}
      />

      {/* Tabella righe */}
      <div className="border rounded-lg">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-44" />
            <col />
            <col className="w-20" />
            <col className="w-[148px]" />
            <col className="w-[52px]" />
          </colgroup>
          <tbody className="divide-y">
            {fields.map((f, i) => {
              const err = errors.righe?.[i]
              const r = righe?.[i]
              const editing = inModifica.has(f.id)
              const tipo = r?.tipoAttivitaId ? tipiMap.get(r.tipoAttivitaId) : undefined
              const nota = !!r && !rigaVuota(r) && num(r.giorni) === 0
              return (
                <tr
                  key={f.id}
                  id={`riga-stima-${i}`}
                  className={cn(
                    editing ? 'align-top bg-amber-50/40' : 'align-middle leading-tight hover:bg-muted/30',
                    !editing && r?.accettata && 'bg-emerald-50/50',
                    err && 'bg-red-50 shadow-[inset_3px_0_0_0_rgb(220_38_38)]'
                  )}
                  onDoubleClick={() => { if (!editing) apri(i) }}
                >
                  {editing ? (
                    <>
                      <td className="px-1.5 py-px">
                        <Select
                          value={r?.tipoAttivitaId ?? ''}
                          onValueChange={v => setValue(`righe.${i}.tipoAttivitaId`, v, { shouldDirty: true, shouldValidate: true })}
                        >
                          <SelectTrigger className={cn('h-6 px-2 text-xs', err?.tipoAttivitaId && 'border-destructive')}>
                            <SelectValue placeholder="Seleziona tipo…" />
                          </SelectTrigger>
                          <SelectContent>
                            {tipiAttivita.map(t => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {tipiProgetto.has(t.id) ? '• ' : ''}{t.codice} — {t.descrizione}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1.5 py-px">
                        <textarea
                          rows={1}
                          placeholder="Descrizione attività stimata"
                          className="block w-full h-6 min-h-6 px-2 py-0.5 leading-tight border rounded-md text-xs bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                          {...register(`righe.${i}.descrizione`)}
                        />
                      </td>
                      <td className="px-1.5 py-px">
                        <Input
                          inputMode="decimal"
                          placeholder="nota"
                          className={cn('h-6 px-2 text-xs text-right tabular-nums', err?.giorni && 'border-destructive')}
                          {...register(`righe.${i}.giorni`)}
                        />
                        {err?.giorni && <p className="text-[10px] text-destructive text-right">{err.giorni.message}</p>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-0 h-6 truncate">
                        {tipo ? (
                          <span title={tipo.descrizione}>
                            {tipiProgetto.has(tipo.id) ? '• ' : ''}
                            <span className="font-medium">{tipo.codice}</span>
                            <span className="text-muted-foreground"> {tipo.descrizione}</span>
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-0 h-6">
                        <div className={cn('truncate', nota && 'italic text-muted-foreground')} title={r?.descrizione || undefined}>
                          {r?.descrizione || <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-0 h-6 text-right tabular-nums font-medium">
                        {nota ? <span className="text-[10px] font-normal italic text-muted-foreground">nota</span> : fmtGg(num(r?.giorni))}
                      </td>
                    </>
                  )}
                  <td className="px-1 py-px">
                    <div className="h-6 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setValue(`righe.${i}.inviata`, !r?.inviata, { shouldDirty: true })}
                        title={r?.inviata ? 'Inviata — clic per annullare' : 'Segna come inviata'}
                        className={cn(
                          'h-5 px-1.5 rounded-full border text-[10px] font-medium transition-colors',
                          r?.inviata
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-border text-muted-foreground hover:border-blue-400 hover:text-blue-700'
                        )}
                      >
                        Inviata
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue(`righe.${i}.accettata`, !r?.accettata, { shouldDirty: true })}
                        title={r?.accettata ? 'Accettata — clic per annullare' : 'Segna come accettata'}
                        className={cn(
                          'h-5 px-1.5 rounded-full border text-[10px] font-medium transition-colors',
                          r?.accettata
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-700'
                        )}
                      >
                        Accettata
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-px">
                    <div className="h-6 flex items-center justify-end">
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => chiudi(i)}
                          title="Chiudi modifica riga (Esc)"
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => apri(i)}
                          title="Modifica riga (doppio clic)"
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        title="Elimina riga"
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t">
            <tr>
              <td colSpan={2} className="px-1 py-0.5">
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => aggiungiRighe(1)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Aggiungi riga
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => aggiungiRighe(5)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    5 righe
                  </Button>
                  <span className="ml-2 text-[10px] text-muted-foreground truncate hidden lg:inline">
                    Invio = riga successiva · Shift+Invio = a capo · Esc = chiudi riga · doppio clic = modifica · Ctrl+Invio = salva · giornate vuote = nota
                  </span>
                </div>
              </td>
              <td className="px-2 py-0.5 text-right font-semibold tabular-nums">{fmtGg(totale)} gg</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Riepilogo per tipo: una riga compatta */}
      {totaliPerTipo.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1">Per tipo:</span>
          {totaliPerTipo.map(t => (
            <span key={t.id} title={t.descrizione} className="bg-muted rounded px-2 py-0.5 tabular-nums">
              <span className="font-medium">{tipiProgetto.has(t.id) ? '• ' : ''}{t.codice}</span>{' '}
              {fmtGg(t.giorni)} gg
              {totale > 0 && <span className="text-muted-foreground"> ({Math.round((t.giorni / totale) * 100)}%)</span>}
            </span>
          ))}
          <span className="text-muted-foreground ml-auto">• = tipo previsto per te nel progetto</span>
        </div>
      )}
    </form>
  )
}
