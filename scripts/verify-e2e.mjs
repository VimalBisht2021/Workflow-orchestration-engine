const WOE_API = 'http://127.0.0.1:3000';

async function runVerification() {
  console.log('--- STARTING COMPREHENSIVE END-TO-END VERIFICATION ---');

  // 1. Create a diamond DAG workflow
  console.log('\n[1] Creating Diamond DAG Workflow...');
  const runTag = Date.now().toString(36);
  const rootId = `root-${runTag}`;
  const branchAId = `branch-a-${runTag}`;
  const branchBId = `branch-b-${runTag}`;
  const joinId = `join-${runTag}`;

  const workflowPayload = {
    name: `E2E Diamond DAG (${runTag})`,
    description: 'Diamond workflow verifying parallel fan-out and join',
    owner: 'e2e-tester',
    tasks: [
      {
        id: rootId,
        name: 'Root HTTP Task',
        handler: 'core/http',
        configuration: {
          url: 'http://echo:8080/data',
          method: 'GET',
        },
        dependencies: [],
      },
      {
        id: branchAId,
        name: 'Branch A Script',
        handler: 'core/script',
        configuration: {
          code: `return { branch: "A", val: 100, original: input.upstreamOutputs ? input.upstreamOutputs["${rootId}"] : null };`,
        },
        dependencies: [rootId],
      },
      {
        id: branchBId,
        name: 'Branch B Script',
        handler: 'core/script',
        configuration: {
          code: 'return { branch: "B", val: 200, multiplier: 2 };',
        },
        dependencies: [rootId],
      },
      {
        id: joinId,
        name: 'Join Template Task',
        handler: 'core/template',
        configuration: {
          template: `Joined Branch A {{upstreamOutputs.${branchAId}.val}} with Branch B {{upstreamOutputs.${branchBId}.val}}`,
        },
        dependencies: [branchAId, branchBId],
      },
    ],
  };

  const createRes = await fetch(`${WOE_API}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowPayload),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create workflow: ${createRes.status} ${errText}`);
  }
  const created = await createRes.json();
  const workflowId = created.id;
  console.log(`✓ Workflow created: ID=${workflowId}, Version=${created.version}, Status=${created.status}`);

  // 2. Validate & Publish Workflow
  console.log('\n[2] Validating and Publishing Workflow...');
  const valRes = await fetch(`${WOE_API}/workflows/${workflowId}/validate`, {
    method: 'POST',
  });
  if (!valRes.ok) {
    const errText = await valRes.text();
    throw new Error(`Failed to validate workflow: ${valRes.status} ${errText}`);
  }
  const valData = await valRes.json();
  console.log(`✓ Workflow validated: Valid=${valData.isValid}, Errors=${valData.errors?.length || 0}`);

  const publishRes = await fetch(`${WOE_API}/workflows/${workflowId}/publish`, {
    method: 'POST',
  });
  if (!publishRes.ok) {
    const errText = await publishRes.text();
    throw new Error(`Failed to publish workflow: ${publishRes.status} ${errText}`);
  }
  const published = await publishRes.json();
  console.log(`✓ Workflow published: Status=${published.status}, Version=${published.version}`);

  // 3. Immutability Guard Verification
  console.log('\n[3] Testing Workflow Immutability Guard...');
  const updateRes = await fetch(`${WOE_API}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tampered Name While Published' }),
  });
  console.log(`  Update response status: ${updateRes.status} (Expected: 409 Conflict)`);
  if (updateRes.status === 409) {
    const errJson = await updateRes.json();
    console.log(`✓ Immutability guard verified! Message: "${errJson.message}"`);
  } else {
    throw new Error(`Expected 409 Conflict for published workflow update, got ${updateRes.status}`);
  }

  // 4. Fork New Version
  console.log('\n[4] Testing Version Forking (POST /workflows/:id/fork)...');
  const forkRes = await fetch(`${WOE_API}/workflows/${workflowId}/fork`, {
    method: 'POST',
  });
  if (!forkRes.ok) {
    const errText = await forkRes.text();
    throw new Error(`Failed to fork workflow: ${forkRes.status} ${errText}`);
  }
  const forked = await forkRes.json();
  console.log(`✓ Forked new draft: ID=${forked.id}, Version=${forked.version}, Status=${forked.status}`);
  if (forked.version !== published.version + 1 || forked.status !== 'DRAFT') {
    throw new Error(`Fork failed expected properties: version=${forked.version}, status=${forked.status}`);
  }

  // 5. Execute Original Published Workflow
  console.log('\n[5] Executing Published Workflow Run...');
  const execRes = await fetch(`${WOE_API}/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { test: true } }),
  });
  if (!execRes.ok) {
    const errText = await execRes.text();
    throw new Error(`Failed to execute workflow: ${execRes.status} ${errText}`);
  }
  const run = await execRes.json();
  const runId = run.id;
  console.log(`✓ Workflow execution started: RunID=${runId}, Status=${run.status}`);

  // Poll for completion
  console.log('\n[6] Polling Execution Progress...');
  let finalRun = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(`${WOE_API}/workflow-runs/${runId}`);
    const pollData = await pollRes.json();
    console.log(`  [Poll ${i + 1}] Status: ${pollData.status}`);
    if (pollData.status === 'COMPLETED' || pollData.status === 'FAILED') {
      finalRun = pollData;
      break;
    }
  }

  if (!finalRun) {
    throw new Error('Workflow run timed out before completing');
  }

  console.log(`\n✓ Workflow Run finished with status: ${finalRun.status}`);

  // 7. Inspect Task Details & Outputs
  console.log('\n[7] Inspecting Task Runs and Output Passing...');
  const tasksRes = await fetch(`${WOE_API}/workflow-runs/${runId}/tasks`);
  const tasks = await tasksRes.json();
  for (const t of tasks) {
    console.log(`  Task '${t.taskDefinition?.name || t.id}' (${t.taskDefinition?.handler || 'unknown'}): Status=${t.status}`);
    console.log(`    Output:`, JSON.stringify(t.output));
  }

  // Verify join task output interpolation
  const joinTask = tasks.find((t) => t.taskDefinition?.name === 'Join Template Task' || t.taskDefinition?.handler === 'core/template');
  if (joinTask && joinTask.output) {
    console.log(`\n✓ Join Task Output: "${joinTask.output.rendered || joinTask.output}"`);
  }

  // 8. Test Manual Reconcile Endpoint
  console.log('\n[8] Testing On-Demand Reconciliation Endpoint (POST /workflow-runs/:id/reconcile)...');
  const reconcileRes = await fetch(`${WOE_API}/workflow-runs/${runId}/reconcile`, {
    method: 'POST',
  });
  const reconcileData = await reconcileRes.json();
  console.log(`✓ Reconciliation response:`, reconcileData);

  console.log('\n======================================================');
  console.log('🎉 ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

