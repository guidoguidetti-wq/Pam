'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Pencil, Check, X, Search } from 'lucide-react'
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

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca ente, categoria o note…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} enti</div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Categoria</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 text-right">Mov.</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Caricamento…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nessun ente trovato</td></tr>
            )}
            {filtered.map(e => {
              const isEditing = editId === e.id
              return (
                <tr key={e.id} className={isEditing ? 'bg-muted/20' : 'hover:bg-muted/30 transition-colors'}>
                  {/* Nome */}
                  <td className="px-3 py-2 min-w-[180px]">
                    {isEditing ? (
                      <Input
                        value={edit.nome}
                        onChange={ev => setEdit(s => ({ ...s, nome: ev.target.value }))}
                        placeholder="Nome ente"
                        className="h-7 text-sm"
                        onKeyDown={ev => { if (ev.key === 'Enter') saveEdit(e.id); if (ev.key === 'Escape') cancelEdit() }}
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{e.nome}</span>
                    )}
                  </td>

                  {/* Categoria */}
                  <td className="px-3 py-2 min-w-[150px]">
                    {isEditing ? (
                      <Input
                        value={edit.categoria}
                        onChange={ev => setEdit(s => ({ ...s, categoria: ev.target.value }))}
                        placeholder="Es. Utenze, Alimentari…"
                        className="h-7 text-sm"
                        onKeyDown={ev => { if (ev.key === 'Escape') cancelEdit() }}
                      />
                    ) : (
                      e.categoria
                        ? <Badge variant="outline" className="text-[10px]">{e.categoria}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Note */}
                  <td className="px-3 py-2 max-w-xs">
                    {isEditing ? (
                      <Textarea
                        value={edit.note}
                        onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setEdit(s => ({ ...s, note: ev.target.value }))}
                        placeholder="Note aggiuntive…"
                        className="text-sm min-h-[56px] resize-none"
                        rows={2}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground line-clamp-2" title={e.note ?? undefined}>
                        {e.note ?? '—'}
                      </span>
                    )}
                  </td>

                  {/* Movimenti */}
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {e._count.movimenti}
                  </td>

                  {/* Azioni */}
                  <td className="px-3 py-2 text-center">
                    {isEditing ? (
                      <div className="flex justify-center gap-2">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-green-600 hover:text-green-700" onClick={() => saveEdit(e.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
