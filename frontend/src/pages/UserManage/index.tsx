import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Upload, message } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { usersApi, User, departmentsApi, Department } from '../../api';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';

const roleMap: Record<string, { color: string; text: string }> = {
  employee: { color: 'default', text: '员工' },
  assistant: { color: 'blue', text: '助理' },
  manager: { color: 'orange', text: '经理' },
  gm: { color: 'red', text: '总经理' },
};

const UserManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const users = await usersApi.getAll();
      setData(users);
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const depts = await departmentsApi.getAll();
      setDepartments(depts);
    } catch {
      // 错误已处理
    }
  };

  useEffect(() => {
    fetchData();
    fetchDepartments();
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setModalVisible(true);
  };

  const handleDelete = async (userId: number) => {
    try {
      await usersApi.delete(userId);
      message.success('删除成功');
      fetchData();
    } catch {
      // 错误已处理
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await usersApi.update(editingUser.user_id, values);
        message.success('更新成功');
      } else {
        await usersApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch {
      // 表单验证失败或API错误
    }
  };

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.error('请选择文件');
      return;
    }

    setImporting(true);
    try {
      const file = fileList[0].originFileObj as File;
      const result = await usersApi.import(file);
      message.success(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
      if (result.errors.length > 0) {
        console.error('导入错误:', result.errors);
      }
      setImportModalVisible(false);
      setFileList([]);
      fetchData();
    } catch {
      // 错误已处理
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
    },
    {
      title: '职位',
      dataIndex: 'job_title',
      key: 'job_title',
      width: 150,
    },
    {
      title: '部门',
      dataIndex: ['department', 'department_name'],
      key: 'department',
      width: 120,
      render: (name) => name || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={roleMap[role]?.color}>{roleMap[role]?.text || role}</Tag>
      ),
    },
    {
      title: '直属主管',
      dataIndex: ['supervisor', 'real_name'],
      key: 'supervisor',
      width: 100,
      render: (name) => name || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除用户 ${record.real_name} 吗？`,
                onOk: () => handleDelete(record.user_id),
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="人员管理"
      extra={
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            Excel导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建用户
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="user_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 新建/编辑用户弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名（登录账号）"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="real_name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="job_title"
            label="职位"
            rules={[{ required: true, message: '请输入职位' }]}
          >
            <Input placeholder="请输入职位" />
          </Form.Item>
          <Form.Item
            name="department_id"
            label="所属部门"
            rules={[{ required: true, message: '请选择所属部门' }]}
          >
            <Select placeholder="请选择所属部门" showSearch optionFilterProp="children">
              {departments.map((dept) => (
                <Select.Option key={dept.department_id} value={dept.department_id}>
                  {dept.department_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select placeholder="请选择角色">
              <Select.Option value="employee">员工</Select.Option>
              <Select.Option value="assistant">助理</Select.Option>
              <Select.Option value="manager">经理</Select.Option>
              <Select.Option value="gm">总经理</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="supervisor_id" label="直属主管">
            <Select placeholder="请选择直属主管" allowClear showSearch optionFilterProp="children">
              {data.map((user) => (
                <Select.Option key={user.user_id} value={user.user_id}>
                  {user.real_name} ({user.job_title})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Excel导入弹窗 */}
      <Modal
        title="Excel导入人员"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false);
          setFileList([]);
        }}
        confirmLoading={importing}
      >
        <div style={{ marginBottom: 16 }}>
          <p>请上传Excel文件，包含以下字段：</p>
          <ul>
            <li><strong>账号</strong>（必填）</li>
            <li><strong>姓名</strong>（必填）</li>
            <li>部门</li>
            <li>岗位</li>
            <li>直属主管（填写姓名）</li>
          </ul>
        </div>
        <Upload
          beforeUpload={() => false}
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList.slice(-1))}
          accept=".xlsx,.xls"
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Modal>
    </Card>
  );
};

export default UserManage;
