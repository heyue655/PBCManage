import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Tag, Space, Spin, Alert, Descriptions, Divider,
  Modal, Form, Input, InputNumber, Select, message, Popconfirm, Progress, Row, Col, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, StarOutlined, LinkOutlined,
} from '@ant-design/icons';
import { pbcApi, PbcTask, PbcGoal, PbcStatus } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { sortGoals } from '../../utils/goalSort';
import MultilineText from '../../components/MultilineText';

const { TextArea } = Input;

const goalTypeMap: Record<string, string> = {
  business: '业务目标',
  skill: '个人能力提升',
  team: '组织与人员管理&团队建设',
};

const goalNatureMap: Record<string, string> = {
  qualitative: '定性',
  quantitative: '定量',
};

const getDefaultGoalNature = (goalType?: string) =>
  goalType === 'business' ? 'quantitative' : 'qualitative';

const statusMap: Record<PbcStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  submitted: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
  archived: { color: 'purple', text: '已归档' },
};

const taskStatusLabelMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待填写' },
  filling: { color: 'processing', text: '填写中' },
  submitted: { color: 'blue', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
  archived: { color: 'purple', text: '已归档' },
};

// 权重徽章 - 醒目展示
const WeightBadge: React.FC<{ weight: number }> = ({ weight }) => (
  <span
    style={{
      display: 'inline-block',
      background: 'linear-gradient(135deg, #fa8c16, #faad14)',
      color: '#fff',
      borderRadius: 20,
      padding: '3px 14px',
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: 1,
      minWidth: 64,
      textAlign: 'center',
      boxShadow: '0 2px 6px rgba(250,140,22,0.4)',
    }}
  >
    {weight}%
  </span>
);

