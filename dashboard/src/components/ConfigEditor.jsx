import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';
const adminHeaders = {
    'Content-Type': 'application/json',
    'X-Admin-Key': 'mysecretkeyadmin123'
};

const ConfigEditor = () => {
    const [route, setRoute] = useState('/api/login');
    const [max, setMax] = useState(5);
    const [windowSize, setWindowSize] = useState(60);
    const [algorithm, setAlgorithm] = useState('sliding');
    const [rules, setRules] = useState({});
    const [message, setMessage] = useState('');

    const fetchRules = async () => {
        try {
            const res = await axios.get(`${API}/admin/config`, {
                headers: adminHeaders
            });
            setRules(res.data.rules || {});
        } catch (err) {
            console.error('Failed to fetch rules');
        }
    };

    useEffect(() => { fetchRules(); }, []);

    const handleSet = async () => {
        try {
            await axios.post(`${API}/admin/config`,
                { route, max: parseInt(max), window: parseInt(windowSize), algorithm },
                { headers: adminHeaders }
            );
            setMessage(` Rule set for ${route}`);
            fetchRules();
        } catch (err) {
            setMessage(` ${err.response?.data?.error || 'Failed'}`);
        }
    };

    const handleDelete = async (r) => {
        try {
            await axios.delete(`${API}/admin/config`,
                { data: { route: r }, headers: adminHeaders }
            );
            setMessage(` Rule deleted for ${r}`);
            fetchRules();
        } catch (err) {
            setMessage(` Failed to delete`);
        }
    };

    return (
        <div className="section">
            <h2>Dynamic Config</h2>

            <div className="input-row">
                <input
                    value={route}
                    onChange={e => setRoute(e.target.value)}
                    placeholder="/api/login"
                    style={{ flex: 2 }}
                />
                <input
                    type="number"
                    value={max}
                    onChange={e => setMax(e.target.value)}
                    placeholder="Max"
                    style={{ width: '80px' }}
                />
                <input
                    type="number"
                    value={windowSize}
                    onChange={e => setWindowSize(e.target.value)}
                    placeholder="Window"
                    style={{ width: '80px' }}
                />
                <select value={algorithm} onChange={e => setAlgorithm(e.target.value)}>
                    <option value="sliding">Sliding</option>
                    <option value="fixed">Fixed</option>
                    <option value="token">Token</option>
                </select>
                <button className="btn-primary" onClick={handleSet}>
                    Set Rule
                </button>
            </div>

            {message && (
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                    {message}
                </div>
            )}

            <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                    ACTIVE RULES ({Object.keys(rules).length})
                </div>
                {Object.keys(rules).length === 0
                    ? <div className="empty">No dynamic rules — using env defaults</div>
                    : Object.entries(rules).map(([r, rule]) => (
                        <div key={r} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: '1px solid #0f172a'
                        }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{r}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="badge algo">{rule.algorithm}</span>
                                <span className="tag">{rule.max} req / {rule.window}s</span>
                                <button
                                    className="btn-ghost"
                                    style={{ padding: '2px 8px', fontSize: '11px' }}
                                    onClick={() => handleDelete(r)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

export default ConfigEditor;