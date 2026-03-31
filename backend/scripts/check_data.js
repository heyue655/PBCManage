const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const users = await p.user.findMany({
    select: { user_id: true, username: true, real_name: true, role: true },
    orderBy: { user_id: 'asc' },
  });
  console.log('=== Users ===');
  console.table(users);

  const goals = await p.pbcGoal.findMany({
    where: { user: { username: 'heyue' } },
    select: { goal_id: true, user_id: true, period_id: true, goal_name: true, status: true, goal_weight: true },
  });
  console.log('\n=== heyue goals ===');
  console.table(goals);

  const tasks = await p.pbcTask.findMany({
    include: { user: { select: { username: true, real_name: true } }, period: true },
  });
  console.log('\n=== Existing tasks ===');
  console.log(JSON.stringify(tasks, null, 2));

  await p.$disconnect();
})();
