import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Empty, Descriptions } from 'antd';
import { performanceApi, Performance } from '../../api';
import type { ColumnsType } from 'antd/es/table';

const levelColorMap: Record<string, string> = {
  S: 'gold',
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

const MyPerformance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Performance[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    performanceApi
      .getMine()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnsType<Performance> = [
    {
      title: '周期',
      key: 'period',
      width: 140,
      render: (_, r) =>
        r.period ? `${r.period.year}年 Q${r.period.quarter}` : '-',
    },
    {
      title: '绩效等级',
      dataIndex: 'performance_level',
      key: 'performance_level',
      width: 120,
      render: (level: string | null) =>
        level ? (
          <Tag color={levelColorMap[level] || 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>
            {level}
          </Tag>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '绩效评价',
      dataIndex: 'performance_comment',
      key: 'performance_comment',
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '下发时间',
      dataIndex: 'result_distributed_at',
      key: 'result_distributed_at',
      width: 180,
      render: (date: string | null) =>
        date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <Card title="我的绩效">
      {data.length === 0 && !loading ? (
        <Empty description="暂无已下发的绩效结果" />
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey="performance_id"
          loading={loading}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedId ? [expandedId] : [],
            onExpand: (expanded, record) =>
              setExpandedId(expanded ? record.performance_id : null),
            expandedRowRender: (record) => (
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="主管整体评分">
                  {record.evaluation?.supervisor_overall_score != null ? (
                    <span style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>
                      {record.evaluation.supervisor_overall_score} 分
                    </span>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="绩效等级">
                  {record.performance_level ? (
                    <Tag color={levelColorMap[record.performance_level]}>
                      {record.performance_level}
                    </Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="主管整体评价" span={2}>
                  {record.evaluation?.supervisor_overall_comment || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="绩效评价" span={2}>
                  {record.performance_comment || '-'}
                </Descriptions.Item>
                {record.has_ai_contribution != null && (
                  <Descriptions.Item label="AI维度组织贡献">
                    {record.has_ai_contribution ? '是' : '否'}
                  </Descriptions.Item>
                )}
                {record.ai_performance_comment && (
                  <Descriptions.Item label="AI维度绩效评价" span={record.has_ai_contribution != null ? 1 : 2}>
                    {record.ai_performance_comment}
                  </Descriptions.Item>
                )}
              </Descriptions>
            ),
          }}
        />
      )}
    </Card>
  );
};

export default MyPerformance;
