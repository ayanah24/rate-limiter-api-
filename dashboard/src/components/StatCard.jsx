const StatCard = ({ label, value, type, icon }) => (
    <div className={`stat-card fade-in`}>
        <div className="label">
            {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
            {label}
        </div>
        <div className={`value ${type || ''}`}>{value}</div>
    </div>
);

export default StatCard;