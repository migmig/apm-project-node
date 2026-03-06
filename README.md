# apm-project-node

`gcgf-untact`의 `apm-agent`가 보내는 데이터를 받아 저장하고, React 대시보드에서 실시간으로 보여주는 Bun 기반 APM 서버입니다.

## 제공 기능

- `POST /api/v1/register` 로 애플리케이션 등록 정보 수신
- `POST /api/v1/metrics` 로 metric batch 수신
- `POST /api/v1/traces` 로 trace batch 수신
- `data/*.jsonl` 에 raw payload 저장
- `GET /api/v1/dashboard` 로 현재 집계 상태 조회
- `GET /api/v1/stream` SSE 스트림으로 대시보드 실시간 갱신
- `GET /api/v1/traces` 로 trace 검색
- `GET /api/v1/traces/:traceId` 로 trace 상세 조회
- `GET /api/v1/api-detail?appName=...&uri=...` 로 API 상세 조회
- `/` 에서 `React + Vite + Tailwind` 기반 실시간 모니터링 UI 제공

## 실행

```bash
cd /Users/migmig/IdeaProjects/apm-project-node
bun install
bun run build
bun start
```

기본 바인드 주소는 `127.0.0.1`, 포트는 `9900` 입니다.

환경 변수:

- `PORT`: 서버 포트
- `HOST`: 바인드 주소
- `APM_API_KEY`: 설정 시 `X-API-Key` 헤더 검증

개발용 스크립트:

- `bun run dev:client`: Vite 프론트엔드 개발 서버
- `bun run dev:server`: Bun 서버 watch 모드
- `bun run build`: React 프론트엔드 빌드 후 `dist/` 생성
- `bun start`: Bun 런타임으로 APM 서버 실행

기본 Bun 경로는 `$HOME/.bun/bin/bun` 으로 가정합니다.
다른 위치에 설치했다면 `BUN_BIN=/path/to/bun bun start` 형태로 실행할 수 있습니다.

Node 호환 스크립트:

- `npm run start:node`
- `npm run dev:server:node`

## apm-agent 연동

`gcgf-untact` 애플리케이션 설정에서 다음처럼 맞추면 됩니다.

```properties
apm.agent.enabled=true
apm.agent.server-url=http://localhost:9900
apm.agent.app-name=gcgf-untact
apm.agent.api-key=
```

`APM_API_KEY` 를 서버에 설정했다면, 같은 값을 `apm.agent.api-key` 에 넣어야 합니다.

## 확인 포인트

1. 대시보드: `http://localhost:9900`
2. 헬스 체크: `http://localhost:9900/health`
3. 저장 파일: `/Users/migmig/IdeaProjects/apm-project-node/data`

## 저장 형식

수신한 payload는 날짜별 JSONL 파일로 저장됩니다.

- `register-YYYY-MM-DD.jsonl`
- `metrics-YYYY-MM-DD.jsonl`
- `traces-YYYY-MM-DD.jsonl`

각 줄은 다음 구조입니다.

```json
{
  "receivedAt": 1741234567890,
  "count": 3,
  "data": []
}
```

## 현재 대시보드 표시 항목

- `Dashboard` 탭: 앱 요약, 최근 trace, 주요 지표 차트
- `APIs` 탭: URI 목록과 API 상세 화면
- `SQL` 탭: SQL 문장 기준 검색과 SQL 상세 화면
- `Traces` 탭: traceId, URI, duration 기준 검색과 trace 상세 화면

## 한계

- 현재 저장소는 파일 기반 JSONL 입니다.
- 서버가 UI를 서빙하려면 먼저 `bun run build` 로 `dist/`를 생성해야 합니다.
- 재시작 후 대시보드는 과거 파일을 재적재하지 않고 새로 들어오는 데이터부터 집계합니다.
- 인증은 단일 API 키 헤더 검증만 제공합니다.
