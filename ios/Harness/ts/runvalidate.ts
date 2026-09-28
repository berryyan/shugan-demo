import { validateAll } from './validate.ts';
const r = validateAll() as Record<string, any>;
let allGood = true;
for (const [k, v] of Object.entries(r)) {
  const ok = v.badCount === 0;
  if (!ok) allGood = false;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k}: total=${v.total} bad=${v.badCount} reducible=${v.reducible} equal=${v.equalCount}${ok ? '' : ' sample=' + JSON.stringify(v.badSample)}`);
}
console.log(allGood ? 'ALL_GREEN' : 'HAS_FAILURES');
