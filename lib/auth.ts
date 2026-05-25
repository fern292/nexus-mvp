import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { SiweMessage } from "siwe";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Ethereum",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials?.signature) return null;

        try {
          const siwe = new SiweMessage(JSON.parse(credentials.message));
          const result = await siwe.verify({
            signature: credentials.signature,
          });

          if (!result.success) return null;

          const address = result.data.address.toLowerCase();

          // Find or create user
          let user = await prisma.user.findFirst({
            where: {
              wallets: {
                some: { address },
              },
            },
            include: { wallets: true },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                wallets: {
                  create: {
                    address,
                    chainId: result.data.chainId,
                    isPrimary: true,
                  },
                },
              },
              include: { wallets: true },
            });
          }

          return {
            id: user.id,
            name: address,
            wallets: user.wallets.map((w) => ({
              id: w.id,
              address: w.address,
              chainId: w.chainId,
              isPrimary: w.isPrimary,
            })),
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.wallets = ((
          user as {
            wallets?: Array<{
              id: string;
              address: string;
              chainId: number;
              isPrimary: boolean;
            }>;
          }
        ).wallets || []) as NonNullable<typeof token.wallets>;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { wallets: unknown[] }).wallets = (token.wallets as unknown[]) || [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
