const fs = require('fs');
const vm = require('vm');
const f = 'C:/Users/HUAWEI/WorkBuddy/2026-07-27-17-09-44/workbench/app.js';
const out = 'C:/Users/HUAWEI/WorkBuddy/2026-07-27-17-09-44/workbench/_check_out.txt';
let log = [];
try {
  const code = fs.readFileSync(f, 'utf8');
  try {
    new vm.Script(code, { filename: 'app.js' });
    log.push('SYNTAX_OK');
  } catch (e) {
    log.push('SYNTAX_ERROR: ' + e.message);
    const m = /app\.js:(\d+)/.exec(e.stack || '');
    if (m) {
      const line = parseInt(m[1], 10);
      const lines = code.split('\n');
      for (let i = Math.max(0, line - 3); i < Math.min(lines.length, line + 2); i++) {
        log.push((i + 1) + ': ' + lines[i]);
      }
    } else {
      log.push(String(e.stack));
    }
  }
} catch (e2) {
  log.push('RUNNER_FAIL: ' + e2.message);
}
fs.writeFileSync(out, log.join('\n'));
