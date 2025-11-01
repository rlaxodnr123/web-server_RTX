# 백엔드 API 테스트 가이드

## 빠른 시작

### 1. 자동 테스트 스크립트 사용 (추천)

```bash
# 백엔드 디렉토리에서
cd backend
node test-api.js
```

이 스크립트는 모든 주요 API를 자동으로 테스트합니다.

### 2. 수동 테스트 방법

#### A. curl 명령어 사용

##### 인증 관련

```bash
# 회원가입 (학생)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "password": "password123",
    "name": "홍길동",
    "role": "student"
  }'

# 회원가입 (관리자)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "admin001",
    "password": "admin123",
    "name": "관리자",
    "role": "admin"
  }'

# 로그인 (토큰 저장)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "password": "password123"
  }'
```

**응답 예시:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "student_id": "2024001",
    "name": "홍길동",
    "role": "student"
  }
}
```

토큰을 변수에 저장:
```bash
TOKEN="your_token_here"
```

##### 강의실 관련

```bash
# 강의실 목록 조회 (인증 필요)
curl -X GET http://localhost:5000/api/classrooms \
  -H "Authorization: Bearer $TOKEN"

# 강의실 상세 조회
curl -X GET http://localhost:5000/api/classrooms/1 \
  -H "Authorization: Bearer $TOKEN"

# 예약 가능한 강의실 조회
curl -X GET "http://localhost:5000/api/classrooms/available?start_time=2024-01-15T10:00:00Z&end_time=2024-01-15T12:00:00Z" \
  -H "Authorization: Bearer $TOKEN"

# 강의실 생성 (관리자만)
curl -X POST http://localhost:5000/api/classrooms \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "101호",
    "location": "1층",
    "capacity": 30,
    "has_projector": true,
    "has_whiteboard": true
  }'
```

##### 예약 관련

```bash
# 예약 생성
curl -X POST http://localhost:5000/api/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classroom_id": 1,
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T12:00:00Z"
  }'

# 내 예약 목록 조회
curl -X GET http://localhost:5000/api/reservations/my \
  -H "Authorization: Bearer $TOKEN"

# 강의실 타임라인 조회
curl -X GET http://localhost:5000/api/reservations/classroom/1 \
  -H "Authorization: Bearer $TOKEN"

# 예약 취소
curl -X DELETE http://localhost:5000/api/reservations/1 \
  -H "Authorization: Bearer $TOKEN"
```

##### 대기열 관련

```bash
# 대기열 추가
curl -X POST http://localhost:5000/api/waitlist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classroom_id": 1,
    "start_time": "2024-01-15T14:00:00Z",
    "end_time": "2024-01-15T16:00:00Z"
  }'

# 내 대기열 조회
curl -X GET http://localhost:5000/api/waitlist/my \
  -H "Authorization: Bearer $TOKEN"
```

##### 알림 관련

```bash
# 내 알림 조회
curl -X GET http://localhost:5000/api/notifications \
  -H "Authorization: Bearer $TOKEN"

# 알림 읽음 처리
curl -X PUT http://localhost:5000/api/notifications/1/read \
  -H "Authorization: Bearer $TOKEN"
```

##### 통계 관련 (관리자만)

```bash
# 인기 강의실 조회
curl -X GET http://localhost:5000/api/statistics/top-classrooms \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### B. Postman/Thunder Client 사용

1. **Postman** 또는 **VS Code Thunder Client** 확장 설치
2. 새 컬렉션 생성
3. 환경 변수 설정:
   - `base_url`: `http://localhost:5000/api`
   - `token`: (로그인 후 토큰)
   - `admin_token`: (관리자 로그인 후 토큰)

4. 요청 예시:
   - **Method**: POST
   - **URL**: `{{base_url}}/auth/login`
   - **Headers**: `Content-Type: application/json`
   - **Body** (JSON):
     ```json
     {
       "student_id": "2024001",
       "password": "password123"
     }
     ```

5. 응답에서 토큰을 복사해 환경 변수 `token`에 저장

## API 엔드포인트 목록

### 인증 (`/api/auth`)
- `POST /register` - 회원가입
- `POST /login` - 로그인
- `POST /logout` - 로그아웃

### 강의실 (`/api/classrooms`)
- `GET /` - 강의실 목록 (인증 필요)
- `GET /:id` - 강의실 상세 (인증 필요)
- `GET /available` - 예약 가능한 강의실 조회 (인증 필요)
- `POST /` - 강의실 생성 (관리자만)
- `PUT /:id` - 강의실 수정 (관리자만)
- `DELETE /:id` - 강의실 삭제 (관리자만)

### 예약 (`/api/reservations`)
- `POST /` - 예약 생성 (인증 필요)
- `GET /my` - 내 예약 목록 (인증 필요)
- `GET /classroom/:id` - 강의실 타임라인 (인증 필요)
- `DELETE /:id` - 예약 취소 (인증 필요)

### 대기열 (`/api/waitlist`)
- `POST /` - 대기열 추가 (인증 필요)
- `GET /my` - 내 대기열 목록 (인증 필요)

### 알림 (`/api/notifications`)
- `GET /` - 내 알림 목록 (인증 필요)
- `PUT /:id/read` - 알림 읽음 처리 (인증 필요)

### 통계 (`/api/statistics`)
- `GET /top-classrooms` - 인기 강의실 조회 (관리자만)

## 주의사항

1. **서버 실행 확인**: 테스트 전에 `npm run dev`로 서버가 실행 중인지 확인하세요.
2. **데이터베이스 연결**: `.env` 파일이 올바르게 설정되어 있는지 확인하세요.
3. **토큰 만료**: JWT 토큰은 24시간 후 만료됩니다. 만료되면 다시 로그인하세요.
4. **권한 확인**: 관리자 전용 API는 `role: 'admin'`인 사용자만 사용할 수 있습니다.

## 기본 관리자 계정

데이터베이스 초기화 시 기본 관리자 계정이 생성됩니다:
- **학번**: `admin`
- **비밀번호**: `admin123`

(이 정보는 `backend/src/config/init.ts`에서 확인할 수 있습니다)

