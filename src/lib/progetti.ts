import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const stimaSchema = z.object({
  tipoAttivitaId: z.number().int().positive(),
  giorniStimati: z.coerce.number().positive(),
  orePerGiorno: z.coerce.number().positive().default(8),
})

export const progettoSchema = z.object({
  committenteId: z.number().int().positive(),
  clienteId: z.number().int().positive(),
  codice: z.string().max(50).nullable().optional(),
  nome: z.string().trim().min(1, 'Nome obbligatorio').max(200),
  descrizione: z.string().nullable().optional(),
  tipoBudget: z.enum(['STIMATO', 'CONSUNTIVO']).default('CONSUNTIVO'),
  dataInizio: z.string().nullable().optional(),
  dataFinePrevista: z.string().nullable().optional(),
  attivo: z.boolean().default(true),
  note: z.string().nullable().optional(),
  tipiAttivitaIds: z.array(z.number().int().positive()).min(1, 'Seleziona almeno un tipo attività'),
  stime: z.array(stimaSchema).default([]),
})

type ProgettoInput = z.infer<typeof progettoSchema>

/** Dati Prisma comuni a create/update. I tipi con stima sono sempre inclusi tra i tipi del progetto. */
export function datiProgetto({ stime, tipiAttivitaIds, dataInizio, dataFinePrevista, ...rest }: ProgettoInput) {
  const stimeValide = rest.tipoBudget === 'STIMATO' ? stime : []
  const tipi = [...new Set([...tipiAttivitaIds, ...stimeValide.map(s => s.tipoAttivitaId)])]
  return {
    ...rest,
    dataInizio: dataInizio ? new Date(dataInizio) : null,
    dataFinePrevista: dataFinePrevista ? new Date(dataFinePrevista) : null,
    tipiAttivita: { create: tipi.map(tipoAttivitaId => ({ tipoAttivitaId })) },
    stime: {
      create: stimeValide.map(s => ({
        tipoAttivitaId: s.tipoAttivitaId,
        giorniStimati: s.giorniStimati,
        orePerGiorno: s.orePerGiorno,
      })),
    },
  }
}

export const progettoInclude = {
  committente: { select: { id: true, ragioneSociale: true } },
  cliente: { select: { id: true, ragioneSociale: true } },
  stime: {
    include: { tipoAttivita: { select: { id: true, codice: true, descrizione: true } } },
    orderBy: { tipoAttivitaId: 'asc' },
  },
  tipiAttivita: {
    include: { tipoAttivita: { select: { id: true, codice: true, descrizione: true } } },
    orderBy: { tipoAttivitaId: 'asc' },
  },
  _count: { select: { attivita: true, allegati: true } },
} satisfies Prisma.ProgettoInclude

type ProgettoConRelazioni = Prisma.ProgettoGetPayload<{ include: typeof progettoInclude }>

export type OrePerTipo = {
  tipoAttivitaId: number
  codice: string
  descrizione: string
  oreErogate: number // minuti
  oreStimate: number // minuti (0 se non stimato)
}

/**
 * Aggiunge ai progetti i totali ore (in minuti) complessivi e per tipo attività.
 * Il dettaglio per tipo include tutti i tipi del progetto, più eventuali tipi
 * presenti solo nelle attività registrate.
 */
export async function conOrePerTipo(progetti: ProgettoConRelazioni[]) {
  const ids = progetti.map(p => p.id)
  const gruppi = ids.length > 0
    ? await prisma.attivita.groupBy({
        by: ['progettoId', 'tipoAttivitaId'],
        _sum: { oreErogate: true },
        where: { progettoId: { in: ids } },
      })
    : []

  const tipiIds = [...new Set(gruppi.map(g => g.tipoAttivitaId))]
  const tipi = tipiIds.length > 0
    ? await prisma.tipoAttivita.findMany({
        where: { id: { in: tipiIds } },
        select: { id: true, codice: true, descrizione: true },
      })
    : []
  const tipiMap = new Map(tipi.map(t => [t.id, t]))

  return progetti.map(p => {
    const righe = new Map<number, OrePerTipo>()
    const riga = (t: { id: number; codice: string; descrizione: string }) => {
      if (!righe.has(t.id))
        righe.set(t.id, { tipoAttivitaId: t.id, codice: t.codice, descrizione: t.descrizione, oreErogate: 0, oreStimate: 0 })
      return righe.get(t.id)!
    }

    for (const pt of p.tipiAttivita) riga(pt.tipoAttivita)
    if (p.tipoBudget === 'STIMATO') {
      for (const s of p.stime)
        riga(s.tipoAttivita).oreStimate += s.giorniStimati.toNumber() * s.orePerGiorno.toNumber() * 60
    }
    for (const g of gruppi) {
      if (g.progettoId !== p.id) continue
      const t = tipiMap.get(g.tipoAttivitaId)
      if (t) riga(t).oreErogate += g._sum.oreErogate ?? 0
    }

    const orePerTipo = [...righe.values()].sort((a, b) => a.tipoAttivitaId - b.tipoAttivitaId)
    return {
      ...p,
      orePerTipo,
      oreErogateTotale: orePerTipo.reduce((acc, r) => acc + r.oreErogate, 0),
      oreStimaTotale: orePerTipo.reduce((acc, r) => acc + r.oreStimate, 0),
    }
  })
}

/**
 * Verifica che il tipo attività sia ammesso nel progetto.
 * Restituisce un messaggio di errore, oppure null se è tutto ok.
 */
export async function verificaTipoProgetto(progettoId: number, tipoAttivitaId: number) {
  const progetto = await prisma.progetto.findUnique({
    where: { id: progettoId },
    select: { nome: true, tipiAttivita: { select: { tipoAttivitaId: true } } },
  })
  if (!progetto) return 'Progetto non trovato'
  // Progetto senza tipi definiti: nessun vincolo
  if (progetto.tipiAttivita.length === 0) return null
  if (progetto.tipiAttivita.some(t => t.tipoAttivitaId === tipoAttivitaId)) return null
  return `Il tipo attività selezionato non è previsto nel progetto "${progetto.nome}"`
}
