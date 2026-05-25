import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      wallets: Array<{
        id: string;
        address: string;
        chainId: number;
        isPrimary: boolean;
      }>;
    };
  }

  interface User {
    id: string;
    wallets?: Array<{
      id: string;
      address: string;
      chainId: number;
      isPrimary: boolean;
    }>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    wallets?: Array<{
      id: string;
      address: string;
      chainId: number;
      isPrimary: boolean;
    }>;
  }
}
