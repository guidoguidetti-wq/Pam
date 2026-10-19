'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'
import { Paperclip, Trash2, Pencil, Check, X, Loader2, Upload, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Allegato = {
  id: string
  nomeFile: string
  tipoMime: string | null
  dimensioneBytes: number | null
  storageUrl: string | null
  descrizione: string | null
  dataAllegato: string | null
  createdAt: string
}

const uploadSchema = z.object({
  descrizione: z.string().trim().max(2000).optional(),
  dataAllegato: z.string().optional(),
})

type UploadData = z.infer<typeof uploadSchema>

function oggi() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT')
}

function formatBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function ProgettoAllegatiDialog({
  progetto,
  open,
  onOpenChange,
  onCountChange,
}: {
  progetto: { id: number; nome: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCountChange: (progettoId: number, count: number) => void
}) {
  const [allegati, setAllegati] = useState<Allegato[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDescrizione, setEditDescrizione] = useState('')
  const [editData, setEditData] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset } = useForm<UploadData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { descrizione: '', dataAllegato: oggi() },
  })

  useEffect(() => {
    if (!open || !progetto) return
    setAllegati([])
    setFile(null)
    setEditId(null)
    reset({ descrizione: '', dataAllegato: oggi() })
    setLoadingList(true)
    fetch(`/api/allegati?progetto_id=${progetto.id}`)
      .then(r => r.json())
      .then(setAllegati)
      .catch(console.error)
      .finally(() => setLoadingList(false))
  }, [open, progetto, reset])

  function updateList(next: Allegato[]) {
    setAllegati(next)
    if (progetto) onCountChange(progetto.id, next.length)
  }

  async function onUpload(data: UploadData) {
    if (!progetto) return
    if (!file) { toast.error('Seleziona un file'); return }
    setUploading(true)
    try {
      // Comprimi solo le immagini, gli altri file vanno caricati così come sono
      const toUpload = file.type.startsWith('image/')
        ? await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
        : file
      const formData = new FormData()
      formData.append('file', toUpload, file.name)
      formData.append('progetto_id', String(progetto.id))
      if (data.descrizione) formData.append('descrizione', data.descrizione)
      if (data.dataAllegato) formData.append('data_allegato', data.dataAllegato)

      const res = await fetch('/api/allegati', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error)
      const saved: Allegato = await res.json()
      updateList([saved, ...allegati])
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      reset({ descrizione: '', dataAllegato: oggi() })
      toast.success('Allegato caricato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore upload')
    } finally {
      setUploading(false)
    }
  }

  function startEdit(a: Allegato) {
    setEditId(a.id)
    setEditDescrizione(a.descrizione ?? '')
    setEditData(a.dataAllegato ? a.dataAllegato.split('T')[0] : '')
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/allegati/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descrizione: editDescrizione || null, dataAllegato: editData || null }),
    })
    if (!res.ok) {
      toast.error((await res.json()).error ?? 'Errore salvataggio')
      return
    }
    const saved: Allegato = await res.json()
    setAllegati(prev => prev.map(a => a.id === id ? saved : a))
    setEditId(null)
    toast.success('Allegato aggiornato')
  }

  async function onDelete(a: Allegato) {
    if (!confirm(`Eliminare l'allegato "${a.nomeFile}"?`)) return
    const res = await fetch(`/api/allegati/${a.id}`, { method: 'DELETE' })
    if (res.ok) {
      updateList(allegati.filter(x => x.id !== a.id))
      toast.success('Allegato eliminato')
    } else {
      toast.error('Errore eliminazione allegato')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allegati — {progetto?.nome}</DialogTitle>
        </DialogHeader>

        {/* Form caricamento */}
        <form onSubmit={handleSubmit(onUpload)} className="space-y-2 border rounded-md p-3 bg-muted/20">
          <div className="text-sm font-medium">Nuovo allegato</div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5 mr-1.5" />
              Scegli file
            </Button>
            <span className="text-xs text-muted-foreground truncate">
              {file ? `${file.name} (${formatBytes(file.size)})` : 'Nessun file selezionato'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-3 space-y-1">
              <Label className="text-xs">Descrizione</Label>
              <Input placeholder="Es. Offerta firmata, verbale riunione…" {...register('descrizione')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" {...register('dataAllegato')} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={uploading || !file}>
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {uploading ? 'Caricamento…' : 'Carica'}
            </Button>
          </div>
        </form>

        {/* Elenco allegati */}
        {loadingList ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : allegati.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Nessun allegato.</div>
        ) : (
          <div className="divide-y border rounded-md">
            {allegati.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-2">
                <a href={a.storageUrl ?? '#'} target="_blank" rel="noreferrer" className="shrink-0">
                  {a.tipoMime?.startsWith('image/') && a.storageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.storageUrl} alt={a.nomeFile} className="h-12 w-12 object-cover rounded border" />
                  ) : (
                    <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted/40">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </a>

                <div className="flex-1 min-w-0">
                  {editId === a.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <Input
                        className="h-8 text-sm sm:col-span-3"
                        placeholder="Descrizione"
                        value={editDescrizione}
                        onChange={e => setEditDescrizione(e.target.value)}
                      />
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={editData}
                        onChange={e => setEditData(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium">
                        {a.descrizione || <span className="italic text-muted-foreground font-normal">Senza descrizione</span>}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        <span>{formatDate(a.dataAllegato)}</span>
                        <a href={a.storageUrl ?? '#'} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-64">
                          {a.nomeFile}
                        </a>
                        <span>{formatBytes(a.dimensioneBytes)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {editId === a.id ? (
                    <>
                      <button onClick={() => saveEdit(a.id)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(a)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(a)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
