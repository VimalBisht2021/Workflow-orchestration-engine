import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    webhook_spam: {
      executor: 'constant-arrival-rate',
      rate: 500, // 500 webhooks per second
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<50'], // webhooks should be instantly acknowledged
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const url = 'http://localhost:3001/api/webhooks/dtp'; // Assuming WOE webhook endpoint
  
  const body = JSON.stringify({
    jobId: `job-${__ITER}`,
    status: 'COMPLETED',
    result: { success: true }
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, body, params);

  check(res, {
    'status is 200/202': (r) => r.status === 200 || r.status === 202,
  });
}
