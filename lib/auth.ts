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
          const siwe = new SiweMessage(credentials.message);
          const result = await siwe.verify({
            signature: credentials.signature,
          });

          if (result.success) {
            // Find or create user
            let user = await prisma.user.findFirst({
              where: {
                wallets: {
                  some: { address: result.data.address },
                },
              },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  wallets: {
                    create: {
                      address: result.data.address,
                      chainId: result.data.chainId,
                      isPrimary: true,
                    },
                  },
                },
              });
            }

            return { id: user.id, name: result.data.address };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) (session.user as { id: string }).id = token.sub;
      return session;
    },
  },
};
