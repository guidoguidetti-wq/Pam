'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  titolo: z.string().min(1, 'Titolo obbligatorio').max(300),
  descrizione: z.string().optional(),
  priorita: z.enum(['URGENTE', 'ALTA', 'MEDIA', 'BASSA']),
  stato: z.enum(['APERTA', 'IN_CORSO', 'IN_ATTESA', 'CHIUSA']),
  committenteMode: z.enum(['esistente', 'nuovo']),
  committenteId: z.string().optional(),
  committenteLibero: z.string().max(200).optional(),
  clienteMode: z.enum(['esistente', 'nuovo', 'nessuno']),
  clienteId: z.string().optional(),
  clienteLibero: z.string().max(200).optional(),
  scadenza: z.string().optional(),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Committente {
  id: number
  ragioneSociale: string
}

interface Cliente {
  id: number
  ragioneSociale: string
  committenteId: number
}

export interface TodoItem {
  id: string
  titolo: string
  descrizione: string | null
  priorita: 'URGENTE' | 'ALTA' | 'MEDIA' | 'BASSA'
  stato: 'APERTA' | 'IN_CORSO' | 'IN_ATTESA' | 'CHIUSA'
  committenteId: number | null
  clienteId: number | null
  committenteLibero: string | null
  clienteLibero: string | null
  scadenza: string | null
  note: string | null
  committente: { id: number; ragioneSociale: string } | null
  cliente: { id: number; ragioneSociale: string } | null
  createdAt: string
  updatedAt: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  todo?: TodoItem | null
  committenti: Committente[]
  clienti: Cliente[]
  onSaved: (todo: TodoItem) => void
}

