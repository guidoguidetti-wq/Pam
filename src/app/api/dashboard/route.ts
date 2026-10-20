import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function epochTimeToMins(d: Date): number {
  const [h, m] = d.toISOString().substring(11, 16).split(':').map(Number)
  return h * 60 + m
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anno = parseInt(searchParams.get('anno') ?? String(new Date().getFullYear()))

  const from = new Date(`${anno}-01-01`)
  const to = new Date(`${anno}-12-31`)

  // ── Attività dell'anno ───────────────────────────────────────────────────
  const attivita = await prisma.attivita.findMany({
    where: { dataAttivita: { gte: from, lte: to } },
    select: {
      dataAttivita: true,
      oraInizio: true,
      oraFine: true,
      oreErogate: true,
      valoreAttivita: true,
      spese: { select: { importoTotale: true } },
    },
  })

  // Aggrega per mese
  const byMonth: Record<number, { oreErogate: number; valoreAttivita: number; valoreSpese: number }> = {}
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { oreErogate: 0, valoreAttivita: 0, valoreSpese: 0 }
  }

  for (const a of attivita) {
    const mese = a.dataAttivita.getUTCMonth() + 1
    const ore = a.oreErogate != null
      ? a.oreErogate
      : epochTimeToMins(a.oraFine) - epochTimeToMins(a.oraInizio)
    byMonth[mese].oreErogate += ore
    byMonth[mese].valoreAttivita += a.valoreAttivita ? parseFloat(a.valoreAttivita.toString()) : 0
    byMonth[mese].valoreSpese += a.spese.reduce((s, sp) => s + parseFloat(sp.importoTotale.toString()), 0)
  }

  const mesiStats = Object.entries(byMonth).map(([mese, vals]) => ({
    mese: parseInt(mese),
    oreErogate: Math.round(vals.oreErogate) / 60, // in ore (float)
    valoreAttivita: Math.round(vals.valoreAttivita * 100) / 100,
    valoreSpese: Math.round(vals.valoreSpese * 100) / 100,
  }))

  // ── Progetti con ore stimate e erogate ──────────────────────────────────
  const progetti = await prisma.progetto.findMany({
    where: { attivo: true },
    orderBy: [
      { dataInizio: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    include: {
      committente: { select: { ragioneSociale: true } },
      cliente: { select: { ragioneSociale: true } },
      stime: { select: { giorniStimati: true, orePerGiorno: true, tipoAttivita: { select: { id: true, codice: true, descrizione: true } } } },
      tipiAttivita: { select: { tipoAttivita: { select: { id: true, codice: true, descrizione: true } } }, orderBy: { tipoAttivitaId: 'asc' } },
      attivita: { select: { oreErogate: true, oraInizio: true, oraFine: true, tipoAttivita: { select: { id: true, codice: true, descrizione: true } } } },
    },
  })

  const progettiData = progetti.map((p) => {
    const oreStimate = p.tipoBudget === 'STIMATO'
      ? p.stime.reduce((acc, s) =>
          acc + parseFloat(s.giorniStimati.toString()) * parseFloat(s.orePerGiorno.toString()), 0)
      : null
    const giorniStimati = p.tipoBudget === 'STIMATO'
      ? p.stime.reduce((acc, s) => acc + parseFloat(s.giorniStimati.toString()), 0)
      : null

    // Dettaglio ore (in ore decimali) per tipo attività: tipi del progetto + tipi presenti nelle attività
    type RigaTipo = { id: number; codice: string; descrizione: string; oreErogate: number; oreStimate: number | null }
    const perTipoMap = new Map<number, RigaTipo>()
    const riga = (t: { id: number; codice: string; descrizione: string }) => {
      if (!perTipoMap.has(t.id))
        perTipoMap.set(t.id, { ...t, oreErogate: 0, oreStimate: p.tipoBudget === 'STIMATO' ? 0 : null })
      return perTipoMap.get(t.id)!
    }
    for (const pt of p.tipiAttivita) riga(pt.tipoAttivita)
    if (p.tipoBudget === 'STIMATO') {
      for (const s of p.stime) {
        const r = riga(s.tipoAttivita)
        r.oreStimate = (r.oreStimate ?? 0) + parseFloat(s.giorniStimati.toString()) * parseFloat(s.orePerGiorno.toString())
      }
    }

    let oreErogate = 0
    for (const a of p.attivita) {
      const ore = (a.oreErogate != null
        ? a.oreErogate
        : epochTimeToMins(a.oraFine) - epochTimeToMins(a.oraInizio)) / 60
      oreErogate += ore
      riga(a.tipoAttivita).oreErogate += ore
    }
    const perTipo = [...perTipoMap.values()]
      .sort((a, b) => a.id - b.id)
      .map((r) => ({
        ...r,
        oreErogate: Math.round(r.oreErogate * 100) / 100,
        oreStimate: r.oreStimate !== null ? Math.round(r.oreStimate * 100) / 100 : null,
      }))

    return {
      id: p.id,
      nome: p.nome,
      codice: p.codice,
      tipoBudget: p.tipoBudget,
      attivo: p.attivo,
      dataInizio: p.dataInizio ? p.dataInizio.toISOString().split('T')[0] : null,
      dataFinePrevista: p.dataFinePrevista ? p.dataFinePrevista.toISOString().split('T')[0] : null,
      committente: p.committente.ragioneSociale,
      cliente: p.cliente.ragioneSociale,
      oreStimate: oreStimate !== null ? Math.round(oreStimate * 100) / 100 : null,
      giorniStimati: giorniStimati !== null ? Math.round(giorniStimati * 100) / 100 : null,
      oreErogate: Math.round(oreErogate * 100) / 100,
      perTipo,
    }
  })

  // ── Task urgenti/alti aperti ────────────────────────────────────────────
  const todoUrgenti = await prisma.todo.findMany({
    where: {
      stato: { in: ['APERTA', 'IN_CORSO', 'IN_ATTESA'] },
      priorita: { in: ['URGENTE', 'ALTA'] },
    },
    include: {
      committente: { select: { ragioneSociale: true } },
      cliente: { select: { ragioneSociale: true } },
    },
    orderBy: [{ priorita: 'asc' }, { scadenza: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 10,
  })

  const todoData = todoUrgenti.map((t) => ({
    id: t.id.toString(),
    titolo: t.titolo,
    priorita: t.priorita,
    stato: t.stato,
    scadenza: t.scadenza ? t.scadenza.toISOString().split('T')[0] : null,
    committente: t.committente?.ragioneSociale ?? t.committenteLibero ?? null,
    cliente: t.cliente?.ragioneSociale ?? t.clienteLibero ?? null,
  }))

  const todoCount = await prisma.todo.count({
    where: { stato: { in: ['APERTA', 'IN_CORSO', 'IN_ATTESA'] } },
  })

  return NextResponse.json({ mesiStats, progetti: progettiData, todoUrgenti: todoData, todoCount })
}
