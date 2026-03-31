const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.pbcPerformance.create({
    data: {
      user_id: 19,
      period_id: 1,
      evaluation_id: 2,
      performance_comment: '88', // 自动带入主管整体评价
    },
  });
  console.log('已创建绩效记录:', JSON.stringify(result, null, 2));
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
