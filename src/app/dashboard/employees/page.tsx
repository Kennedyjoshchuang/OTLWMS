import { prisma } from "@/lib/prisma";
import EmployeesClient from "./EmployeesClient";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const users = await prisma.user.findMany({
    orderBy: { role: "asc" },
    include: {
      deleteRequests: {
        where: { status: "pending" },
        take: 1,
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Directory</h1>
          <p className="text-slate-500 mt-1">Manage warehouse staff, drivers, and system users.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <EmployeesClient initialUsers={users} />
      </div>
    </div>
  );
}
