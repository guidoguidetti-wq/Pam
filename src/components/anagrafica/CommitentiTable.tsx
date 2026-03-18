'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Building2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

export type CommittenteRow = {
  id: number
  ragioneSociale: string
  partitaIva: string | null
  codiceFiscale: string | null
  indirizzo: string | null
  email: string | null
  telefono: string | null
  note: string | null
  attivo: boolean
  createdAt: string
  _count: { clienti: number }
}

const schema = z.object({
  ragioneSociale: z.string().trim().min(1, 'Obbligatorio').max(200),
  partitaIva: z.string().trim().max(20).optional(),
  codiceFiscale: z.string().trim().max(16).optional(),
  indirizzo: z.string().trim().optional(),
  email: z.string().trim().max(150).optional(),
  telefono: z.string().trim().max(30).optional(),
  note: z.string().trim().optional(),
  attivo: z.boolean(),
})
type FormData = z.infer<typeof schema>

export default function CommitentiTable({ committenti }: { committenti: CommittenteRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommittenteRow | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { attivo: true },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ ragioneSociale: '', partitaIva: '', codiceFiscale: '', indirizzo: '', email: '', telefono: '', note: '', attivo: true })
    setOpen(true)
  }

  function openEdit(c: CommittenteRow) {
    setEditing(c)
    form.reset({
      ragioneSociale: c.ragioneSociale,
      partitaIva: c.partitaIva ?? '',
      codiceFiscale: c.codiceFiscale ?? '',
      indirizzo: c.indirizzo ?? '',
      email: c.email ?? '',
      telefono: c.telefono ?? '',
      note: c.note ?? '',
      attivo: c.attivo,
    })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      partitaIva: data.partitaIva || null,
      codiceFiscale: data.codiceFiscale || null,
      indirizzo: data.indirizzo || null,
      email: data.email || null,
      telefono: data.telefono || null,
      note: data.note || null,
    }
    try {
      const url = editing ? `/api/committenti/${editing.id}` : '/api/committenti'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(editing ? 'Committente aggiornato' : 'Committente creato')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function onDelete(id: number, ragioneSociale: string) {
    if (!confirm(`Eliminare "${ragioneSociale}"?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/committenti/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Committente eliminato')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Committenti</h1>
            <p className="text-sm text-muted-foreground">{committenti.length} committenti</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuovo
          </Button>
        </div>

        {committenti.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nessun committente. Creane uno!</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Ragione sociale</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">P.IVA</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Telefono</th>
                  <th className="text-center px-4 py-2.5 font-medium hidden md:table-cell">Clienti</th>
                  <th className="text-center px-4 py-2.5 font-medium">Attivo</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {committenti.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.ragioneSociale}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.partitaIva ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.telefono ?? '—'}</td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <Badge variant="secondary">{c._count.clienti}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.attivo
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === c.id}
                          onClick={() => onDelete(c.id, c.ragioneSociale)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica committente' : 'Nuovo committente'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ragioneSociale">Ragione sociale *</Label>
              <Input id="ragioneSociale" {...form.register('ragioneSociale')} />
              {form.formState.errors.ragioneSociale && (
                <p className="text-xs text-destructive">{form.formState.errors.ragioneSociale.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="partitaIva">Partita IVA</Label>
                <Input id="partitaIva" {...form.register('partitaIva')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codiceFiscale">Codice fiscale</Label>
                <Input id="codiceFiscale" {...form.register('codiceFiscale')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Telefono</Label>
                <Input id="telefono" {...form.register('telefono')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Input id="indirizzo" {...form.register('indirizzo')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Note</Label>
              <textarea
                id="note"
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                {...form.register('note')}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="attivo"
                checked={form.watch('attivo')}
                onCheckedChange={(v) => form.setValue('attivo', v)}
              />
              <Label htmlFor="attivo">Attivo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvataggio…' : 'Salva'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
