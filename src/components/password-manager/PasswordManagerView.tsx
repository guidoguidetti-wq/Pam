'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Copy, KeyRound, Search, X, Paperclip, Download } from 'lucide-react'
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
  fileNome: string | null
  fileUrl: string | null
  fileSize: number | null
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
  // Solo visualizzazione: l'allegato si carica a parte dopo il salvataggio
  fileNome: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
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
const vuota = { descrizione: '', utente: '', password: '', fileNome: null, fileUrl: null }
const CAMPI = ['descrizione', 'utente', 'password'] as const
const MAX_FILE = 4 * 1024 * 1024

// Link di download del file su Vercel Blob
const urlDownload = (url: string) => `${url}${url.includes('?') ? '&' : '?'}download=1`

function valoriForm(c: Credenziale): FormData {
  return {
    clienteId: c.clienteId,
    sezione: c.sezione,
    ambiente: c.ambiente ?? '',
    note: c.note ?? '',
    voci: [
      ...c.voci.map(v => ({
        id: v.id,
        descrizione: v.descrizione ?? '',
        utente: v.utente ?? '',
        password: v.password ?? '',
        fileNome: v.fileNome,
        fileUrl: v.fileUrl,
      })),
      // Riga vuota pronta per l'inserimento successivo
      vuota,
    ],
  }
}

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
  // Allegati scelti nel form (per id riga del field array), caricati al salvataggio
  const [fileInAttesa, setFileInAttesa] = useState<Record<string, File>>({})
  const [fileDaRimuovere, setFileDaRimuovere] = useState<Set<string>>(new Set())
  const inputFile = useRef<Record<string, HTMLInputElement | null>>({})

  const { register, control, handleSubmit, watch, setValue, setFocus, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { sezione: '', ambiente: '', note: '', voci: [vuota] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'voci' })
  const watchCliente = watch('clienteId')
  const vociForm = watch('voci')
  const modificheFile = Object.keys(fileInAttesa).length > 0 || fileDaRimuovere.size > 0

  function azzeraFile() {
    setFileInAttesa({})
    setFileDaRimuovere(new Set())
  }

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
      [c.sezione, c.ambiente, c.note, c.cliente.ragioneSociale, ...c.voci.flatMap(v => [v.descrizione, v.utente, v.fileNome])]
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
    azzeraFile()
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(c: Credenziale) {
    reset(valoriForm(c))
    azzeraFile()
    setEditing(c)
    setDialogOpen(true)
  }

  // Chiusura del dialog: chiede conferma se ci sono modifiche non salvate
  function chiudiDialog() {
    if ((isDirty || modificheFile) && !confirm('Ci sono modifiche non salvate. Chiudere senza salvare?')) return
    setDialogOpen(false)
  }

  // Invio: passa al campo successivo; sull'ultimo campo dell'ultima riga aggiunge una nuova riga
  function onKeyDownVoce(e: React.KeyboardEvent<HTMLInputElement>, i: number, campo: (typeof CAMPI)[number]) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    const k = CAMPI.indexOf(campo)
    if (k < CAMPI.length - 1) setFocus(`voci.${i}.${CAMPI[k + 1]}`)
    else if (i < fields.length - 1) setFocus(`voci.${i + 1}.descrizione`)
    else append(vuota, { focusName: `voci.${fields.length}.descrizione` })
  }

  function scegliFile(fid: string, file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE) {
      toast.error('File troppo grande (max 4 MB)')
      return
    }
    setFileInAttesa(prev => ({ ...prev, [fid]: file }))
  }

  function annullaFileInAttesa(fid: string) {
    setFileInAttesa(prev => {
      const resto = { ...prev }
      delete resto[fid]
      return resto
    })
  }

  function rimuoviRiga(i: number, fid: string) {
    annullaFileInAttesa(fid)
    remove(i)
  }

  async function onSubmit(data: FormData, chiudi: boolean) {
    setSaving(true)
    try {
      // Righe da salvare, con l'id del field array per ritrovare gli allegati scelti
      const righe = data.voci
        .map((v, i) => ({ v, fid: fields[i]?.id ?? '' }))
        .filter(({ v, fid }) => v.id || v.descrizione || v.utente || v.password || fileInAttesa[fid])
      const payload = {
        clienteId: data.clienteId,
        sezione: data.sezione,
        ambiente: data.ambiente || null,
        note: data.note || null,
        voci: righe.map(({ v }) => ({
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

      // Allegati: le voci salvate sono nello stesso ordine delle righe inviate
      const vociSalvate = [...saved.voci]
      let erroriFile = 0
      for (const [j, { v, fid }] of righe.entries()) {
        const voce = vociSalvate[j]
        if (!voce) continue
        const file = fileInAttesa[fid]
        let r: Response | null = null
        if (file) {
          const fd = new FormData()
          fd.append('file', file)
          r = await fetch(`/api/password-manager/voci/${voce.id}/allegato`, { method: 'POST', body: fd })
        } else if (v.id && fileDaRimuovere.has(fid) && voce.fileUrl) {
          r = await fetch(`/api/password-manager/voci/${voce.id}/allegato`, { method: 'DELETE' })
        }
        if (!r) continue
        if (r.ok) vociSalvate[j] = await r.json()
        else {
          erroriFile++
          const msg = (await r.json().catch(() => ({}))).error ?? 'errore'
          toast.error(`Allegato "${file?.name ?? voce.fileNome}": ${msg}`)
        }
      }
      const finale: Credenziale = { ...saved, voci: vociSalvate }

      // Se il filtro cliente è attivo e il cliente è cambiato, la credenziale esce dall'elenco
      const visibile = filtroCliente === 'all' || finale.clienteId === parseInt(filtroCliente)
      setCredenziali(prev => {
        const altre = prev.filter(c => c.id !== finale.id)
        return visibile ? [...altre, finale] : altre
      })
      toast.success(editing ? 'Credenziali aggiornate' : 'Credenziali create')

      if (chiudi && erroriFile === 0) {
        setDialogOpen(false)
        return
      }
      // Resta aperto in modifica, con una riga vuota per l'inserimento successivo
      setEditing(finale)
      reset(valoriForm(finale))
      azzeraFile()
      setTimeout(() => setFocus(`voci.${finale.voci.length}.descrizione`), 0)
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
                          {c.voci.some(v => v.fileUrl) && <th className="text-left font-medium px-3 py-1">File</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {c.voci.map(v => (
                          <tr key={v.id} className="align-top">
                            <td className="px-3 py-1.5 text-xs">{v.descrizione || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5"><CampoCopiabile valore={v.utente} cosa="Utente" /></td>
                            <td className="px-3 py-1.5"><CampoCopiabile valore={v.password} cosa="Password" /></td>
                            {c.voci.some(x => x.fileUrl) && (
                              <td className="px-3 py-1.5 max-w-[10rem]">
                                {v.fileUrl ? (
                                  <a
                                    href={urlDownload(v.fileUrl)}
                                    title={`Scarica ${v.fileNome ?? 'file'}`}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <Download className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{v.fileNome ?? 'file'}</span>
                                  </a>
                                ) : null}
                              </td>
                            )}
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
      <Dialog open={dialogOpen} onOpenChange={open => (open ? setDialogOpen(true) : chiudiDialog())}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica credenziali' : 'Nuove credenziali'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(d => onSubmit(d, false))} className="space-y-2 py-1" autoComplete="off">
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
                <Button type="button" size="sm" variant="outline" onClick={() => append(vuota, { focusName: `voci.${fields.length}.descrizione` })}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Aggiungi riga
                </Button>
              </div>
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_11rem_auto] gap-2 text-xs text-muted-foreground">
                <span>Descrizione</span><span>Utente</span><span>Password</span><span>Allegato</span><span className="w-7" />
              </div>
              {fields.map((f, i) => {
                const attesa = fileInAttesa[f.id]
                const v = vociForm?.[i]
                const esistente = v?.fileUrl && !fileDaRimuovere.has(f.id) ? v : null
                return (
                  <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_11rem_auto] gap-2 items-center border-b sm:border-0 pb-2 sm:pb-0">
                    <Input className="h-8 text-sm" placeholder="Descrizione" {...register(`voci.${i}.descrizione`)} onKeyDown={e => onKeyDownVoce(e, i, 'descrizione')} />
                    <Input className="h-8 text-sm" placeholder="Utente" autoComplete="off" {...register(`voci.${i}.utente`)} onKeyDown={e => onKeyDownVoce(e, i, 'utente')} />
                    <Input className="h-8 text-sm font-mono" placeholder="Password" autoComplete="off" {...register(`voci.${i}.password`)} onKeyDown={e => onKeyDownVoce(e, i, 'password')} />

                    {/* Allegato della riga */}
                    <div className="flex items-center gap-1 min-w-0 h-8">
                      <input
                        type="file"
                        className="hidden"
                        ref={el => { inputFile.current[f.id] = el }}
                        onChange={e => { scegliFile(f.id, e.target.files?.[0]); e.target.value = '' }}
                      />
                      {attesa ? (
                        <>
                          <span className="text-xs italic truncate text-amber-700" title={`${attesa.name} — verrà caricato al salvataggio`}>
                            {attesa.name}
                          </span>
                          <button type="button" onClick={() => annullaFileInAttesa(f.id)} title="Annulla file" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : esistente ? (
                        <>
                          <a href={urlDownload(esistente.fileUrl!)} title={`Scarica ${esistente.fileNome ?? 'file'}`} className="flex items-center gap-1 min-w-0 text-xs text-primary hover:underline">
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{esistente.fileNome ?? 'file'}</span>
                          </a>
                          <button type="button" onClick={() => inputFile.current[f.id]?.click()} title="Sostituisci file" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => setFileDaRimuovere(prev => new Set(prev).add(f.id))} title="Rimuovi file" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFile.current[f.id]?.click()}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1 py-1 rounded hover:bg-accent"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {fileDaRimuovere.has(f.id) ? <span className="italic">rimosso · carica</span> : 'Carica file'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => rimuoviRiga(i, f.id)}
                      title="Elimina riga"
                      className="h-8 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
              <p className="text-[11px] text-muted-foreground">
                Invio = campo successivo / nuova riga · Salva mantiene la finestra aperta · i file (max 4 MB) vengono caricati al salvataggio
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={chiudiDialog}>Chiudi</Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={handleSubmit(d => onSubmit(d, true))}>
                Salva e chiudi
              </Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
