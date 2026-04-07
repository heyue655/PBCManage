import request from './request';

export interface Performance {
  performance_id: number;
  user_id: number;
  period_id: number;
  evaluation_id: number;
  performance_level: string | null;
  performance_comment: string | null;
  has_ai_contribution: boolean | null;
  ai_performance_comment: string | null;
  bottom_mgmt_status: string | null;
  planned_elimination_date: string | null;
  created_at: string;
  updated_at: string;
  user: {
    user_id: number;
    real_name: string;
    department_id: number | null;
    supervisor_id: number | null;
    department: {
      department_id: number;
      department_name: string;
    } | null;
  };
  period: {
    period_id: number;
    year: number;
    quarter: number;
  };
  evaluation: {
    evaluation_id: number;
    supervisor_overall_comment: string | null;
  };
}

export interface UpdatePerformanceDto {
  performance_level?: string;
  has_ai_contribution?: boolean;
  ai_performance_comment?: string;
  bottom_mgmt_status?: string;
  planned_elimination_date?: string;
}

export const performanceApi = {
  // 获取绩效列表
  getList: (periodId?: number): Promise<Performance[]> => {
    return request.get('/performance', { params: periodId ? { periodId } : {} });
  },

  // 获取单条绩效
  getOne: (id: number): Promise<Performance> => {
    return request.get(`/performance/${id}`);
  },

  // 更新绩效
  update: (id: number, dto: UpdatePerformanceDto): Promise<Performance> => {
    return request.put(`/performance/${id}`, dto);
  },

  // 导出Excel
  export: (periodId?: number): Promise<void> => {
    return request
      .get('/performance/export', {
        params: periodId ? { periodId } : {},
        responseType: 'blob',
      })
      .then((res: any) => {
        const blob = new Blob([res], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '绩效管理.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      });
  },
};
