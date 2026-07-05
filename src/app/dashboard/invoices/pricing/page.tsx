import { prisma } from "@/lib/prisma";
import PricingClient from "./PricingClient";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const rates = await prisma.pricingRate.findMany({
    orderBy: { createdAt: "asc" },
  });

  const serialized = rates.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return <PricingClient rates={serialized} />;
}
