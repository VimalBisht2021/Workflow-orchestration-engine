import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const taskRunId = 'b020e8a0-1671-415a-8bd1-761f0dc185b7';
  const workflowRunId = '16027014-0e3c-4565-8192-3bf5a6a31eaa';
  const err = "InputMappingResolutionError: Target input 'deliveryTier' failed resolving path [result, tier]: property 'result' does not exist on source output 'Reserve Warehouse Stock'";

  await prisma.taskRun.update({
    where: { id: taskRunId },
    data: { status: 'FAILED', error: err, completedAt: new Date() }
  });

  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: { status: 'FAILED', completedAt: new Date() }
  });

  console.log('Run 16027014 and Task b020e8a0 updated to FAILED.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
