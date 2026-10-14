import fetch from 'node-fetch';
import assert from 'node:assert';

const TEAM_C_URL = 'http://localhost:3003/api/v1';
const TEAM_A_URL = 'http://localhost:3001/api/v1';
const TEAM_B_URL = 'http://localhost:3002/api/v1';
const BFF_URL = 'http://localhost:3004/api/v1';

async function runE2ETests() {
  let studentId = `test_student_${Date.now()}`;
  let driveId = `test_drive_${Date.now()}`;
  const correlationId = `e2e_${Date.now()}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId
  };

  console.log('Step 1: Student registers in portal (Team C)');
    // We register directly in Team C for setup
    const student = {
      student_id: studentId,
      name: 'E2E Test Student',
      email: 'e2e@example.com',
      branch: 'CS',
      batch: 2024,
      cgpa: 9.0,
      backlogs: 0,
      attendance: 95,
      '10th_marks': 95,
      '12th_marks': 92,
      skill_tags: ['REACT', 'NODEJS', 'TYPESCRIPT'],
      project_score: 85,
      has_active_offer: false
    };

    let res = await fetch(`${TEAM_C_URL}/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(student)
    });
    
    if (res.status !== 201) {
      console.log('Error:', await res.text());
    }
    assert.strictEqual(res.status, 201);
    const bodyC1: any = await res.json();
    studentId = bodyC1.data.student_id;
    console.log('Step 1 complete, studentId:', studentId);

  console.log('Step 2: Admin creates a Drive (Team C)');
    const drive = {
      drive_id: driveId,
      company: 'E2E Corp',
      role: 'Full Stack Engineer',
      package: '15 LPA',
      seats: 5,
      criteria: {
        min_cgpa: 8.0,
        min_attendance: 90,
        max_backlogs: 0,
        allowed_branches: ['CS', 'IT'],
        required_skill_tags: ['NODEJS']
      },
      skill_weightage: {
        NODEJS: 1.0,
        REACT: 0.8
      },
      state: 'OPEN'
    };

    res = await fetch(`${TEAM_C_URL}/drives`, {
      method: 'POST',
      headers,
      body: JSON.stringify(drive)
    });
    
    if (res.status !== 201) {
      console.log('Error creating drive:', await res.text());
    }
    assert.strictEqual(res.status, 201);
    const bodyC2: any = await res.json();
    driveId = bodyC2.data.drive_id;
    console.log('Step 2 complete, driveId:', driveId);

  console.log('Step 3: Student applies to the Drive (Team A Eligibility)');
    // Wait for Team B to sync (10 seconds or trigger manually)
    // Team B fetches from Team C every 10s. For e2e, we'll wait 12 seconds.
    await new Promise(resolve => setTimeout(resolve, 12000));

    const reqBody1 = {
      request_id: `req_${Date.now()}`,
      application_id: `app_${Date.now()}`,
      student_id: studentId,
      drive_id: driveId,
      rule_set_version: 'v1.0.0',
      priority: 'NORMAL',
      trigger_source: 'STUDENT_PORTAL',
      context: { bypass_active_offer_rule: false }
    };

    res = await fetch(`${TEAM_A_URL}/eligibility/requests`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': `idem_${Date.now()}` },
      body: JSON.stringify(reqBody1)
    });
    
    if (res.status !== 202) {
      console.log('Error applying to drive:', await res.text());
    }
    assert.strictEqual(res.status, 202);
    console.log('Step 3 complete');

  console.log('Step 4: Compute Rankings (Team B)');
    // Ask Team B to compute the shortlist
    const reqBody2 = {
      driveId: driveId,
      topK: 10
    };

    res = await fetch(`${TEAM_B_URL}/rankings/compute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody2)
    });

    if (res.status !== 200) {
      console.log('Error computing rankings:', await res.text());
    }
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    
    // Student should be in the shortlist
    const found = body.data.shortlist.find((s: any) => s.student_id === studentId);
    assert.ok(found, 'Student should be in the shortlist');
    console.log('Step 4 complete');

  console.log('Step 5: Verify via BFF (Team D)');
    // Fetch rankings via Team D BFF
    res = await fetch(`${BFF_URL}/rankings/${driveId}?k=10`);
    assert.strictEqual(res.status, 200);
    const body2: any = await res.json();
    
    const found2 = body2.data.shortlist.find((s: any) => s.student_id === studentId);
    assert.ok(found2, 'Student should be in the shortlist via BFF');
    console.log('Step 5 complete');
    
    console.log('All E2E steps passed successfully!');
}

runE2ETests().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
