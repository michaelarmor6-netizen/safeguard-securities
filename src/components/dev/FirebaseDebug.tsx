import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';

const FirebaseDebug: React.FC = () => {
  const [debugData, setDebugData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFirebaseData = async () => {
      try {
        console.log('🔍 FirebaseDebug: Starting comprehensive Supabase check...');

        const results: any = {};

        // Check if system_config document exists
        try {
          console.log('🔍 Checking system_config/main row...');
          const { data, error } = await supabase
            .from('system_config')
            .select('*')
            .eq('id', 'main')
            .maybeSingle();

          results.systemConfig = {
            exists: !!data && !error,
            data,
            error: error?.message ?? null
          };

          console.log('🔍 SystemConfig row exists:', !!data && !error);
          if (data) {
            console.log('🔍 SystemConfig data keys:', Object.keys(data));
            console.log('🔍 Branding section:', data.branding);
            console.log('🔍 Logo primary:', data.branding?.logo?.primary);
          }
        } catch (error) {
          console.error('🔍 Error checking system_config:', error);
          results.systemConfig = { error: error instanceof Error ? error.message : 'Unknown error' };
        }

        // Check all tables
        try {
          console.log('🔍 Checking available tables...');
          const tables = ['system_config', 'users', 'accounts', 'transactions'];

          for (const tableName of tables) {
            try {
              const { data: rows, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
              results[`table_${tableName}`] = {
                exists: !error,
                docCount: (rows ?? []).length,
                docIds: (rows ?? []).map((row: any) => row.id),
                error: error?.message ?? null
              };
              console.log(`🔍 Table '${tableName}': ${(rows ?? []).length} rows`);
            } catch (error) {
              results[`table_${tableName}`] = { error: error instanceof Error ? error.message : 'Unknown error' };
            }
          }
        } catch (error) {
          console.error('🔍 Error checking tables:', error);
        }

        setDebugData(results);
        console.log('🔍 Supabase debug complete:', results);

      } catch (error) {
        console.error('🔍 Supabase debug failed:', error);
        setDebugData({ globalError: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };

    fetchFirebaseData();
  }, []);

  if (loading) return <div style={{ position: 'fixed', top: '10px', left: '10px', background: 'yellow', padding: '10px', zIndex: 9999 }}>Loading Supabase Debug...</div>;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: 'white',
      border: '2px solid #333',
      padding: '15px',
      borderRadius: '8px',
      maxWidth: '500px',
      maxHeight: '90vh',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '11px'
    }}>
      <h3>🔍 Supabase Debug Panel</h3>

      {debugData.systemConfig && (
        <div style={{ marginBottom: '15px', border: '1px solid #ddd', padding: '10px' }}>
          <h4>SystemConfig Row</h4>
          <div><strong>Exists:</strong> {debugData.systemConfig.exists ? '✅ Yes' : '❌ No'}</div>

          {debugData.systemConfig.data && (
            <>
              <div><strong>Company Name:</strong> {debugData.systemConfig.data.company_info?.name || 'N/A'}</div>
              <div><strong>Logo Primary:</strong>
                <div style={{
                  background: debugData.systemConfig.data.branding?.logo?.primary ? '#d4edda' : '#f8d7da',
                  padding: '5px',
                  wordBreak: 'break-all',
                  maxHeight: '100px',
                  overflow: 'auto'
                }}>
                  {debugData.systemConfig.data.branding?.logo?.primary || '(empty/null)'}
                </div>
              </div>
              <div><strong>Updated At:</strong> {debugData.systemConfig.data.updated_at ? new Date(debugData.systemConfig.data.updated_at).toLocaleString() : 'Never'}</div>
              <div><strong>Updated By:</strong> {debugData.systemConfig.data.updated_by || 'N/A'}</div>
            </>
          )}

          {debugData.systemConfig.error && (
            <div style={{ color: 'red' }}><strong>Error:</strong> {debugData.systemConfig.error}</div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <h4>Tables Status</h4>
        {Object.entries(debugData).filter(([key]) => key.startsWith('table_')).map(([key, value]: [string, any]) => (
          <div key={key} style={{ marginBottom: '5px' }}>
            <strong>{key.replace('table_', '')}:</strong>
            {value.error ? (
              <span style={{ color: 'red' }}> Error: {value.error}</span>
            ) : (
              <span> {value.docCount} rows {value.exists ? '✅' : '❌'}</span>
            )}
          </div>
        ))}
      </div>

      <details>
        <summary style={{ cursor: 'pointer' }}>Full Debug Data</summary>
        <pre style={{
          background: '#f8f8f8',
          padding: '10px',
          fontSize: '9px',
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {JSON.stringify(debugData, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default FirebaseDebug;
