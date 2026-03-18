# PAM — Personal Activity Manager
## Istruzioni per Claude Code

---

## Contesto del progetto

PAM è un'applicazione web **personale e individuale** per la gestione delle attività lavorative.
Consente di loggare attività su calendario, valorizzarle in base a listini tariffari e
produrre report per la fatturazione ai committenti.

**Sviluppatore**: Guido Guidetti — Softintime (guido.guidetti@softintime.com)
**Ambiente target**: Neon PostgreSQL + Vercel (Next.js)

---

## Stack tecnologico — RISPETTA SEMPRE QUESTO

| Layer         | Tecnologia               | Note                                           |
|---------------|--------------------------|------------------------------------------------|
| Framework     | **Next.js 15** App Router | Usa React Server Components dove possibile     |
| UI            | **shadcn/ui** + Tailwind  | Componenti da `@/components/ui/`               |
| Calendario    | **FullCalendar** React    | `@fullcalendar/react` + `@fullcalendar/daygrid` |
| ORM           | **Prisma 5**              | Client generato in `@/lib/prisma.ts`           |
| Database      | **Neon PostgreSQL**       | Connection string da `DATABASE_URL` in `.env`  |
| Auth          | **NextAuth.js v5**        | Credentials provider, sessione JWT             |
| File upload   | **Vercel Blob**           | Per scontrini e allegati                       |
| Validazione   | **Zod**                   | Schema validation su tutte le API              |
| Forms         | **React Hook Form** + Zod | Hook `useForm` + `zodResolver`                 |
| Notifiche     | **Sonner**                | Toast per feedback utente                      |
| PDF report    | **@react-pdf/renderer**   | Generazione report fatturazione lato server    |
| Mobile        | **PWA**                   | `next-pwa` con manifest per iOS/Android        |

---

## Struttura directory — MANTIENI QUESTA CONVENZIONE

```
pam/
├── CLAUDE.md                      ← questo file
├── prisma/
│   ├── schema.prisma              ← schema DB completo
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               ← redirect a /calendario
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── calendario/
│   │   │   └── page.tsx           ← vista principale calendario
│   │   ├── attivita/
│   │   │   └── [id]/page.tsx
│   │   ├── anagrafica/
│   │   │   ├── committenti/
│   │   │   ├── clienti/
│   │   │   └── listino/
│   │   ├── progetti/
│   │   │   └── page.tsx
│   │   ├── report/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── attivita/route.ts
│   │       ├── attivita/[id]/route.ts
│   │       ├── committenti/route.ts
│   │       ├── clienti/route.ts
│   │       ├── progetti/route.ts
│   │       ├── listino/route.ts
│   │       ├── spese/route.ts
│   │       ├── allegati/route.ts
│   │       └── report/route.ts
│   ├── components/
│   │   ├── ui/                    ← shadcn components (non modificare)
│   │   ├── calendario/
│   │   │   ├── CalendarioView.tsx
│   │   │   ├── AttivitaDrawer.tsx ← form log attività (slide-in laterale)
│   │   │   └── OreCounter.tsx     ← badge ore giornata/settimana/mese
│   │   ├── attivita/
│   │   │   └── AttivitaForm.tsx
│   │   ├── spese/
│   │   │   └── SpeseForm.tsx
│   │   ├── report/
│   │   │   └── ReportPreview.tsx
│   │   └── shared/
│   │       ├── CommittenteSelect.tsx
│   │       ├── ClienteSelect.tsx   ← filtrato per committente
│   │       └── ProgettoSelect.tsx  ← filtrato per committente+cliente
│   ├── lib/
│   │   ├── prisma.ts              ← singleton Prisma client
│   │   ├── auth.ts                ← NextAuth config
│   │   ├── tariffe.ts             ← logica risoluzione tariffa
│   │   └── utils.ts               ← cn(), formatOre(), formatValuta()
│   └── types/
│       └── index.ts               ← tipi TypeScript condivisi
├── public/
│   ├── manifest.json              ← PWA manifest
│   └── icons/
├── .env.local                     ← credenziali locali (non committare)
├── .env.example                   ← template variabili (committare)
└── package.json
```

---

## Modello dati — ENTITÀ PRINCIPALI

### Logica listino tariffe (CRITICA)
La tariffa si risolve in ordine di priorità decrescente:
1. `committente_id + cliente_id + tipo_attivita_id` → tariffa specifica cliente+tipo
2. `committente_id + cliente_id` (tipo NULL) → flat per cliente
3. `committente_id + tipo_attivita_id` (cliente NULL) → tipo generico committente
4. `committente_id` solo → default committente

