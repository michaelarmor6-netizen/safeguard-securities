import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';

const SystemConfigDebug: React.FC = () => {
  const [configData, setConfigData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('🔍 SystemConfigDebug: Fetching config from Supabase...');
        const { data, error: err } = await supabase
          .from('system_config')
          .select('*')
          .eq('id', 'main')
          .maybeSingle();

        if (err) throw err;

        if (data) {
          console.log('🔍 SystemConfigDebug: Raw Supabase data:', data);
          console.log('🔍 SystemConfigDebug: Logo primary value:', data.branding?.logo?.primary);
          setConfigData(data);
        } else {
          console.log('🔍 SystemConfigDebug: No document found');
          setError('No system config document found');
        }
      } catch (err) {
        console.error('🔍 SystemConfigDebug: Error fetching config:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  if (loading) return <div>Loading config debug...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'white',
      border: '2px solid #333',
      padding: '15px',
      borderRadius: '8px',
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h3>🔍 System Config Debug</h3>

      <div style={{ marginBottom: '10px' }}>
        <strong>Logo Primary:</strong>
        <div style={{
          background: '#f0f0f0',
          padding: '5px',
          wordBreak: 'break-all',
          color: configData?.branding?.logo?.primary ? 'green' : 'red'
        }}>
          {configData?.branding?.logo?.primary || '(empty/null)'}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Company Name:</strong>
        <div style={{ background: '#f0f0f0', padding: '5px' }}>
          {configData?.company_info?.name || '(empty)'}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Updated At:</strong>
        <div style={{ background: '#f0f0f0', padding: '5px' }}>
          {configData?.updated_at ? new Date(configData.updated_at).toLocaleString() : 'Never'}
        </div>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
          <strong>Full Config Data</strong>
        </summary>
        <pre style={{
          background: '#f8f8f8',
          padding: '10px',
          fontSize: '10px',
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {JSON.stringify(configData, null, 2)}
        </pre>
      </details>

      {configData?.branding?.logo?.primary && (
        <div style={{ marginTop: '10px' }}>
          <strong>Logo Test:</strong>
          <img
            src={configData.branding.logo.primary}
            alt="Logo test"
            style={{
              display: 'block',
              maxWidth: '100px',
              maxHeight: '50px',
              margin: '5px 0',
              border: '1px solid #ddd'
            }}
            onLoad={() => console.log('✅ Logo loaded successfully in debug component')}
            onError={(e) => console.log('❌ Logo failed to load in debug component:', e)}
          />
        </div>
      )}
    </div>
  );
};

export default SystemConfigDebug;
