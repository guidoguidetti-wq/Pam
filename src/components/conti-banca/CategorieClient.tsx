'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Pencil, Check, X, Search, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type EnteCategoria = {
  id: number
  categoria: string
  inestratto: boolean
  ingrafico: boolean
}

export function CategorieClient() {
  const [categorie, setCategorie] = useState<EnteCategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNome, setEditNome] = useState('')
  const [nuova, setNuova] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/conti-banca/enti-categorie')
      .then(r => r.json())
      .then(data => { setCategorie(data); setLoading(false) })
      .catch(() => { toast.error('Errore caricamento categorie'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const filtered = categorie.filter(c => c.categoria.toLowerCase().includes(search.toLowerCase()))

  function startEdit(c: EnteCategoria) {
    setEditId(c.id)
    setEditNome(c.categoria)
  }

  function cancelEdit() {
    setEditId(null)
    setEditNome('')
  }

  async function saveNome(id: number) {
    if (!editNome.trim()) { toast.error('La categoria è obbligatoria'); return }
    try {
      const res = await fetch(`/api/conti-banca/enti-categorie?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: editNome.trim() }),
      })
      if (!res.ok) throw new Error()
      setCategorie(prev => prev.map(c => c.id === id ? { ...c, categoria: editNome.trim() } : c))
      cancelEdit()
      toast.success('Categoria aggiornata')
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  async function toggleFlag(c: EnteCategoria, campo: 'inestratto' | 'ingrafico') {
    const valorePrecedente = c[campo]
    const nuovoValore = !valorePrecedente
    setCategorie(prev => prev.map(x => x.id === c.id ? { ...x, [campo]: nuovoValore } : x))
    try {
      const res = await fetch(`/api/conti-banca/enti-categorie?id=${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: nuovoValore }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setCategorie(prev => prev.map(x => x.id === c.id ? { ...x, [campo]: valorePrecedente } : x))
      toast.error('Errore aggiornamento')
    }
  }

  async function addCategoria() {
    const categoria = nuova.trim()
    if (!categoria) return
    try {
      const res = await fetch('/api/conti-banca/enti-categorie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Errore creazione')
        return
      }
      const created = await res.json()
      setCategorie(prev => [...prev, created].sort((a, b) => a.categoria.localeCompare(b.categoria)))
      setNuova('')
      toast.success('Categoria creata')
    } catch {
      toast.error('Errore creazione')
    }
  }

  async function removeCategoria(id: number) {
    if (!confirm('Eliminare questa categoria?')) return
    try {
      const res = await fetch(`/api/conti-banca/enti-categorie?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCategorie(prev => prev.filter(c => c.id !== id))
      toast.success('Categoria eliminata')
    } catch {
      toast.error('Errore eliminazione')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca categoria…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Nuova categoria…"
            value={nuova}
            onChange={e => setNuova(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategoria() }}
            className="h-8 text-sm w-48"
          />
          <Button size="sm" onClick={addCategoria}>
            <Plus className="h-4 w-4 mr-1" />Aggiungi
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} categorie</div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Categoria</th>
              <th className="px-3 py-2 text-center">In estratto</th>
              <th className="px-3 py-2 text-center">In grafico</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Caricamento…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Nessuna categoria trovata</td></tr>
            )}
            {filtered.map(c => {
              const isEditing = editId === c.id
              return (
                <tr key={c.id} className={isEditing ? 'bg-muted/20' : 'hover:bg-muted/30 transition-colors'}>
                  <td className="px-3 py-2 min-w-[180px]">
                    {isEditing ? (
                      <Input
                        value={editNome}
                        onChange={ev => setEditNome(ev.target.value)}
                        className="h-7 text-sm"
                        onKeyDown={ev => { if (ev.key === 'Enter') saveNome(c.id); if (ev.key === 'Escape') cancelEdit() }}
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{c.categoria}</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <Switch checked={c.inestratto} onCheckedChange={() => toggleFlag(c, 'inestratto')} />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <Switch checked={c.ingrafico} onCheckedChange={() => toggleFlag(c, 'ingrafico')} />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-green-600 hover:text-green-700" onClick={() => saveNome(c.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground hover:text-foreground" onClick={() => startEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground hover:text-destructive" onClick={() => removeCategoria(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
