import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ids = [
    "cmrk8hhe60009gds3a01wu6l3",
    "cmrk8y27h000mgds3i6lhyjsu",
    "cmrkae6zi0023gds3v04af6ti",
    "cmrkaeoqn002agds3ol81do37"
  ];

  const movements = await prisma.stockMovement.findMany({
    where: { id: { in: ids } },
    include: { performedBy: true }
  });

  for (const m of movements) {
    console.log(`Movement ID: ${m.id}`);
    console.log(`  Notes: ${m.notes}`);
    console.log(`  Performed By: ${m.performedBy?.fullName} (ID: ${m.performedById})`);
    console.log(`  Reference: ${m.referenceType} (${m.referenceId})`);
    console.log(`  Created At: ${m.createdAt}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
