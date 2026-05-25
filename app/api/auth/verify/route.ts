import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/prisma";
import { nonceStore } from "@/lib/nonce-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, signature, address, chainId } = body;

    if (!message || !signature || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const siwe = new SiweMessage(message);
    const result = await siwe.verify({ signature });

    if (!result.success) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Validate and consume nonce
    const nonceKey = siwe.nonce.slice(0, 16);
    const storedNonce = nonceStore.consume(nonceKey);
    if (!storedNonce || storedNonce !== siwe.nonce) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 401 });
    }

    const normalizedAddress = result.data.address.toLowerCase();

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        wallets: {
          some: { address: normalizedAddress },
        },
      },
      include: { wallets: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          wallets: {
            create: {
              address: normalizedAddress,
              chainId: result.data.chainId,
              isPrimary: true,
            },
          },
        },
        include: { wallets: true },
      });
    } else {
      // Add wallet if it doesn't exist for this user
      const existingWallet = user.wallets.find(
        (w) => w.address.toLowerCase() === normalizedAddress
      );
      if (!existingWallet) {
        await prisma.wallet.create({
          data: {
            address: normalizedAddress,
            chainId: result.data.chainId,
            userId: user.id,
            isPrimary: user.wallets.length === 0,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      address: normalizedAddress,
    });
  } catch (err) {
    console.error("SIWE verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
