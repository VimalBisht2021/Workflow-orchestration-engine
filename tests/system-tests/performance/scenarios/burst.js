import http from 'k6/http';
import { check } from 'k6';

const payload = JSON.parse(open('../fixtures/small.json'));

export const options = {
  scenarios: {
    burst: {
      executor: 'shared-iterations',
      vus: 1000,          // 1000 concurrent virtual users
      iterations: 5000,   // Fire exactly 5000 requests total
      maxDuration: '10s', // Must finish in 10s or fail
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // Tolerate < 1% failure on massive bursts
  },
};

export default function () {
  const url = 'http://localhost:3000/api/dispatch';
  
  const body = JSON.stringify({
    ...payload,
    taskId: `burst-${__VU}-${__ITER}`,
    workflowId: `wf-burst`
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
  };

  const res = http.post(url, body, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
  });
}
