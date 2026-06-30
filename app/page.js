export default function Home() {
  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#0a0a0c',
      color: '#e2e8f0',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      margin: 0,
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '600px',
        padding: '40px',
        borderRadius: '16px',
        backgroundColor: '#13131a',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        border: '1px solid #27273a'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          margin: '0 0 10px 0',
          background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          DuDi CRM Backend
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: '0 0 30px 0' }}>
          Hệ thống chia data khách hàng hoạt động trên Next.js API Server
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '30px'
        }}>
          <span style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 12px #10b981'
          }}></span>
          <span style={{ fontWeight: '600', fontSize: '1.2rem', color: '#10b981' }}>
            HỆ THỐNG ĐANG HOẠT ĐỘNG
          </span>
        </div>

        <div style={{
          textAlign: 'left',
          backgroundColor: '#0a0a0c',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #1e1e2f',
          fontSize: '0.95rem',
          lineHeight: '1.6'
        }}>
          <div><strong>Phiên bản:</strong> Next.js API Routes (App Router)</div>
          <div><strong>Cổng chạy:</strong> 8080 (Tương thích Frontend)</div>
          <div><strong>Cơ sở dữ liệu:</strong> MongoDB (dudi_chiadata)</div>
          <div><strong>Dữ liệu mẫu (Seeding):</strong> Đã kích hoạt khi chạy API lần đầu</div>
        </div>

        <p style={{ marginTop: '30px', fontSize: '0.85rem', color: '#64748b' }}>
          © 2026 DuDi Group. All rights reserved.
        </p>
      </div>
    </div>
  );
}
