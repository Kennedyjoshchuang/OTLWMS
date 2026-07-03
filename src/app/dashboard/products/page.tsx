import { prisma } from "@/lib/prisma";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, customers] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { customer: { select: { id: true, name: true, code: true } } },
      orderBy: [{ customerId: "asc" }, { productCode: "asc" }],
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Product List</h1>
          <p className="text-slate-500 mt-1">
            Kelola daftar produk yang dapat dipilih saat membuat Inbound (GRN).
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <ProductsClient initialProducts={products} customers={customers} />
      </div>
    </div>
  );
}
