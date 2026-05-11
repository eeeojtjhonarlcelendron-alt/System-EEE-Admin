import React, { useState, useEffect } from 'react';
import { getClusterLeaders } from '../lib/data';

function ClusterLeaderTest() {
  const [clusterLeaders, setClusterLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function testFetch() {
      console.log('Testing cluster leaders fetch...');
      setLoading(true);
      
      try {
        const { data, error } = await getClusterLeaders();
        console.log('Test result:', { data, error });
        
        if (error) {
          setError(error);
        } else {
          setClusterLeaders(data || []);
        }
      } catch (err) {
        console.error('Test error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    testFetch();
  }, []);

  if (loading) {
    return <div>Loading cluster leaders...</div>;
  }

  if (error) {
    return (
      <div>
        <h3>Error fetching cluster leaders:</h3>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div>
      <h3>Cluster Leaders ({clusterLeaders.length}):</h3>
      {clusterLeaders.length === 0 ? (
        <p>No cluster leaders found. The table might be empty or doesn't exist.</p>
      ) : (
        <ul>
          {clusterLeaders.map(leader => (
            <li key={leader.id}>
              <strong>{leader.leader_name}</strong> - Hubs: {leader.hubs?.join(', ') || 'None'}
            </li>
          ))}
        </ul>
      )}
      
      <details>
        <summary>Raw data</summary>
        <pre>{JSON.stringify(clusterLeaders, null, 2)}</pre>
      </details>
    </div>
  );
}

export default ClusterLeaderTest;
