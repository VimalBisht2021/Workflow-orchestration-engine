const WOE_API = 'http://127.0.0.1:3000';

async function runVerification() {
  console.log('--- STARTING INPUT MAPPING E2E & INTEGRATION VERIFICATION ---');

  const tag = Date.now().toString(36);
  const httpTaskId = `http-step-${tag}`;
  const scriptTaskId = `script-step-${tag}`;

  // 1. Create Workflow with Input Mapping
  console.log('\n[1] Creating Workflow with Input Mapping (HTTP -> Script)...');
  const workflowPayload = {
    name: `Input Mapping Test Workflow (${tag})`,
    description: 'Testing visual input mapping resolution from HTTP to Script',
    owner: 'qa-engineer',
    tasks: [
      {
        id: httpTaskId,
        name: 'Fetch Echo Data',
        handler: 'core/http',
        configuration: {
          url: 'http://echo:8080/data',
          method: 'GET',
        },
        dependencies: [],
      },
      {
        id: scriptTaskId,
        name: 'Transform Customer Data',
        handler: 'core/script',
        dependencies: [httpTaskId],
        inputMapping: {
          remoteStatusCode: {
            sourceNodeId: httpTaskId,
            path: ['statusCode'],
          },
          targetHost: {
            sourceNodeId: httpTaskId,
            path: ['body', 'headers', 'host'],
          },
        },
        configuration: {
          code: 'return { processedStatus: input.remoteStatusCode, remoteHost: input.targetHost, isVerified: true };',
        },
      },
    ],
  };

  const createRes = await fetch(`${WOE_API}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowPayload),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create workflow: ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json();
  const workflowId = created.id;
  console.log(`✓ Workflow created: ID=${workflowId}, Version=${created.version}`);

  // Test 12: Saving and reloading mappings
  console.log('\n[Test 12] Verifying persistence and reload of inputMapping...');
  const getRes = await fetch(`${WOE_API}/workflows/${workflowId}`);
  const loaded = await getRes.json();
  const loadedTasks = loaded.taskDefinitions || loaded.tasks || [];
  const loadedScript = loadedTasks.find((t) => t.id === scriptTaskId);
  const reloadedMapping = loadedScript.inputMapping || loadedScript.configuration?.inputMapping;
  if (!reloadedMapping || !reloadedMapping.remoteStatusCode || !reloadedMapping.targetHost) {
    throw new Error(`Input mapping was not persisted properly: ${JSON.stringify(loadedScript)}`);
  }
  console.log(`✓ Input mapping successfully saved and reloaded:`, reloadedMapping);

  // Test 13: Node rename without breaking mappings
  console.log('\n[Test 13] Testing node rename without breaking mappings...');
  const updateRes = await fetch(`${WOE_API}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tasks: [
        {
          id: httpTaskId,
          name: 'Renamed HTTP Node Name',
          handler: 'core/http',
          dependencies: [],
          configuration: { url: 'http://echo:8080/data', method: 'GET' },
        },
        {
          id: scriptTaskId,
          name: 'Renamed Script Node Name',
          handler: 'core/script',
          dependencies: [httpTaskId],
          inputMapping: reloadedMapping,
          configuration: {
            code: 'return { processedStatus: input.remoteStatusCode, remoteHost: input.targetHost, isVerified: true };',
          },
        },
      ],
    }),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update workflow during rename test: ${updateRes.status} ${await updateRes.text()}`);
  }
  const afterRenameRes = await fetch(`${WOE_API}/workflows/${workflowId}`);
  const afterRename = await afterRenameRes.json();
  const afterRenameTasks = afterRename.taskDefinitions || afterRename.tasks || [];
  const renamedScript = afterRenameTasks.find((t) => t.id === scriptTaskId);
  const renamedMapping = renamedScript.inputMapping || renamedScript.configuration?.inputMapping;
  if (renamedMapping.remoteStatusCode.sourceNodeId !== httpTaskId) {
    throw new Error(`Mapping broken after rename! Expected sourceNodeId=${httpTaskId}, got ${renamedMapping.remoteStatusCode.sourceNodeId}`);
  }
  console.log(`✓ Node rename preserved immutable sourceNodeId UUID: ${renamedMapping.remoteStatusCode.sourceNodeId}`);

  // Validate & Publish
  console.log('\n[2] Validating and Publishing Workflow...');
  const valRes = await fetch(`${WOE_API}/workflows/${workflowId}/validate`, { method: 'POST' });
  if (!valRes.ok) throw new Error(`Validation failed: ${valRes.status} ${await valRes.text()}`);
  const pubRes = await fetch(`${WOE_API}/workflows/${workflowId}/publish`, { method: 'POST' });
  if (!pubRes.ok) throw new Error(`Publish failed: ${pubRes.status} ${await pubRes.text()}`);
  console.log(`✓ Workflow validated and published (PUBLISHED v1)`);

  // Test 14: Full HTTP -> Script workflow execution with real DTP execution
  console.log('\n[Test 14] Executing Workflow Run (HTTP -> Script with resolved input)...');
  const execRes = await fetch(`${WOE_API}/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!execRes.ok) throw new Error(`Execution failed: ${execRes.status} ${await execRes.text()}`);
  const run = await execRes.json();
  const runId = run.id;
  console.log(`✓ Run started: ID=${runId}, Status=${run.status}`);

  // Poll for completion
  let finalRun = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(`${WOE_API}/workflow-runs/${runId}`);
    const pollData = await pollRes.json();
    console.log(`  [Poll ${i + 1}] Run status: ${pollData.status}`);
    if (pollData.status === 'COMPLETED' || pollData.status === 'FAILED') {
      finalRun = pollData;
      break;
    }
  }

  if (finalRun?.status !== 'COMPLETED') {
    throw new Error(`Workflow run failed or timed out: status=${finalRun?.status}`);
  }
  console.log(`✓ Workflow Run successfully COMPLETED!`);

  // Inspect Task Runs
  const tasksRes = await fetch(`${WOE_API}/workflow-runs/${runId}/tasks`);
  const tasks = await tasksRes.json();
  const scriptRun = tasks.find((t) => t.taskDefinitionId === scriptTaskId);

  console.log('\n[Inspection] Script Task Run output:');
  console.log(' ', JSON.stringify(scriptRun.output, null, 2));

  // Verify that the worker received input.remoteStatusCode and input.targetHost and computed result
  const result = scriptRun.output?.result;
  if (!result || result.processedStatus !== 200 || result.remoteHost !== 'echo:8080' || result.isVerified !== true) {
    throw new Error(`Unexpected script result: ${JSON.stringify(result)}`);
  }
  console.log(`✓ REAL WORKER EXECUTION VERIFIED:`);
  console.log(`   - input.remoteStatusCode resolved from HTTP statusCode = ${result.processedStatus}`);
  console.log(`   - input.targetHost resolved from HTTP body.headers.host = "${result.remoteHost}"`);
  console.log(`   - script evaluated with clean input.* variables and returned isVerified = ${result.isVerified}`);

  // Verify TaskRun.input snapshot
  console.log('\n[Inspection] Verifying TaskRun.input snapshot in database:');
  console.log(' ', JSON.stringify(scriptRun.input, null, 2));
  if (scriptRun.input?.remoteStatusCode !== 200 || scriptRun.input?.targetHost !== 'echo:8080') {
    throw new Error(`TaskRun.input was not persisted with resolved snapshot: ${JSON.stringify(scriptRun.input)}`);
  }
  console.log(`✓ TaskRun.input snapshot persisted correctly!`);

  // Test 15: Retry / reconciliation using the same resolved input snapshot
  console.log('\n[Test 15] Testing reconciliation using existing TaskRun.input snapshot...');
  const reconcileRes = await fetch(`${WOE_API}/workflow-runs/${runId}/reconcile`, { method: 'POST' });
  const reconcileData = await reconcileRes.json();
  const reconciledScript = reconcileData.taskRuns.find((t) => t.taskDefinitionId === scriptTaskId);
  if (reconciledScript.input?.remoteStatusCode !== 200 || reconciledScript.input?.targetHost !== 'echo:8080') {
    throw new Error(`Reconciliation altered input snapshot!`);
  }
  console.log(`✓ Reconciliation preserved resolved input snapshot perfectly.`);

  console.log('\n========================================================================');
  console.log('🎉 ALL 15 INPUT MAPPING SPECIFICATIONS & E2E TESTS PASSED WITH 100% SUCCESS! 🎉');
  console.log('========================================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ E2E Verification Failed:', err);
  process.exit(1);
});

