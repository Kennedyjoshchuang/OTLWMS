import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundFloat } from "@/lib/utils";

// POST /api/delivery-tickets — create a new DT from OCR data
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      dtNumber,
      orderNumber,
      customerPoNo,
      deliverToName,
      deliverToAddress,
      deliveryDate,
      items, // Array of { productCode, productName, lotBatchNo, delQtyPcs, delQtyLiter }
    } = body;

    if (!customerId || !dtNumber) {
      return NextResponse.json(
        { error: "customerId and dtNumber are required." },
        { status: 400 }
      );
    }

    // Try to find matching products by code for this customer
    const productCodes: string[] = [...new Set<string>((items || []).map((i: any) => String(i.productCode)))];
    const products = await prisma.product.findMany({
      where: {
        customerId,
        productCode: { in: productCodes },
      },
    });
    const productMap = new Map(products.map((p) => [p.productCode, p.id]));

    // Check for existing DT
    const existing = await prisma.deliveryTicket.findFirst({
      where: { customerId, dtNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: `DT number "${dtNumber}" already exists for this customer.` },
        { status: 409 }
      );
    }

    const ticket = await prisma.deliveryTicket.create({
      data: {
        customerId,
        dtNumber,
        orderNumber: orderNumber || null,
        customerPoNo: customerPoNo || null,
        deliverToName: deliverToName || null,
        deliverToAddress: deliverToAddress || null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        ocrStatus: "completed",
        status: "ready",
        items: {
          create: (items || []).map((item: any, idx: number) => ({
            lineNo: idx + 1,
            productId: productMap.get(item.productCode) || null,
            productCode: item.productCode,
            productName: item.productName || null,
            lotBatchNo: item.lotBatchNo || null,
            delQtyPcs: item.delQtyPcs || 0,
            delQtyLiter: item.delQtyLiter ? roundFloat(Number(item.delQtyLiter), 2) : null,
            status: "pending",
          })),
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/delivery-tickets error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
