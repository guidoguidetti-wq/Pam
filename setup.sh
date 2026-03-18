#!/bin/bash
# ============================================================
#  PAM — Setup Script
#  Esegui: bash setup.sh
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   PAM — Personal Activity Manager   ║"
echo "║         Setup iniziale               ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Verifica Node.js
NODE_VER=$(node -v 2>/dev/null || echo "none")
if [ "$NODE_VER" = "none" ]; then
  echo "❌ Node.js non trovato. Installa Node.js >= 20"
  exit 1
fi
echo "✅ Node.js $NODE_VER"

# 2. Verifica npm
NPM_VER=$(npm -v 2>/dev/null || echo "none")
echo "✅ npm $NPM_VER"

# 3. Scaffolding Next.js
echo ""
echo "📦 Creazione progetto Next.js..."
npx create-next-app@latest pam \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git

cd pam

# 4. Copia i file del pacchetto starter
echo ""
echo "📋 Copia file configurazione..."

# Copia package.json (sostituisce quello creato da create-next-app)
cp ../package.json package.json

# Copia schema Prisma
mkdir -p prisma
cp ../prisma/schema.prisma prisma/schema.prisma

# Copia tipi TypeScript
mkdir -p src/types
cp ../src/types/index.ts src/types/index.ts

# Copia .env.example
cp ../.env.example .env.example

# Copia CLAUDE.md
cp ../CLAUDE.md CLAUDE.md

# Copia schema SQL (documentazione)
cp ../pam_schema.sql docs/pam_schema.sql 2>/dev/null || true

# 5. Installa dipendenze
echo ""
echo "📦 Installazione dipendenze (potrebbe richiedere qualche minuto)..."
npm install

# 6. shadcn/ui setup
echo ""
echo "🎨 Inizializzazione shadcn/ui..."
npx shadcn@latest init --yes --base-color neutral

# 7. Installa componenti shadcn necessari
echo ""
echo "🧩 Installazione componenti shadcn..."
npx shadcn@latest add button input label select dialog sheet tabs \
  badge progress separator tooltip dropdown-menu avatar \
  scroll-area checkbox switch popover calendar --yes

# 8. Crea file lib base
echo ""
echo "🔧 Creazione lib di base..."

mkdir -p src/lib

cat > src/lib/prisma.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
EOF

cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

cat > src/lib/tariffe.ts << 'EOF'
import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'

type TipoVoce = 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO'

/**
 * Risolve la tariffa vigente alla data per committente/cliente/tipo attività.
 * Priorità: cliente+tipo > cliente > tipo > default committente
 */
export async function getTariffa(
  committenteId: number,
  clienteId: number,
  tipoAttivitaId: number | null,
  tipoVoce: TipoVoce,
  data: Date = new Date()
): Promise<Decimal | null> {
  const dove = {
    committenteId,
    tipoVoce,
    dataInizio: { lte: data },
    OR: [{ dataFine: null }, { dataFine: { gte: data } }],
  }

  // 1. Cliente + tipo specifico
  if (tipoAttivitaId) {
    const r = await prisma.listino.findFirst({
      where: { ...dove, clienteId, tipoAttivitaId },
    })
    if (r) return r.tariffa
  }

  // 2. Cliente, qualsiasi tipo
  const r2 = await prisma.listino.findFirst({
    where: { ...dove, clienteId, tipoAttivitaId: null },
  })
  if (r2) return r2.tariffa

  // 3. Committente + tipo specifico (nessun cliente)
  if (tipoAttivitaId) {
    const r3 = await prisma.listino.findFirst({
      where: { ...dove, clienteId: null, tipoAttivitaId },
    })
    if (r3) return r3.tariffa
  }

  // 4. Default committente
  const r4 = await prisma.listino.findFirst({
    where: { ...dove, clienteId: null, tipoAttivitaId: null },
  })
  return r4?.tariffa ?? null
}
EOF

# 9. Crea seed DB con tipi attività
cat > prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Tipi attività
  const tipi = [
    { codice: 'COM', descrizione: 'Commerciale' },
    { codice: 'PRE', descrizione: 'Presale' },
    { codice: 'PMG', descrizione: 'Project Management' },
    { codice: 'BAN', descrizione: 'Business Analyst' },
    { codice: 'SVI', descrizione: 'Sviluppo' },
    { codice: 'OPS', descrizione: 'Operation' },
  ]

  for (const tipo of tipi) {
    await prisma.tipoAttivita.upsert({
      where: { codice: tipo.codice },
      update: {},
      create: tipo,
    })
  }

  console.log('✅ Tipi attività creati')
  console.log('')
  console.log('📝 Prossimi passi:')
  console.log('   1. Copia .env.example → .env.local e compila le variabili')
  console.log('   2. npx prisma migrate dev --name init')
  console.log('   3. npm run db:seed')
  console.log('   4. npm run dev')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
EOF

# 10. Configura PWA manifest
cat > public/manifest.json << 'EOF'
{
  "name": "PAM — Personal Activity Manager",
  "short_name": "PAM",
  "description": "Gestione attività, fatturazione e spese",
  "start_url": "/calendario",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
EOF

# 11. Aggiunge script type-check a next config
cat > next.config.ts << 'EOF'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
}

export default nextConfig
EOF

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ✅  Setup completato!              ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "📋 Passi successivi:"
echo ""
echo "   1. cd pam"
echo "   2. cp .env.example .env.local"
echo "   3. Modifica .env.local con le tue credenziali Neon"
echo "   4. npx prisma migrate dev --name init"
echo "   5. npm run db:seed"
echo "   6. npm run dev"
echo ""
echo "   Poi apri Claude Code nella cartella 'pam' e parti! 🚀"
echo ""
