import type { NextAuthConfig } from 'next-auth'

// Config edge-safe: niente bcryptjs, usata solo dal middleware
// Il provider Credentials (che usa bcryptjs) è aggiunto solo in auth.ts
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
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
}
