import request from './request';

export interface DingtalkApp {
  app_id: number;
  organization: string;
  app_name: string;
  agent_id: string;
  corp_id: string;
  app_key: string;
  app_secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDingtalkAppParams {
  organization: string;
  app_name: string;
  agent_id: string;
  corp_id: string;
  app_key: string;
  app_secret: string;
  is_active?: boolean;
}

export const dingtalkAppsApi = {
  getAll: (): Promise<DingtalkApp[]> => {
    return request.get('/dingtalk-apps');
  },

  getOne: (id: number): Promise<DingtalkApp> => {
    return request.get(`/dingtalk-apps/${id}`);
  },

  create: (params: CreateDingtalkAppParams): Promise<DingtalkApp> => {
    return request.post('/dingtalk-apps', params);
  },

  update: (id: number, params: Partial<CreateDingtalkAppParams>): Promise<DingtalkApp> => {
    return request.put(`/dingtalk-apps/${id}`, params);
  },

  delete: (id: number): Promise<void> => {
    return request.delete(`/dingtalk-apps/${id}`);
  },

  toggleActive: (id: number): Promise<DingtalkApp> => {
    return request.put(`/dingtalk-apps/${id}/toggle`);
  },
};
