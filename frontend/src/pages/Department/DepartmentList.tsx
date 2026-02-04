import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Modal, Form, Input, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { departmentsApi, Department } from '../../api';
import { useAuthStore } from '../../store/authStore';
import type { ColumnsType } from 'antd/es/table';

const DepartmentList: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const isGM = user?.role === 'gm';

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await departmentsApi.getAll();
      setDepartments(data);
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Department) => {
    setEditingId(record.department_id);
    form.setFieldsValue({
      department_name: record.department_name,
      parent_id: record.parent_id,
    });
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个部门吗？删除后不可恢复。',
      onOk: async () => {
        try {
          await departmentsApi.delete(id);
          message.success('删除成功');
          fetchData();
        } catch {
          // 错误已处理
        }
      },
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await departmentsApi.update(editingId, values);
        message.success('更新成功');
      } else {
        await departmentsApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch {
      // 错误已处理或验证失败
    }
  };

  const columns: ColumnsType<Department> = [
    {
      title: '部门ID',
      dataIndex: 'department_id',
      key: 'department_id',
      width: 100,
    },
    {
      title: '部门名称',
      dataIndex: 'department_name',
      key: 'department_name',
    },
    {
      title: '上级部门',
      dataIndex: ['parent', 'department_name'],
      key: 'parent',
      render: (text) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  if (isGM) {
    columns.push({
      title: '操作',
      key: 'action',
      width: 200,
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
            danger
            type="link"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.department_id)}
          >
            删除
          </Button>
        </Space>
      ),
    });
  }

  return (
    <>
      <Card
        title="部门管理"
        extra={
          isGM && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增部门
            </Button>
          )
        }
      >
        <Table
          columns={columns}
          dataSource={departments}
          rowKey="department_id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑部门' : '新增部门'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="department_name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item name="parent_id" label="上级部门">
            <Select placeholder="请选择上级部门（可选）" allowClear>
              {departments
                .filter((d) => d.department_id !== editingId)
                .map((dept) => (
                  <Select.Option key={dept.department_id} value={dept.department_id}>
                    {dept.department_name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DepartmentList;
