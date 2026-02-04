import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Timeline, Divider, Form, InputNumber, Input, message } from 'antd';
import { pbcApi, reviewsApi, PbcGoal, ApprovalRecord, PbcStatus } from '../../api';

const { TextArea } = Input;

const statusMap: Record<PbcStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  submitted: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
  archived: { color: 'purple', text: '已归档' },
};

const actionMap = {
  submit: { color: 'blue', text: '提交审核' },
  approve: { color: 'green', text: '审核通过' },
  reject: { color: 'red', text: '审核驳回' },
};

const ReviewDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [goal, setGoal] = useState<PbcGoal | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluateForm] = Form.useForm();

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [goalData, approvalsData] = await Promise.all([
        pbcApi.getOne(parseInt(id)),
        reviewsApi.getApprovalHistory(parseInt(id)),
      ]);
      setGoal(goalData);
      setApprovals(approvalsData);
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleArchive = async () => {
    if (!id) return;
    try {
      await reviewsApi.archive(parseInt(id));
      message.success('归档成功');
      fetchData();
    } catch {
      // 错误已处理
    }
  };

  const handleEvaluate = async (values: { score: number; comment?: string }) => {
    if (!id) return;
    try {
      await reviewsApi.supervisorEvaluate(parseInt(id), values.score, values.comment);
      message.success('评估成功');
      fetchData();
    } catch {
      // 错误已处理
    }
  };

  if (!goal) {
    return <Card loading={loading}>加载中...</Card>;
  }

  return (
    <div>
      <Card
        title="目标详情"
        extra={
          <Space>
            {goal.status === 'approved' && (
              <Button type="primary" onClick={handleArchive}>
                归档
              </Button>
            )}
            <Button onClick={() => navigate('/review')}>返回</Button>
          </Space>
        }
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="员工姓名">{goal.user?.real_name}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusMap[goal.status].color}>{statusMap[goal.status].text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="目标名称" span={2}>{goal.goal_name}</Descriptions.Item>
          <Descriptions.Item label="目标类型">
            {{
              business: '业务目标',
              skill: '个人能力提升',
              team: '组织与人员管理&团队建设',
            }[goal.goal_type]}
          </Descriptions.Item>
          <Descriptions.Item label="目标权重">{goal.goal_weight}%</Descriptions.Item>
          <Descriptions.Item label="目标描述" span={2}>
            {goal.goal_description}
          </Descriptions.Item>
          {goal.measures && (
            <Descriptions.Item label="实现举措" span={2}>
              {goal.measures}
            </Descriptions.Item>
          )}
          {goal.supervisorGoal && (
            <Descriptions.Item label="关联上级目标" span={2}>
              {goal.supervisorGoal.goal_name}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider>评价标准</Divider>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="不可接受">{goal.unacceptable || '-'}</Descriptions.Item>
          <Descriptions.Item label="达标">{goal.acceptable || '-'}</Descriptions.Item>
          <Descriptions.Item label="卓越">{goal.excellent || '-'}</Descriptions.Item>
        </Descriptions>

        {goal.status === 'archived' && (
          <>
            <Divider>评估信息</Divider>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="自评分数">{goal.self_score ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="主管评分">{goal.supervisor_score ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="自评说明" span={2}>{goal.self_comment || '-'}</Descriptions.Item>
              <Descriptions.Item label="主管评语" span={2}>{goal.supervisor_comment || '-'}</Descriptions.Item>
            </Descriptions>

            {!goal.supervisor_score && (
              <Card title="主管评估" style={{ marginTop: 16 }}>
                <Form form={evaluateForm} layout="inline" onFinish={handleEvaluate}>
                  <Form.Item
                    name="score"
                    label="评分"
                    rules={[{ required: true, message: '请输入评分' }]}
                  >
                    <InputNumber min={0} max={100} placeholder="0-100" />
                  </Form.Item>
                  <Form.Item name="comment" label="评语">
                    <Input placeholder="请输入评语" style={{ width: 300 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      提交评估
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            )}
          </>
        )}

        <Divider>审批历史</Divider>
        <Timeline
          items={approvals.map((approval) => ({
            color: actionMap[approval.action].color,
            children: (
              <div>
                <p>
                  <strong>{actionMap[approval.action].text}</strong>
                  <span style={{ marginLeft: 16, color: '#999' }}>
                    {approval.reviewer?.real_name} - {new Date(approval.created_at).toLocaleString('zh-CN')}
                  </span>
                </p>
                {approval.comments && <p style={{ color: '#666' }}>{approval.comments}</p>}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default ReviewDetail;