export default function TodoDialog({ open, onOpenChange, todo, committenti, clienti, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const isEdit = !!todo

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      titolo: '',
      descrizione: '',
      priorita: 'MEDIA',
      stato: 'APERTA',
      committenteMode: 'esistente',
      clienteMode: 'nessuno',
      scadenza: '',
      note: '',
    },
  })

  const committenteMode = watch('committenteMode')
  const committenteId = watch('committenteId')
  const clienteMode = watch('clienteMode')

  const filteredClienti = clienti.filter(
    (c) => !committenteId || c.committenteId === parseInt(committenteId)
  )

  useEffect(() => {
    if (open) {
      if (todo) {
        reset({
          titolo: todo.titolo,
          descrizione: todo.descrizione ?? '',
          priorita: todo.priorita,
          stato: todo.stato,
          committenteMode: todo.committenteId ? 'esistente' : (todo.committenteLibero ? 'nuovo' : 'esistente'),
          committenteId: todo.committenteId?.toString() ?? '',
          committenteLibero: todo.committenteLibero ?? '',
          clienteMode: todo.clienteId ? 'esistente' : (todo.clienteLibero ? 'nuovo' : 'nessuno'),
          clienteId: todo.clienteId?.toString() ?? '',
          clienteLibero: todo.clienteLibero ?? '',
          scadenza: todo.scadenza ?? '',
          note: todo.note ?? '',
        })
      } else {
        reset({
          titolo: '',
          descrizione: '',
          priorita: 'MEDIA',
          stato: 'APERTA',
          committenteMode: 'esistente',
          committenteId: '',
          committenteLibero: '',
          clienteMode: 'nessuno',
          clienteId: '',
          clienteLibero: '',
          scadenza: '',
          note: '',
        })
      }
    }
  }, [open, todo, reset])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const payload = {
        titolo: values.titolo,
        descrizione: values.descrizione || null,
        priorita: values.priorita,
        stato: values.stato,
        committenteId: values.committenteMode === 'esistente' && values.committenteId
          ? parseInt(values.committenteId) : null,
        committenteLibero: values.committenteMode === 'nuovo' ? (values.committenteLibero || null) : null,
        clienteId: values.clienteMode === 'esistente' && values.clienteId
          ? parseInt(values.clienteId) : null,
        clienteLibero: values.clienteMode === 'nuovo' ? (values.clienteLibero || null) : null,
        scadenza: values.scadenza || null,
        note: values.note || null,
      }

      const url = isEdit ? `/api/todo/${todo!.id}` : '/api/todo'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error()

      const saved: TodoItem = await res.json()
      toast.success(isEdit ? 'Task aggiornato' : 'Task creato')
      onSaved(saved)
      onOpenChange(false)
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifica task' : 'Nuovo task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Titolo */}
          <div className="space-y-1">
            <Label>Titolo *</Label>
            <Input {...register('titolo')} placeholder="Descrivi il task..." />
            {errors.titolo && <p className="text-xs text-destructive">{errors.titolo.message}</p>}
          </div>

          {/* Priorità + Stato */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priorità</Label>
              <Select
                value={watch('priorita')}
                onValueChange={(v) => setValue('priorita', v as FormValues['priorita'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENTE">🔴 Urgente</SelectItem>
                  <SelectItem value="ALTA">🟠 Alta</SelectItem>
                  <SelectItem value="MEDIA">🔵 Media</SelectItem>
                  <SelectItem value="BASSA">⚪ Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Stato</Label>
              <Select
                value={watch('stato')}
                onValueChange={(v) => setValue('stato', v as FormValues['stato'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APERTA">Evidenza</SelectItem>
                  <SelectItem value="IN_CORSO">Aperta</SelectItem>
                  <SelectItem value="IN_ATTESA">In attesa</SelectItem>
                  <SelectItem value="CHIUSA">Chiusa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Committente */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label>Committente</Label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setValue('committenteMode', 'esistente')}
                  className={`px-2 py-0.5 rounded ${committenteMode === 'esistente' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Esistente
                </button>
                <button
                  type="button"
                  onClick={() => setValue('committenteMode', 'nuovo')}
                  className={`px-2 py-0.5 rounded ${committenteMode === 'nuovo' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Nuovo
                </button>
              </div>
            </div>

            {committenteMode === 'esistente' ? (
              <Select
                value={watch('committenteId') || '__none__'}
                onValueChange={(v) => {
                  setValue('committenteId', v === '__none__' ? '' : v)
                  setValue('clienteId', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona committente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nessuno —</SelectItem>
                  {committenti.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.ragioneSociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input {...register('committenteLibero')} placeholder="Nome committente..." />
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label>Cliente</Label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setValue('clienteMode', 'nessuno')}
                  className={`px-2 py-0.5 rounded ${clienteMode === 'nessuno' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Nessuno
                </button>
                <button
                  type="button"
                  onClick={() => setValue('clienteMode', 'esistente')}
                  className={`px-2 py-0.5 rounded ${clienteMode === 'esistente' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Esistente
                </button>
                <button
                  type="button"
                  onClick={() => setValue('clienteMode', 'nuovo')}
                  className={`px-2 py-0.5 rounded ${clienteMode === 'nuovo' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Nuovo
                </button>
              </div>
            </div>

            {clienteMode === 'esistente' && (
              <Select
                value={watch('clienteId') || '__none__'}
                onValueChange={(v) => setValue('clienteId', v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nessuno —</SelectItem>
                  {filteredClienti.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.ragioneSociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {clienteMode === 'nuovo' && (
              <Input {...register('clienteLibero')} placeholder="Nome cliente..." />
            )}
          </div>

          {/* Scadenza */}
          <div className="space-y-1">
            <Label>Scadenza</Label>
            <Input type="date" {...register('scadenza')} />
          </div>

          {/* Descrizione */}
          <div className="space-y-1">
            <Label>Descrizione</Label>
            <textarea
              {...register('descrizione')}
              rows={3}
              placeholder="Dettagli del task..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label>Note interne</Label>
            <textarea
              {...register('note')}
              rows={2}
              placeholder="Note aggiuntive..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Salva' : 'Crea task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
