const RequestLog = ({ logs }) => (
    <div className="section">
        <h2>
            <span>📡</span> Live Request Log
        </h2>
        <div className="logs-container">
            {logs.length === 0 ? (
                <div className="empty">No requests yet — make some API calls to see traffic</div>
            ) : (
                logs.map((log, i) => (
                    <div className="log-entry fade-in" key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${log.allowed ? 'allowed' : 'blocked'}`}>
                                {log.allowed ? 'PASS' : 'FAIL'}
                            </span>
                            <span className="log-ip">{log.ip}</span>
                        </div>

                        <span className="log-method">{log.method}</span>
                        
                        <span className="log-route" title={log.route}>{log.route}</span>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="badge algo">{log.algorithm}</span>
                            <span className="tag">{log.count}/{log.limit}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                            <span style={{ 
                                color: log.allowed ? 'var(--success)' : 'var(--danger)',
                                fontWeight: '700'
                            }}>
                                {log.statusCode}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                            </span>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);

export default RequestLog;