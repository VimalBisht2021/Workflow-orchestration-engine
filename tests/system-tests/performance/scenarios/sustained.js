import http from 'k6/http';
import { check, sleep } from 'k6';

const payload = JSON.parse(open('../fixtures/medium.json'));

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '30m', // Sustain for 30 minutes to check memory leaks
      preAllocatedVUs: 100,
      maxVUs: 1000,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<100'], 
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const url = 'http://localhost:3000/api/dispatch';
  
  const body = JSON.stringify({
    ...payload,
    taskId: `sustained-${__ITER}`,
    workflowId: `wf-sustained`
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, body, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
  });
}
