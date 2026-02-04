import request from './request';

export interface Department {
  department_id: number;
  department_name: string;
  parent_id: number | null;
  parent?: Department;
  children?: Department[];
  created_at: string;
  updated_at: string;
}

export interface CreateDepartmentDto {
  department_name: string;
  parent_id?: number;
}

export interface UpdateDepartmentDto {
  department_name?: string;
  parent_id?: number;
}

export const departmentsApi = {
  // 获取部门列表（根据当前用户权限）
  getAll: (): Promise<Department[]> => {
    return request.get('/departments');
  },

  // 获取部门树
  getTree: (): Promise<Department[]> => {
    return request.get('/departments/tree');
  },

  // 获取单个部门
  getOne: (id: number): Promise<Department> => {
    return request.get(`/departments/${id}`);
  },

  // 创建部门
  create: (data: CreateDepartmentDto): Promise<Department> => {
    return request.post('/departments', data);
  },

  // 更新部门
  update: (id: number, data: UpdateDepartmentDto): Promise<Department> => {
    return request.put(`/departments/${id}`, data);
  },

  // 删除部门
  delete: (id: number): Promise<any> => {
    return request.delete(`/departments/${id}`);
  },
};
