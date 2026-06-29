'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Pencil, Check, X, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

type Ente = {
  id: number
  nome: string
  categoria: string | null
  note: string | null
  _count: { movimenti: number }
}

type EditState = {
  nome: string
  categoria: string
  note: string
}

export function EntiClient() {
  const [enti, setEnti] = useState<Ente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [edit, setEdit] = useState<EditState>({ nome: '', categoria: '', note: '' })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch('/api/conti-banca/enti')
      .then(r => r.json())
      .then(data => { setEnti(data); setLoading(false) })
      .catch(() => { toast.error('Errore caricamento enti'); setLoading(false) })
  }, [])

  const filtered = enti.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    (e.categoria ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.note ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function startEdit(e: Ente) {
    setEditId(e.id)
    setEdit({ nome: e.nome, categoria: e.categoria ?? '', note: e.note ?? '' })
    setExpanded(prev => new Set([...prev, e.id]))
  }

  function cancelEdit() {
    setEditId(null)
    setEdit({ nome: '', categoria: '', note: '' })
  }

  async function saveEdit(id: number) {
    if (!edit.nome.trim()) { toast.error('Il nome è obbligatorio'); return }
    try {
      const res = await fetch(`/api/conti-banca/enti?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: edit.nome.trim(),
          categoria: edit.categoria.trim() || null,
          note: edit.note.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      setEnti(prev => prev.map(e => e.id === id
        ? { ...e, nome: edit.nome.trim(), categoria: edit.categoria.trim() || null, note: edit.note.trim() || null }
        : e
      ))
      cancelEdit()
      toast.success('Ente aggiornato')
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca ente, categoria o note…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} enti</div>

      <div className="rounded-lg border divide-y">
        {loading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Caricamento…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun ente trovato</div>
        )}

        {filtered.map(e => {
          const isEditing = editId === e.id
          const isExpanded = expanded.has(e.id)

          return (
            <div key={e.id} className="px-4 py-2.5">
              {/* Header row */}
              <div className="flex items-center gap-2">
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  onClick={() => toggleExpand(e.id)}
                  title={isExpanded ? 'Comprimi' : 'Espandi'}
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {isEditing ? (
                  <Input
                    value={edit.nome}
                    onChange={ev => setEdit(s => ({ ...s, nome: ev.target.value }))}
                    placeholder="Nome ente"
                    className="h-7 text-sm flex-1"
                    onKeyDown={ev => { if (ev.key === 'Enter') saveEdit(e.id); if (ev.key === 'Escape') cancelEdit() }}
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium flex-1 truncate">{e.nome}</span>
                )}

                <span className="text-xs text-muted-foreground shrink-0">{e._count.movimenti} mov.</span>

                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(e.id)} className="text-green-600 hover:text-green-700 shrink-0">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(e)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Expanded detail: categoria + note */}
              {(isEditing || isExpanded) && (
                <div className="mt-2 ml-6 space-y-2">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                        <Input
                          value={edit.categoria}
                          onChange={ev => setEdit(s => ({ ...s, categoria: ev.target.value }))}
                          placeholder="Es. Utenze, Alimentari, Trasporti…"
                          className="h-7 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Note</label>
                        <Textarea
                          value={edit.note}
                          onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setEdit(s => ({ ...s, note: ev.target.value }))}
                          placeholder="Note aggiuntive…"
                          className="text-sm min-h-[60px] resize-none"
                          rows={2}
                        />
                      </div>
                      <Button size="sm" onClick={() => saveEdit(e.id)} className="h-7 text-xs">
                        Salva
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-1">
                      {e.categoria && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground w-16">Categoria:</span>
                          <Badge variant="outline" className="text-[10px]">{e.categoria}</Badge>
                        </div>
                      )}
                      {e.note && (
                        <div className="flex gap-1.5">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">Note:</span>
                          <span className="text-xs text-muted-foreground">{e.note}</span>
                        </div>
                      )}
                      {!e.categoria && !e.note && (
                        <span className="text-xs text-muted-foreground italic">Nessun dettaglio — clicca matita per modificare</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
