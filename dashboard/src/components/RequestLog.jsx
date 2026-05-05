// Shows last N requests in real time
// Props: logs (array of request events)
const RequestLog = ({ logs }) => (
    <div className="section">
      <h2>Live Request Log</h2>
      {logs.length === 0 && (
        <div className="empty">No requests yet — make some API calls</div>
      )}
      {logs.map((log, i) => (
        <div className="log-entry" key={i}>
  
          {/* Allowed or blocked badge */}
          <span className={`badge ${log.allowed ? 'allowed' : 'blocked'}`}>
            {log.allowed ? '✓' : '✗'}
          </span>
  
          {/* IP address */}
          <span style={{ color: '#94a3b8', minWidth: '80px' }}>
            {log.ip}
          </span>
  
          {/* HTTP method + route */}
          <span style={{ color: '#e2e8f0' }}>
            {log.method} {log.route}
          </span>
  
          {/* Algorithm badge */}
          <span className="badge algo">{log.algorithm}</span>
  
          {/* Request count / limit */}
          <span className="tag">{log.count}/{log.limit}</span>
  
          {/* Status code */}
          <span style={{
            color: log.allowed ? '#22c55e' : '#ef4444',
            marginLeft: 'auto'
          }}>
            {log.statusCode}
          </span>
  
          {/* Timestamp */}
          <span style={{ color: '#475569', fontSize: '11px' }}>
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
  
  export default RequestLog;
