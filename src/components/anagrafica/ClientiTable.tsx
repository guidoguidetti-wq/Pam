'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users, CheckCircle2, XCircle, Navigation, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

export type ClienteRow = {
  id: number
  ragioneSociale: string
  partitaIva: string | null
  indirizzo: string | null
  email: string | null
  note: string | null
  kmTrasferta: number | null
  attivo: boolean
  createdAt: string
  committenteId: number
  committente: { id: number; ragioneSociale: string }
  _count: { attivita: number }
}

export type CommittenteOption = { id: number; ragioneSociale: string }

const schema = z.object({
  committenteId: z.coerce.number().int().positive('Seleziona un committente'),
  ragioneSociale: z.string().trim().min(1, 'Obbligatorio').max(200),
  partitaIva: z.string().trim().max(20).optional(),
  indirizzo: z.string().trim().optional(),
  email: z.string().trim().max(150).optional(),
  note: z.string().trim().optional(),
  kmTrasferta: z.coerce.number().int().min(0).max(99999).nullable().optional(),
  attivo: z.boolean(),
})
type FormData = z.infer<typeof schema>

export default function ClientiTable({
  clienti,
  committenti,
}: {
  clienti: ClienteRow[]
  committenti: CommittenteOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClienteRow | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [filterCommittente, setFilterCommittente] = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { attivo: true },
  })

  const filtered = filterCommittente
    ? clienti.filter((c) => c.committenteId === filterCommittente)
    : clienti

  function openCreate() {
    setEditing(null)
    form.reset({
      committenteId: filterCommittente ?? undefined,
      ragioneSociale: '',
      partitaIva: '',
      indirizzo: '',
      email: '',
      note: '',
      kmTrasferta: null,
      attivo: true,
    })
    setOpen(true)
  }

  function openEdit(c: ClienteRow) {
    setEditing(c)
    form.reset({
      committenteId: c.committenteId,
      ragioneSociale: c.ragioneSociale,
      partitaIva: c.partitaIva ?? '',
      indirizzo: c.indirizzo ?? '',
      email: c.email ?? '',
      note: c.note ?? '',
      kmTrasferta: c.kmTrasferta ?? null,
      attivo: c.attivo,
    })
    setOpen(true)
  }

  async function rilevaPosizione() {
    const indirizzo = form.getValues('indirizzo')
    if (!indirizzo?.trim()) {
      toast.error("Inserisci prima l'indirizzo del cliente")
      return
    }
    if (!navigator.geolocation) {
      toast.error('Geolocalizzazione non supportata dal browser')
      return
    }
    setGeoLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      )
      const { latitude: lat1, longitude: lon1 } = pos.coords

      // Geocode the client address
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(indirizzo)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'PAM-PersonalActivityManager/1.0' } }
      )
      const nomData = await nomRes.json()
      if (!nomData.length) throw new Error('Indirizzo non trovato nella mappa')

      const lat2 = parseFloat(nomData[0].lat)
      const lon2 = parseFloat(nomData[0].lon)

      // Try OSRM for actual driving distance (note: OSRM uses lon,lat order)
      let kmOneway: number
      let method = 'stradale'
      try {
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (!osrmRes.ok) throw new Error('OSRM non disponibile')
        const osrmData = await osrmRes.json()
        if (osrmData.code !== 'Ok' || !osrmData.routes?.length)
          throw new Error('Nessun percorso trovato')
        kmOneway = osrmData.routes[0].distance / 1000
      } catch {
        // Fallback: haversine in linea d'aria
        const R = 6371
        const dLat = ((lat2 - lat1) * Math.PI) / 180
        const dLon = ((lon2 - lon1) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2
        kmOneway = R * 2 * Math.asin(Math.sqrt(a))
        method = 'aria (fallback)'
      }

      const kmAR = Math.round(kmOneway * 2)
      form.setValue('kmTrasferta', kmAR)
      toast.success(`Distanza A/R ${method}: ${kmAR} km (${Math.round(kmOneway)} km × 2)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore geolocalizzazione'
      toast.error(msg)
    } finally {
      setGeoLoading(false)
    }
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      partitaIva: data.partitaIva || null,
      indirizzo: data.indirizzo || null,
      email: data.email || null,
      note: data.note || null,
      kmTrasferta: data.kmTrasferta ?? null,
    }
    try {
      const url = editing ? `/api/clienti/${editing.id}` : '/api/clienti'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(editing ? 'Cliente aggiornato' : 'Cliente creato')
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
      const res = await fetch(`/api/clienti/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Cliente eliminato')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Clienti</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} clienti</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuovo
          </Button>
        </div>

        {/* Filtro committente */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCommittente(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterCommittente === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Tutti
          </button>
          {committenti.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCommittente(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterCommittente === c.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.ragioneSociale}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nessun cliente.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-1.5 font-medium">Ragione sociale</th>
                  <th className="text-left px-3 py-1.5 font-medium hidden md:table-cell">Committente</th>
                  <th className="text-left px-3 py-1.5 font-medium hidden lg:table-cell">Indirizzo</th>
                  <th className="text-right px-3 py-1.5 font-medium hidden lg:table-cell">Km A/R</th>
                  <th className="text-center px-3 py-1.5 font-medium hidden md:table-cell">Attività</th>
                  <th className="text-center px-3 py-1.5 font-medium">Attivo</th>
                  <th className="px-3 py-1.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-1.5 font-medium">{c.ragioneSociale}</td>
                    <td className="px-3 py-1.5 text-muted-foreground hidden md:table-cell">
                      {c.committente.ragioneSociale}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                      {c.indirizzo ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums hidden lg:table-cell">
                      {c.kmTrasferta != null ? `${c.kmTrasferta} km` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center hidden md:table-cell">
                      <Badge variant="secondary">{c._count.attivita}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {c.attivo
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="px-3 py-1.5">
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
            <DialogTitle>{editing ? 'Modifica cliente' : 'Nuovo cliente'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Committente *</Label>
              <Select
                value={form.watch('committenteId')?.toString()}
                onValueChange={(v) => form.setValue('committenteId', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona committente" />
                </SelectTrigger>
                <SelectContent>
                  {committenti.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.ragioneSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.committenteId && (
                <p className="text-xs text-destructive">{form.formState.errors.committenteId.message}</p>
              )}
            </div>

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
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Input id="indirizzo" {...form.register('indirizzo')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kmTrasferta">Km trasferta A/R (default)</Label>
              <div className="flex gap-2">
                <Input
                  id="kmTrasferta"
                  type="number"
                  min="0"
                  max="99999"
                  step="1"
                  placeholder="0"
                  className="max-w-32"
                  {...form.register('kmTrasferta', { valueAsNumber: true })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={rilevaPosizione}
                  disabled={geoLoading}
                  title="Rileva distanza dalla posizione attuale"
                >
                  {geoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Rileva</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Chilometri andata e ritorno — viene precompilato nelle spese km dell&apos;attività
              </p>
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
