from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "BizBarter"
    DATABASE_URL: str = "postgresql+psycopg://bizbarter:bizbarter@localhost:5435/bizbarter"
    JWT_SECRET: str = "change-me-in-production-please-use-a-long-random-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 60 * 24
    CORS_ORIGINS: str = "http://localhost:3500,http://127.0.0.1:3500"

    # 최초 관리자 계정 (서버 기동 시 없으면 생성)
    ADMIN_EMAIL: str = "admin@bizbarter.kr"
    ADMIN_PASSWORD: str = "bizbarter2026"

    # 선택: LLM 연동 (설정 시 Q&A 등록 도우미가 자유서술 답변에서 항목을 자동 추출)
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL: str = "claude-sonnet-5-5"

    # 플랫폼 수수료 (현금 정산액 기준, %)
    PLATFORM_FEE_RATE: float = 1.0

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
