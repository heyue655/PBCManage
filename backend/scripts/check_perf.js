const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 查找已完成主管评价的评估记录
  const evals = await p.pbcEvaluation.findMany({
    where: { supervisor_submitted_at: { not: null } },
    include: {
      user: { select: { user_id: true, real_name: true, username: true } },
      period: { select: { period_id: true, year: true, quarter: true } },
    },
  });
  console.log('已完成主管评价的记录:', JSON.stringify(evals, null, 2));

  // 查看已有绩效记录
  const perfs = await p.pbcPerformance.findMany();
  console.log('已有绩效记录:', JSON.stringify(perfs, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
