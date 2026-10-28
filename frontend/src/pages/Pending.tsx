import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { LogoMark } from '../components/Logo'

export default function Pending() {
  const { user, refresh, logout, loading } = useAuth()
  const nav = useNavigate()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'approved' || user.role === 'admin') return <Navigate to="/" replace />
  const rejected = user.status === 'rejected'
  return (
    <div className="auth-form" style={{ minHeight: '100%' }}>
      <div className="card card-pad auth-box stack" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><LogoMark size={52} /></div>
        <h2>{rejected ? '가입 신청이 반려되었습니다' : user.status === 'suspended' ? '이용이 정지된 계정입니다' : '관리자 승인 대기 중입니다'}</h2>
        <p className="muted">
          {rejected ? `사유: ${user.reject_reason || '-'}` : `${user.company?.name ?? ''} 기업 정보를 확인하고 있습니다. 승인이 완료되면 모든 기능을 이용할 수 있습니다.`}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => refresh()}>승인 상태 새로고침</button>
          <button className="btn" onClick={() => { logout(); nav('/', { state: { toast: '로그아웃되었습니다' } }) }}>로그아웃</button>
        </div>
      </div>
    </div>
  )
}
