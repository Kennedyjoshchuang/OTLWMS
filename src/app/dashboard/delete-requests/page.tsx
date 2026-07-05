import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DeleteRequestsClient from "./DeleteRequestsClient";

export default async function DeleteRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any)?.role;
  if (role !== "super_admin") redirect("/dashboard");

  const requests = await (prisma as any).deleteRequest.findMany({
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <DeleteRequestsClient initialRequests={requests} />;
}
