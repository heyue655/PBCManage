import request from './request';

export interface User {
  user_id: number;
  username: string;
  real_name: string;
  job_title: string;
  role: string;
  department_id?: number;
  supervisor_id?: number;
  dingtalk_userid?: string;
  department?: {
    department_id: number;
    department_name: string;
  };
  supervisor?: {
    user_id: number;
    real_name: string;
  };
}

export interface CreateUserParams {
  username: string;
  real_name: string;
  job_title: string;
  department_id?: number;
  supervisor_id?: number;
  role?: string;
  dingtalk_userid?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export const usersApi = {
  getAll: (params?: { departmentId?: number; role?: string }): Promise<User[]> => {
    return request.get('/users', { params });
  },

  getOne: (id: number): Promise<User> => {
    return request.get(`/users/${id}`);
  },

  getMe: (): Promise<User> => {
    return request.get('/users/me');
  },

  getSubordinates: (id: number): Promise<User[]> => {
    return request.get(`/users/${id}/subordinates`);
  },

  getHierarchy: (): Promise<User & { subordinates: User[] }> => {
    return request.get('/users/hierarchy');
  },

  create: (params: CreateUserParams): Promise<User> => {
    return request.post('/users', params);
  },

  update: (id: number, params: Partial<CreateUserParams>): Promise<User> => {
    return request.put(`/users/${id}`, params);
  },

  delete: (id: number): Promise<{ message: string }> => {
    return request.delete(`/users/${id}`);
  },

  import: (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
