import React, { useState } from 'react';
import { Modal, Form, Input } from 'antd';
import { PbcGoal } from '../../api';

const { TextArea } = Input;

interface ReviewModalProps {
  visible: boolean;
  action: 'approve' | 'reject';
  goal: PbcGoal | null;
  onOk: (comments: string) => void;
  onCancel: () => void;
  extraInfo?: string;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  visible,
  action,
  goal,
  onOk,
  onCancel,
  extraInfo,
}) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values.comments);
      form.resetFields();
    } catch {
      // 表单验证失败
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={action === 'approve' ? '审核通过' : '驳回审核'}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={action === 'approve' ? '确认通过' : '确认驳回'}
      okButtonProps={{ danger: action === 'reject' }}
    >
      <div style={{ marginBottom: 16 }}>
        {extraInfo ? (
          <p style={{ color: '#1890ff', fontWeight: 'bold' }}>{extraInfo}</p>
        ) : (
          <>
            <p><strong>目标名称：</strong>{goal?.goal_name}</p>
            <p><strong>员工姓名：</strong>{goal?.user?.real_name}</p>
          </>
        )}
      </div>
      <Form form={form} layout="vertical">
        <Form.Item
          name="comments"
          label={action === 'approve' ? '审核意见（可选）' : '驳回原因'}
          rules={action === 'reject' ? [{ required: true, message: '请填写驳回原因' }] : []}
        >
          <TextArea
            rows={4}
            placeholder={action === 'approve' ? '请输入审核意见' : '请输入驳回原因'}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ReviewModal;
