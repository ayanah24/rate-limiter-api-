// Props: label, value, type 

const StatCard = ({ label, value, type }) => (
    <div className="stat-card">
        <div className="label">{label}</div>
        <div className={`value ${type || ''}`}>{value}</div>
    </div>
);

export default StatCard;  