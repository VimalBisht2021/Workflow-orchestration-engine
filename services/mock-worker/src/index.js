const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
console.log('Starting Mock DTP Worker...');

app.post('/api/jobs', (req, res) => {
  const job = req.body;
  console.log(`[Mock DTP] Received job for TaskRun ${job.payload?.taskRunId}`);
  
  res.status(201).json({ id: 'mock-job-' + Date.now() });

  // Simulate execution and callback
  setTimeout(() => {
    const callbackUrl = job.callback?.url;
    if (callbackUrl) {
      console.log(`[Mock DTP] Executing task and sending callback to ${callbackUrl}`);
      fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'TaskRunCompleted',
          payload: {
            taskRunId: job.payload?.taskRunId,
            workflowRunId: job.payload?.workflowRunId,
            status: 'COMPLETED',
            output: { result: 'Mock execution success' },
            error: null,
            completedAt: new Date().toISOString()
          }
        })
      }).catch(err => console.error(`[Mock DTP] Callback failed: ${err.message}`));
    }
  }, 1500); // 1.5 seconds mock duration
});

app.listen(PORT, () => {
  console.log(`Mock DTP listening on port ${PORT}`);
});
