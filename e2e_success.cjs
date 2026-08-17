const fetch = globalThis.fetch;
const http = require('http');

async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === '/test' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'DTP execution works!' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const testUrl = `http://host.docker.internal:${port}/test`;

  console.log(`[E2E] Mock server running on port ${port}. Target URL: ${testUrl}`);

  try {
    console.log('[E2E] Creating workflow...');
    
    const suffix = Date.now();
    const scriptTaskId = `task-script-${suffix}`;
    
    const workflowRes = await fetch('http://127.0.0.1:3000/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Success Test Workflow',
        description: 'Testing successful script execution in DTP',
        owner: 'e2e-test',
        tasks: [
          {
            id: scriptTaskId,
            name: 'Success Script Node',
            handler: 'core/script',
            dependencies: [],
            timeoutMs: 10000,
            maxRetries: 0,
            configuration: {
              code: `console.log("Running in DTP Sandbox!"); return { success: true, timestamp: Date.now() };`
            }
          }
        ]
      })
    });
    
    if (!workflowRes.ok) {
      console.error('[E2E] Failed to create workflow:', await workflowRes.text());
      process.exit(1);
    }
    
    const workflow = await workflowRes.json();
    console.log(`[E2E] Workflow created with ID: ${workflow.id}`);

    console.log('[E2E] Validating workflow...');
    const valRes = await fetch(`http://127.0.0.1:3000/workflows/${workflow.id}/validate`, { method: 'POST' });
    if (!valRes.ok) console.error('[E2E] Failed to validate:', await valRes.text());

    console.log('[E2E] Publishing workflow...');
    const pubRes = await fetch(`http://127.0.0.1:3000/workflows/${workflow.id}/publish`, { method: 'POST' });
    if (!pubRes.ok) console.error('[E2E] Failed to publish:', await pubRes.text());

    console.log('[E2E] Starting workflow execution...');
    const runRes = await fetch(`http://127.0.0.1:3000/workflows/${workflow.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} })
    });
    
    if (!runRes.ok) {
      console.error('[E2E] Failed to start run:', await runRes.text());
      process.exit(1);
    }

    const run = await runRes.json();
    console.log(`[E2E] Execution started! Run ID: ${run.id}`);
    
    // Poll for completion
    let attempts = 0;
    while (attempts < 15) {
      const statusRes = await fetch(`http://127.0.0.1:3000/workflow-runs/${run.id}`);
      const status = await statusRes.json();
      console.log(`[E2E] Run status: ${status.status}`);
      
      if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        console.log(`\n[E2E] ✅ Workflow reached terminal state: ${status.status}`);
        
        const tasksRes = await fetch(`http://127.0.0.1:3000/workflow-runs/${run.id}/tasks`);
        const tasks = await tasksRes.json();
        
        for (const t of tasks) {
          console.log(`\n--- Task: ${t.taskDefinitionId} (${t.status}) ---`);
          if (t.output) console.log('Output:', JSON.stringify(t.output, null, 2));
          if (t.error) console.log('Error:', t.error);
        }
        
        server.close();
        
        if (status.status === 'COMPLETED') {
          console.log('\n[E2E] 🎉 Test Passed! Workflow was successfully executed by DTP.');
          process.exit(0);
        } else {
          console.error('\n[E2E] ❌ Test Failed! Workflow did not complete successfully.');
          process.exit(1);
        }
      }
      
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
    }
    
    console.error('\n[E2E] ❌ Timeout waiting for workflow completion.');
    server.close();
    process.exit(1);
  } catch (err) {
    console.error('\n[E2E] ❌ Error occurred:', err);
    server.close();
    process.exit(1);
  }
}

main().catch(console.error);
