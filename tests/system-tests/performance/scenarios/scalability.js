import http from 'k6/http';
import { check, sleep } from 'k6';

const payload = JSON.parse(open('../fixtures/small.json'));

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Warm-up
    { duration: '2m', target: 200 },  // Measurement
    { duration: '30s', target: 0 },   // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  // Simulates varying the number of workers externally while running the same load.
  // The test assumes a script orchestrating docker compose scale worker=X 
  // before triggering this benchmark.
  const url = 'http://localhost:3000/api/dispatch';
  
  const body = JSON.stringify({
    ...payload,
    taskId: `scale-${__ITER}`,
    workflowId: `wf-scale`
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, body, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
  });
  
  sleep(1);
}
