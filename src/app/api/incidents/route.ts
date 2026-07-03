import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: { reportedAt?: { gte?: Date; lte?: Date } } = {};
    if (from || to) {
      where.reportedAt = {};
      if (from) where.reportedAt.gte = new Date(from);
      if (to) where.reportedAt.lte = new Date(to);
    }

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { reportedAt: "desc" },
    });

    return NextResponse.json({ success: true, incidents });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, description, location, reportedAt } = body;

    if (!type || !description) {
      return NextResponse.json(
        { error: "type and description are required" },
        { status: 400 }
      );
    }

    const incident = await prisma.incident.create({
      data: {
        type,
        description,
        location: location ?? null,
        reportedAt: reportedAt ? new Date(reportedAt) : new Date(),
      },
    });

    return NextResponse.json({ success: true, incident }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
