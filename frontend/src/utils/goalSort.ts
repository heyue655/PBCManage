import { PbcGoal } from '../api';

/**
 * 目标类型优先级映射
 * business: 业务目标（优先级最高）
 * team: 组织与人员管理&团队建设（优先级中等）
 * skill: 个人能力提升（优先级最低）
 */
const goalTypePriority: Record<string, number> = {
  business: 1,
  team: 2,
  skill: 3,
};

/**
 * 对目标数组进行排序
 * 排序规则：
 * 1. 首先按目标类型排序（业务目标 > 组织与人员管理&团队建设 > 个人能力提升）
 * 2. 同类型内按权重倒序排列（权重高的在前）
 * 
 * @param goals 目标数组
 * @returns 排序后的目标数组
 */
export function sortGoals(goals: PbcGoal[]): PbcGoal[] {
  return [...goals].sort((a, b) => {
    // 1. 首先按目标类型排序
    const typePriorityA = goalTypePriority[a.goal_type] || 999;
    const typePriorityB = goalTypePriority[b.goal_type] || 999;
    
    if (typePriorityA !== typePriorityB) {
      return typePriorityA - typePriorityB;
    }
    
    // 2. 同类型内按权重倒序（权重大的在前）
    const weightA = Number(a.goal_weight) || 0;
    const weightB = Number(b.goal_weight) || 0;
    return weightB - weightA;
  });
}
