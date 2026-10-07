const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the shipped inline script with isolated browser storage and a minimal DOM.
// Rendering checks exercise the actual templates, including their branch guards.
function appContext() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const app = { innerHTML: '' };
  const values = new Map();
  const context = vm.createContext({
    console, URLSearchParams,
    location: { search: '', protocol: 'file:', pathname: '/index.html' },
    window: {},
    document: { getElementById: id => id === 'app' ? app : null },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
    setTimeout: () => {},
  });
  vm.runInContext(source, context, { filename: 'index.html inline script' });
  return {
    app,
    run: code => vm.runInContext(code, context),
    json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)),
  };
}

test('baseline, surviving identities, and prerequisites remain consistent', () => {
  const { json } = appContext();
  const base = json('BASE');
  assert.equal(base.tuition, 47040000);
  assert.equal(base.otherRev, 3960000);
  assert.equal(base.tuition + base.otherRev - base.expense, 2500000);
  assert.equal(base.restricted, 1500000);
  assert.equal(base.fund, 5000000);
  assert.equal(base.reserve, 13000000);
  const cards = json('CARDS');
  assert.equal(cards.length, 25);
  const ids = cards.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [6, 9, 27]) assert(!ids.includes(id));
  for (const card of cards) if (card.req) assert(ids.includes(card.req));
  assert.equal(cards.find(c => c.id === 25).tail, 2200000);
  assert.equal(cards.find(c => c.id === 26).tail, 350000);
  assert.match(cards.find(c => c.id === 11).n, /Preceptor/);
  assert.deepEqual(json('Object.values(EVENTS).map(events => events.length)'), [3, 3, 3]);
});

test('OMM succession has only the held and unprepared outcomes', () => {
  const { run, json } = appContext();
  run("const omm = EVENTS[2].find(e => e.n.startsWith('OMM chair'));");
  const held = json('omm.f({held:[26]})');
  assert.equal(held.hd, 'Succession held');
  assert.equal(held.m, 1);
  assert.equal(held.s, 1);
  assert.equal(held.cash, undefined);
  for (const ids of [[], [9]]) {
    const result = json(`omm.f({held:${JSON.stringify(ids)}})`);
    assert.equal(result.cash, -1400000);
    assert.equal(result.m, -7);
    assert.equal(result.cite, 1);
    assert.doesNotMatch(result.hd, /Partial/);
  }
});

test('risk mitigation and revenue dependencies still work', () => {
  const { run, json } = appContext();
  const event = (year, name, ids) => json(
    `EVENTS[${year}].find(e => e.n.includes(${JSON.stringify(name)})).f({held:${JSON.stringify(ids)}})`
  );
  assert.equal(event(1, 'Ransomware', []).cash, -2400000);
  assert.equal(event(1, 'Ransomware', [4]).cash, -300000);
  assert.equal(event(1, 'Ransomware', [4, 5]).cash, -50000);
  const denied = event(1, 'Ransomware', [5]);
  assert.equal(denied.cash, -2400000);
  assert.match(denied.notes.join(' '), /Claim denied/);
  assert.equal(event(1, 'Financing Act', []).enroll, -0.06);
  assert.equal(event(1, 'Financing Act', [23]).enroll, -0.03);
  assert.equal(event(1, 'Financing Act', [23, 24]).enroll, -0.015);
  assert.equal(event(2, 'storm', []).cash, -3000000);
  assert.equal(event(2, 'storm', [1]).cash, -1500000);
  assert.equal(event(2, 'storm', [1, 2]).cash, -600000);
  assert.equal(event(2, 'storm', []).m, -5);
  assert.equal(event(2, 'storm', [3]).m, -1);
  assert.equal(event(3, 'scrutiny', [15]).s, 4);
  assert.equal(event(3, 'scrutiny', [15]).m, 3);
  const ai = event(3, 'scrutiny', [25]);
  assert.equal(ai.cash, -700000);
  assert.equal(ai.m, -6);
  assert.equal(ai.cite, 1);
  assert.equal(event(3, 'Estate gift', [19, 13]).cash, 2500000);
  assert.equal(event(3, 'Estate gift', [19]).cash, 1200000);
  assert.equal(event(3, 'Estate gift', [13]).cash, 1200000);
  assert.equal(event(3, 'Estate gift', []).cash, undefined);
  run('const t = newTeam(1); t.held=[25]; t.bought={25:1};');
  assert.equal(run('revenueOf(t,1)'), 51000000);
  assert.equal(run('revenueOf(t,2)'), 51000000 + 3200000 * 0.6);
  run('t.held.push(15);');
  assert.equal(run('revenueOf(t,2)'), 54200000);
  run('t.held=[10]; t.bought={10:1};');
  assert.equal(run('revenueOf(t,1)'), 51600000);
  run('t.held.push(12);');
  assert.equal(run('revenueOf(t,1)'), 52200000);
});

