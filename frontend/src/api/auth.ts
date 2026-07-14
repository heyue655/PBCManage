import request from './request';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  access_token: string;
  needResetPassword?: boolean;
  user: {
    user_id: number;
    username: string;
    real_name: string;
    job_title: string;
    role: string;
    department_id?: number;
    managed_department_ids?: number[];
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

  daslinkStatus: (): Promise<{ enabled: boolean }> => {
    return request.get('/auth/daslink/status');
  },

  daslinkLoginUrl: (callbackUrl: string): Promise<{ url: string }> => {
    return request.get(`/auth/daslink/login-url?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  },

  daslinkCallback: (code: string): Promise<LoginResult> => {
    return request.get(`/auth/daslink/callback?code=${code}`);
  },
};
