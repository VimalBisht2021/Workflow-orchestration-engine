const API_URL = 'http://127.0.0.1:3000';

async function main() {
  const workflowId = '4f55ba0d-7261-494e-a729-174c4612bf6b';
  console.log('[1] Forking published workflow to create draft v2...');
  const forkRes = await fetch(`${API_URL}/workflows/${workflowId}/fork`, { method: 'POST' });
  const forked = await forkRes.json();
  const draftId = forked.id;
  console.log(`✓ Forked into draft: ID=${draftId}, Version=${forked.version}`);

  const getRes = await fetch(`${API_URL}/workflows/${draftId}`);
  const wf = await getRes.json();

  const pricingTask = wf.taskDefinitions.find(t => t.name.includes('Discount') || t.name.includes('Pricing'));
  const notifTask = wf.taskDefinitions.find(t => t.name.includes('Notification'));
  const inventoryTask = wf.taskDefinitions.find(t => t.name.includes('Warehouse') || t.name.includes('Reserve'));
  const fulfillTask = wf.taskDefinitions.find(t => t.name.includes('Fulfillment'));

  console.log('Task IDs:', {
    pricing: pricingTask?.id,
    notif: notifTask?.id,
    inventory: inventoryTask?.id,
    fulfill: fulfillTask?.id
  });

  const correctMapping = {
    inventoryStatusCode: { sourceNodeId: inventoryTask.id, path: ['statusCode'] },
    notificationMessage: { sourceNodeId: notifTask.id, path: ['result', 'formattedMessage'] },
    deliveryTier: { sourceNodeId: pricingTask.id, path: ['result', 'tier'] },
  };

  const updatedTasks = wf.taskDefinitions.map((t) => {
    if (t.id === fulfillTask.id) {
      return {
        id: t.id,
        name: t.name,
        handler: t.handler,
        dependencies: [inventoryTask.id, notifTask.id],
        inputMapping: correctMapping,
        configuration: {
          ...t.configuration,
          inputMapping: correctMapping,
        },
      };
    }
    return {
      id: t.id,
      name: t.name,
      handler: t.handler,
      dependencies: t.dependencies,
      inputMapping: t.configuration?.inputMapping,
      configuration: t.configuration,
    };
  });

  console.log('\n[2] Updating task mappings on draft...');
  const putRes = await fetch(`${API_URL}/workflows/${draftId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks: updatedTasks }),
  });
  if (!putRes.ok) throw new Error(`Update failed: ${putRes.status} ${await putRes.text()}`);
  console.log('✓ Draft updated with correct source node bindings.');

  console.log('\n[3] Validating and Publishing v2...');
  const valRes = await fetch(`${API_URL}/workflows/${draftId}/validate`, { method: 'POST' });
  const valData = await valRes.json();
  console.log('✓ Validation:', valData.valid ? 'VALID' : 'INVALID');

  const pubRes = await fetch(`${API_URL}/workflows/${draftId}/publish`, { method: 'POST' });
  const pubData = await pubRes.json();
  console.log(`✓ Published v${pubData.version}!`);

  console.log('\n[4] Executing v2...');
  const execRes = await fetch(`${API_URL}/workflows/${draftId}/execute`, { method: 'POST' });
  const execData = await execRes.json();
  const runId = execData.id;
  console.log(`✓ Execution started: Run ID=${runId}, Status=${execData.status}`);

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const runRes = await fetch(`${API_URL}/workflow-runs/${runId}`);
    const r = await runRes.json();
    console.log(`  [Poll ${i + 1}] Status: ${r.status}`);
    if (r.status === 'COMPLETED' || r.status === 'FAILED') break;
  }

  console.log(`\nView v2 in Studio: http://localhost:3001/studio/${draftId}`);
  console.log(`View v2 Run Details: http://localhost:3001/runs/${runId}`);
}

main().catch(console.error);
