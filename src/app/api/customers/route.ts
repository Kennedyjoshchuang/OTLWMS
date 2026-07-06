import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const count = await prisma.customer.count();
    const code = `CUST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const newCustomer = await prisma.customer.create({
      data: {
        name: name.trim(),
        code: code,
      }
    });

    return NextResponse.json({ success: true, customer: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
