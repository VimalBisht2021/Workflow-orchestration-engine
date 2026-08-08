import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Warm-up
    { duration: '3m', target: 200 },  // Measurement
    { duration: '30s', target: 0 },   // Cool-down
  ],
};

export default function () {
  // Simulates hammering the replay API to force lineague regeneration/fetching
  const url = `http://localhost:3001/api/workflows/wf-${Math.floor(Math.random() * 1000)}/replay`;
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, JSON.stringify({ fromTaskId: 'task-1' }), params);

  check(res, {
    'status is 202': (r) => r.status === 202, // Accepted for replay
  });
}
