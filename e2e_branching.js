const fetch = globalThis.fetch;

async function main() {
  console.log('Publishing workflow...');
  
  const suffix = Date.now();
  const httpTaskId = `task-http-${suffix}`;
  const conditionTaskId = `task-cond-${suffix}`;
  const emailTaskId = `task-email-${suffix}`;
  const scriptTaskId = `task-script-${suffix}`;
  
  const workflowRes = await fetch('http://127.0.0.1:3000/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Branching & Handlers Test',
      owner: 'e2e-test',
      tasks: [
        {
          id: httpTaskId,
          name: 'Fetch Data',
          handler: 'core/http',
          dependencies: [],
          timeoutMs: 10000,
          maxRetries: 0,
          configuration: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/todos/1'
          }
        },
        {
          id: conditionTaskId,
          name: 'Check Status',
          handler: 'core/condition',
          dependencies: [httpTaskId],
          timeoutMs: 10000,
          maxRetries: 0,
          configuration: {
            expression: `upstreamOutputs['${httpTaskId}'].statusCode === 200`,
            routes: {
              conditional: {
                "true": emailTaskId,
                "false": scriptTaskId
              }
            }
          }
        },
        {
          id: emailTaskId,
          name: 'Send Success Email',
          handler: 'core/email',
          dependencies: [conditionTaskId, httpTaskId],
          timeoutMs: 10000,
          maxRetries: 0,
          configuration: {
            to: 'success@example.com',
            subject: 'HTTP Request Succeeded',
            body: 'The status code was 200!'
          }
        },
        {
          id: scriptTaskId,
          name: 'Handle Failure',
          handler: 'core/script',
          dependencies: [conditionTaskId, httpTaskId],
          timeoutMs: 10000,
          maxRetries: 0,
          configuration: {
            code: `console.log("Failed with status:", upstreamOutputs['${httpTaskId}'].statusCode); return false;`
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
  console.log('Validating...');
  const valRes = await fetch(`http://127.0.0.1:3000/workflows/${workflow.id}/validate`, { method: 'POST' });
  if (!valRes.ok) console.error('Failed to validate', await valRes.text());

  console.log('Publishing...');
  const pubRes = await fetch(`http://127.0.0.1:3000/workflows/${workflow.id}/publish`, { method: 'POST' });
  if (!pubRes.ok) console.error('Failed to publish', await pubRes.text());

  console.log('Starting workflow run...');
  const runRes = await fetch(`http://127.0.0.1:3000/workflows/${workflow.id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: {} })
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
    const statusRes = await fetch(`http://127.0.0.1:3000/workflow-runs/${run.id}`);
    const status = await statusRes.json();
    console.log(`Run status: ${status.status}`);
    
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      console.log('Workflow reached terminal state:', status.status);
      
      const tasksRes = await fetch(`http://127.0.0.1:3000/workflow-runs/${run.id}/tasks`);
      const tasks = await tasksRes.json();
      
      for (const t of tasks) {
        console.log(`\n--- Task: ${t.taskDefinitionId} (${t.status}) ---`);
        if (t.output) console.log('Output:', JSON.stringify(t.output, null, 2));
        if (t.error) console.log('Error:', t.error);
      }
      process.exit(status.status === 'COMPLETED' ? 0 : 1);
    }
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
  }
  console.error('Timeout waiting for workflow completion');
  process.exit(1);
}

main().catch(console.error);
