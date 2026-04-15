import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Select, Space, Tag, Input, DatePicker, Switch, message, Button, Modal, Descriptions, Popconfirm } from 'antd';
import { DownloadOutlined, SendOutlined } from '@ant-design/icons';
import { performanceApi, Performance, UpdatePerformanceDto, pbcApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import MultilineText from '../../components/MultilineText';

interface PeriodOption {
  period_id: number;
  year: number;
  quarter: number;
}

const performanceLevelOptions = [
  { value: 'S', label: 'S - 卓越' },
  { value: 'A', label: 'A - 优秀' },
  { value: 'B', label: 'B - 合格' },
  { value: 'C', label: 'C - 待改进' },
  { value: 'D', label: 'D - 不合格' },
];

const bottomMgmtStatusOptions = [
  { value: '不适用', label: '不适用' },
  { value: '观察期', label: '观察期' },
  { value: '改进计划中', label: '改进计划中' },
  { value: '拟淘汰', label: '拟淘汰' },
  { value: '已淘汰', label: '已淘汰' },
];

const levelColorMap: Record<string, string> = {
  S: 'gold',
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

const PerformanceList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Performance[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<Performance | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<UpdatePerformanceDto>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [distributing, setDistributing] = useState(false);
  const { user: currentUser } = useAuthStore();

  // 判断当前用户是否可编辑某条绩效记录
  const canEditRecord = (record: Performance): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'assistant') return false;
    if (currentUser.role === 'gm' || currentUser.role === 'manager') {
      return record.user?.supervisor_id === currentUser.user_id;
    }
    return false;
  };

  const fetchPeriods = useCallback(async () => {
    try {
      const [list, activePeriod] = await Promise.all([
        pbcApi.getPeriods(),
        pbcApi.getActivePeriod(),
      ]);
      setPeriods(list);
      if (activePeriod) {
        setSelectedPeriodId(activePeriod.period_id);
      } else if (list.length > 0) {
        const sorted = [...list].sort((a, b) => b.year - a.year || b.quarter - a.quarter);
        setSelectedPeriodId(sorted[0].period_id);
      }
    } catch {
      // handled
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await performanceApi.getList(selectedPeriodId);
      setData(list);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriodId !== undefined) {
      fetchData();
    }
  }, [selectedPeriodId, fetchData]);

  const handleView = (record: Performance) => {
    setCurrentRecord(record);
    setIsEditing(false);
    setModalVisible(true);
  };

  const handleEdit = (record: Performance) => {
    setCurrentRecord(record);
    setIsEditing(true);
    setEditValues({
      performance_level: record.performance_level || undefined,
      has_ai_contribution: record.has_ai_contribution ?? undefined,
      ai_performance_comment: record.ai_performance_comment || undefined,
      bottom_mgmt_status: record.bottom_mgmt_status || undefined,
      planned_elimination_date: record.planned_elimination_date || undefined,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!currentRecord) return;
    setSaving(true);
    try {
      await performanceApi.update(currentRecord.performance_id, editValues);
      message.success('保存成功');
      setModalVisible(false);
      setCurrentRecord(null);
      setEditValues({});
      fetchData();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setCurrentRecord(null);
    setIsEditing(false);
    setEditValues({});
  };

  const handleDistribute = async () => {
    if (selectedRowKeys.length === 0) return;
    setDistributing(true);
    try {
      const result = await performanceApi.distributeResults(selectedRowKeys);
      message.success(result.message);
      setSelectedRowKeys([]);
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '下发失败');
    } finally {
      setDistributing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await performanceApi.export(selectedPeriodId);
      message.success('导出成功');
    } catch {
      // handled
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnsType<Performance> = [
    {
      title: '姓名',
      key: 'real_name',
      width: 100,
      render: (_, record) => record.user?.real_name || '-',
    },
    {
      title: '部门',
      key: 'department',
      width: 120,
      render: (_, record) => record.user?.department?.department_name || '-',
    },
    {
      title: '季度',
      key: 'quarter',
      width: 100,
      render: (_, record) => `${record.period?.year}Q${record.period?.quarter}`,
    },
    {
      title: '绩效等级',
      key: 'performance_level',
      width: 100,
      render: (_, record) => {
        const level = record.performance_level;
        return level ? <Tag color={levelColorMap[level] || 'default'}>{level}</Tag> : '-';
      },
    },
    {
      title: '绩效评价',
      key: 'performance_comment',
      width: 200,
      render: (_, record) => <MultilineText text={record.performance_comment} />,
    },
    {
      title: '主管评分',
      key: 'supervisor_overall_score',
      width: 100,
      render: (_, record) => {
        const score = record.evaluation?.supervisor_overall_score;
        return score != null ? (
          <span style={{ fontWeight: 700, color: '#52c41a' }}>{score} 分</span>
        ) : '-';
      },
    },
    {
      title: 'AI维度组织贡献',
      key: 'has_ai_contribution',
      width: 120,
      render: (_, record) =>
        record.has_ai_contribution === true
          ? <Tag color="green">是</Tag>
          : record.has_ai_contribution === false
          ? <Tag>否</Tag>
          : '-',
    },
    {
      title: '末位管理执行状态',
      key: 'bottom_mgmt_status',
      width: 140,
      render: (_, record) => record.bottom_mgmt_status || '-',
    },
    {
      title: '结果下发',
      key: 'result_distributed_at',
      width: 110,
      render: (_, record) =>
        record.result_distributed_at
          ? <Tag color="success">已下发</Tag>
          : <Tag color="default">未下发</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleView(record)}>
            查看
          </Button>
          {canEditRecord(record) && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const renderModalContent = () => {
    if (!currentRecord) return null;

    if (isEditing) {
      return (
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="姓名">{currentRecord.user?.real_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="部门">{currentRecord.user?.department?.department_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="季度">{`${currentRecord.period?.year}Q${currentRecord.period?.quarter}`}</Descriptions.Item>
          <Descriptions.Item label="绩效评价"><MultilineText text={currentRecord.performance_comment} /></Descriptions.Item>
          <Descriptions.Item label="绩效等级">
            <Select
              style={{ width: 200 }}
              value={editValues.performance_level}
              onChange={(val) => setEditValues({ ...editValues, performance_level: val })}
              options={performanceLevelOptions}
              allowClear
              placeholder="选择绩效等级"
            />
          </Descriptions.Item>
          <Descriptions.Item label="是否有AI维度的组织贡献">
            <Switch
              checked={editValues.has_ai_contribution ?? false}
              onChange={(val) => setEditValues({ ...editValues, has_ai_contribution: val })}
              checkedChildren="是"
              unCheckedChildren="否"
            />
          </Descriptions.Item>
          <Descriptions.Item label="AI维度绩效评价">
            <Input.TextArea
              rows={3}
              value={editValues.ai_performance_comment || ''}
              onChange={(e) => setEditValues({ ...editValues, ai_performance_comment: e.target.value })}
              placeholder="输入AI维度绩效评价"
            />
          </Descriptions.Item>
          <Descriptions.Item label="末位管理执行状态">
            <Select
              style={{ width: 200 }}
              value={editValues.bottom_mgmt_status}
              onChange={(val) => setEditValues({ ...editValues, bottom_mgmt_status: val })}
              options={bottomMgmtStatusOptions}
              allowClear
              placeholder="选择状态"
            />
          </Descriptions.Item>
          <Descriptions.Item label="拟淘汰时间">
            <DatePicker
              value={editValues.planned_elimination_date ? dayjs(editValues.planned_elimination_date) : null}
              onChange={(date) =>
                setEditValues({
                  ...editValues,
                  planned_elimination_date: date ? date.format('YYYY-MM-DD') : undefined,
                })
              }
              placeholder="选择日期"
            />
          </Descriptions.Item>
        </Descriptions>
      );
    }

    // 查看模式
    const level = currentRecord.performance_level;
    return (
      <Descriptions column={1} bordered size="middle">
        <Descriptions.Item label="姓名">{currentRecord.user?.real_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="部门">{currentRecord.user?.department?.department_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="季度">{`${currentRecord.period?.year}Q${currentRecord.period?.quarter}`}</Descriptions.Item>
        <Descriptions.Item label="绩效等级">
          {level ? <Tag color={levelColorMap[level] || 'default'}>{performanceLevelOptions.find(o => o.value === level)?.label || level}</Tag> : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="绩效评价"><MultilineText text={currentRecord.performance_comment} /></Descriptions.Item>
        <Descriptions.Item label="是否有AI维度的组织贡献">
          {currentRecord.has_ai_contribution === true
            ? <Tag color="green">是</Tag>
            : currentRecord.has_ai_contribution === false
            ? <Tag>否</Tag>
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="AI维度绩效评价"><MultilineText text={currentRecord.ai_performance_comment} /></Descriptions.Item>
        <Descriptions.Item label="末位管理执行状态">{currentRecord.bottom_mgmt_status || '-'}</Descriptions.Item>
        <Descriptions.Item label="拟淘汰时间">
          {currentRecord.planned_elimination_date
            ? dayjs(currentRecord.planned_elimination_date).format('YYYY-MM-DD')
            : '-'}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  return (
    <Card
      title="绩效管理"
      extra={
        <Space>
          <span>季度筛选：</span>
          <Select
            style={{ width: 160 }}
            value={selectedPeriodId}
            onChange={setSelectedPeriodId}
            placeholder="选择季度"
            allowClear
            options={periods
              .sort((a, b) => b.year - a.year || b.quarter - a.quarter)
              .map((p) => ({
                value: p.period_id,
                label: `${p.year}年 Q${p.quarter}`,
              }))}
          />
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            导出Excel
          </Button>
          {currentUser?.role === 'assistant' && (
            <Popconfirm
              title={`确定将所选 ${selectedRowKeys.length} 条绩效结果下发给员工？`}
              description="下发后员工将收到钉钉通知并可查看主管评价"
              onConfirm={handleDistribute}
              disabled={selectedRowKeys.length === 0}
              okText="确认下发"
              cancelText="取消"
            >
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={distributing}
                disabled={selectedRowKeys.length === 0}
              >
                下发绩效结果{selectedRowKeys.length > 0 ? `（${selectedRowKeys.length}）` : ''}
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Table
        rowKey="performance_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1250 }}
        pagination={{ pageSize: 20 }}
        rowSelection={
          currentUser?.role === 'assistant'
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as number[]),
                getCheckboxProps: (record) => ({
                  disabled: !!record.result_distributed_at,
                  title: record.result_distributed_at ? '已下发' : undefined,
                }),
              }
            : undefined
        }
      />

      <Modal
        title={isEditing ? '编辑绩效' : '绩效详情'}
        open={modalVisible}
        onCancel={handleCloseModal}
        width={640}
        footer={
          isEditing
            ? [
                <Button key="cancel" onClick={handleCloseModal}>
                  取消
                </Button>,
                <Button key="save" type="primary" loading={saving} onClick={handleSave}>
                  保存
                </Button>,
              ]
            : [
                <Button key="close" onClick={handleCloseModal}>
                  关闭
                </Button>,
              ]
        }
      >
        {renderModalContent()}
      </Modal>
    </Card>
  );
};

export default PerformanceList;
