'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type TipoSpesa = 'KM' | 'AUTOSTRADA' | 'MEZZI' | 'VITTO' | 'ALLOGGIO' | 'ALTRO'

const TIPO_LABELS: Record<TipoSpesa, string> = {
  KM: 'Km trasferta',
  AUTOSTRADA: 'Pedaggi/Autostrada',
  MEZZI: 'Treni/Aerei/Taxi',
  VITTO: 'Vitto',
  ALLOGGIO: 'Alloggio',
  ALTRO: 'Altro',
}

interface Allegato {
  id: string
  nomeFile: string
  tipoMime: string | null
  storageUrl: string | null
}

interface SpesaRow {
  id: string
  tipoSpesa: TipoSpesa
  descrizione: string | null
  quantita: number | null
  importoUnitario: number | null
  importoTotale: number
  dataSpesa: string
  rimborsoRichiesto: boolean
  allegati: Allegato[]
}

interface SpeseSectionProps {
  attivitaId: string | undefined
  dataAttivita: string
  committenteId: string
  clienteId: string
  kmDefaultTrasferta: number | null
}

export function SpeseSection({
  attivitaId,
  dataAttivita,
  committenteId,
  clienteId,
  kmDefaultTrasferta,
}: SpeseSectionProps) {
  const [spese, setSpese] = useState<SpesaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadSpesaId, setPendingUploadSpesaId] = useState<string | null>(null)

  // Add form state
  const [tipo, setTipo] = useState<TipoSpesa>('KM')
  const [descrizione, setDescrizione] = useState('')
  const [quantita, setQuantita] = useState('')
  const [importoUnitario, setImportoUnitario] = useState('')
  const [importoTotale, setImportoTotale] = useState('')
  const [dataSpesa, setDataSpesa] = useState(dataAttivita)
  const [rimborso, setRimborso] = useState(true)
  const [loadingKmPrice, setLoadingKmPrice] = useState(false)
  // Track whether the user has manually edited quantita after opening the form
  const kmUserEdited = useRef(false)

  // Load existing spese
  useEffect(() => {
    if (!attivitaId) {
      setSpese([])
      return
    }
    setLoading(true)
    fetch(`/api/spese?attivita_id=${attivitaId}`)
      .then((r) => r.json())
      .then(setSpese)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [attivitaId])

  // Fetch KM price from listino
  useEffect(() => {
    if (tipo !== 'KM' || !committenteId || !adding) return
    setLoadingKmPrice(true)
    const params = new URLSearchParams({ committente_id: committenteId, tipo_voce: 'KM' })
    if (clienteId) params.set('cliente_id', clienteId)
    if (dataSpesa) params.set('data', dataSpesa)
    fetch(`/api/listino/prezzo?${params}`)
      .then((r) => r.json())
      .then((d: { tariffa: number | null }) => {
        if (d.tariffa != null) setImportoUnitario(String(d.tariffa))
      })
      .catch(console.error)
      .finally(() => setLoadingKmPrice(false))
  }, [tipo, committenteId, clienteId, dataSpesa, adding])

  // Se kmDefaultTrasferta arriva dopo l'apertura del form (race condition sulla fetch clienti),
  // aggiorna quantita solo se l'utente non ha ancora modificato manualmente il campo
  useEffect(() => {
    if (adding && tipo === 'KM' && !kmUserEdited.current && kmDefaultTrasferta != null) {
      setQuantita(String(kmDefaultTrasferta))
    }
  }, [kmDefaultTrasferta, adding, tipo])

  // Auto-calc total for KM
  useEffect(() => {
    if (tipo !== 'KM') return
    const q = parseFloat(quantita)
    const u = parseFloat(importoUnitario)
    if (!isNaN(q) && !isNaN(u) && q > 0 && u > 0) {
      setImportoTotale((q * u).toFixed(2))
    }
  }, [quantita, importoUnitario, tipo])

  function openAddForm() {
    kmUserEdited.current = false
    setTipo('KM')
    setDescrizione('')
    setQuantita(kmDefaultTrasferta != null ? String(kmDefaultTrasferta) : '')
    setImportoUnitario('')
    setImportoTotale('')
    setDataSpesa(dataAttivita)
    setRimborso(true)
    setAdding(true)
  }

  function handleTipoChange(v: TipoSpesa) {
    kmUserEdited.current = false
    setTipo(v)
    setDescrizione('')
    setImportoTotale('')
    if (v === 'KM') {
      setQuantita(kmDefaultTrasferta != null ? String(kmDefaultTrasferta) : '')
      setImportoUnitario('')
    } else {
      setQuantita('')
      setImportoUnitario('')
    }
  }

  async function handleSave() {
    const totale = parseFloat(importoTotale)
    if (isNaN(totale) || totale <= 0) {
      toast.error('Inserisci un importo valido')
      return
    }
    if (!attivitaId) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        attivitaId,
        tipoSpesa: tipo,
        descrizione: descrizione.trim() || null,
        importoTotale: totale,
        dataSpesa,
        rimborsoRichiesto: rimborso,
        valuta: 'EUR',
      }
      if (tipo === 'KM') {
        const q = parseFloat(quantita)
        const u = parseFloat(importoUnitario)
        body.quantita = !isNaN(q) ? q : null
        body.importoUnitario = !isNaN(u) ? u : null
      }
      const res = await fetch('/api/spese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const saved: SpesaRow = await res.json()
      setSpese((prev) => [...prev, saved])
      toast.success('Spesa aggiunta')
      setAdding(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa spesa?')) return
    const res = await fetch(`/api/spese/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSpese((prev) => prev.filter((s) => s.id !== id))
      toast.success('Spesa eliminata')
    } else {
      toast.error("Errore durante l'eliminazione")
    }
  }

  function openFileUpload(spesaId: string) {
    setPendingUploadSpesaId(spesaId)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadSpesaId) return
    setUploadingId(pendingUploadSpesaId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('spesa_id', pendingUploadSpesaId)
      const res = await fetch('/api/allegati', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error)
      const allegato: Allegato = await res.json()
      setSpese((prev) =>
        prev.map((s) =>
          s.id === pendingUploadSpesaId ? { ...s, allegati: [...s.allegati, allegato] } : s
        )
      )
      toast.success('File allegato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore upload')
    } finally {
      setUploadingId(null)
      setPendingUploadSpesaId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAllegato(spesaId: string, allegatoId: string) {
    const res = await fetch(`/api/allegati/${allegatoId}`, { method: 'DELETE' })
    if (res.ok) {
      setSpese((prev) =>
        prev.map((s) =>
          s.id === spesaId ? { ...s, allegati: s.allegati.filter((a) => a.id !== allegatoId) } : s
        )
      )
    } else {
      toast.error('Errore eliminazione allegato')
    }
  }

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Spese</span>
        {attivitaId && !adding && (
          <Button type="button" size="sm" variant="outline" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Aggiungi
          </Button>
        )}
      </div>

      {!attivitaId && (
        <p className="text-xs text-muted-foreground italic">
          Salva prima l&apos;attività per poter aggiungere spese.
        </p>
      )}

      {/* Hidden file input — supports camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {/* Elenco spese salvate */}
      {spese.map((s) => (
        <div key={s.id} className="rounded-md border bg-muted/20 p-2 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
              <Badge variant="secondary" className="text-xs shrink-0">
                {TIPO_LABELS[s.tipoSpesa]}
              </Badge>
              <span className="font-mono font-medium">€ {s.importoTotale.toFixed(2)}</span>
              {s.tipoSpesa === 'KM' && s.quantita && (
                <span className="text-muted-foreground">{s.quantita} km</span>
              )}
              {s.descrizione && (
                <span className="text-muted-foreground truncate">{s.descrizione}</span>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openFileUpload(s.id)}
                disabled={uploadingId === s.id}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40"
                title="Allega foto/file"
              >
                {uploadingId === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Allegati */}
          {s.allegati.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.allegati.map((a) => (
                <div key={a.id} className="relative group">
                  {a.tipoMime?.startsWith('image/') && a.storageUrl ? (
                    <a href={a.storageUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.storageUrl}
                        alt={a.nomeFile}
                        className="h-14 w-14 object-cover rounded border"
                      />
                    </a>
                  ) : (
                    <a
                      href={a.storageUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-accent"
                    >
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-24">{a.nomeFile}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAllegato(s.id, a.id)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Form aggiunta nuova spesa */}
      {adding && (
        <div className="rounded-md border p-2 space-y-2 bg-background">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => handleTipoChange(v as TipoSpesa)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIPO_LABELS) as [TipoSpesa, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={dataSpesa}
                onChange={(e) => setDataSpesa(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {tipo === 'KM' ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Km</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={quantita}
                  onChange={(e) => {
                    kmUserEdited.current = true
                    setQuantita(e.target.value)
                  }}
                  className="h-8 text-xs"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  €/km{' '}
                  {loadingKmPrice && <Loader2 className="inline h-2.5 w-2.5 animate-spin" />}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={importoUnitario}
                  onChange={(e) => setImportoUnitario(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Totale €</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={importoTotale}
                  onChange={(e) => setImportoTotale(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Importo € *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={importoTotale}
                onChange={(e) => setImportoTotale(e.target.value)}
                className="h-8 text-xs"
                placeholder="0.00"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Descrizione</Label>
            <Input
              type="text"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              className="h-8 text-xs"
              placeholder="Facoltativo"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="rimborso-sw"
              checked={rimborso}
              onCheckedChange={setRimborso}
              className="scale-90"
            />
            <Label htmlFor="rimborso-sw" className="text-xs cursor-pointer">
              Rimborso richiesto
            </Label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Salva spesa
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
