import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'

export async function GET() {
  const hash = process.env.PAM_ADMIN_PASSWORD_HASH ?? ''
  const email = process.env.PAM_ADMIN_EMAIL ?? ''
  const password = 'Guido2026!'
  const valid = hash ? await compare(password, hash) : false
  return NextResponse.json({
    email,
    hashPrefix: hash.substring(0, 10),
    hashLen: hash.length,
    valid,
  })
}
