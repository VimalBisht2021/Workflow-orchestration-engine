import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Warm-up
    { duration: '2m', target: 50 },   // Measurement
    { duration: '30s', target: 0 },   // Cool-down
  ],
};

export default function () {
  // Simulates creating a workflow that is A -> B -> C -> D
  // Instead of dispatching single tasks, we send the full topology to WOE
  const url = 'http://localhost:3001/api/workflows/dispatch'; 
  
  const body = JSON.stringify({
    workflowId: `linear-wf-${__ITER}`,
    topology: 'LINEAR',
    steps: ['A', 'B', 'C', 'D']
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, body, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
  });
}
