// Genera l'hash bcrypt per PAM_ADMIN_PASSWORD_HASH.
// Uso (in un terminale interattivo):  node scripts/hash-password.mjs
// La password viene digitata senza eco e non finisce nella cronologia della shell.
import bcrypt from 'bcryptjs'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import readline from 'node:readline'

const MIN_LEN = 12

function chiedi(domanda, nascosto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (nascosto) {
      rl._writeToOutput = (s) => {
        if (s.startsWith(domanda)) rl.output.write(domanda)
      }
    }
    rl.question(domanda, (r) => {
      rl.close()
      if (nascosto) process.stdout.write('\n')
      resolve(r)
    })
  })
}

if (!process.stdin.isTTY) {
  console.error('Eseguire lo script in un terminale interattivo (PowerShell / cmd), non tramite pipe.')
  process.exit(1)
}

const pwd = await chiedi('Nuova password admin: ', true)
if (pwd.length < MIN_LEN) {
  console.error(`La password deve avere almeno ${MIN_LEN} caratteri.`)
  process.exit(1)
}
if ((await chiedi('Conferma password: ', true)) !== pwd) {
  console.error('Le password non coincidono.')
  process.exit(1)
}

const h = await bcrypt.hash(pwd, 12)
console.log('\nNuovo valore per PAM_ADMIN_PASSWORD_HASH (da incollare su Vercel):\n')
console.log(h + '\n')

if (existsSync('.env.local') && /^s/i.test(await chiedi('Aggiornare anche .env.local? (s/N) '))) {
  const env = readFileSync('.env.local', 'utf8')
  const riga = `PAM_ADMIN_PASSWORD_HASH='${h}'`
  const nuovo = /^PAM_ADMIN_PASSWORD_HASH=.*$/m.test(env)
    ? env.replace(/^PAM_ADMIN_PASSWORD_HASH=.*$/m, () => riga)
    : `${env.replace(/\n?$/, '\n')}${riga}\n`
  writeFileSync('.env.local', nuovo)
  console.log('.env.local aggiornato.')
}
