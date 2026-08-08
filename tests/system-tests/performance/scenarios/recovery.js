import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Warm-up
    { duration: '2m', target: 100 },  // Measurement
    { duration: '30s', target: 0 },   // Cool-down
  ],
};

export default function () {
  const url = 'http://localhost:3000/api/dispatch'; // DTP API
  
  // Send a task that is designed to trigger a worker crash (e.g. out of memory, or deliberate panic flag)
  const body = JSON.stringify({
    taskId: `recover-${__ITER}`,
    workflowId: `wf-recover`,
    type: 'POISON_PILL',
    payload: { crashWorker: true }
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