const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<PbcTask | null>(null);

  // 目标表单相关
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PbcGoal | null>(null);
  const [goalForm] = Form.useForm();
  const [supervisorGoals, setSupervisorGoals] = useState<PbcGoal[]>([]);
  const [selectedSupervisorGoal, setSelectedSupervisorGoal] = useState<PbcGoal | undefined>();

  // 内联自评
  const [evalInputs, setEvalInputs] = useState<Record<number, { score?: number; comment: string }>>({}); 
  const [overallComment, setOverallComment] = useState('');

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await pbcApi.getTaskDetail(Number(taskId));
      setTask(data);
    } catch (err: any) {
      message.error(err.response?.data?.message || '获取任务详情失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // 初始化内联自评数据
  useEffect(() => {
    if (task?.goals) {
      const inputs: Record<number, { score?: number; comment: string }> = {};
      (task.goals as any[]).forEach((g) => {
        inputs[g.goal_id] = {
          score: g.self_score ? Number(g.self_score) : undefined,
          comment: g.self_comment || '',
        };
      });
      setEvalInputs(inputs);
      setOverallComment(task.evaluation?.self_overall_comment || '');
    }
  }, [task]);

  const goals = task?.goals ? sortGoals(task.goals) : [];
  const evaluation = task?.evaluation;
  const totalWeight = task?.total_weight ?? 0;
  const taskStatus = task?.task_status ?? 'pending';
  const isEditable = taskStatus === 'pending' || taskStatus === 'filling' || taskStatus === 'rejected';
  const isApproved = taskStatus === 'approved';
  const isSelfSubmitted = !!evaluation?.self_submitted_at;

  // 打开目标表单
  const openGoalModal = async (goal?: PbcGoal) => {
    setEditingGoal(goal || null);
    setSelectedSupervisorGoal(undefined);
    goalForm.resetFields();
    if (goal) {
      goalForm.setFieldsValue({
        goal_type: goal.goal_type,
        goal_nature: (goal as any).goal_nature || getDefaultGoalNature(goal.goal_type),
        goal_name: goal.goal_name,
        goal_weight: Number(goal.goal_weight),
        goal_description: goal.goal_description,
        supervisor_goal_id: goal.supervisor_goal_id,
        measures: goal.measures,
        unacceptable: goal.unacceptable,
        acceptable: goal.acceptable,
        excellent: goal.excellent,
        completion_time: goal.completion_time,
      });
    } else {
      goalForm.setFieldsValue({
        goal_type: 'business',
        goal_nature: 'quantitative',
      });
    }
    // 获取当前周期的上级目标
    try {
      const sg = await pbcApi.getSupervisorGoals(task?.period_id);
      setSupervisorGoals(sg);
      // 如果是编辑模式，回显已选上级目标的详情
      if (goal?.supervisor_goal_id) {
        const found = sg.find(g => g.goal_id === goal.supervisor_goal_id);
        if (found) setSelectedSupervisorGoal(found);
        else if ((goal as any).supervisorGoal) setSelectedSupervisorGoal((goal as any).supervisorGoal);
      }
    } catch {
      setSupervisorGoals([]);
    }
    setGoalModalVisible(true);
  };

  const handleGoalSubmit = async () => {
    try {
      const values = await goalForm.validateFields();
      const params = {
        ...values,
        period_id: task?.period_id,
      };
      if (editingGoal) {
        await pbcApi.update(editingGoal.goal_id, params);
        message.success('目标已更新');
      } else {
        await pbcApi.create(params);
        message.success('目标已添加');
      }
      setGoalModalVisible(false);
      fetchTask();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    try {
      await pbcApi.delete(goalId);
      message.success('目标已删除');
      fetchTask();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleSubmitAll = async () => {
    try {
      const result = await pbcApi.submitAll(task?.period_id);
      message.success(result.message || `成功提交 ${result.count} 个目标`);
      fetchTask();
    } catch (err: any) {
      message.error(err.response?.data?.message || '提交失败');
    }
  };

  // 批量保存所有自评
  const [evalSavingAll, setEvalSavingAll] = useState(false);
  const handleSaveAllSelfEval = async () => {
    const approvedGoals = goals.filter(g => g.status === 'approved');
    // 校验所有目标都已填写
    const missing = approvedGoals.filter(g => {
      const input = evalInputs[g.goal_id];
      return input?.score == null || !input?.comment;
    });
    if (missing.length > 0) {
      message.warning(`还有 ${missing.length} 个目标未填写自评，请全部填写后再保存`);
      return;
    }
    if (!overallComment.trim()) {
      message.warning('请填写整体自评');
      return;
    }
    setEvalSavingAll(true);
    let success = 0;
    for (const g of approvedGoals) {
      const input = evalInputs[g.goal_id];
      try {
        await pbcApi.selfEvaluate(g.goal_id, input.score!, input.comment);
        success++;
      } catch { /* skip */ }
    }
    // 保存整体自评
    if (task?.period_id) {
      try {
        await pbcApi.submitSelfEvaluation(task.period_id, overallComment);
      } catch { /* skip */ }
    }
    setEvalSavingAll(false);
    if (success > 0) {
      message.success(`已保存 ${success} 个目标的自评及整体自评`);
      fetchTask();
    }
  };


  const currentGoalType = Form.useWatch('goal_type', goalForm);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!task) return <Alert type="error" message="任务不存在" />;

  const periodName = task.period
    ? `${task.period.year}年 Q${task.period.quarter}`
    : '-';

  const allGoalsEvaluated = goals.filter(g => g.status === 'approved').every((g: any) => g.self_score);
  const canSubmitOverallSelfEval = isApproved && allGoalsEvaluated && !isSelfSubmitted;

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* 顶部导航 */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/pbc')}
        style={{ marginBottom: 16 }}
      >
        返回我的PBC
      </Button>

      {/* 任务基本信息 */}
      <Card
        title={
          <Space>
            <span>PBC任务详情</span>
            <Tag color={taskStatusLabelMap[taskStatus]?.color || 'default'}>
              {taskStatusLabelMap[taskStatus]?.text || taskStatus}
            </Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={24}>
          <Col span={6}>
            <div style={{ color: '#999', fontSize: 12 }}>季度</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{periodName}</div>
          </Col>
          <Col span={6}>
            <div style={{ color: '#999', fontSize: 12 }}>下发人</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              {task.distributor?.real_name || '-'}
            </div>
          </Col>
          <Col span={6}>
            <div style={{ color: '#999', fontSize: 12 }}>下发时间</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              {task.created_at ? new Date(task.created_at).toLocaleDateString('zh-CN') : '-'}
            </div>
          </Col>
          <Col span={6}>
            <div style={{ color: '#999', fontSize: 12 }}>权重总和</div>
            <div style={{ marginTop: 4 }}>
              <Progress
                percent={Math.min(totalWeight, 100)}
                format={() => `${totalWeight}%`}
                status={Math.abs(totalWeight - 100) <= 0.01 ? 'success' : 'exception'}
                strokeWidth={10}
              />
            </div>
          </Col>
        </Row>

        {taskStatus === 'rejected' && (
          <Alert
            type="error"
            message={`已驳回：${goals.find((g: any) => g.approvals?.[0]?.comments)
              ? (goals.find((g: any) => g.approvals?.[0]?.comments) as any)?.approvals?.[0]?.comments
              : '请修改后重新提交'}`}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 自评被驳回提示 */}
      {isApproved && !isSelfSubmitted && evaluation?.self_eval_rejected_at && (
        <Alert
          type="warning"
          showIcon
          message="自评已被主管驳回，请修改后重新提交"
          description={evaluation.self_eval_reject_reason ? `驳回原因：${evaluation.self_eval_reject_reason}` : undefined}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 目标列表 */}
      <Card
        title={`本季度PBC目标（共 ${goals.length} 项）`}
        extra={
          isEditable && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openGoalModal()}>
              添加目标
            </Button>
          )
        }
        style={{ marginBottom: 16 }}
      >
        {goals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
            暂无目标，点击右上角"添加目标"开始填写
          </div>
        ) : (
          goals.map((goal, index) => (
            <Card
              key={goal.goal_id}
              size="small"
              style={{ marginBottom: 12, border: '1px solid #f0f0f0' }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <Tag color="blue">目标 {index + 1}</Tag>
                    <span style={{ fontWeight: 600 }}>{goal.goal_name}</span>
                  </Space>
                  <Space wrap>
                    <Tag color="geekblue">{goalTypeMap[goal.goal_type] || goal.goal_type}</Tag>
                    <Tag color={statusMap[goal.status]?.color}>{statusMap[goal.status]?.text}</Tag>
                    {/* 醒目权重展示 */}
                    <WeightBadge weight={Number(goal.goal_weight)} />
                  </Space>
                </div>
              }
              extra={
                isEditable ? (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openGoalModal(goal)}>
                      编辑
                    </Button>
                    <Popconfirm title="确定删除此目标吗？" onConfirm={() => handleDeleteGoal(goal.goal_id)}>
                      <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  </Space>
                ) : null
              }
            >
              <Descriptions column={1} size="small" bordered labelStyle={{ width: 110, whiteSpace: 'nowrap' }}>
                <Descriptions.Item label="性质">{goalNatureMap[(goal as any).goal_nature] || '-'}</Descriptions.Item>
                {goal.goal_type !== 'skill' && goal.measures && (
                    <Descriptions.Item label="实现举措"><MultilineText text={goal.measures} /></Descriptions.Item>
                )}
                  <Descriptions.Item label="目标描述"><MultilineText text={goal.goal_description} /></Descriptions.Item>
                {goal.goal_type === 'skill' && goal.completion_time && (
                  <Descriptions.Item label="完成时间">
                    {new Date(goal.completion_time).toLocaleDateString('zh-CN')}
                  </Descriptions.Item>
                )}
                {goal.goal_type === 'business' && (
                  <>
                    <Descriptions.Item label={<span style={{ color: '#ff4d4f' }}>不可接受标准</span>}>
                      <MultilineText text={goal.unacceptable} style={{ color: '#ff4d4f' }} />
                    </Descriptions.Item>
                    <Descriptions.Item label={<span style={{ color: '#1890ff' }}>达标标准</span>}>
                      <MultilineText text={goal.acceptable} style={{ color: '#1890ff' }} />
                    </Descriptions.Item>
                    <Descriptions.Item label={<span style={{ color: '#52c41a' }}>卓越标准</span>}>
                      <MultilineText text={goal.excellent} style={{ color: '#52c41a' }} />
                    </Descriptions.Item>
                  </>
                )}
                {/* 展示自评结果 */}
                {(goal as any).self_score && (
                  <>
                    <Descriptions.Item label="自评分数">
                      <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 16 }}>
                        {(goal as any).self_score} 分
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="自评说明">
                      <MultilineText text={(goal as any).self_comment} />
                    </Descriptions.Item>
                  </>
                )}
                {/* 展示主管评价 */}
                {(goal as any).supervisor_score && (
                  <>
                    <Descriptions.Item label="主管评分">
                      <span style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>
                        {(goal as any).supervisor_score} 分
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="主管评价">
                      <MultilineText text={(goal as any).supervisor_comment} />
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>

              {/* 内联自评区域 */}
              {isApproved && !isSelfSubmitted && goal.status === 'approved' && (
                <div style={{ display: 'flex', gap: 12, marginTop: 12, padding: '10px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, width: 90 }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>自评分</div>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0} max={100}
                      placeholder="0-100"
                      value={evalInputs[goal.goal_id]?.score}
                      onChange={(val) => setEvalInputs(prev => ({
                        ...prev,
                        [goal.goal_id]: { ...prev[goal.goal_id], score: val ?? undefined },
                      }))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>自评说明</div>
                    <TextArea
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      placeholder="请描述完成情况、遇到的问题、收获等"
                      value={evalInputs[goal.goal_id]?.comment}
                      onChange={(e) => setEvalInputs(prev => ({
                        ...prev,
                        [goal.goal_id]: { ...prev[goal.goal_id], comment: e.target.value },
                      }))}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))
        )}

        {/* 整体自评（内联） */}
        {isApproved && !isSelfSubmitted && goals.some(g => g.status === 'approved') && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff', fontSize: 13 }}>
              <StarOutlined style={{ marginRight: 4 }} />
              整体自评
            </div>
            <TextArea
              rows={3}
              autoSize={{ minRows: 3, maxRows: 8 }}
              showCount
              maxLength={1000}
              placeholder="请总结本季度工作完成情况、亮点、不足、改进方向等"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
            />
          </div>
        )}

        {/* 底部操作区 */}
        {goals.length > 0 && (
          <div style={{ textAlign: 'right', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Space>
              {isEditable && (
                <Popconfirm
                  title={`确定提交吗？（共 ${goals.length} 项目标，权重总和 ${totalWeight}%）`}
                  description="提交后将发送给主管审核"
                  onConfirm={handleSubmitAll}
                  disabled={Math.abs(totalWeight - 100) > 0.01}
                >
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={Math.abs(totalWeight - 100) > 0.01}
                    title={Math.abs(totalWeight - 100) > 0.01 ? '权重总和必须为100%' : ''}
                  >
                    提交审批
                  </Button>
                </Popconfirm>
              )}
              {canSubmitOverallSelfEval && (
                <Button
                  type="primary"
                  icon={<StarOutlined />}
                  loading={evalSavingAll}
                  onClick={handleSaveAllSelfEval}
                >
                  保存并提交自评
                </Button>
              )}
              {isApproved && !isSelfSubmitted && !canSubmitOverallSelfEval && (
                <Button
                  type="primary"
                  icon={<StarOutlined />}
                  loading={evalSavingAll}
                  onClick={handleSaveAllSelfEval}
                >
                  保存全部自评
                </Button>
              )}
              {isSelfSubmitted && (
                <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                  ✓ 自评已提交
                </Tag>
              )}
            </Space>
          </div>
        )}
      </Card>

      {/* 整体评价区（已提交自评后展示） */}
      {evaluation?.self_submitted_at && (
        <Card title="整体自评" size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={1}>
            <Descriptions.Item label="提交时间">
              {new Date(evaluation.self_submitted_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="整体评价">
              <MultilineText text={evaluation.self_overall_comment} />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {evaluation?.supervisor_submitted_at && (
        <Card title="主管整体评价" size="small">
          <Descriptions column={1}>
            <Descriptions.Item label="提交时间">
              {new Date(evaluation.supervisor_submitted_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="整体评价">
              <MultilineText text={evaluation.supervisor_overall_comment} />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 添加/编辑目标弹窗 */}
      <Modal
        title={editingGoal ? '编辑目标' : '添加目标'}
        open={goalModalVisible}
        onOk={handleGoalSubmit}
        onCancel={() => { setGoalModalVisible(false); goalForm.resetFields(); setSelectedSupervisorGoal(undefined); }}
        okText="保存"
        cancelText="取消"
        width={760}
      >
        <Form
          form={goalForm}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (changedValues.goal_type !== undefined) {
              goalForm.setFieldValue('goal_nature', getDefaultGoalNature(changedValues.goal_type));
              if (changedValues.goal_type !== 'business') {
                goalForm.setFieldValue('supervisor_goal_id', undefined);
                setSelectedSupervisorGoal(undefined);
              }
            }
            if (changedValues.supervisor_goal_id !== undefined) {
              const found = supervisorGoals.find(g => g.goal_id === changedValues.supervisor_goal_id);
              setSelectedSupervisorGoal(found);
            }
          }}
        >
          {/* 第一行：目标类型、性质 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="goal_type" label="目标类型" rules={[{ required: true }]}>
                <Select placeholder="选择目标类型">
                  {Object.entries(goalTypeMap).map(([k, v]) => (
                    <Select.Option key={k} value={k}>{v}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="goal_nature" label="性质" rules={[{ required: true, message: '请选择性质' }]}>
                <Select placeholder="选择性质">
                  <Select.Option value="qualitative">定性</Select.Option>
                  <Select.Option value="quantitative">定量</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 第二行：目标名称、权重 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="goal_name" label="目标名称" rules={[{ required: true, message: '请输入目标名称' }]}>
                <Input placeholder="请输入目标名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="goal_weight"
                label="权重（%）"
                rules={[
                  { required: true, message: '请输入权重' },
                  { type: 'number', min: 1, max: 100, message: '权重范围：1-100' },
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="请输入1-100的整数" min={1} max={100} />
              </Form.Item>
            </Col>
          </Row>

          {/* 关联上级业务目标（仅业务目标时显示） */}
          {currentGoalType === 'business' && (
            <Form.Item
              name="supervisor_goal_id"
              label="关联上级业务目标"
              extra={supervisorGoals.length === 0 ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>当前周期上级暂无业务目标</Typography.Text> : undefined}
            >
              <Select
                placeholder={supervisorGoals.length > 0 ? "可关联上级当季业务目标（可选）" : "暂无可关联目标"}
                allowClear
                disabled={supervisorGoals.length === 0}
                optionLabelProp="label"
              >
                {supervisorGoals.map(sg => (
                  <Select.Option key={sg.goal_id} value={sg.goal_id} label={sg.goal_name}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{sg.goal_name}</div>
                        {sg.goal_description && (
                          <div style={{ fontSize: 12, color: '#888', whiteSpace: 'normal', lineHeight: '1.4' }}>
                            {sg.goal_description.length > 60 ? sg.goal_description.slice(0, 60) + '…' : sg.goal_description}
                          </div>
                        )}
                      </div>
                      <Tag
                        color={sg.status === 'approved' ? 'success' : sg.status === 'submitted' ? 'processing' : sg.status === 'rejected' ? 'error' : 'default'}
                        style={{ marginTop: 2, flexShrink: 0 }}
                      >
                        {statusMap[sg.status as PbcStatus]?.text || sg.status}
                      </Tag>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 选中上级目标后展示详情 */}
          {currentGoalType === 'business' && selectedSupervisorGoal && (
            <Card
              size="small"
              style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}
              title={
                <Space>
                  <LinkOutlined style={{ color: '#52c41a' }} />
                  <Typography.Text style={{ fontSize: 13 }}>已关联上级目标</Typography.Text>
                </Space>
              }
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div>
                  <Typography.Text strong>{selectedSupervisorGoal.goal_name}</Typography.Text>
                  <Tag color="green" style={{ marginLeft: 8 }}>权重 {selectedSupervisorGoal.goal_weight}%</Tag>
                  <Tag color="blue" style={{ marginLeft: 4 }}>{selectedSupervisorGoal.goal_nature === 'quantitative' ? '定量' : '定性'}</Tag>
                </div>
                {selectedSupervisorGoal.goal_description && (
                  <Typography.Paragraph style={{ margin: 0, fontSize: 13, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {selectedSupervisorGoal.goal_description}
                  </Typography.Paragraph>
                )}
              </Space>
            </Card>
          )}

          <Form.Item name="goal_description" label="目标描述" rules={[{ required: true, message: '请输入目标描述' }]}>
            <TextArea rows={3} placeholder="请描述目标内容" />
          </Form.Item>
          {currentGoalType !== 'skill' && (
            <Form.Item name="measures" label="实现举措">
              <TextArea rows={3} placeholder="请描述实现该目标的具体措施" />
            </Form.Item>
          )}
          {currentGoalType === 'skill' && (
            <Form.Item name="completion_time" label="预计完成时间">
              <Input type="date" />
            </Form.Item>
          )}
          {currentGoalType === 'business' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13 }}>评价标准</Divider>
              <Form.Item name="unacceptable" label={<span style={{ color: '#ff4d4f' }}>不可接受标准</span>}>
                <TextArea rows={2} placeholder="描述不可接受的完成情况" />
              </Form.Item>
              <Form.Item name="acceptable" label={<span style={{ color: '#1890ff' }}>达标标准</span>}>
                <TextArea rows={2} placeholder="描述达标的完成情况" />
              </Form.Item>
              <Form.Item name="excellent" label={<span style={{ color: '#52c41a' }}>卓越标准</span>}>
                <TextArea rows={2} placeholder="描述卓越的完成情况" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>


    </div>
  );
};

export default TaskDetail;
