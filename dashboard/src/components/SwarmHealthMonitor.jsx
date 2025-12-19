import React, { useState, useEffect, useCallback } from 'react';
import './SwarmHealthMonitor.css';

const SwarmHealthMonitor = ({ 
  agents = [], 
  refreshInterval = 5000, 
  onAgentClick = () => {}, 
  showDetails = false, 
  theme = 'light' 
}) => {
  const [healthData, setHealthData] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to format relative time
  const formatRelativeTime = useCallback((timestamp) => {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now - updated;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  }, []);

  // Status color mapping
  const getStatusColor = useCallback((status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === 'healthy') return '#00ff88';
    if (statusLower === 'warning' || statusLower === 'degraded') return '#ffcc00';
    if (statusLower === 'critical') return '#ff4757';
    return '#666666'; // gray for unknown/offline
  }, []);

  // Fetch health data
  const fetchHealthData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHealthData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up polling
  useEffect(() => {
    fetchHealthData(); // Initial fetch
    const interval = setInterval(fetchHealthData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchHealthData, refreshInterval]);

  // Handle agent clicks
  const handleAgentClick = useCallback((agent) => {
    onAgentClick(agent);
  }, [onAgentClick]);

  if (isLoading && !lastUpdated) {
    return (
      <div className={`health-monitor ${theme === 'dark' ? 'dark' : ''}`}>
        <div className="loading">Loading health data...</div>
      </div>
    );
  }

  return (
    <div className={`health-monitor ${theme === 'dark' ? 'dark' : ''}`}>
      {error && (
        <div className="error">
          Error: {error}
          <button onClick={fetchHealthData}>Retry</button>
        </div>
      )}
      {lastUpdated && (
        <div className="last-updated">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
      
      <div className="health-cards-grid">
        {agents.map(agent => {
          const agentHealth = healthData[agent.id] || {};
          const isHealthy = agentHealth.status?.toLowerCase() === 'healthy';
          
          return (
            <div
              key={agent.id}
              className={`health-card ${theme === 'dark' ? 'dark' : ''}`}
              onClick={() => handleAgentClick(agent)}
              style={{ cursor: 'pointer' }}
            >
              <div className="health-card-header">
                <h3>{agent.name}</h3>
                <div
                  className="health-status-indicator"
                  style={{ 
                    backgroundColor: getStatusColor(agentHealth.status),
                    animation: isHealthy ? 'healthyPulse 2s infinite' : 'none'
                  }}
                />
              </div>
              <div className="health-card-details">
                <div>Status: {agentHealth.status || 'Unknown'}</div>
                {showDetails && agentHealth.cpu !== undefined && (
                  <div>CPU: {agentHealth.cpu}%</div>
                )}
                {showDetails && agentHealth.ram !== undefined && (
                  <div>RAM: {agentHealth.ram}%</div>
                )}
                {agentHealth.lastUpdated && (
                  <div>Last: {formatRelativeTime(agentHealth.lastUpdated)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SwarmHealthMonitor;
