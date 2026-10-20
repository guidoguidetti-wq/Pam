'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Copy, KeyRound, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type Cliente = { id: number; ragioneSociale: string; committente: { id: number; ragioneSociale: string } }

type Voce = {
  id: number
  descrizione: string | null
  utente: string | null
  password: string | null
}

type Credenziale = {
  id: number
  clienteId: number
  sezione: string
  ambiente: string | null
  note: string | null
  cliente: Cliente
  voci: Voce[]
}

const voceFormSchema = z.object({
  id: z.number().optional(),
  descrizione: z.string().max(500).optional(),
  utente: z.string().max(500).optional(),
  password: z.string().max(1000).optional(),
})

const formSchema = z.object({
  clienteId: z.coerce.number().int().positive('Cliente obbligatorio'),
  sezione: z.string().trim().min(1, 'Sezione obbligatoria').max(200),
  ambiente: z.string().max(100).optional(),
  note: z.string().optional(),
  voci: z.array(voceFormSchema),
})

type FormData = z.infer<typeof formSchema>

const AMBIENTI_BASE = ['Produzione', 'Test', 'Sviluppo', 'Collaudo']
const vuota = { descrizione: '', utente: '', password: '' }

async function copia(testo: string, cosa: string) {
  try {
    await navigator.clipboard.writeText(testo)
    toast.success(`${cosa} copiato`)
  } catch {
    toast.error('Copia non riuscita')
  }
}

