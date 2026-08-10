const fetch = globalThis.fetch;

async function main() {
  console.log('Publishing workflow...');
  const workflowRes = await fetch('http://localhost:3000/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Cross-Service HTTP Test',
      owner: 'e2e-test',
      tasks: [
        {
          id: 'task-1',
          name: 'Echo Test',
          handler: 'http', // Assuming 'http' is a registered handler that uses DTP
          dependencies: [],
          timeoutMs: 10000,
          retries: 0,
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
  const runRes = await fetch(`http://localhost:3000/api/workflows/${workflow.id}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        method: 'GET',
        url: 'https://httpbin.org/get',
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
    const statusRes = await fetch(`http://localhost:3000/api/workflow-runs/${run.id}`);
    const status = await statusRes.json();
    console.log(`Run status: ${status.status}`);
    if (status.status === 'COMPLETED') {
      console.log('Workflow completed successfully!');
      console.log('Task output:', JSON.stringify(status.taskRuns[0].output, null, 2));
      process.exit(0);
    } else if (status.status === 'FAILED') {
      console.error('Workflow failed!');
      console.error('Task error:', status.taskRuns[0].error);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
  }
  console.error('Timeout waiting for workflow completion');
  process.exit(1);
}

main().catch(console.error);
