const fs = require('fs');

const reportFile = process.argv[2] || 'test/load-test-report.json';
const isProd = reportFile.includes('production');

try {
  if (!fs.existsSync(reportFile)) {
    console.error(`❌ Report file not found: ${reportFile}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const aggregate = report.aggregate;

  console.log('═══════════════════════════════════════════════════════');
  console.log(`📊 ${isProd ? 'PRODUCTION' : 'LOCAL'} LOAD TEST REPORT`);
  if (isProd) {
    console.log('🎯 Target: https://vibe-backend2.kidneyweakx.workers.dev');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  // Overall Statistics
  console.log('🎯 OVERALL PERFORMANCE:');
  console.log(`   Total Requests:        ${(aggregate.counters['http.requests'] || 0).toLocaleString()}`);
  console.log(`   Successful (2xx):      ${(aggregate.counters['http.responses'] || 0).toLocaleString()}`);
  console.log(`   Client Errors (4xx):   ${(aggregate.counters['http.response_4xx'] || 0).toLocaleString()}`);
  console.log(`   Server Errors (5xx):   ${(aggregate.counters['http.response_5xx'] || 0).toLocaleString()}`);
  console.log(`   Completed Scenarios:   ${(aggregate.counters['vusers.completed'] || 0).toLocaleString()}`);
  console.log('');

  // Throughput
  console.log('⚡ THROUGHPUT:');
  const duration = Math.max((aggregate.period || 1) / 1000, 1);
  const reqPerSec = (aggregate.counters['http.requests'] || 0) / duration;
  console.log(`   Requests/sec (avg):    ${reqPerSec.toFixed(2)} req/s`);
  console.log(`   Test Duration:         ${duration.toFixed(0)}s`);
  console.log('');

  // Response Times
  console.log('⏱️  RESPONSE TIMES:');
  const rt = aggregate.summaries['http.response_time'];
  if (rt) {
    console.log(`   Min:                   ${rt.min.toFixed(0)}ms`);
    console.log(`   Median (p50):          ${rt.median.toFixed(0)}ms`);
    console.log(`   95th percentile:       ${rt.p95.toFixed(0)}ms`);
    console.log(`   99th percentile:       ${rt.p99.toFixed(0)}ms`);
    console.log(`   Max:                   ${rt.max.toFixed(0)}ms`);
    console.log(`   Average:               ${rt.mean.toFixed(0)}ms`);
  }
  console.log('');

  // Success Rate
  console.log('✅ SUCCESS RATE:');
  const totalReqs = aggregate.counters['http.requests'] || 1;
  const successReqs = aggregate.counters['http.responses'] || 0;
  const successRate = (successReqs / totalReqs * 100);
  console.log(`   Success Rate:          ${successRate.toFixed(2)}%`);

  // Performance Grade
  if (rt) {
    let grade = 'Unknown';
    if (successRate >= 99.5 && rt.p95 < 100) {
      grade = '🏆 EXCELLENT (A+)';
    } else if (successRate >= 99 && rt.p95 < 200) {
      grade = '✨ GREAT (A)';
    } else if (successRate >= 98 && rt.p95 < 500) {
      grade = '👍 GOOD (B)';
    } else if (successRate >= 95 && rt.p95 < 1000) {
      grade = '⚠️  FAIR (C)';
    } else {
      grade = '❌ NEEDS IMPROVEMENT (D)';
    }
    console.log(`   Performance Grade:     ${grade}`);
  }
  console.log('');

  // Errors
  const hasErrors = aggregate.counters['errors.ECONNREFUSED'] ||
      aggregate.counters['errors.ETIMEDOUT'] ||
      aggregate.counters['errors.ENOTFOUND'] ||
      aggregate.counters['http.response_4xx'] ||
      aggregate.counters['http.response_5xx'];

  if (hasErrors) {
    console.log('❌ ERRORS:');
    if (aggregate.counters['errors.ECONNREFUSED']) {
      console.log(`   Connection Refused:    ${aggregate.counters['errors.ECONNREFUSED']}`);
    }
    if (aggregate.counters['errors.ETIMEDOUT']) {
      console.log(`   Timeouts:              ${aggregate.counters['errors.ETIMEDOUT']}`);
    }
    if (aggregate.counters['http.response_4xx']) {
      console.log(`   4xx Errors:            ${aggregate.counters['http.response_4xx']}`);
    }
    if (aggregate.counters['http.response_5xx']) {
      console.log(`   5xx Errors:            ${aggregate.counters['http.response_5xx']}`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('');

} catch (error) {
  console.error('❌ Error parsing report:', error.message);
  process.exit(1);
}
