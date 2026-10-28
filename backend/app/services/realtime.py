"""협상 메신저용 WebSocket 연결 관리 (단일 프로세스 메모리 기반).

다중 인스턴스로 확장할 때는 PostgreSQL LISTEN/NOTIFY 나 Redis Pub/Sub 으로 교체한다.
"""
import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, room: int, ws: WebSocket):
        await ws.accept()
        self.loop = asyncio.get_running_loop()
        self.rooms[room].add(ws)

    def disconnect(self, room: int, ws: WebSocket):
        self.rooms[room].discard(ws)

    async def broadcast(self, room: int, payload: dict):
        dead = []
        for ws in list(self.rooms.get(room, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room, ws)

    def broadcast_from_sync(self, room: int, payload: dict):
        """동기 라우터(스레드풀)에서 호출."""
        if self.loop and self.rooms.get(room):
            asyncio.run_coroutine_threadsafe(self.broadcast(room, payload), self.loop)


manager = ConnectionManager()
