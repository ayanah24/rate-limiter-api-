import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';
const ADMIN_KEY = 'mysecretkeyadmin123';

// Headers needed for all admin requests
const adminHeaders = {
    'Content-Type': 'application/json',
    'X-Admin-Key': ADMIN_KEY
};

const IPManager = ({ onUpdate }) => {
    const [ip, setIp] = useState('');
    const [message, setMessage] = useState('');
    const [lists, setLists] = useState({ blacklist: [], whitelist: [] });


    // onUpdate dependency means refetch when parent says data changed
    const fetchLists = async () => {
        try {
            const res = await axios.get(`${API}/admin/lists`, {
                headers: adminHeaders
            });
            setLists(res.data);
        } catch (err) {
            console.error('Failed to fetch lists');
        }
    };

    // Generic action handler
    const handleAction = async (action) => {
        if (!ip) return setMessage('Enter an IP address first');
        try {
            const isDelete = action === 'remove-black' || action === 'remove-white';
            const endpoint = action.includes('black') ? 'blacklist' : 'whitelist';

            if (isDelete) {
                await axios.delete(`${API}/admin/${endpoint}`, {
                    data: { ip },
                    headers: adminHeaders
                });
            } else {
                await axios.post(`${API}/admin/${endpoint}`,
                    { ip },
                    { headers: adminHeaders }
                );
            }

            setMessage(`Action ${action} successful for ${ip}`);
            setIp('');
            fetchLists();  // refresh lists after action
        } catch (err) {
            const errorMsg = err.response?.data?.details?.[0]?.message 
                || err.response?.data?.error 
                || err.message 
                || 'Failed';
            setMessage(`Error: ${errorMsg}`);
        }
    };

    // Fetch on mount
    useEffect(() => { fetchLists(); }, []);

    return (
        <div className="section">
            <h2>IP Manager</h2>

            <div className="input-row">
                <input
                    value={ip}
                    onChange={e => setIp(e.target.value)}
                    placeholder="IP address e.g. 192.168.1.1"
                    style={{ flex: 1 }}
                />
                <button className="btn-danger" onClick={() => handleAction('blacklist')}>
                    Blacklist
                </button>
                <button className="btn-success" onClick={() => handleAction('whitelist')}>
                    Whitelist
                </button>
            </div>

            {message && (
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                    {message}
                </div>
            )}

            <div className="grid-2">
                <div>
                    <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>
                        BLACKLISTED ({lists.blacklist.length})
                    </div>
                    {lists.blacklist.length === 0
                        ? <div className="empty">None</div>
                        : lists.blacklist.map(ip => (
                            <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{ip}</span>
                                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: '11px' }}
                                    onClick={() => { setIp(ip); handleAction('remove-black'); }}>
                                    Remove
                                </button>
                            </div>
                        ))
                    }
                </div>

                <div>
                    <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px' }}>
                        WHITELISTED ({lists.whitelist.length})
                    </div>
                    {lists.whitelist.length === 0
                        ? <div className="empty">None</div>
                        : lists.whitelist.map(ip => (
                            <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{ip}</span>
                                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: '11px' }}
                                    onClick={() => { setIp(ip); handleAction('remove-white'); }}>
                                    Remove
                                </button>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    );
};

export default IPManager;