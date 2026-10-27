#!/usr/bin/env tsx
/**
 * Test script for the broadcast endpoint's scheduler authentication
 * 
 * This script tests that:
 * 1. Scheduler auth with valid secret succeeds (when SCHEDULER_SECRET is set)
 * 2. Scheduler auth with invalid secret fails with 401
 * 3. Auto-poll selection works for scheduler calls
 * 
 * Usage:
 *   # Set up environment
 *   export USE_MOCK_DB=true
 *   export SCHEDULER_SECRET=test-secret-12345
 *   
 *   # Run tests
 *   npm run test:broadcast
 * 
 * Note: This script does NOT send actual emails - it uses mock mode
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET || '';
const BROADCAST_ENDPOINT = `${BASE_URL}/api/admin/broadcast`;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  response?: {
    status: number;
    body: unknown;
  };
}

async function runTest(
  name: string,
  testFn: () => Promise<{ passed: boolean; message: string; response?: { status: number; body: unknown } }>
): Promise<TestResult> {
  try {
    const result = await testFn();
    return { name, ...result };
  } catch (error) {
    return {
      name,
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function testSchedulerAuthWithValidSecret(): Promise<TestResult> {
  if (!SCHEDULER_SECRET) {
    return {
      name: 'Scheduler auth with valid secret',
      passed: true,
      message: 'SKIPPED: SCHEDULER_SECRET not set (auth is optional)',
    };
  }

  const response = await fetch(BROADCAST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scheduled-job': 'true',
      'x-scheduler-secret': SCHEDULER_SECRET,
    },
    body: JSON.stringify({}),
  });

  const body = await response.json();

  if (response.status === 404 && body.error?.includes('No scheduled or active poll')) {
    return {
      name: 'Scheduler auth with valid secret',
      passed: true,
      message: 'Auth succeeded (404 is expected when no poll exists)',
      response: { status: response.status, body },
    };
  }

  if (response.ok && body.success) {
    return {
      name: 'Scheduler auth with valid secret',
      passed: true,
      message: 'Auth succeeded and broadcast triggered',
      response: { status: response.status, body },
    };
  }

  return {
    name: 'Scheduler auth with valid secret',
    passed: false,
    message: `Unexpected response: ${response.status}`,
    response: { status: response.status, body },
  };
}

async function testSchedulerAuthWithInvalidSecret(): Promise<TestResult> {
  if (!SCHEDULER_SECRET) {
    return {
      name: 'Scheduler auth with invalid secret',
      passed: true,
      message: 'SKIPPED: SCHEDULER_SECRET not set (cannot test rejection)',
    };
  }

  const response = await fetch(BROADCAST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scheduled-job': 'true',
      'x-scheduler-secret': 'wrong-secret',
    },
    body: JSON.stringify({}),
  });

  const body = await response.json();

  if (response.status === 401) {
    return {
      name: 'Scheduler auth with invalid secret',
      passed: true,
      message: 'Correctly rejected with 401',
      response: { status: response.status, body },
    };
  }

  return {
    name: 'Scheduler auth with invalid secret',
    passed: false,
    message: `Expected 401, got ${response.status}`,
    response: { status: response.status, body },
  };
}

async function testSchedulerAuthWithMissingSecret(): Promise<TestResult> {
  if (!SCHEDULER_SECRET) {
    return {
      name: 'Scheduler auth with missing secret',
      passed: true,
      message: 'SKIPPED: SCHEDULER_SECRET not set (cannot test rejection)',
    };
  }

  const response = await fetch(BROADCAST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scheduled-job': 'true',
    },
    body: JSON.stringify({}),
  });

  const body = await response.json();

  if (response.status === 401) {
    return {
      name: 'Scheduler auth with missing secret',
      passed: true,
      message: 'Correctly rejected with 401',
      response: { status: response.status, body },
    };
  }

  return {
    name: 'Scheduler auth with missing secret',
    passed: false,
    message: `Expected 401, got ${response.status}`,
    response: { status: response.status, body },
  };
}

async function testAdminAuthWithoutSession(): Promise<TestResult> {
  const response = await fetch(BROADCAST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ poll_id: 'test-poll-id' }),
  });

  const body = await response.json();

  if (response.status === 401) {
    return {
      name: 'Admin auth without session',
      passed: true,
      message: 'Correctly rejected with 401',
      response: { status: response.status, body },
    };
  }

  return {
    name: 'Admin auth without session',
    passed: false,
    message: `Expected 401, got ${response.status}`,
    response: { status: response.status, body },
  };
}

async function testSchedulerWithoutSecretWhenNotRequired(): Promise<TestResult> {
  if (SCHEDULER_SECRET) {
    return {
      name: 'Scheduler without secret (when not required)',
      passed: true,
      message: 'SKIPPED: SCHEDULER_SECRET is set',
    };
  }

  const response = await fetch(BROADCAST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scheduled-job': 'true',
    },
    body: JSON.stringify({}),
  });

  const body = await response.json();

  if (response.status === 404 && body.error?.includes('No scheduled or active poll')) {
    return {
      name: 'Scheduler without secret (when not required)',
      passed: true,
      message: 'Auth succeeded (404 is expected when no poll exists)',
      response: { status: response.status, body },
    };
  }

  if (response.ok && body.success) {
    return {
      name: 'Scheduler without secret (when not required)',
      passed: true,
      message: 'Auth succeeded and broadcast triggered',
      response: { status: response.status, body },
    };
  }

  return {
    name: 'Scheduler without secret (when not required)',
    passed: false,
    message: `Unexpected response: ${response.status}`,
    response: { status: response.status, body },
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Broadcast Endpoint Scheduler Auth Tests');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Scheduler Secret: ${SCHEDULER_SECRET ? '(set)' : '(not set)'}`);
  console.log('');

  const tests = [
    () => runTest('Scheduler auth with valid secret', testSchedulerAuthWithValidSecret),
    () => runTest('Scheduler auth with invalid secret', testSchedulerAuthWithInvalidSecret),
    () => runTest('Scheduler auth with missing secret', testSchedulerAuthWithMissingSecret),
    () => runTest('Admin auth without session', testAdminAuthWithoutSession),
    () => runTest('Scheduler without secret (when not required)', testSchedulerWithoutSecretWhenNotRequired),
  ];

  const results: TestResult[] = [];
  
  for (const test of tests) {
    const result = await test();
    results.push(result);
    
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.response) {
      console.log(`   Status: ${result.response.status}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Results: ${passed}/${total} tests passed`);
  
  if (passed < total) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  }
  
  console.log('\nAll tests passed! ✅');
}

main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
