import request from './request';

export interface SystemConfig {
  [key: string]: string;
}

export const systemConfigApi = {
  getAll: (): Promise<SystemConfig> => {
    return request.get('/system-config');
  },

  update: (key: string, value: string): Promise<{ config_key: string; config_value: string }> => {
    return request.put(`/system-config/${key}`, { value });
  },
};