La funzione `get_tariffa()` in PostgreSQL implementa questa logica.
In TypeScript usa `src/lib/tariffe.ts` per la stessa logica lato applicazione.

### Tipi attività (enum fisso)
```
COM → Commerciale
PRE → Presale
PMG → Project Management
BAN → Business Analyst
SVI → Sviluppo
OPS → Operation
```

### Tipi spesa (enum fisso)
```
KM         → km percorsi (tariffa da listino tipo_voce='KM')
AUTOSTRADA → pedaggi
MEZZI      → treni, aerei, taxi
VITTO      → pasti
ALLOGGIO   → hotel/b&b
ALTRO      → altro
```

### Progetto stimato vs consuntivo
- `STIMATO`: ha righe in `progetto_stima` con giorni stimati per tipo attività.
  Mostrare sempre il residuo (stimato − erogato).
- `CONSUNTIVO`: nessuna stima, solo accumulo ore.

---

## Regole di sviluppo — RISPETTA SEMPRE

### API Routes
- Ogni route valida l'input con **Zod** prima di toccare il DB
- Errori: `{ error: string, details?: z.ZodIssue[] }` con status HTTP corretto
- Autenticazione: controlla sessione NextAuth su ogni route protetta
- Usa sempre `try/catch` con log dell'errore server-side

```typescript
// Pattern standard API route
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ /* ... */ })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.attivita.create({ data: parsed.data })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
```

### Componenti React
- Usa **Server Components** per fetch dati statici (anagrafiche, liste)
- Usa **Client Components** (`'use client'`) solo per interattività (calendario, form, drawer)
- Tutti i select concatenati (committente → cliente → progetto) usano
  `useState` + `useEffect` per ricaricare le opzioni in cascata
- Form sempre con `react-hook-form` + `zodResolver`

### Stile UI
- Palette colori per committente: genera colori deterministici da ID con HSL
  `hsl(${(id * 47) % 360}, 65%, 55%)` — consistenti tra sessioni
- Il calendario mostra badge colorati per committente
- Su mobile: drawer a schermo intero, bottone FAB "+" per nuova attività
- Usa `cn()` da `@/lib/utils` per classi condizionali

### Upload allegati (scontrini)
- Usa Vercel Blob per storage
- Su mobile: `<input type="file" accept="image/*" capture="environment">` → attiva fotocamera
- Comprimi immagini client-side con `browser-image-compression` prima dell'upload
- Salva `storage_key` e `storage_url` in tabella `allegato`

---

## Report di fatturazione

Il report è generato da `/api/report` con parametri `{ da: Date, a: Date, committente_id?: number }`.

### Struttura del report
```
COMMITTENTE: Acme Srl
Periodo: 01/01/2025 – 31/01/2025

CLIENTE: Mario Rossi SpA
  PROGETTO: Implementazione CRM
    Sviluppo          12h 30m   @€120/h   = €1.500,00
    Project Mgmt       3h 00m   @€150/h   = €  450,00
  CONSUNTIVO (senza progetto)
    Commerciale        2h 00m   @€100/h   = €  200,00

  SPESE:
    Km percorsi        240 km  @€0,42/km  = €  100,80
    Autostrada                             = €   12,50
    Vitto                                  = €   45,00
    [thumbnail scontrino 1] [thumbnail 2]

  TOTALE COMPETENZE:                        €2.150,00
  TOTALE SPESE:                             €  158,30
  TOTALE CLIENTE:                           €2.308,30

TOTALE COMMITTENTE:                         €2.308,30
```

---

## Comandi utili

```bash
# Setup iniziale
npm install
npx prisma generate
npx prisma migrate dev --name init

# Dev
npm run dev

# DB studio
npx prisma studio

# Type check
npm run type-check

# Build
npm run build
```

---

## Variabili d'ambiente necessarie

Vedi `.env.example` per tutte le variabili richieste.
Le variabili `NEXTAUTH_SECRET` e `DATABASE_URL` sono **obbligatorie**.

---

## TODO — ordine di implementazione suggerito

- [ ] 1. Setup progetto Next.js + installazione dipendenze
- [ ] 2. Configurazione Prisma + migrate su Neon
- [ ] 3. Auth (NextAuth credentials, pagina login)
- [ ] 4. Anagrafiche CRUD: committenti, clienti
- [ ] 5. Listino tariffe (UI a matrice)
- [ ] 6. Progetti (con stima opzionale)
- [ ] 7. Calendario con log attività (FullCalendar + drawer)
- [ ] 8. Form spese con upload foto
- [ ] 9. Report PDF con valorizzazione a listino
- [ ] 10. PWA manifest + ottimizzazioni mobile
