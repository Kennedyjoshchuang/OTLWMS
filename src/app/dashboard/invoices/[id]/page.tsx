import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import InvoiceDetailClient from "./InvoiceDetailClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      deliveryTicket: {
        include: {
          items: true,
          deliveryOrders: true,
        },
      },
      items: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  // Convert Date objects to strings for Client Component serialization
  const serializedInvoice = {
    ...invoice,
    issuedAt: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    deliveryTicket: {
      ...invoice.deliveryTicket,
      createdAt: invoice.deliveryTicket.createdAt.toISOString(),
      updatedAt: invoice.deliveryTicket.updatedAt.toISOString(),
      orderDate: invoice.deliveryTicket.orderDate?.toISOString() || null,
      deliveryDate: invoice.deliveryTicket.deliveryDate?.toISOString() || null,
      items: invoice.deliveryTicket.items.map(item => ({
        ...item,
      })),
      deliveryOrders: invoice.deliveryTicket.deliveryOrders.map(doOrder => ({
        ...doOrder,
        createdAt: doOrder.createdAt.toISOString(),
        updatedAt: doOrder.updatedAt.toISOString(),
        deliveryDate: doOrder.deliveryDate?.toISOString() || null,
        pickingStartedAt: doOrder.pickingStartedAt?.toISOString() || null,
        pickingCompletedAt: doOrder.pickingCompletedAt?.toISOString() || null,
        shippedAt: doOrder.shippedAt?.toISOString() || null,
        deliveredAt: doOrder.deliveredAt?.toISOString() || null,
      })),
    },
  };

  return <InvoiceDetailClient invoice={serializedInvoice as any} />;
}
