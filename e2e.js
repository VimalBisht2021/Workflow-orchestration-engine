const fetch = globalThis.fetch;
const http = require('http');

async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === '/anything' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Hello from local test server!' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const testUrl = `http://host.docker.internal:${port}/anything`;

  console.log(`Test server running on port ${port}. URL: ${testUrl}`);

  try {
    console.log('Publishing workflow...');
    const workflowRes = await fetch('http://localhost:3000/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Cross-Service HTTP Test',
        owner: 'e2e-test',
        tasks: [
          {
            id: `task-${Date.now()}`,
            name: 'Echo Test',
            handler: 'HTTP',
            dependencies: [],
            timeoutMs: 10000,
            maxRetries: 0,
            configuration: {
              method: 'GET',
              url: testUrl,
              headers: { 'x-test': 'hello-e2e' }
            }
          }
        ]
      })
    });
    
    if (!workflowRes.ok) {
      console.error('Failed to create workflow', await workflowRes.text());
      process.exit(1);
    }
    
    const workflow = await workflowRes.json();
    console.log('Workflow created:', workflow.id);

    console.log('Starting workflow run...');
    const runRes = await fetch(`http://localhost:3000/workflows/${workflow.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          method: 'GET',
          url: testUrl,
          headers: {
            'x-test': 'hello-e2e'
          }
        }
      })
    });
    
    if (!runRes.ok) {
      console.error('Failed to start run', await runRes.text());
      process.exit(1);
    }

    const run = await runRes.json();
    console.log('Run started:', run.id);
    
    // poll for completion
    let attempts = 0;
    while(attempts < 15) {
      const statusRes = await fetch(`http://localhost:3000/workflow-runs/${run.id}`);
      const status = await statusRes.json();
      console.log(`Run status: ${status.status}`);
      if (status.status === 'COMPLETED') {
        console.log('Workflow completed successfully!');
        console.log('Task output:', JSON.stringify(status.taskRuns[0].output, null, 2));
        server.close();
        process.exit(0);
      } else if (status.status === 'FAILED') {
        console.error('Workflow failed!');
        console.error('Task error:', status.taskRuns[0].error);
        server.close();
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
    }
    console.error('Timeout waiting for workflow completion');
    server.close();
    process.exit(1);
  } catch (err) {
    console.error(err);
    server.close();
    process.exit(1);
  }
}

main().catch(console.error);
