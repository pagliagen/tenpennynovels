import React from 'react';

interface MessagingChartProps {
  data: Array<{
    date: string;
    messages: number;
    chats: number;
  }>;
  type?: string;
}

const MessagingChart: React.FC<MessagingChartProps> = ({ data, type }) => {
  // Placeholder chart component
  // In a full implementation, this would use a charting library like Chart.js or Recharts
  return (
    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
      <h3 style={{ marginBottom: '16px', color: '#333' }}>Recent Activity</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'white',
              borderRadius: '4px'
            }}
          >
            <span style={{ fontWeight: '500' }}>{item.date}</span>
            <span>
              {item.messages} messages / {item.chats} chats
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessagingChart;
