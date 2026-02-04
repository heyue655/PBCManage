import request from './request';

export type GoalType = 'business' | 'skill' | 'team';
export type PbcStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';

export interface PbcGoal {
  goal_id: number;
  user_id: number;
  period_id?: number;
  goal_type: GoalType;
  goal_name: string;
  goal_description: string;
  goal_weight: number;
  parent_goal_id?: number;
  supervisor_goal_id?: number;
  measures?: string;
  unacceptable?: string;
  acceptable?: string;
  excellent?: string;
  completion_time?: string;
  status: PbcStatus;
  self_score?: number;
  self_comment?: string;
  supervisor_score?: number;
  supervisor_comment?: string;
  created_at?: string;
  updated_at?: string;
  user?: {
    user_id: number;
    real_name: string;
    department?: {
      department_id: number;
      department_name: string;
    };
  };
  period?: {
    period_id: number;
    year: number;
    quarter: number;
  };
  subGoals?: PbcGoal[];
  supervisorGoal?: PbcGoal;
}

export interface PbcPeriod {
  period_id: number;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
}

export interface CreatePbcParams {
  period_id?: number;
  goal_type: GoalType;
  goal_name: string;
  goal_description: string;
  goal_weight: number;
  supervisor_goal_id?: number;
  measures?: string;
  unacceptable?: string;
  acceptable?: string;
  excellent?: string;
  completion_time?: string;
}

export interface PbcSummary {
  total: number;
  status: string;
  statusDetail?: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    archived: number;
  };
  message: string;
}

export const pbcApi = {
  // 周期管理
  getPeriods: (): Promise<PbcPeriod[]> => {
    return request.get('/pbc/periods');
  },

  getActivePeriod: (): Promise<PbcPeriod | null> => {
    return request.get('/pbc/periods/active');
  },

  createPeriod: (params: Omit<PbcPeriod, 'period_id' | 'status'>): Promise<PbcPeriod> => {
    return request.post('/pbc/periods', params);
  },

  // 上级目标
  getSupervisorGoals: (periodId?: number): Promise<PbcGoal[]> => {
    return request.get('/pbc/supervisor-goals', { params: { periodId } });
  },

  // 团队目标（根据权限）
  getTeamGoals: (periodId?: number): Promise<PbcGoal[]> => {
    return request.get('/pbc/team-goals', { params: { periodId } });
  },

  // PBC统计
  getSummary: (periodId?: number): Promise<PbcSummary> => {
    return request.get('/pbc/summary', { params: { periodId } });
  },

  // PBC目标CRUD
  getAll: (params?: {
    userId?: number;
    year?: number;
    quarter?: number;
    status?: PbcStatus;
    goalType?: GoalType;
  }): Promise<PbcGoal[]> => {
    return request.get('/pbc', { params });
  },

  getOne: (id: number): Promise<PbcGoal> => {
    return request.get(`/pbc/${id}`);
  },

  create: (params: CreatePbcParams): Promise<PbcGoal> => {
    return request.post('/pbc', params);
  },

  update: (id: number, params: Partial<CreatePbcParams>): Promise<PbcGoal> => {
    return request.put(`/pbc/${id}`, params);
  },

  delete: (id: number): Promise<{ message: string }> => {
    return request.delete(`/pbc/${id}`);
  },

  // 批量提交当前周期所有草稿和被驳回的目标
  submitAll: (periodId?: number): Promise<any> => {
    return request.post('/pbc/submit', null, {
      params: { periodId },
    });
  },

  // 子目标
  createSubGoal: (parentId: number, params: CreatePbcParams): Promise<PbcGoal> => {
    return request.post(`/pbc/${parentId}/sub-goals`, params);
  },

  // 自评单个目标
  selfEvaluate: (id: number, score: number, comment?: string): Promise<PbcGoal> => {
    return request.post(`/pbc/${id}/self-evaluate`, { score, comment });
  },

  // 提交整体自评
  submitSelfEvaluation: (periodId: number, overallComment: string): Promise<any> => {
    return request.post('/pbc/submit-self-evaluation', { periodId, overallComment });
  },

  // 获取评价信息
  getEvaluation: (userId: number, periodId: number): Promise<any> => {
    return request.get(`/pbc/evaluation/${userId}/${periodId}`);
  },

  // 主管评价单个目标
  supervisorEvaluate: (id: number, score: number, comment: string): Promise<PbcGoal> => {
    return request.post(`/pbc/${id}/supervisor-evaluate`, { score, comment });
  },

  // 提交整体主管评价
  submitSupervisorEvaluation: (
    userId: number,
    periodId: number,
    overallComment: string,
  ): Promise<any> => {
    return request.post('/pbc/submit-supervisor-evaluation', {
      userId,
      periodId,
      overallComment,
    });
  },
};
