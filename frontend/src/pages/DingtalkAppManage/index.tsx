import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Switch, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { dingtalkAppsApi, DingtalkApp, CreateDingtalkAppParams } from '../../api/dingtalkApps';

const DingtalkAppManage: React.FC = () => {
  const [data, setData] = useState<DingtalkApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<DingtalkApp | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await dingtalkAppsApi.getAll();
      setData(result);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingApp(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalVisible(true);
  };

  const handleEdit = (app: DingtalkApp) => {
    setEditingApp(app);
    form.setFieldsValue(app);
    setModalVisible(true);
  };

  const handleDelete = async (appId: number) => {
    try {
      await dingtalkAppsApi.delete(appId);
      message.success('删除成功');
      fetchData();
    } catch {
      // 错误已处理
    }
  };

  const handleToggleActive = async (app: DingtalkApp) => {
    try {
      await dingtalkAppsApi.toggleActive(app.app_id);
      message.success(app.is_active ? '已禁用' : '已启用');
      fetchData();
    } catch {
      // 错误已处理
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingApp) {
        await dingtalkAppsApi.update(editingApp.app_id, values);
        message.success('更新成功');
      } else {
        await dingtalkAppsApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch {
      // 表单验证失败或API错误
    }
  };

  const columns: ColumnsType<DingtalkApp> = [
    {
      title: '组织',
      dataIndex: 'organization',
      key: 'organization',
      width: 120,
    },
    {
      title: '应用名称',
      dataIndex: 'app_name',
      key: 'app_name',
      width: 150,
    },
    {
      title: 'AgentId',
      dataIndex: 'agent_id',
      key: 'agent_id',
      width: 120,
    },
    {
      title: 'CorpId',
      dataIndex: 'corp_id',
      key: 'corp_id',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'AppKey',
      dataIndex: 'app_key',
      key: 'app_key',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'AppSecret',
      dataIndex: 'app_secret',
      key: 'app_secret',
      width: 180,
      ellipsis: true,
      render: (text) => '••••••••••••' + text.slice(-4),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
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
            icon={record.is_active ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => handleToggleActive(record)}
          >
            {record.is_active ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除应用 ${record.app_name} 吗？`,
                onOk: () => handleDelete(record.app_id),
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
      title="钉钉应用管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建应用
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="app_id"
        loading={loading}
        pagination={false}
        scroll={{ x: 1200 }}
      />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingApp ? '编辑钉钉应用' : '新建钉钉应用'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="organization"
            label="所属组织"
            rules={[{ required: true, message: '请输入所属组织' }]}
          >
            <Input placeholder="例如：安恒、中宇华兴" disabled={!!editingApp} />
          </Form.Item>
          <Form.Item
            name="app_name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="请输入应用名称" />
          </Form.Item>
          <Form.Item
            name="agent_id"
            label="AgentId"
            rules={[{ required: true, message: '请输入AgentId' }]}
          >
            <Input placeholder="请输入钉钉应用的AgentId" />
          </Form.Item>
          <Form.Item
            name="corp_id"
            label="CorpId"
            rules={[{ required: true, message: '请输入CorpId' }]}
          >
            <Input placeholder="请输入企业CorpId" />
          </Form.Item>
          <Form.Item
            name="app_key"
            label="AppKey"
            rules={[{ required: true, message: '请输入AppKey' }]}
          >
            <Input placeholder="请输入应用AppKey" />
          </Form.Item>
          <Form.Item
            name="app_secret"
            label="AppSecret"
            rules={[{ required: true, message: '请输入AppSecret' }]}
          >
            <Input.Password placeholder="请输入应用AppSecret" />
          </Form.Item>
          <Form.Item
            name="is_active"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DingtalkAppManage;
