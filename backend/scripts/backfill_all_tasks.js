const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 查找所有已有目标但没有任务记录的 user_id + period_id 组合
  const goalGroups = await p.pbcGoal.groupBy({
    by: ['user_id', 'period_id'],
    where: { period_id: { not: null } },
  });

  const juzi = await p.user.findFirst({ where: { username: 'juzi' } });
  if (!juzi) { console.log('找不到助理 juzi'); return; }

  let created = 0, skipped = 0;

  for (const g of goalGroups) {
    if (!g.period_id) continue;

    const existing = await p.pbcTask.findUnique({
      where: { user_id_period_id: { user_id: g.user_id, period_id: g.period_id } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const task = await p.pbcTask.create({
      data: { user_id: g.user_id, period_id: g.period_id, distributed_by: juzi.user_id },
      include: { user: { select: { username: true, real_name: true } }, period: { select: { year: true, quarter: true } } },
    });
    console.log(`已补建: ${task.user.real_name}(${task.user.username}) - ${task.period.year}Q${task.period.quarter}`);
    created++;
  }

  console.log(`\n完成: 新建 ${created} 条, 跳过已存在 ${skipped} 条`);

  // 验证
  const allTasks = await p.pbcTask.findMany({
    include: {
      user: { select: { username: true, real_name: true } },
      period: { select: { year: true, quarter: true } },
    },
    orderBy: { task_id: 'asc' },
  });
  console.log('\n=== 全部任务记录 ===');
  console.table(allTasks.map(t => ({
    task_id: t.task_id,
    user: `${t.user.real_name}(${t.user.username})`,
    period: `${t.period.year}Q${t.period.quarter}`,
  })));

  await p.$disconnect();
})();
