import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
