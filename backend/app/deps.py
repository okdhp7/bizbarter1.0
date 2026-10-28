from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserRole, UserStatus
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다.")
    payload = decode_token(cred.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "인증 토큰이 유효하지 않습니다.")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자를 찾을 수 없습니다.")
    return user


def get_approved_user(user: User = Depends(get_current_user)) -> User:
    """관리자 승인을 받은 회원만 서비스 기능을 사용할 수 있다."""
    if user.role == UserRole.admin:
        return user
    if user.status != UserStatus.approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 승인 후 이용할 수 있습니다.")
    if not user.company_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "기업 정보가 없습니다.")
    return user


def get_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 권한이 필요합니다.")
    return user


def get_optional_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """비로그인 방문자도 볼 수 있는 화면(오퍼 목록·상세)용. 토큰이 없거나 무효면 None."""
    if not cred:
        return None
    payload = decode_token(cred.credentials)
    return db.get(User, int(payload["sub"])) if payload else None
