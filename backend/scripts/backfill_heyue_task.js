const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 为 heyue (user_id=2) 在 Q1 (period_id=1) 补建任务，下发人为 juzi (user_id=3)
  const task = await p.pbcTask.create({
    data: {
      user_id: 2,
      period_id: 1,
      distributed_by: 3, // juzi 助理
    },
    include: {
      user: { select: { username: true, real_name: true } },
      period: true,
      distributor: { select: { username: true, real_name: true } },
    },
  });

  console.log('已为 heyue 补建任务记录:');
  console.log(JSON.stringify(task, null, 2));

  // 验证：查看关联的目标
  const goals = await p.pbcGoal.findMany({
    where: { user_id: 2, period_id: 1, parent_goal_id: null },
    select: { goal_id: true, goal_name: true, goal_weight: true, status: true },
  });
  console.log('\n关联的顶级目标:');
  console.table(goals);
  console.log('目标数:', goals.length, '总权重:', goals.reduce((s, g) => s + Number(g.goal_weight), 0));

  await p.$disconnect();
})();
