'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus, Loader2 } from 'lucide-react'

interface TipoAttivita {
  id: number
  codice: string
  descrizione: string
  attivo: boolean
}

interface TipiAttivitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function TipiAttivitaDialog({ open, onOpenChange, onChanged }: TipiAttivitaDialogProps) {
  const [tipi, setTipi] = useState<TipoAttivita[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | 'new' | null>(null)

  // Stato righe in editing (chiavi come stringhe per compatibilità TS)
  const [edits, setEdits] = useState<Record<string, { codice: string; descrizione: string }>>({})
  const [newRow, setNewRow] = useState<{ codice: string; descrizione: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/tipo-attivita')
      .then((r) => r.json())
      .then((data: TipoAttivita[]) => {
        setTipi(data)
        const initEdits: Record<string, { codice: string; descrizione: string }> = {}
        data.forEach((t) => { initEdits[t.id] = { codice: t.codice, descrizione: t.descrizione } })
        setEdits(initEdits)
        setNewRow(null)
      })
      .finally(() => setLoading(false))
  }, [open])

  async function salva(id: number) {
    const edit = edits[id]
    if (!edit) return
    setSaving(id)
    try {
      const res = await fetch(`/api/tipo-attivita/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...edit, attivo: tipi.find((t) => t.id === id)?.attivo ?? true }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Errore salvataggio')
        return
      }
      const updated: TipoAttivita = await res.json()
      setTipi((prev) => prev.map((t) => (t.id === id ? updated : t)))
      toast.success('Salvato')
      onChanged?.()
    } finally {
      setSaving(null)
    }
  }

  async function toggleAttivo(tipo: TipoAttivita) {
    setSaving(tipo.id)
    try {
      const res = await fetch(`/api/tipo-attivita/${tipo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codice: tipo.codice, descrizione: tipo.descrizione, attivo: !tipo.attivo }),
      })
      if (!res.ok) { toast.error('Errore aggiornamento'); return }
      const updated: TipoAttivita = await res.json()
      setTipi((prev) => prev.map((t) => (t.id === tipo.id ? updated : t)))
      onChanged?.()
    } finally {
      setSaving(null)
    }
  }

  async function elimina(id: number) {
    if (!confirm('Eliminare questo tipo attività?')) return
    setSaving(id)
    try {
      const res = await fetch(`/api/tipo-attivita/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Errore eliminazione')
        return
      }
      setTipi((prev) => prev.filter((t) => t.id !== id))
      toast.success('Eliminato')
      onChanged?.()
    } finally {
      setSaving(null)
    }
  }

  async function creaNew() {
    if (!newRow || !newRow.codice.trim() || !newRow.descrizione.trim()) {
      toast.error('Codice e descrizione obbligatori')
      return
    }
    setSaving('new')
    try {
      const res = await fetch('/api/tipo-attivita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRow, attivo: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Errore creazione')
        return
      }
      const created: TipoAttivita = await res.json()
      setTipi((prev) => [...prev, created])
      setEdits((prev) => ({ ...prev, [created.id]: { codice: created.codice, descrizione: created.descrizione } }))
      setNewRow(null)
      toast.success('Creato')
      onChanged?.()
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestione Tipi Attività</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 w-24">Codice</th>
                  <th className="text-left py-2">Descrizione</th>
                  <th className="text-center py-2 w-16">Attivo</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {tipi.map((tipo) => (
                  <tr key={tipo.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <Input
                        value={edits[tipo.id]?.codice ?? tipo.codice}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [tipo.id]: { ...prev[tipo.id], codice: e.target.value.toUpperCase() },
                          }))
                        }
                        className="h-8 uppercase"
                        maxLength={10}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        value={edits[tipo.id]?.descrizione ?? tipo.descrizione}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [tipo.id]: { ...prev[tipo.id], descrizione: e.target.value },
                          }))
                        }
                        className="h-8"
                        maxLength={100}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <Switch
                        checked={tipo.attivo}
                        onCheckedChange={() => toggleAttivo(tipo)}
                        disabled={saving === tipo.id}
                      />
                    </td>
                    <td className="py-1.5">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => salva(tipo.id)}
                          disabled={saving === tipo.id}
                        >
                          {saving === tipo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salva'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => elimina(tipo.id)}
                          disabled={saving === tipo.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {newRow && (
                  <tr className="border-b bg-muted/30">
                    <td className="py-1.5 pr-2">
                      <Input
                        placeholder="COD"
                        value={newRow.codice}
                        onChange={(e) => setNewRow({ ...newRow, codice: e.target.value.toUpperCase() })}
                        className="h-8 uppercase"
                        maxLength={10}
                        autoFocus
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        placeholder="Descrizione"
                        value={newRow.descrizione}
                        onChange={(e) => setNewRow({ ...newRow, descrizione: e.target.value })}
                        className="h-8"
                        maxLength={100}
                      />
                    </td>
                    <td />
                    <td className="py-1.5">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" className="h-8 px-2" onClick={creaNew} disabled={saving === 'new'}>
                          {saving === 'new' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Crea'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setNewRow(null)}
                        >
                          ✕
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {!newRow && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setNewRow({ codice: '', descrizione: '' })}
              >
                <Plus className="h-4 w-4 mr-1" /> Nuovo tipo
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
