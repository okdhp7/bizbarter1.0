from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Notification, User, UserStatus


def notify_company(db: Session, company_id: int, title: str, body: str = "", link: str = "", exclude_user: int | None = None):
    users = db.scalars(select(User).where(User.company_id == company_id, User.status == UserStatus.approved)).all()
    for u in users:
        if u.id != exclude_user:
            db.add(Notification(user_id=u.id, title=title, body=body[:500], link=link))


def notify_user(db: Session, user_id: int, title: str, body: str = "", link: str = ""):
    db.add(Notification(user_id=user_id, title=title, body=body[:500], link=link))
