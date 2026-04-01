import { useState } from 'react';
import { useData, usePermissions, useNotification, useEventBus } from '@kb-labs/sdk/studio';
import { Button, Select, Table, Tag, Empty, Spin, Typography } from 'antd';
import { GitlabOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface ScopeOption {
  label: string;
  value: string;
}

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

const STATUS_COLORS: Record<string, string> = {
  added: 'green',
  modified: 'orange',
  deleted: 'red',
};

export default function CommitOverview() {
  const [scope, setScope] = useState<string>();
  const { data: scopes, isLoading: scopesLoading } = useData<ScopeOption[]>('/v1/plugins/commit/scopes');
  const { data: files, isLoading: filesLoading } = useData<FileChange[]>(
    `/v1/plugins/commit/files`,
    { params: scope ? { scope } : {}, enabled: !!scope },
  );
  const { hasPermission } = usePermissions();
  const notify = useNotification();
  const bus = useEventBus();

  const handleCommit = async () => {
    // TODO: call commit mutation
    bus.publish('commit:completed', { scope });
    notify.success('Commit created', `Scope: ${scope}`);
  };

  const columns = [
    {
      title: 'File',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <code>{path}</code>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] ?? 'default'}>{status}</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>
        <GitlabOutlined style={{ marginRight: 8 }} />
        Commit
      </Title>

      <div style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 300 }}
          placeholder="Select scope..."
          options={scopes}
          loading={scopesLoading}
          onChange={setScope}
          allowClear
        />
      </div>

      {scope ? (
        filesLoading ? (
          <Spin tip="Loading files..." />
        ) : files && files.length > 0 ? (
          <Table dataSource={files} columns={columns} rowKey="path" pagination={false} />
        ) : (
          <Empty description="No changes in this scope" />
        )
      ) : (
        <Empty description="Select a scope to see changes" />
      )}

      {hasPermission('commit:write') && scope && files && files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={handleCommit}>
            Create Commit
          </Button>
        </div>
      )}
    </div>
  );
}
