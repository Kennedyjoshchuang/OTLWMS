import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Auto-generate a unique email from fullName + role
async function generateEmail(fullName: string, role: string): Promise<string> {
  const slug = fullName
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
  const domain = "omegaTrust.id";
  const base = `${slug}@${domain}`;

  // Check uniqueness; append a counter if needed
  let candidate = base;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    candidate = `${slug}${counter}@${domain}`;
    counter++;
  }
  return candidate;
}

export async function POST(req: NextRequest) {
  try {
    const { fullName, password, role, phone } = await req.json();

    if (!fullName || !password || !role) {
      return NextResponse.json({ error: "fullName, password, and role are required." }, { status: 400 });
    }

    const validRoles = [
      "super_admin", "warehouse_admin", "checker_inbound", "picker", "driver", "customer_viewer",
      "inbound_staff", "outbound_staff", "picklist_staff", "delivery_staff",
      "hr_staff", "product_staff", "billing_staff", "report_staff", "warehouse_staff",
    ];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    // Auto-generate email
    const email = await generateEmail(fullName, role);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role,
        phone: phone || null,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("[POST /api/employees]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
