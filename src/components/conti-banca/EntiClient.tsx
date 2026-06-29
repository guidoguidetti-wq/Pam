'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Check, X, Search } from 'lucide-react'
import { toast } from 'sonner'

type Ente = { id: number; nome: string; categoria: string | null; _count: { movimenti: number } }

export function EntiClient() {
  const [enti, setEnti] = useState<Ente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCategoria, setEditCategoria] = useState('')

  useEffect(() => {
    fetch('/api/conti-banca/enti')
      .then(r => r.json())
      .then(data => { setEnti(data); setLoading(false) })
      .catch(() => { toast.error('Errore caricamento enti'); setLoading(false) })
  }, [])

  const filtered = enti.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    (e.categoria ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function startEdit(e: Ente) {
    setEditId(e.id)
    setEditNome(e.nome)
    setEditCategoria(e.categoria ?? '')
  }

  function cancelEdit() {
    setEditId(null)
    setEditNome('')
    setEditCategoria('')
  }

  async function saveEdit(id: number) {
    try {
      const res = await fetch(`/api/conti-banca/enti?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome, categoria: editCategoria || null }),
      })
      if (!res.ok) throw new Error()
      setEnti(prev => prev.map(e => e.id === id ? { ...e, nome: editNome, categoria: editCategoria || null } : e))
      cancelEdit()
      toast.success('Ente aggiornato')
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca ente o categoria…"
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
        {filtered.map(e => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            {editId === e.id ? (
              <>
                <div className="flex-1 flex gap-2 items-center">
                  <Input
                    value={editNome}
                    onChange={ev => setEditNome(ev.target.value)}
                    placeholder="Nome ente"
                    className="h-7 text-sm flex-1"
                    onKeyDown={ev => { if (ev.key === 'Enter') saveEdit(e.id); if (ev.key === 'Escape') cancelEdit() }}
                    autoFocus
                  />
                  <Input
                    value={editCategoria}
                    onChange={ev => setEditCategoria(ev.target.value)}
                    placeholder="Categoria (opz.)"
                    className="h-7 text-sm w-36"
                  />
                </div>
                <button onClick={() => saveEdit(e.id)} className="text-green-600 hover:text-green-700">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{e.nome}</span>
                  {e.categoria && (
                    <Badge variant="outline" className="text-[10px] mt-0.5">{e.categoria}</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{e._count.movimenti} mov.</span>
                <button
                  onClick={() => startEdit(e)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
