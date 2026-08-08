import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load payload fixture
const payload = new SharedArray('small payload', function () {
  return [JSON.parse(open('../fixtures/small.json'))];
});

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Warm-up
    { duration: '3m', target: 100 },  // Measurement
    { duration: '30s', target: 0 },   // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of requests must complete below 100ms
    http_req_failed: ['rate<0.001'],  // Error rate must be < 0.1%
  },
};

export default function () {
  const url = 'http://localhost:3000/api/dispatch'; // Adjust to actual DTP API URL
  
  const body = JSON.stringify({
    ...payload[0],
    taskId: `task-${__VU}-${__ITER}`,
    workflowId: `wf-${__VU}`
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
    'has jobId': (r) => r.json().jobId !== undefined,
  });

  sleep(1);
}
