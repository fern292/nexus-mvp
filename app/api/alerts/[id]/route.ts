import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationChannel } from "@prisma/client";

/**
 * PUT /api/alerts/[id]
 * Update an alert (toggle active, change threshold, channel, etc.)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive, threshold, channel, condition } = body as {
      isActive?: boolean;
      threshold?: string | number;
      channel?: NotificationChannel;
      condition?: Record<string, unknown>;
    };

    // Verify ownership
    const existing = await prisma.alert.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (threshold !== undefined) update.threshold = threshold.toString();
    if (channel) update.channel = channel;
    if (condition !== undefined) update.condition = condition;

    const alert = await prisma.alert.update({
      where: { id },
      data: update as never,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            symbol: true,
            contract: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({ data: alert });
  } catch (err) {
    console.error("[PUT /api/alerts/:id] Error:", err);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

/**
 * DELETE /api/alerts/[id]
 * Delete an alert.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.alert.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await prisma.alert.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/alerts/:id] Error:", err);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