test('Board Ask appears only in Year 1 for CFO and facilitator', async () => {
  const { app, run, json } = appContext();
  assert.deepEqual(json('Object.keys(MIDYEAR)'), ['1']);
  assert.match(run('MIDYEAR[1].opts'), /card 11/);
  for (const year of [1, 2, 3]) {
    run(`S={round:${year},phase:'locked',tables:1}; ME=newTeam(1);
      ME.locked[${year}]=[4]; TEAMS=[ME]; BOARD=[]; CART=[];`);
    for (const phase of ['locked', 'reveal']) {
      run(`S.phase='${phase}'; renderTeam();`);
      if (year === 1) assert.match(app.innerHTML, /Preceptor rates must rise now/);
      else {
        assert.match(app.innerHTML, /No mid-year demand/);
        assert.doesNotMatch(app.innerHTML, /Unbudgeted · arriving now/);
      }
    }
    run("S.phase='locked';");
    await run('renderFac()');
    if (year === 1) assert.match(app.innerHTML, /Preceptor rates must rise now/);
    else assert.doesNotMatch(app.innerHTML, /Mid-year · read aloud/);
  }
});

test('prepared and do-nothing portfolios complete all rounds and views', async () => {
  const { app, run, json } = appContext();
  run('const prepared=newTeam(1), idle=newTeam(2);');
  const picks = [[4, 15, 23, 11], [1, 3, 26], [25, 13, 19, 17]];
  for (let year = 1; year <= 3; year++) {
    run(`S={round:${year},phase:'brief',tables:2};
      prepared.pending=${JSON.stringify(picks[year-1])};
      prepared.locked[${year}]=prepared.pending.slice(); idle.locked[${year}]=[];
      resolveRound(prepared,${year}); resolveRound(idle,${year});
      ME=prepared; TEAMS=[prepared,idle];
      BOARD=TEAMS.map(t=>({id:t.id,name:t.name,s:score(t)})); CART=[];`);
    for (const phase of ['brief', 'locked', 'reveal', 'resolved', ...(year === 3 ? ['final'] : [])]) {
      run(`S.phase='${phase}'; renderTeam();`);
      assert(app.innerHTML.length > 0);
      await run('renderFac()');
      assert(app.innerHTML.length > 0);
      run('renderProj();');
      assert(app.innerHTML.length > 0);
    }
  }
  const result = json('({prepared:score(prepared).total,idle:score(idle).total})');
  assert(result.prepared > result.idle + 20, JSON.stringify(result));
  assert.equal(run('prepared.cite'), 0);
  assert.equal(run('prepared.restricted'), 1000000);
  assert.equal(run('prepared.log.length'), 3);
  assert.equal(run('idle.log.length'), 3);
  console.log(`Portfolio scores: prepared ${result.prepared.toFixed(1)}, do-nothing ${result.idle.toFixed(1)}`);
});
