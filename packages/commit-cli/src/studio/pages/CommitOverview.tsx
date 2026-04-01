/**
 * CommitOverview — main commit plugin page.
 * Scope selector + tabbed view (Plan / Files).
 */

import { useState, useEffect } from 'react';
import { useData, useTheme } from '@kb-labs/sdk/studio';
import { UIPage, UIHeader } from '@kb-labs/studio-ui-kit';
import { UITabs, UISelect } from '@kb-labs/studio-ui-kit';
import { CommitPlanTab } from '../components/CommitPlanTab';
import { CommitFilesTab } from '../components/CommitFilesTab';

interface Scope {
  id: string;
  name: string;
  path: string;
}

export default function CommitOverview() {
  const { semantic } = useTheme();
  const [scope, setScope] = useState<string>('');

  const { data: scopesData, isLoading: scopesLoading } = useData<{ scopes: Scope[] }>(
    '/v1/plugins/commit/scopes',
  );

  // Auto-select first scope
  useEffect(() => {
    if (scopesData?.scopes?.length && !scope) {
      setScope(scopesData.scopes[0]!.id);
    }
  }, [scopesData, scope]);

  const scopeOptions = scopesData?.scopes?.map((s) => ({
    label: s.name,
    value: s.id,
  })) ?? [];

  return (
    <UIPage>
      <UIHeader
        title="Commit"
        subtitle="AI-powered commit generation"
        actions={
          <UISelect
            style={{ width: 300 }}
            placeholder="Select scope..."
            value={scope || undefined}
            onChange={(v) => setScope(v as string)}
            loading={scopesLoading}
            showSearch
            options={scopeOptions}
          />
        }
      />

      <UITabs
        size="large"
        items={[
          {
            key: 'plan',
            label: 'Commit Plan',
            children: <CommitPlanTab scope={scope} />,
          },
          {
            key: 'files',
            label: 'Files',
            children: <CommitFilesTab scope={scope} />,
          },
        ]}
      />
    </UIPage>
  );
}
