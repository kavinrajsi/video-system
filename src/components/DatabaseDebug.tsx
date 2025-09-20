// src/components/DatabaseDebug.tsx - Quick debug component for troubleshooting
'use client';

import { useState } from 'react';
import { videoApi, supabase } from '@/lib/supabase';
import { RefreshCw, Database } from 'lucide-react';

export default function DatabaseDebug() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    env: Record<string, string | undefined>;
    connection: string;
    schema: string;
    error?: string;
  } | null>(null);

  const runTests = async () => {
    setTesting(true);
    setResults(null);

    try {
      // 1. Check environment
      console.log('🔧 Checking environment...');
      const env = videoApi.checkEnvironment();

      // 2. Test basic connection
      console.log('🔌 Testing database connection...');
      let connectionResult = '';
      try {
        const { error } = await supabase.from('videos').select('count').limit(1);
        if (error) {
          connectionResult = `❌ Connection failed: ${error.message}`;
        } else {
          connectionResult = '✅ Database connection successful';
        }
      } catch (connError) {
        connectionResult = `❌ Connection error: ${connError}`;
      }

      // 3. Check schema
      console.log('📋 Checking table schema...');
      let schemaResult = '';
      try {
        const schemaCheck = await videoApi.checkVideoTableSchema();
        if (schemaCheck.error) {
          schemaResult = `❌ Schema error: ${schemaCheck.error.message}`;
        } else if (schemaCheck.testInsertError) {
          schemaResult = `❌ Insert test failed: ${schemaCheck.testInsertError.message}`;
        } else if (schemaCheck.columns) {
          schemaResult = `✅ Schema OK. Columns: ${schemaCheck.columns.join(', ')}`;
        } else {
          schemaResult = '❓ Schema check inconclusive';
        }
      } catch (schemaError) {
        schemaResult = `❌ Schema check failed: ${schemaError}`;
      }

      setResults({
        env,
        connection: connectionResult,
        schema: schemaResult
      });

    } catch (error) {
      console.error('Debug test error:', error);
      setResults({
        env: {},
        connection: '',
        schema: '',
        error: String(error)
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Database Debug</h3>
        </div>
        <button
          onClick={runTests}
          disabled={testing}
          className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Testing...' : 'Run Tests'}</span>
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Environment */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Environment Variables</h4>
            <div className="bg-gray-50 p-3 rounded text-sm">
              {Object.entries(results.env).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-mono">{key}:</span>
                  <span className={value === 'Set' ? 'text-green-600' : 'text-red-600'}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Connection */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Database Connection</h4>
            <div className={`p-3 rounded text-sm ${
              results.connection.includes('✅') 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              {results.connection}
            </div>
          </div>

          {/* Schema */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Table Schema</h4>
            <div className={`p-3 rounded text-sm ${
              results.schema.includes('✅') 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              {results.schema}
            </div>
          </div>

          {/* Error */}
          {results.error && (
            <div>
              <h4 className="font-medium text-red-700 mb-2">Error Details</h4>
              <div className="bg-red-50 p-3 rounded text-sm text-red-800">
                {results.error}
              </div>
            </div>
          )}

          {/* Quick Fix Suggestions */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-700 mb-2">Quick Fixes</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Check that your .env.local file has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
              <p>• Verify your Supabase project is active and accessible</p>
              <p>• Run the database migration SQL script in your Supabase SQL editor</p>
              <p>• Check your internet connection</p>
              <p>• Try refreshing the page</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 