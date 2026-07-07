import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Upload, message, Row, Col } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, SearchOutlined, RedoOutlined } from '@ant-design/icons';
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
  const [searchName, setSearchName] = useState('');
  const [searchDept, setSearchDept] = useState<number | undefined>(undefined);
  const [searchJobTitle, setSearchJobTitle] = useState('');
  const [searchOrg, setSearchOrg] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    setLoading(true);
    try {
      const users = await usersApi.getAll({
        realName: searchName || undefined,
        departmentId: searchDept,
        jobTitle: searchJobTitle || undefined,
        organization: searchOrg,
      });
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

  const handleSearch = () => {
    fetchData();
  };

  const handleReset = async () => {
    setSearchName('');
    setSearchDept(undefined);
    setSearchJobTitle('');
    setSearchOrg(undefined);
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

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      ...user,
      functional_supervisor_id: user.functional_supervisor_id || user.functionalSupervisor?.user_id || null,
      business_supervisor_id: user.business_supervisor_id || user.businessSupervisor?.user_id || null,
    });
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

  const handleResetPassword = async (user: User) => {
    try {
      const result = await usersApi.resetPassword(user.user_id);
      message.success(result.message || `用户 ${user.real_name} 的密码已重置为123456`);
    } catch {
      // 错误已处理
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      // 将清空的主管字段从 undefined 转为 null，确保后端能正确更新
      if (values.functional_supervisor_id === undefined) {
        values.functional_supervisor_id = null;
      }
      if (values.business_supervisor_id === undefined) {
        values.business_supervisor_id = null;
      }
      if (values.department_id === undefined) {
        values.department_id = null;
      }
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
      title: '所属组织',
      dataIndex: 'organization',
      key: 'organization',
      width: 100,
      render: (org) => org || '安恒',
    },
    {
      title: '职能主管',
      dataIndex: ['functionalSupervisor', 'real_name'],
      key: 'functionalSupervisor',
      width: 100,
      render: (name) => name || '-',
    },
    {
      title: '业务主管',
      dataIndex: ['businessSupervisor', 'real_name'],
      key: 'businessSupervisor',
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
            icon={<RedoOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认重置密码',
                content: `确定将用户 ${record.real_name} 的密码重置为123456吗？`,
                onOk: () => handleResetPassword(record),
              });
            }}
          >
            重置密码
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
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Input
            placeholder="姓名"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ width: 140 }}
            allowClear
            onPressEnter={handleSearch}
          />
        </Col>
        <Col>
          <Select
            placeholder="部门"
            value={searchDept}
            onChange={(v) => setSearchDept(v)}
            style={{ width: 160 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {departments.map((dept) => (
              <Select.Option key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col>
          <Input
            placeholder="职位"
            value={searchJobTitle}
            onChange={(e) => setSearchJobTitle(e.target.value)}
            style={{ width: 140 }}
            allowClear
            onPressEnter={handleSearch}
          />
        </Col>
        <Col>
          <Select
            placeholder="所属组织"
            value={searchOrg}
            onChange={(v) => setSearchOrg(v)}
            style={{ width: 130 }}
            allowClear
          >
            <Select.Option value="安恒">安恒</Select.Option>
            <Select.Option value="耘瓴端">耘瓴端</Select.Option>
          </Select>
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Col>
      </Row>
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
            <Input placeholder="请输入用户名" />
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
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.role !== currentValues.role}
          >
            {({ getFieldValue }) =>
              getFieldValue('role') === 'assistant' ? (
                <Form.Item
                  name="managed_department_ids"
                  label="管理部门"
                  extra="助理可管理多个部门，不选则默认为所属部门"
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择管理部门（可多选）"
                    showSearch
                    optionFilterProp="children"
                  >
                    {departments.map((dept) => (
                      <Select.Option key={dept.department_id} value={dept.department_id}>
                        {dept.department_name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item 
            name="organization" 
            label="所属组织"
            rules={[{ required: true, message: '请选择所属组织' }]}
          >
            <Select placeholder="请选择所属组织">
              <Select.Option value="安恒">安恒</Select.Option>
              <Select.Option value="耘瓴端">耘瓴端</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="functional_supervisor_id" label="职能主管">
            <Select placeholder="请选择职能主管" allowClear showSearch optionFilterProp="children">
              {data.map((user) => (
                <Select.Option key={user.user_id} value={user.user_id}>
                  {user.real_name} ({user.job_title})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="business_supervisor_id" label="业务主管">
            <Select placeholder="请选择业务主管" allowClear showSearch optionFilterProp="children">
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
            <li>职位</li>
            <li>部门</li>
            <li>角色（员工/助理/经理/总经理）</li>
            <li>所属组织（安恒/耘瓴端）</li>
            <li>职能主管（填写姓名）</li>
            <li>业务主管（填写姓名）</li>
          </ul>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => usersApi.downloadImportTemplate()}
            style={{ padding: 0 }}
          >
            下载导入模板
          </Button>
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
