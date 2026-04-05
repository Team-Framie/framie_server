# Framie Server

Framie 백엔드 API 서버. NestJS 10 + TypeScript, Supabase(Auth / DB / Storage)와 연동.

---

## 주요 기능

- **인증** — Supabase Auth 기반 이메일·비밀번호 회원가입/로그인, JWT 발급 및 검증
- **프레임** — 2컷/3컷/4컷 등 프레임 목록·상세 조회
- **촬영 세션** — 누끼 처리된 컷과 최종 이미지를 Supabase Storage에 업로드, 세션 레코드 저장, 공유 코드 발급
- **공유 코드** — 코드로 세션 조회 (다른 사용자가 프레임 위에 합성 촬영할 수 있도록)
- **이미지 처리 프록시** — `framie_image_server`로 배경 제거 요청 전달
- **이미지 업로드 프록시** — 프론트엔드 → NestJS → Supabase Storage 업로드 중계
- **마이페이지 데이터** — 사용자 통계, 최근 세션 조회

---

## 기술 스택

| 분류 | 사용 기술 |
|------|----------|
| Framework | NestJS 10 |
| Language | TypeScript 5.6 |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` |
| Backend-as-a-Service | Supabase (`@supabase/supabase-js`) |
| Validation | `class-validator`, `class-transformer` |
| File Upload | `multer` |
| HTTP Client | `axios` (이미지 서버 호출) |

---

## 시작하기

### 사전 요구사항
- Node.js 20+
- Supabase 프로젝트 (URL / anon key / 테이블 · 스토리지 버킷 준비)
- `framie_image_server`가 실행 중이거나 원격 주소

### 설치 & 실행

```bash
npm install
cp .env.example .env     # 실제 값으로 채워주세요
npm run start:dev        # 개발 (watch)
# 또는
npm run build && npm run start:prod
```

서버는 기본적으로 `http://localhost:3000/api/v1`에서 동작하며, 모든 엔드포인트에 전역 prefix `/api/v1`이 적용되어 있고 CORS가 열려 있습니다.

---

## 환경 변수

`.env` 파일을 생성하고 아래 값을 채워주세요.

| 키 | 설명 | 예시 |
|----|------|------|
| `PORT` | 서버 포트 | `3000` |
| `SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon 키 | `eyJhbGci...` |
| `IMAGE_SERVER_URL` | `framie_image_server` 베이스 URL | `http://localhost:8001` |

---

## API 엔드포인트

모든 경로의 prefix는 `/api/v1` 입니다.

### 인증 (`/auth`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/signup` | 이메일·비밀번호 회원가입 |
| POST | `/auth/login` | 로그인, `access_token`/`refresh_token` 발급 |
| GET  | `/auth/me` | 현재 로그인 사용자 정보 (JWT 필요) |

### 프레임 (`/frames`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/frames` | 프레임 목록 (`?shot_count=`, `?title=`) |
| GET | `/frames/:id` | 프레임 상세 |

### 이미지 (`/images`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/images/remove-bg` | multipart `image` 업로드 → 이미지 서버로 프록시, 누끼 PNG 반환 |
| POST | `/images/upload` | multipart `file`/`bucket`/`path` → Supabase Storage 업로드 |

### 세션 (`/sessions`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/sessions` | 촬영 세션 저장, 공유 코드 발급 |
| GET  | `/sessions` | 페이지네이션 목록 (`?page=&limit=`) |
| GET  | `/sessions/:id` | 세션 상세 |

### 공유 (`/share`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/share/:code` | 공유 코드로 세션 조회 (커스텀 프레임 촬영에서 사용) |

### 사용자 (`/users`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/users/me/stats` | 저장 세션 수, 총 사진 수 |
| GET | `/users/me/sessions` | 최근 세션 목록 (`?limit=`) |

---

## 폴더 구조

```
framie_server/
├── src/
│   ├── main.ts              # 부트스트랩, CORS, ValidationPipe, prefix 설정
│   ├── app.module.ts        # 전역 모듈 구성
│   ├── common/
│   │   └── supabase/        # Supabase 클라이언트 모듈
│   ├── auth/                # 회원가입·로그인·JWT 전략
│   ├── frames/              # 프레임 조회
│   ├── images/              # 배경 제거 프록시, 업로드
│   ├── sessions/            # 세션 저장/조회, 공유 코드 발급
│   ├── share/               # 코드로 세션 조회
│   └── users/               # 마이페이지용 집계
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## 데이터베이스

Supabase의 주요 테이블(스키마는 프로젝트 Supabase 대시보드 참고):

- `users` — Supabase Auth와 연동된 사용자 프로필
- `frames` — 프레임 템플릿 (`shot_count`, `title`)
- `photo_sessions` — 촬영 세션 (`frame_id`, `photographer_id`, `frame_owner_id`, `source_type`, `result_image_path`, `result_thumbnail_path`, ...)
- `session_photos` — 세션의 개별 컷 (`session_id`, `shot_order`, `original_path`, `processed_path`)
- `share_codes` — 세션 공유 코드

`photo_sessions.source_type`은 `own_frame` / `other_frame` 열거형이며, `photographer_id`와 `frame_owner_id`의 일치 여부에 대한 CHECK 제약이 있습니다.

---

## 실행 스크립트

| 명령 | 설명 |
|------|------|
| `npm run start:dev` | watch 모드 개발 실행 |
| `npm run start` | 일반 실행 |
| `npm run build` | NestJS 빌드 (`dist/`) |
| `npm run start:prod` | 빌드 결과 실행 |
