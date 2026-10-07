const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the shipped inline script with isolated browser storage and a minimal DOM.
// Rendering checks exercise the actual templates, including their branch guards.
function appContext(options = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const app = { innerHTML: '' };
  const values = new Map();
  const context = vm.createContext({
    console, URLSearchParams,
    location: { search: '', protocol: 'file:', pathname: '/index.html' },
    window: {},
    document: { getElementById: id => id === 'app' ? app : options.inputs?.[id] ?? null },
    prompt: (...args) => options.prompt?.(...args) ?? null,
    confirm: () => true,
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
  assert.deepEqual(ids, Array.from({ length: 25 }, (_, i) => i + 1));
  for (const name of ['MS Biomedical Sciences bridge program',
    'Faculty development and retention pool', 'Unified learning platform migration']) {
    assert(!cards.some(c => c.n === name));
  }
  for (const card of cards) if (card.req) assert(ids.includes(card.req));
  assert.equal(cards.find(c => c.id === 6).tail, 2200000);
  assert.equal(cards.find(c => c.id === 10).tail, 350000);
  assert.match(cards.find(c => c.id === 13).n, /Preceptor/);
  assert.deepEqual(json('Object.values(EVENTS).map(events => events.length)'), [3, 3, 3]);
});

test('OMM succession has only the held and unprepared outcomes', () => {
  const { run, json } = appContext();
  run("const omm = EVENTS[2].find(e => e.n.startsWith('OMM chair'));");
  const held = json('omm.f({held:[10]})');
  assert.equal(held.hd, 'Succession held');
  assert.equal(held.m, 1);
  assert.equal(held.s, 1);
  assert.equal(held.cash, undefined);
  for (const ids of [[], [16]]) {
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
  assert.equal(event(1, 'Financing Act', [22]).enroll, -0.03);
  assert.equal(event(1, 'Financing Act', [22, 23]).enroll, -0.015);
  assert.equal(event(2, 'storm', []).cash, -3000000);
  assert.equal(event(2, 'storm', [1]).cash, -1500000);
  assert.equal(event(2, 'storm', [1, 2]).cash, -600000);
  assert.equal(event(2, 'storm', []).m, -5);
  assert.equal(event(2, 'storm', [3]).m, -1);
  assert.equal(event(3, 'scrutiny', [15]).s, 4);
  assert.equal(event(3, 'scrutiny', [15]).m, 3);
  const ai = event(3, 'scrutiny', [6]);
  assert.equal(ai.cash, -700000);
  assert.equal(ai.m, -6);
  assert.equal(ai.cite, 1);
  assert.equal(event(3, 'Estate gift', [20, 14]).cash, 2500000);
  assert.equal(event(3, 'Estate gift', [20]).cash, 1200000);
  assert.equal(event(3, 'Estate gift', [14]).cash, 1200000);
  assert.equal(event(3, 'Estate gift', []).cash, undefined);
  run('const t = newTeam(1); t.held=[6]; t.bought={6:1};');
  assert.equal(run('revenueOf(t,1)'), 51000000);
  assert.equal(run('revenueOf(t,2)'), 51000000 + 3200000 * 0.6);
  run('t.held.push(15);');
  assert.equal(run('revenueOf(t,2)'), 54200000);
  run('t.held=[9]; t.bought={9:1};');
  assert.equal(run('revenueOf(t,1)'), 51600000);
  run('t.held.push(12);');
  assert.equal(run('revenueOf(t,1)'), 52200000);
});

test('Board Ask appears only in Year 1 for CFO and facilitator', async () => {
  const { app, run, json } = appContext();
  assert.deepEqual(json('Object.keys(MIDYEAR)'), ['1']);
  assert.match(run('MIDYEAR[1].opts'), /card 13/);
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
  const picks = [[4, 15, 22, 13], [1, 3, 10], [6, 14, 20, 17]];
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

test('host enters new card numbers, resolves three rounds, adjusts tables, and resets', async () => {
  const inputs = {
    ntab: { value: '2' },
    adjT: { value: '2' }, adjP: { value: '2' }, adjN: { value: 'Mentor ruling' },
    cashT: { value: '2' }, cashV: { value: '1234' },
  };
  let answer;
  const { app, run, json } = appContext({ inputs, prompt: () => answer });
  run("ROLE='fac';");
  await run('startGame()');
  assert.match(app.innerHTML, /Facilitator console/);
  assert.equal(run('TEAMS.length'), 2);
  const picks = [[4, 15, 22, 13], [1, 3, 10], [6, 14, 20, 17]];
  for (let year = 1; year <= 3; year++) {
    answer = picks[year - 1].join(', ') + ', 999';
    await run('facEnter(1)');
    assert.deepEqual(json('TEAMS[0].pending'), picks[year - 1]);
    assert.deepEqual(json(`TEAMS[0].locked[${year}]`), picks[year - 1]);
    assert.deepEqual(json('TEAMS[1].pending'), []);
    await run("setPhase('locked')");
    if (year === 1) assert.match(app.innerHTML, /Tables holding card 13/);
    else assert.doesNotMatch(app.innerHTML, /Mid-year · read aloud/);
    await run("setPhase('reveal')");
    assert.match(app.innerHTML, /Read these aloud/);
    await run('doResolve()');
    assert.equal(run('S.phase'), 'resolved');
    assert.equal(run('TEAMS[0].log.length'), year);
    assert.equal(run('TEAMS[1].log.length'), year);
    assert.deepEqual(json('TEAMS[0].log[S.round-1].purchases.map(p=>p.n)'),
      json(`(${JSON.stringify(picks[year - 1])}).map(id=>CARD(id).n)`));
    // A second click must not purchase or resolve the same round again.
    const reserve = run('TEAMS[0].reserve');
    await run('doResolve()');
    assert.equal(run('TEAMS[0].reserve'), reserve);
    if (year < 3) await run('nextRound()');
  }
  assert.equal(run('TEAMS[0].bought[6]'), 3);
  assert.equal(run('TEAMS[0].bought[10]'), 2);
  assert.equal(run('TEAMS[0].bought[13]'), 1);
  assert.equal(run('TEAMS[0].cite'), 0);
  const beforeCash = run('TEAMS[1].reserve');
  await run('applyCash()');
  assert.equal(run('TEAMS[1].reserve'), beforeCash + 1234);
  await run('applyAdj()');
  assert.equal(run('score(TEAMS[1]).adj'), 2);
  await run("setPhase('final')");
  assert.match(app.innerHTML, /Final/);
  run("ROLE='proj';");
  await run('loop()');
  assert.match(app.innerHTML, /Final standings/);
  assert.equal(run('BOARD.length'), 2);
  run("ROLE='fac';");
  await run('hardReset()');
  assert.equal(await run('sget(K.state)'), null);
  assert.equal(await run('sget(K.team(1))'), null);
  assert.equal(await run('sget(K.team(2))'), null);
});

test('CFO selection, locking, unlocking, and polling preserve renumbered IDs', async () => {
  const { app, run, json } = appContext({
    inputs: { decName: { value: 'Year 1 decider' }, disName: { value: 'Dissenting fellow' } },
  });
  run("S={round:1,phase:'brief',tables:1}; ME=newTeam(1); ROLE='team';");
  await run('sset(K.state,S)');
  await run('sset(K.team(1),ME)');
  run('pick(6); pick(15); pick(22); drop(22);');
  assert.deepEqual(json('CART'), [6, 15]);
  assert.doesNotMatch(app.innerHTML, /You do not hold card 15/);
  await run('lockIn()');
  assert.deepEqual(json('ME.locked[1]'), [6, 15]);
  assert.deepEqual(json('ME.pending'), [6, 15]);
  await run('loop()');
  assert.deepEqual(json('ME.locked[1]'), [6, 15]);
  assert.match(app.innerHTML, /Locked In/);
  await run('unlockYear()');
  assert.deepEqual(json('CART'), [6, 15]);
  assert.deepEqual(json('ME.pending'), []);
  assert.equal(run('Object.hasOwn(ME.locked,1)'), false);
  await run('lockIn()');
  await run("sset(K.state,{round:1,phase:'locked',tables:1})");
  await run('loop()');
  await run('unlockYear()');
  assert.deepEqual(json('ME.locked[1]'), [6, 15]);
  assert.match(app.innerHTML, /MS in Clinical AI and Health Informatics/);
});
