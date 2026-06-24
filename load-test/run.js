const autocannon = require('autocannon');

const BASE_URL = process.env.LOAD_TEST_BASE_URL || 'http://localhost:5500';
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS || '75', 10);
const DURATION = parseInt(process.env.LOAD_TEST_DURATION || '15', 10);

function summarize(name, result) {
  const { requests, latency, throughput, errors, timeouts, non2xx } = result;
  console.log(`\n=== ${name} ===`);
  console.log(`requests: ${requests.total} (${requests.average.toFixed(1)}/sec avg)`);
  console.log(`latency:  p50=${latency.p50}ms  p99=${latency.p99}ms  max=${latency.max}ms`);
  console.log(`throughput: ${(throughput.average / 1024).toFixed(1)} KB/sec`);
  console.log(`errors: ${errors}  timeouts: ${timeouts}  non-2xx/3xx: ${non2xx}`);
  return { name, total: requests.total, avgRps: requests.average, p99: latency.p99, errors, timeouts, non2xx };
}

async function getToken(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function run() {
  console.log(`Load testing ${BASE_URL} — ${CONNECTIONS} connections, ${DURATION}s per scenario\n`);

  const adminToken = await getToken('admin@vendorportal.com', 'Admin@123');
  const vendorToken = await getToken('vendor1@tatasteel.com', 'Vendor@123');
  const results = [];

  results.push(summarize('GET /api/vendors (mdm_admin, list+pagination)', await autocannon({
    url: `${BASE_URL}/api/vendors`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  })));

  results.push(summarize('GET /api/asns (vendor, own ASNs)', await autocannon({
    url: `${BASE_URL}/api/asns`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${vendorToken}` },
  })));

  results.push(summarize('GET /api/purchase-orders (mdm_admin)', await autocannon({
    url: `${BASE_URL}/api/purchase-orders`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  })));

  results.push(summarize('GET /api/dashboard (mdm_admin)', await autocannon({
    url: `${BASE_URL}/api/dashboard`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  })));

  // Deliberately bursty: exercises the login rate limiter (10 req/min/IP). Expect
  // a flood of 429s after the first ~10 requests — that's correct behavior, not a bug.
  results.push(summarize('POST /api/auth/login (burst, expect rate-limit 429s)', await autocannon({
    url: `${BASE_URL}/api/auth/login`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@vendorportal.com', password: 'Admin@123' }),
    connections: 20,
    duration: 10,
  })));

  console.log('\n\n=== SUMMARY ===');
  for (const r of results) {
    console.log(`${r.name}: ${r.total} reqs, ${r.avgRps.toFixed(1)}/sec, p99=${r.p99}ms, errors=${r.errors}, non2xx=${r.non2xx}`);
  }
}

run().catch(err => { console.error('Load test failed:', err); process.exit(1); });
