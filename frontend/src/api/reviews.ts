import request from './request';
import { PbcGoal } from './pbc';

export interface ApprovalRecord {
  approval_id: number;
  goal_id: number;
  reviewer_id: number;
  action: 'submit' | 'approve' | 'reject';
  comments?: string;
  created_at: string;
  reviewer?: {
    user_id: number;
    real_name: string;
  };
}

export const reviewsApi = {
  // 获取待审核列表
  getPending: (): Promise<PbcGoal[]> => {
    return request.get('/reviews/pending');
  },

  // 获取下属历史记录
  getHistory: (params?: { year?: number; quarter?: number }): Promise<PbcGoal[]> => {
    return request.get('/reviews/history', { params });
  },

  // 获取审批历史
  getApprovalHistory: (goalId: number): Promise<ApprovalRecord[]> => {
    return request.get(`/reviews/${goalId}/approvals`);
  },

  // 通过审核
  approve: (goalId: number, comments?: string): Promise<{ message: string; goal: PbcGoal }> => {
    return request.post(`/reviews/${goalId}/approve`, { comments });
  },

  // 驳回审核
  reject: (goalId: number, reason: string): Promise<{ message: string; goal: PbcGoal; reason: string }> => {
    return request.post(`/reviews/${goalId}/reject`, { reason });
  },

  // 归档
  archive: (goalId: number): Promise<{ message: string; goal: PbcGoal }> => {
    return request.post(`/reviews/${goalId}/archive`);
  },

  // 主管评估
  supervisorEvaluate: (goalId: number, score: number, comment?: string): Promise<PbcGoal> => {
    return request.post(`/reviews/${goalId}/supervisor-evaluate`, { score, comment });
  },
};
