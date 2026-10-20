'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from 'lucide-react'
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

const rigaSchema = z.object({
  tipoAttivitaId: z.string().min(1, 'Tipo obbligatorio'),
  descrizione: z.string().max(5000).optional(),
  giorni: z
    .string()
    .trim()
    .min(1, 'Obbligatorio')
    .refine(v => !isNaN(parseFloat(v.replace(',', '.'))) && parseFloat(v.replace(',', '.')) >= 0, 'Valore non valido'),
})

const formSchema = z.object({ righe: z.array(rigaSchema) })

type FormData = z.infer<typeof formSchema>
type RigaForm = FormData['righe'][number]

const nuovaRiga: RigaForm = { tipoAttivitaId: '', descrizione: '', giorni: '' }

function num(v: string | undefined) {
  const n = parseFloat((v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function fmtGg(n: number) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n)
}

export default function StimeDettaglioEditor({
  progetto,
  tipiAttivita,
  righeIniziali,
}: {
  progetto: ProgettoInfo
  tipiAttivita: TipoAttivita[]
  righeIniziali: RigaForm[]
}) {
  const [saving, setSaving] = useState(false)
  const tipiProgetto = useMemo(() => new Set(progetto.tipiProgetto), [progetto.tipiProgetto])

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { righe: righeIniziali },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'righe' })
  const righe = watch('righe')

  // Avvisa se si esce dalla pagina con modifiche non salvate
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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

  async function onSubmit(data: FormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/progetti/${progetto.id}/stime-dettaglio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          righe: data.righe.map(r => ({
            tipoAttivitaId: parseInt(r.tipoAttivitaId),
            descrizione: r.descrizione || null,
            giorni: num(r.giorni),
          })),
        }),
      })
      if (!res.ok) {
        toast.error((await res.json()).error ?? 'Errore salvataggio')
        return
      }
      const saved: { tipoAttivitaId: number; descrizione: string | null; giorni: string }[] = await res.json()
      reset({
        righe: saved.map(r => ({
          tipoAttivitaId: String(r.tipoAttivitaId),
          descrizione: r.descrizione ?? '',
          giorni: String(parseFloat(r.giorni)),
        })),
      })
      toast.success('Stime salvate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error('Controlla le righe evidenziate'))} className="space-y-4">
      {/* Intestazione */}
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/progetti" className="p-1.5 mt-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Dettaglio stime</h1>
          <p className="text-sm">
            {progetto.codice && <span className="text-muted-foreground">[{progetto.codice}] </span>}
            <span className="font-medium">{progetto.nome}</span>
          </p>
          <p className="text-xs text-muted-foreground">{progetto.committente} › {progetto.cliente}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => append(nuovaRiga)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Aggiungi riga
          </Button>
          <Button type="submit" size="sm" disabled={saving || !isDirty}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {saving ? 'Salvataggio…' : 'Salva'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Stima complessiva del progetto per tipo attività, comprese le attività svolte da altre persone.
        I tipi contrassegnati con • sono quelli previsti per te nel progetto.
      </p>

      {/* Tabella righe */}
      {fields.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
          Nessuna stima inserita. Usa “Aggiungi riga” per iniziare.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium w-56">Tipo attività</th>
                <th className="text-left px-3 py-1.5 font-medium">Descrizione</th>
                <th className="text-right px-3 py-1.5 font-medium w-32">Stima (gg)</th>
                <th className="px-3 py-1.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((f, i) => {
                const err = errors.righe?.[i]
                const tipo = righe?.[i]?.tipoAttivitaId
                return (
                  <tr key={f.id} className="align-top">
                    <td className="px-3 py-1.5">
                      <Select
                        value={tipo ?? ''}
                        onValueChange={v => setValue(`righe.${i}.tipoAttivitaId`, v, { shouldDirty: true, shouldValidate: true })}
                      >
                        <SelectTrigger className={cn('h-8 text-sm', err?.tipoAttivitaId && 'border-destructive')}>
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
                    <td className="px-3 py-1.5">
                      <textarea
                        rows={1}
                        placeholder="Descrizione attività stimata"
                        className="w-full min-h-8 px-3 py-1.5 border rounded-md text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                        {...register(`righe.${i}.descrizione`)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        className={cn('h-8 text-sm text-right tabular-nums', err?.giorni && 'border-destructive')}
                        {...register(`righe.${i}.giorni`)}
                      />
                      {err?.giorni && <p className="text-[11px] text-destructive mt-0.5 text-right">{err.giorni.message}</p>}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        title="Elimina riga"
                        className="h-8 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-muted/30 border-t">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-sm font-semibold">Totale</td>
                <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">{fmtGg(totale)} gg</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Riepilogo per tipo */}
      {totaliPerTipo.length > 0 && (
        <div className="border rounded-lg p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Riepilogo per tipo attività</div>
          <div className="flex flex-wrap gap-2">
            {totaliPerTipo.map(t => (
              <div key={t.id} className="bg-background border rounded px-3 py-1.5 text-xs">
                <span className="font-medium">{tipiProgetto.has(t.id) ? '• ' : ''}{t.codice}</span>
                <span className="text-muted-foreground ml-1">· {t.descrizione}</span>
                <span className="ml-2 font-semibold tabular-nums">{fmtGg(t.giorni)} gg</span>
                {totale > 0 && (
                  <span className="ml-1 text-muted-foreground tabular-nums">({Math.round((t.giorni / totale) * 100)}%)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