function CampoCopiabile({ valore, cosa }: { valore: string | null; cosa: string }) {
  if (!valore) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs break-all">{valore}</span>
      <button onClick={() => copia(valore, cosa)} title={`Copia ${cosa.toLowerCase()}`} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function PasswordManagerView({ clienti }: { clienti: Cliente[] }) {
  const [credenziali, setCredenziali] = useState<Credenziale[]>([])
  const [filtroCliente, setFiltroCliente] = useState<string>('all')
  const [cerca, setCerca] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Credenziale | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { sezione: '', ambiente: '', note: '', voci: [vuota] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'voci' })
  const watchCliente = watch('clienteId')

  useEffect(() => {
    const url = filtroCliente !== 'all' ? `/api/password-manager?cliente_id=${filtroCliente}` : '/api/password-manager'
    fetch(url).then(r => r.json()).then(setCredenziali).catch(console.error)
  }, [filtroCliente])

  const sezioniNote = useMemo(() => [...new Set(credenziali.map(c => c.sezione))].sort(), [credenziali])
  const ambientiNoti = useMemo(
    () => [...new Set([...AMBIENTI_BASE, ...credenziali.flatMap(c => (c.ambiente ? [c.ambiente] : []))])].sort(),
    [credenziali]
  )

  // Filtro testuale su sezione, ambiente, note, descrizione e utente
  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    if (!q) return credenziali
    return credenziali.filter(c =>
      [c.sezione, c.ambiente, c.note, c.cliente.ragioneSociale, ...c.voci.flatMap(v => [v.descrizione, v.utente])]
        .some(t => t?.toLowerCase().includes(q))
    )
  }, [credenziali, cerca])

  // Raggruppa per cliente
  const perCliente = useMemo(() => {
    const map = new Map<number, { cliente: Cliente; items: Credenziale[] }>()
    for (const c of filtrate) {
      if (!map.has(c.clienteId)) map.set(c.clienteId, { cliente: c.cliente, items: [] })
      map.get(c.clienteId)!.items.push(c)
    }
    return [...map.values()]
  }, [filtrate])

  function openNew() {
    reset({
      clienteId: filtroCliente !== 'all' ? parseInt(filtroCliente) : undefined,
      sezione: '',
      ambiente: '',
      note: '',
      voci: [vuota],
    })
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(c: Credenziale) {
    reset({
      clienteId: c.clienteId,
      sezione: c.sezione,
      ambiente: c.ambiente ?? '',
      note: c.note ?? '',
      voci: c.voci.length > 0
        ? c.voci.map(v => ({
            id: v.id,
            descrizione: v.descrizione ?? '',
            utente: v.utente ?? '',
            password: v.password ?? '',
          }))
        : [vuota],
    })
    setEditing(c)
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    try {
      const payload = {
        clienteId: data.clienteId,
        sezione: data.sezione,
        ambiente: data.ambiente || null,
        note: data.note || null,
        voci: data.voci
          .filter(v => v.id || v.descrizione || v.utente || v.password)
          .map(v => ({
            id: v.id,
            descrizione: v.descrizione || null,
            utente: v.utente || null,
            password: v.password || null,
          })),
      }

      const url = editing ? `/api/password-manager/${editing.id}` : '/api/password-manager'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        toast.error((await res.json()).error ?? 'Errore salvataggio')
        return
      }
      const saved: Credenziale = await res.json()
      // Se il filtro cliente è attivo e il cliente è cambiato, la credenziale esce dall'elenco
      const visibile = filtroCliente === 'all' || saved.clienteId === parseInt(filtroCliente)
      setCredenziali(prev => {
        const altre = prev.filter(c => c.id !== saved.id)
        return visibile ? [...altre, saved] : altre
      })
      toast.success(editing ? 'Credenziali aggiornate' : 'Credenziali create')
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(c: Credenziale) {
    if (!confirm(`Eliminare "${c.sezione}${c.ambiente ? ` (${c.ambiente})` : ''}" e tutte le sue credenziali?`)) return
    const res = await fetch(`/api/password-manager/${c.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCredenziali(prev => prev.filter(x => x.id !== c.id))
      toast.success('Credenziali eliminate')
    } else {
      toast.error((await res.json()).error ?? "Errore durante l'eliminazione")
    }
  }

  const ordina = (items: Credenziale[]) =>
    [...items].sort((a, b) => a.sezione.localeCompare(b.sezione) || (a.ambiente ?? '').localeCompare(b.ambiente ?? ''))

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtroCliente} onValueChange={setFiltroCliente}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i clienti</SelectItem>
            {clienti.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.committente.ragioneSociale} › {c.ragioneSociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cerca sezione, ambiente, utente…" value={cerca} onChange={e => setCerca(e.target.value)} />
        </div>
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuove credenziali
        </Button>
      </div>

      {/* Elenco */}
      {perCliente.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nessuna credenziale trovata.</div>
      ) : (
        perCliente.map(({ cliente, items }) => (
          <div key={cliente.id} className="space-y-2">
            <div className="text-sm">
              <span className="font-semibold">{cliente.ragioneSociale}</span>
              <span className="text-muted-foreground"> · {cliente.committente.ragioneSociale}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {ordina(items).map(c => (
                <div key={c.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                    <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{c.sezione}</span>
                    {c.ambiente && (
                      <Badge
                        variant={/^prod/i.test(c.ambiente) ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {c.ambiente}
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(c)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {c.note && <div className="px-3 py-1.5 text-xs text-muted-foreground border-b whitespace-pre-wrap">{c.note}</div>}
                  {c.voci.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">Nessuna voce.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left font-medium px-3 py-1">Descrizione</th>
                          <th className="text-left font-medium px-3 py-1">Utente</th>
                          <th className="text-left font-medium px-3 py-1">Password</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {c.voci.map(v => (
                          <tr key={v.id} className="align-top">
                            <td className="px-3 py-1.5 text-xs">{v.descrizione || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5"><CampoCopiabile valore={v.utente} cosa="Utente" /></td>
                            <td className="px-3 py-1.5"><CampoCopiabile valore={v.password} cosa="Password" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Dialog form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica credenziali' : 'Nuove credenziali'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 py-1" autoComplete="off">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Select value={watchCliente ? String(watchCliente) : ''} onValueChange={v => setValue('clienteId', parseInt(v))}>
                <SelectTrigger className={errors.clienteId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Seleziona cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {clienti.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.committente.ragioneSociale} › {c.ragioneSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clienteId && <p className="text-xs text-destructive">{errors.clienteId.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label>Sezione *</Label>
                <Input
                  list="pm-sezioni"
                  placeholder="Es. Gestionale, VPN, Server SQL, Portale…"
                  className={errors.sezione ? 'border-destructive' : ''}
                  {...register('sezione')}
                />
                <datalist id="pm-sezioni">
                  {sezioniNote.map(s => <option key={s} value={s} />)}
                </datalist>
                {errors.sezione && <p className="text-xs text-destructive">{errors.sezione.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Ambiente</Label>
                <Input list="pm-ambienti" placeholder="Es. Produzione, Test" {...register('ambiente')} />
                <datalist id="pm-ambienti">
                  {ambientiNoti.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Note</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="URL, host, istruzioni di accesso…"
                {...register('note')}
              />
            </div>

            {/* Voci di dettaglio */}
            <div className="space-y-2 border rounded-md p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Credenziali</span>
                <Button type="button" size="sm" variant="outline" onClick={() => append(vuota)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Aggiungi riga
                </Button>
              </div>
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
                <span>Descrizione</span><span>Utente</span><span>Password</span><span className="w-7" />
              </div>
              {fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start border-b sm:border-0 pb-2 sm:pb-0">
                  <Input className="h-8 text-sm" placeholder="Descrizione" {...register(`voci.${i}.descrizione`)} />
                  <Input className="h-8 text-sm" placeholder="Utente" autoComplete="off" {...register(`voci.${i}.utente`)} />
                  <Input className="h-8 text-sm font-mono" placeholder="Password" autoComplete="off" {...register(`voci.${i}.password`)} />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    title="Elimina riga"
                    className="h-8 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
