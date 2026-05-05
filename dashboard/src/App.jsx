import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import StatCard from './components/StatCard';
import RequestLog from './components/RequestLog';
import IPManager from './components/IPManager';
import ConfigEditor from './components/ConfigEditor';

// Connect to backend Socket.io server
// Why outside component? Connection created once, not on every render
// Connect to backend Socket.io server
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
});


const MAX_LOGS = 50;  // keep last 50 requests in memory

function App() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [activeIPs, setActiveIPs] = useState(new Set());

  useEffect(() => {

    // Socket connection events
    socket.on('connect', () => {
      console.log('✅ Connected to backend');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
      setConnected(false);
    });

    // Listen for rate limiter events from backend
    // This fires every time ANY request hits your API
    socket.on('request-log', (data) => {
      console.log('📈 Dashboard received log:', data);

      // Add to log — keep only last MAX_LOGS entries
      // Why spread + slice? Immutable update — React requires this
      setLogs(prev => [data, ...prev].slice(0, MAX_LOGS));

      // Increment total requests counter
      setTotalRequests(prev => prev + 1);

      // Increment blocked counter if request was rejected
      if (!data.allowed) {
        setBlockedRequests(prev => prev + 1);
      }

      // Track unique IPs
      // Why functional update? Ensures we work with latest state
      setActiveIPs(prev => new Set([...prev, data.ip]));
    });

    // Cleanup — remove listeners when component unmounts
    // Why? Prevents memory leaks and duplicate event handlers
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('request-log');
    };
  }, []);  // empty array = run once on mount

  // Calculate block percentage
  const blockRate = totalRequests > 0
    ? ((blockedRequests / totalRequests) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="header">
        <h1>🛡️ Rate Limiter Dashboard</h1>
        <div className="status-indicator">
          <div className={`status-dot ${connected ? '' : 'disconnected'}`} />
          <span>{connected ? 'System Live' : 'System Offline'}</span>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Requests"
          value={totalRequests.toLocaleString()}
          icon="📊"
        />
        <StatCard
          label={`Blocked (${blockRate}%)`}
          value={blockedRequests.toLocaleString()}
          type="blocked"
          icon="🛡️"
        />
        <StatCard
          label="Unique IPs"
          value={activeIPs.size}
          type="active"
          icon="👥"
        />
      </div>

      {/* Live request log */}
      <RequestLog logs={logs} />

      {/* IP Manager + Config Editor side by side */}
      <div className="grid-2">
        <IPManager />
        <ConfigEditor />
      </div>

    </div>
  );
}

export default App;