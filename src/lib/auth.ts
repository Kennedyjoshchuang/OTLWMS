import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const input = credentials.username.trim();
        const inputLower = input.toLowerCase();

        // Support full email login (e.g. jotun@jotun.com) or username (e.g. kennedy)
        let candidates;
        if (inputLower.includes('@')) {
          candidates = await prisma.user.findMany({ where: { email: input } });
        } else {
          // Find all users whose email prefix matches the username (case-insensitive via contains)
          const allUsers = await prisma.user.findMany({
            where: { email: { contains: inputLower } }
          });
          candidates = allUsers.filter(u =>
            u.email.toLowerCase().startsWith(inputLower + '@')
          );
        }

        if (!candidates || candidates.length === 0) return null;

        // Try each candidate and return the one whose password matches
        for (const user of candidates) {
          if (!user.isActive) continue;
          const valid = bcrypt.compareSync(credentials.password, user.passwordHash);
          if (valid) return { id: user.id, email: user.email, name: user.fullName, role: user.role };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.id = user.id }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id   = token.id
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)
