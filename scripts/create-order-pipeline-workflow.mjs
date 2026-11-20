const API_URL = 'http://127.0.0.1:3000';

async function main() {
  const payload = {
    name: 'E-Commerce Order Fulfillment & Notification Pipeline',
    description: 'Diamond DAG: fetches customer order, calculates discounts & taxes, concurrently reserves stock & formats invoices, and joins for fulfillment dispatch.',
    owner: 'studio-user',
    tasks: [
      {
        id: 'step-fetch-order',
        name: 'Fetch Customer Order',
        handler: 'core/http',
        dependencies: [],
        configuration: {
          url: 'http://echo:8080/order/1001',
          method: 'GET'
        }
      },
      {
        id: 'step-process-pricing',
        name: 'Calculate Discounts & Tax',
        handler: 'core/script',
        dependencies: ['step-fetch-order'],
        inputMapping: {
          httpStatus: { sourceNodeId: 'step-fetch-order', path: ['statusCode'] },
          host: { sourceNodeId: 'step-fetch-order', path: ['body', 'headers', 'host'] }
        },
        configuration: {
          code: `
const rawOrder = { orderId: 'ORD-1001', customerName: 'Alex Mercer', subtotal: 120.00, itemsCount: 3 };
const discountRate = rawOrder.itemsCount >= 3 ? 0.15 : 0.05;
const discountAmount = rawOrder.subtotal * discountRate;
const finalTotal = rawOrder.subtotal - discountAmount;
return {
  orderId: rawOrder.orderId,
  customerName: rawOrder.customerName,
  subtotal: rawOrder.subtotal,
  discountAmount: parseFloat(discountAmount.toFixed(2)),
  finalTotal: parseFloat(finalTotal.toFixed(2)),
  tier: finalTotal > 100 ? 'VIP_EXPEDITED' : 'STANDARD',
  apiEchoHost: input.host,
  verified: input.httpStatus === 200
};
          `.trim()
        }
      },
      {
        id: 'step-reserve-inventory',
        name: 'Reserve Warehouse Stock',
        handler: 'core/http',
        dependencies: ['step-process-pricing'],
        configuration: {
          url: 'http://echo:8080/warehouse/reserve',
          method: 'GET'
        }
      },
      {
        id: 'step-format-invoice',
        name: 'Generate Customer Notification',
        handler: 'core/script',
        dependencies: ['step-process-pricing'],
        inputMapping: {
          customer: { sourceNodeId: 'step-process-pricing', path: ['result', 'customerName'] },
          total: { sourceNodeId: 'step-process-pricing', path: ['result', 'finalTotal'] },
          discount: { sourceNodeId: 'step-process-pricing', path: ['result', 'discountAmount'] },
          tier: { sourceNodeId: 'step-process-pricing', path: ['result', 'tier'] }
        },
        configuration: {
          code: `
const message = 'Hello ' + input.customer + '! Your order has been approved with ' + input.tier + ' delivery. Total after $' + input.discount + ' discount is $' + input.total + '.';
return {
  notificationReady: true,
  channel: 'EMAIL',
  formattedMessage: message,
  recipient: input.customer
};
          `.trim()
        }
      },
      {
        id: 'step-fulfill-order',
        name: 'Confirm Order Fulfillment',
        handler: 'core/script',
        dependencies: ['step-reserve-inventory', 'step-format-invoice'],
        inputMapping: {
          inventoryStatusCode: { sourceNodeId: 'step-reserve-inventory', path: ['statusCode'] },
          notificationMessage: { sourceNodeId: 'step-format-invoice', path: ['result', 'formattedMessage'] },
          deliveryTier: { sourceNodeId: 'step-process-pricing', path: ['result', 'tier'] }
        },
        configuration: {
          code: `
const stockReserved = input.inventoryStatusCode === 200;
return {
  fulfillmentStatus: stockReserved ? 'DISPATCHED' : 'BACKORDERED',
  trackingNumber: stockReserved ? 'TRK-849201' : null,
  deliverySpeed: input.deliveryTier,
  customerMessage: input.notificationMessage,
  dispatchedAt: new Date().toISOString()
};
          `.trim()
        }
      }
    ]
  };

  console.log('[1] Creating Workflow...');
  const createRes = await fetch(`${API_URL}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!createRes.ok) {
    throw new Error(`Create failed: ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json();
  const workflowId = created.id;
  console.log(`✓ Workflow created: ID=${workflowId}, Name="${created.name}"`);

  console.log('\n[2] Validating Workflow...');
  const valRes = await fetch(`${API_URL}/workflows/${workflowId}/validate`, { method: 'POST' });
  const valData = await valRes.json();
  console.log('✓ Validation result:', valData.valid ? 'VALID' : 'INVALID', valData.errors || []);

  console.log('\n[3] Publishing Workflow...');
  const pubRes = await fetch(`${API_URL}/workflows/${workflowId}/publish`, { method: 'POST' });
  const pubData = await pubRes.json();
  console.log(`✓ Published version: v${pubData.version}`);

  console.log('\n[4] Triggering Execution...');
  const execRes = await fetch(`${API_URL}/workflows/${workflowId}/execute`, { method: 'POST' });
  const execData = await execRes.json();
  const runId = execData.id;
  console.log(`✓ Execution started: Run ID=${runId}, Status=${execData.status}`);

  console.log('\n[5] Polling for completion...');
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const runRes = await fetch(`${API_URL}/workflow-runs/${runId}`);
    const run = await runRes.json();
    console.log(`  [Poll ${i + 1}] Status: ${run.status}`);
    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
      console.log(`\n🎉 Workflow finished with status: ${run.status}`);
      break;
    }
  }

  // Inspect task outputs
  const tasksRes = await fetch(`${API_URL}/workflow-runs/${runId}/tasks`);
  const tasks = await tasksRes.json();
  console.log('\n--- Task Results Summary ---');
  for (const t of tasks) {
    console.log(`- ${t.taskDefinition?.name || t.id} (${t.status}):`);
    if (t.output?.result) {
      console.log('   Result:', JSON.stringify(t.output.result));
    } else if (t.output?.statusCode) {
      console.log('   Status Code:', t.output.statusCode);
    }
  }

  console.log('\nLinks for User:');
  console.log(`- View in Studio: http://localhost:3001/studio/${workflowId}`);
  console.log(`- View Run Details: http://localhost:3001/runs/${runId}`);
}

main().catch(console.error);

