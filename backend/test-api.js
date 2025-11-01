/**
 * 백엔드 API 테스트 스크립트
 * 사용법: node test-api.js
 * 
 * 서버가 실행 중이어야 합니다 (npm run dev)
 */

const BASE_URL = 'http://localhost:5000/api';

// 테스트 결과 저장
let testResults = [];
let authToken = null;
let adminToken = null;
let studentToken = null;
let classroomId = null;
let reservationId = null;

// 유틸리티 함수
async function request(method, endpoint, data = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return { status: response.status, data: result };
  } catch (error) {
    return { status: 0, data: { error: error.message } };
  }
}

// 테스트 헬퍼
function test(name, testFn) {
  testResults.push({ name, status: 'running' });
  return async () => {
    try {
      await testFn();
      testResults[testResults.length - 1].status = 'passed';
      console.log(`✅ ${name}`);
    } catch (error) {
      testResults[testResults.length - 1].status = 'failed';
      testResults[testResults.length - 1].error = error.message;
      console.log(`❌ ${name}: ${error.message}`);
    }
  };
}

// ========== 테스트 시작 ==========

async function runTests() {
  console.log('🚀 API 테스트 시작...\n');
  
  // 1. Health Check
  await test('Health Check', async () => {
    // Health check는 /api가 아닌 루트에 있습니다
    const response = await fetch('http://localhost:5000/health');
    if (!response.ok) throw new Error('Health check failed');
    const data = await response.json();
    if (!data.status || data.status !== 'ok') throw new Error('Invalid health check response');
  })();
  
  // 2. 회원가입 (학생)
  await test('회원가입 - 학생', async () => {
    const result = await request('POST', '/auth/register', {
      student_id: '2024001',
      password: 'password123',
      name: '홍길동',
      role: 'student'
    });
    if (result.status !== 201 && result.status !== 400) {
      throw new Error(`Expected 201 or 400, got ${result.status}`);
    }
    if (result.status === 201 && result.data.token) {
      studentToken = result.data.token;
    }
  })();
  
  // 3. 회원가입 (관리자)
  await test('회원가입 - 관리자', async () => {
    const result = await request('POST', '/auth/register', {
      student_id: 'admin001',
      password: 'admin123',
      name: '관리자',
      role: 'admin'
    });
    if (result.status !== 201 && result.status !== 400) {
      throw new Error(`Expected 201 or 400, got ${result.status}`);
    }
    if (result.status === 201 && result.data.token) {
      adminToken = result.data.token;
    }
  })();
  
  // 4. 로그인 (학생)
  await test('로그인 - 학생', async () => {
    const result = await request('POST', '/auth/login', {
      student_id: '2024001',
      password: 'password123'
    });
    if (result.status !== 200) throw new Error('Login failed');
    if (!result.data.token) throw new Error('Token not received');
    studentToken = result.data.token;
    console.log(`   학생 토큰: ${studentToken.substring(0, 20)}...`);
  })();
  
  // 5. 로그인 (관리자)
  await test('로그인 - 관리자', async () => {
    const result = await request('POST', '/auth/login', {
      student_id: 'admin001',
      password: 'admin123'
    });
    if (result.status !== 200) throw new Error('Admin login failed');
    if (!result.data.token) throw new Error('Token not received');
    adminToken = result.data.token;
    console.log(`   관리자 토큰: ${adminToken.substring(0, 20)}...`);
  })();
  
  if (!adminToken) {
    console.log('\n⚠️  관리자 토큰이 없어 일부 테스트를 건너뜁니다.');
    console.log('   기본 관리자 계정을 사용하거나 관리자 계정을 생성하세요.\n');
    return;
  }
  
  // 6. 강의실 생성 (관리자)
  await test('강의실 생성', async () => {
    const result = await request('POST', '/classrooms', {
      name: '101호',
      location: '1층',
      capacity: 30,
      has_projector: true,
      has_whiteboard: true
    }, adminToken);
    if (result.status !== 201) throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    if (!result.data.classroom || !result.data.classroom.id) throw new Error('Classroom ID not received');
    classroomId = result.data.classroom.id;
    console.log(`   강의실 ID: ${classroomId}`);
  })();
  
  // 7. 강의실 목록 조회
  await test('강의실 목록 조회', async () => {
    const result = await request('GET', '/classrooms', null, studentToken);
    if (result.status !== 200) throw new Error('Failed to get classrooms');
    if (!result.data.classrooms || !Array.isArray(result.data.classrooms)) {
      throw new Error('Invalid response format: expected { classrooms: [...] }');
    }
    console.log(`   강의실 개수: ${result.data.classrooms.length}`);
  })();
  
  // 8. 강의실 상세 조회
  await test('강의실 상세 조회', async () => {
    if (!classroomId) throw new Error('No classroom ID');
    const result = await request('GET', `/classrooms/${classroomId}`, null, studentToken);
    if (result.status !== 200) throw new Error('Failed to get classroom');
  })();
  
  // 9. 예약 가능한 강의실 조회
  await test('예약 가능한 강의실 조회', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후
    
    // API는 date, startTime, endTime 형식을 요구합니다
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const startTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const endTime = later.toTimeString().split(' ')[0]; // HH:MM:SS
    
    const result = await request('GET', 
      `/classrooms/available?date=${date}&startTime=${startTime}&endTime=${endTime}`,
      null, 
      studentToken
    );
    if (result.status !== 200) throw new Error('Failed to get available classrooms');
  })();
  
  // 10. 예약 생성
  await test('예약 생성', async () => {
    if (!classroomId) throw new Error('No classroom ID');
    
    // 예약 시간: 다음 정시부터 1시간 (예: 10:00-11:00)
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(now.getHours() + 1, 0, 0, 0); // 다음 정시
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // 1시간 후
    
    const result = await request('POST', '/reservations', {
      classroom_id: classroomId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    }, studentToken);
    
    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }
    if (!result.data.reservation || !result.data.reservation.id) {
      throw new Error('Reservation ID not received');
    }
    reservationId = result.data.reservation.id;
    console.log(`   예약 ID: ${reservationId}`);
  })();
  
  // 11. 내 예약 목록 조회
  await test('내 예약 목록 조회', async () => {
    const result = await request('GET', '/reservations/my', null, studentToken);
    if (result.status !== 200) throw new Error('Failed to get my reservations');
    if (!result.data.reservations || !Array.isArray(result.data.reservations)) {
      throw new Error('Invalid response format: expected { reservations: [...] }');
    }
    console.log(`   예약 개수: ${result.data.reservations.length}`);
  })();
  
  // 12. 알림 조회
  await test('알림 조회', async () => {
    const result = await request('GET', '/notifications', null, studentToken);
    if (result.status !== 200) throw new Error('Failed to get notifications');
    if (!result.data.notifications || !Array.isArray(result.data.notifications)) {
      throw new Error('Invalid response format: expected { notifications: [...] }');
    }
  })();
  
  // 13. 대기열 생성
  await test('대기열 생성', async () => {
    if (!classroomId) throw new Error('No classroom ID');
    
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 3);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2);
    
    const result = await request('POST', '/waitlist', {
      classroom_id: classroomId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    }, studentToken);
    
    // 예약이 있으면 대기열이 생성되거나 이미 예약되어 있음을 의미
    if (result.status !== 201 && result.status !== 400) {
      throw new Error(`Expected 201 or 400, got ${result.status}`);
    }
  })();
  
  // 14. 내 대기열 조회
  await test('내 대기열 조회', async () => {
    const result = await request('GET', '/waitlist/my', null, studentToken);
    if (result.status !== 200) throw new Error('Failed to get my waitlist');
    if (!result.data.waitlist || !Array.isArray(result.data.waitlist)) {
      throw new Error('Invalid response format: expected { waitlist: [...] }');
    }
  })();
  
  // 15. 예약 취소
  if (reservationId) {
    await test('예약 취소', async () => {
      const result = await request('DELETE', `/reservations/${reservationId}`, null, studentToken);
      if (result.status !== 200) throw new Error('Failed to cancel reservation');
    })();
  }
  
  // 결과 출력
  console.log('\n📊 테스트 결과:');
  const passed = testResults.filter(t => t.status === 'passed').length;
  const failed = testResults.filter(t => t.status === 'failed').length;
  console.log(`✅ 통과: ${passed}`);
  console.log(`❌ 실패: ${failed}`);
  console.log(`📈 전체: ${testResults.length}`);
  
  if (failed > 0) {
    console.log('\n실패한 테스트:');
    testResults
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`  - ${t.name}: ${t.error}`);
      });
  }
}

// 스크립트 실행
if (typeof fetch === 'undefined') {
  console.error('❌ Node.js 18+ 버전이 필요합니다. fetch API를 사용합니다.');
  process.exit(1);
}

runTests().catch(console.error);

