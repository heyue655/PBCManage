import request from './request';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  access_token: string;
  user: {
    user_id: number;
    username: string;
    real_name: string;
    job_title: string;
    role: string;
    department?: {
      department_id: number;
      department_name: string;
    };
  };
}

export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

export const authApi = {
  login: (params: LoginParams): Promise<LoginResult> => {
    return request.post('/auth/login', params);
  },

  logout: (): Promise<void> => {
    return request.post('/auth/logout');
  },

  changePassword: (params: ChangePasswordParams): Promise<{ message: string }> => {
    return request.post('/auth/change-password', params);
  },
};
