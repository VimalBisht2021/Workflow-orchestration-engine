#!/bin/bash
set -e

echo "Starting Scheduler Split-Brain Chaos Experiment..."

# 1. Start the baseline platform
docker compose up -d

# 2. Scale the scheduler to 2 instances to simulate an active-active split-brain
echo "Scaling scheduler to 2 instances..."
docker compose up -d --scale scheduler=2

# 3. Use toxiproxy or iptables (simulated here via docker network disconnect) 
# to partition the schedulers from each other if they use a peer protocol, 
# or partition one of them from Redis for 10 seconds to induce a lease expiration.
echo "Simulating network partition for scheduler-1..."
docker network disconnect dtp_network $(docker compose ps -q scheduler | head -n 1)

# 4. Wait for leader election timeout
sleep 15

# 5. Reconnect the isolated scheduler. 
# It will believe it is still the leader while the second scheduler has taken over.
echo "Reconnecting scheduler-1 (Split-Brain initiated)..."
docker network connect dtp_network $(docker compose ps -q scheduler | head -n 1)

# 6. Dispatch a payload to observe recovery conflicts
npm run test:dispatch-single

echo "Check logs for Optimistic Concurrency Control (OCC) rejections!"
