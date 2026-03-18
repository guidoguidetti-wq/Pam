import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          console.log('[auth] zod parse failed:', parsed.error.issues)
          return null
        }

        const { email, password } = parsed.data

        const adminEmail = process.env.PAM_ADMIN_EMAIL
        const adminHash = process.env.PAM_ADMIN_PASSWORD_HASH

        console.log('[auth] email match:', email === adminEmail)
        console.log('[auth] hash present:', !!adminHash, 'len:', adminHash?.length, 'prefix:', adminHash?.substring(0, 7))

        if (!adminEmail || !adminHash) return null
        if (email !== adminEmail) return null

        const valid = await compare(password, adminHash)
        console.log('[auth] bcrypt valid:', valid)
        if (!valid) return null

        return { id: '1', email: adminEmail, name: 'Admin' }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token && session.user) session.user.id = token.id as string
      return session
    },
  },
})
