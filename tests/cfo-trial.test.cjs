const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the shipped inline script with isolated browser storage and a minimal DOM.
// Rendering checks exercise the actual templates, including their branch guards.
function appContext(options = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  if (options.review) {
    const setting = 'const REVIEW_CONTENT = { cards: true, events: true };';
    assert(source.includes(setting), 'Review configuration must be present');
    source = source.replace(setting, `const REVIEW_CONTENT = ${JSON.stringify(options.review)};`);
  }
  const app = { innerHTML: '' };
  const fields = new Map();
  const browserDocument = {
    activeElement: null,
    getElementById: id => id === 'app' ? app : options.liveDOM ? fields.get(id) ?? null : options.inputs?.[id] ?? null,
  };
  if (options.liveDOM) {
    let markup = '';
    Object.defineProperty(app, 'innerHTML', {
      get: () => markup,
      set: html => {
        markup = html;
        fields.clear();
        browserDocument.activeElement = null;
        const attr = (tag, name) => tag.match(new RegExp(name + '="([^"]*)"'))?.[1] ?? '';
        const add = (tag, value) => {
          const id = attr(tag, 'id');
          if (!id) return;
          const field = { value, disabled: /\sdisabled(?:\s|>|$)/.test(tag),
            selectionStart: null, selectionEnd: null, selectionDirection: 'none',
            focus() { browserDocument.activeElement = field; },
            setSelectionRange(start, end, direction) {
              this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
            },
          };
          fields.set(id, field);
        };
        for (const tag of html.match(/<input\b[^>]*>/g) || []) add(tag, attr(tag, 'value'));
        for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
          const firstOption = match[2].match(/<option[^>]*>/)?.[0] ?? '';
          add('<select ' + match[1] + '>', attr(firstOption, 'value'));
        }
      },
    });
  }
  const values = new Map();
  const context = vm.createContext({
    console, URLSearchParams,
    location: { search: '', protocol: 'file:', pathname: '/index.html' },
    window: {},
    document: browserDocument,
    alert: message => options.alert?.(message),
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
    field: id => browserDocument.getElementById(id),
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
  assert.equal(cards.length, 14);
  const ids = cards.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, Array.from({ length: 14 }, (_, i) => i + 1));
  assert.deepEqual(cards.map(c => c.n), [
    'Deferred maintenance: roof, HVAC, envelope',
    'Business continuity and distributed instruction',
    'Cybersecurity uplift: MFA, EDR, segmentation, IR retainer',
    'Cyber liability insurance',
    'MS in Clinical AI and Health Informatics, DO dual pathway',
    'MS Biomedical Sciences bridge program',
    'Faculty development and retention pool',
    'OMM department depth and chair succession',
    'Preceptor stipend program',
    'Rural and underserved training track',
    'AI governance framework and faculty upskilling',
    'Data infrastructure and institutional research capacity',
    'Advancement officer and campaign feasibility study',
    'Scholarship and tuition discount pool',
  ]);
  for (const card of cards) if (card.req) assert(ids.includes(card.req));
  assert.equal(cards.find(c => c.id === 5).tail, 2200000);
  assert.equal(cards.find(c => c.id === 8).tail, 350000);
  assert.match(cards.find(c => c.id === 9).n, /Preceptor/);
  assert.equal(cards.find(c => c.id === 4).req, 3);
  assert.equal(cards.find(c => c.id === 5).req, 11);
  assert.deepEqual(json('Object.values(EVENTS).map(events => events.length)'), [2, 3, 2]);
  assert.deepEqual(json('Object.values(EVENTS).flat().filter(e=>e.review).map(e=>e.n)'), [
    'State ties professional-program support to in-state primary care placement',
  ]);
});

test('OMM succession, restored faculty retention, and unprepared outcomes', () => {
  const { run, json } = appContext();
  run("const omm = EVENTS[2].find(e => e.n.startsWith('OMM chair'));");
  const held = json('omm.f({held:[8]})');
  assert.equal(held.hd, 'Succession held');
  assert.equal(held.m, 1);
  assert.equal(held.s, 1);
  assert.equal(held.cash, undefined);
  const partial = json('omm.f({held:[7]})');
  assert.equal(partial.cash, -700000);
  assert.equal(partial.m, -3);
  assert.equal(partial.cite, undefined);
  assert.match(partial.hd, /Partial/);
  assert.equal(json('omm.f({held:[7,8]})').hd, 'Succession held');
  for (const ids of [[], [3]]) {
    const result = json(`omm.f({held:${JSON.stringify(ids)}})`);
    assert.equal(result.cash, -1400000);
    assert.equal(result.m, -7);
    assert.equal(result.cite, 1);
    assert.doesNotMatch(result.hd, /Partial/);
  }
});

test('state-support mitigation is available and bridge revenue follows enrollment', () => {
  const { run, json } = appContext();
  const event = (year, name, held) => json(
    `EVENTS[${year}].find(e=>e.n.includes(${JSON.stringify(name)})).f({held:${JSON.stringify(held)}})`
  );
  assert.equal(event(2, 'State ties', []).cash, -500000);
  assert.equal(event(2, 'State ties', [10]).cash, 1500000);
  run('const bridge=newTeam(1); bridge.held=[6]; bridge.bought={6:1};');
  assert.equal(run('revenueOf(bridge,1)'), 51000000);
  assert.equal(run('revenueOf(bridge,2)'), 52400000);
  run('bridge.enroll=.94;');
  assert.equal(run('revenueOf(bridge,2)'), 47040000 * .94 + 3960000 + 1400000 * .85);
  assert.equal(run('CARD(6).tail'), 1150000);
});

test('review groups can be excluded independently with no missing card references', async () => {
  for (const cards of [true, false]) {
    for (const events of [true, false]) {
      const { app, run, json } = appContext({ review: { cards, events } });
      assert.equal(run('CARDS.length'), cards ? 14 : 12);
      assert.deepEqual(json('Object.values(EVENTS).map(es=>es.length)'), events ? [2,3,2] : [2,2,2]);
      assert.deepEqual(json('CARDS.filter(c=>c.review).map(c=>c.id)'), cards ? [6,7] : []);
      for (const id of json('CARDS.filter(c=>c.req).map(c=>c.req)')) assert(run(`!!CARD(${id})`));
      const partial = json("EVENTS[2].find(e=>e.n.startsWith('OMM chair')).f({held:[7]})");
      assert.equal(partial.cash, cards ? -700000 : -1400000);
      assert.match(app.innerHTML, new RegExp(`${cards ? 14 : 12} cards`));
      run('const checked=newTeam(1); const idle=newTeam(2);');
      const picks = [[3,11,14,9], [1,2,8], [5,10,13,12]];
      for (let year = 1; year <= 3; year++) {
        run(`S={round:${year},phase:'brief',tables:2}; checked.pending=${JSON.stringify(picks[year-1])};
          checked.locked[${year}]=checked.pending.slice(); resolveRound(checked,${year}); resolveRound(idle,${year});
          ME=checked; TEAMS=[checked,idle]; BOARD=TEAMS.map(t=>({id:t.id,name:t.name,s:score(t)})); CART=[];`);
        for (const phase of ['brief','locked','reveal','resolved',...(year===3?['final']:[])]) {
          run(`S.phase='${phase}'; renderTeam();`);
          await run('renderFac()');
          run('renderProj()');
          assert(app.innerHTML.length > 0);
        }
      }
      const scores = json('({prepared:score(checked).total,idle:score(idle).total})');
      if (!events) {
        assert(scores.prepared > 65 && scores.prepared < 75);
        assert(scores.idle > 20 && scores.idle < 30);
      }
    }
  }
});

test('risk mitigation and revenue dependencies still work', () => {
  const { run, json } = appContext();
  const event = (year, name, ids) => json(
    `EVENTS[${year}].find(e => e.n.includes(${JSON.stringify(name)})).f({held:${JSON.stringify(ids)}})`
  );
  assert.equal(event(1, 'Ransomware', []).cash, -2400000);
  assert.equal(event(1, 'Ransomware', [3]).cash, -300000);
  assert.equal(event(1, 'Ransomware', [3, 4]).cash, -50000);
  const denied = event(1, 'Ransomware', [4]);
  assert.equal(denied.cash, -2400000);
  assert.match(denied.notes.join(' '), /Claim denied/);
  assert.equal(event(1, 'Financing Act', []).enroll, -0.06);
  assert.equal(event(1, 'Financing Act', [14]).enroll, -0.03);
  assert.equal(event(2, 'storm', []).cash, -3000000);
  assert.equal(event(2, 'storm', [1]).cash, -1500000);
  assert.equal(event(2, 'storm', []).m, -5);
  assert.equal(event(2, 'storm', [2]).m, -1);
  assert.equal(event(3, 'scrutiny', [11]).s, 4);
  assert.equal(event(3, 'scrutiny', [11]).m, 3);
  const ai = event(3, 'scrutiny', [5]);
  assert.equal(ai.cash, -700000);
  assert.equal(ai.m, -6);
  assert.equal(ai.cite, 1);
  assert.equal(event(3, 'Estate gift', [13, 10]).cash, 2500000);
  assert.equal(event(3, 'Estate gift', [13]).cash, 1200000);
  assert.equal(event(3, 'Estate gift', [10]).cash, 1200000);
  assert.equal(event(3, 'Estate gift', []).cash, undefined);
  run('const t = newTeam(1); t.held=[5]; t.bought={5:1};');
  assert.equal(run('revenueOf(t,1)'), 51000000);
  assert.equal(run('revenueOf(t,2)'), 51000000 + 3200000 * 0.6);
  run('t.held.push(11);');
  assert.equal(run('revenueOf(t,2)'), 54200000);
});

test('Board Ask appears only in Year 1 for CFO and facilitator', async () => {
  const { app, run, json } = appContext();
  assert.deepEqual(json('Object.keys(MIDYEAR)'), ['1']);
  assert.match(run('MIDYEAR[1].opts'), /card 9/);
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
  const picks = [[3, 11, 14, 9], [1, 2, 8], [5, 10, 13, 12]];
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
  assert(result.prepared > 55 && result.prepared < 60, JSON.stringify(result));
  assert.equal(Number(result.prepared.toFixed(1)),56.6,JSON.stringify(result));
  assert.equal(Number(result.idle.toFixed(1)),17.0,JSON.stringify(result));
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
  const picks = [[3, 11, 14, 9], [1, 2, 8], [5, 10, 13, 12]];
  for (let year = 1; year <= 3; year++) {
    answer = picks[year - 1].join(', ') + ', 999';
    await run('facEnter(1)');
    assert.deepEqual(json('TEAMS[0].pending'), picks[year - 1]);
    assert.deepEqual(json(`TEAMS[0].locked[${year}]`), picks[year - 1]);
    assert.deepEqual(json('TEAMS[1].pending'), []);
    await run("setPhase('locked')");
    if (year === 1) assert.match(app.innerHTML, /Tables holding card 9/);
    else assert.doesNotMatch(app.innerHTML, /Mid-year · read aloud/);
    await run("setPhase('reveal')");
    assert.match(app.innerHTML, /Read these aloud/);
    await run('doResolve()');
    assert.equal(run('S.phase'), 'calculated');
    await run("setPhase('resolved')");
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
  assert.equal(run('TEAMS[0].bought[5]'), 3);
  assert.equal(run('TEAMS[0].bought[8]'), 2);
  assert.equal(run('TEAMS[0].bought[9]'), 1);
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
  run('pick(5); pick(11); pick(14); drop(14);');
  assert.deepEqual(json('CART'), [5, 11]);
  assert.doesNotMatch(app.innerHTML, /You do not hold card 11/);
  await run('lockIn()');
  assert.deepEqual(json('ME.locked[1]'), [5, 11]);
  assert.deepEqual(json('ME.pending'), [5, 11]);
  await run('loop()');
  assert.deepEqual(json('ME.locked[1]'), [5, 11]);
  assert.match(app.innerHTML, /Submitted/);
  await run('unlockYear()');
  assert.deepEqual(json('CART'), [5, 11]);
  assert.deepEqual(json('ME.pending'), []);
  assert.equal(run('Object.hasOwn(ME.locked,1)'), false);
  await run('lockIn()');
  await run("sset(K.state,{round:1,phase:'locked',tables:1})");
  await run('loop()');
  await run('unlockYear()');
  assert.deepEqual(json('ME.locked[1]'), [5, 11]);
  assert.match(app.innerHTML, /MS in Clinical AI and Health Informatics/);
});


test('restricted startup preview agrees with purchases and never changes the team', () => {
  for (const gift of [1500000,250000,0]) {
    const {run,json}=appContext();
    run(`const t=newTeam(1); t.restricted=${gift}; const before=JSON.stringify(t); const p=financialPreview(t,[10],1);`);
    assert.equal(run('JSON.stringify(t)===before'),true);
    assert.equal(run('p.team.fund'),5000000-Math.max(0,500000-gift));
    assert.equal(run('p.team.restricted'),Math.max(0,gift-500000));
    assert.equal(run('p.margin'),2250000);
    run('t.pending=[10]; resolveRound(t,1);');
    assert.equal(run('t.fund'),run('p.team.fund'));
    assert.equal(run('t.restricted'),run('p.team.restricted'));
    assert.equal(run('t.log[0].margin'),run('p.margin'));
    assert.equal(json('t.held').length,1);
    // Previously purchased commitments must not be charged again in a preview.
    assert.equal(run('financialPreview(t,[10],2).startup'),0);
  }
});

test('three-year plan includes delayed revenue and does not leak future events', () => {
  const {run}=appContext();
  run("S={round:1,phase:'brief',tables:1}; const t=newTeam(1); const p=financialPreview(t,[5,11],1);");
  assert.equal(run('p.team.fund'),3900000);
  assert.equal(run('p.margin'),200000);
  assert.equal(run('revenueOf(p.team,2)-expenseOf(p.team)'),3400000);
  assert.equal(run('revenueOf(p.team,3)-expenseOf(p.team)'),3400000);
  assert.match(run('timingText(CARD(13),t,1)'),/begins Year 3/);
  assert.match(run('timingText(CARD(13),t,2)'),/begins Year 4.*after/);
  assert.equal(run('timingText(CARD(8),t,2)'),'');
  const html=run('planningYears(t,[5,11],1)');
  assert.match(html,/Year 1/);assert.match(html,/Year 2/);assert.match(html,/Year 3/);
  assert.doesNotMatch(html,/storm|Ransomware|Estate gift|OMM chair departs/);
  assert.equal(run('t.log.length'),0);
  run('t.enroll=.94;');
  assert.equal(run('financialPreview(t,[6],1).revenue'),47040000*.94+3960000);
  assert.equal(run('revenueOf(financialPreview(t,[6],1).team,2)'),47040000*.94+3960000+1400000*.85);
});

test('financial labels and compact interaction flags cover all retained cards', () => {
  const {app,run}=appContext();
  run("S={round:1,phase:'brief',tables:1}; ME=newTeam(1); ROLE='team'; CART=[10]; renderTeam();");
  assert.match(app.innerHTML,/14 investment cards/);
  assert.match(app.innerHTML,/Investment fund.*one-time balance/);
  assert.match(app.innerHTML,/No automatic annual refill/);
  assert.match(app.innerHTML,/Starting restricted gift.*eligible startup only/);
  assert.match(app.innerHTML,/Operating reserve.*cash held/);
  assert.match(app.innerHTML,/Startup cost.*paid once/);
  assert.match(app.innerHTML,/Annual expense/);
  assert.match(app.innerHTML,/class="cflag req">Requires card 11 or delivers 60% revenue/);
  assert.match(app.innerHTML,/class="cflag req">Pays out only alongside card 3/);
  assert.match(app.innerHTML,/class="cflag rest">Starting restricted gift eligible/);
  assert.match(app.innerHTML,/class="cflag rev">Annual revenue \$3,200,000 begins Year 2/);
  assert.doesNotMatch(app.innerHTML,/Startup paid from:|Points and event protection apply|No annual revenue modeled/);
  assert.equal((app.innerHTML.match(/Starting restricted gift eligible/g)||[]).length,1);
  assert.doesNotMatch(app.innerHTML,/lag to value|New recurring tail/);
  assert.equal((app.innerHTML.match(/class="card /g)||[]).length,14);
  assert.match(run('cardEl(CARD(4),ME)'),/Startup.*paid once.*\$0/s);
});


test('unspent investment fund earns five financial-health points within the existing cap', () => {
  const {run,json}=appContext();
  run('const rich=newTeam(1); rich.reserve=20000000; rich.cumMargin=3000000; rich.fund=0; const spent=score(rich);');
  assert.equal(run('spent.fin'),30);
  run('rich.fund=2500000;');assert.equal(run('score(rich).fin'),32.5);
  run('rich.fund=5000000;');assert.equal(run('score(rich).fin'),35);
  for (const category of ['mis','str','res']) assert.equal(run(`score(rich).${category}`),run(`spent.${category}`));
  run('rich.fund=9000000;');assert.equal(run('score(rich).fin'),35);
  run('rich.minDays=44;');assert.equal(run('score(rich).fin'),0);
  run('rich.minDays=98;rich.cite=2;');assert.equal(run('score(rich).fin'),0);
});

test('no-exposure AI outcome has no penalty and OMM outcome has no false chronology', () => {
  const {run,json}=appContext();
  const neutral=json("EVENTS[3].find(e=>e.n.includes('scrutiny')).f({held:[]})");
  assert.equal(neutral.m,undefined);assert.equal(neutral.cash,undefined);assert.equal(neutral.s,undefined);assert.equal(neutral.cite,undefined);
  assert.equal(neutral.hd,'No material effect');
  assert.doesNotMatch(run("EVENTS[2].find(e=>e.n.startsWith('OMM')).f({held:[8]}).notes.join(' ')"),/three years ago/);
  assert.match(run("EVENTS[2].find(e=>e.n.startsWith('OMM')).f({held:[8]}).notes.join(' ')"),/earlier succession investment/);
});

test('terminology stays consistent while yield narration and deferred role labels stay unchanged', async () => {
  const {app,run}=appContext();
  run("S={round:1,phase:'brief',tables:1};ME=newTeam(1);ROLE='team';CART=[];renderTeam();");
  assert.match(app.innerHTML,/Annual briefing/);assert.match(app.innerHTML,/Submit Year 1 selections/);
  assert.match(app.innerHTML,/Decider for Year 1/);assert.match(app.innerHTML,/Who made the case against/);
  assert.equal(run("BRIEFS[1].priv"),'Institutional research flag: 31% of your entering class currently borrows above the proposed cap threshold. Yield exposure is concentrated in your out-of-state applicants.');
  assert.match(run('EVENTS[1][0].d'),/Yield softens immediately across the out-of-state pool/);
  assert.equal(run('EVENTS[1][0].f({held:[14]}).notes[0]'),'Scholarship pool absorbed half the yield loss');
  assert.match(run('timingText(CARD(12),ME,1)'),/Adds additional findings in annual briefing starting Year 2/);
  run("S.phase='final';renderTeam();");assert.doesNotMatch(app.innerHTML,/of 100/);assert.match(app.innerHTML,/Total score:/);
  run("TEAMS=[ME];BOARD=[{id:1,name:'Table 1',s:score(ME)}];S.phase='locked';");await run('renderFac()');
  assert.match(app.innerHTML,/Board Ask/);assert.match(app.innerHTML,/mentor plays the board chair/);
  assert.match(app.innerHTML,/Deliberation closed/);assert.match(app.innerHTML,/Calculate|Show/);
});


test('annual briefing precedes finances and orange research notice follows purchase year', () => {
  const {app,run}=appContext();
  for (const year of [1,2,3]) {
    run(`S={round:${year},phase:'brief',tables:1}; ME=newTeam(1); ROLE='team'; CART=[]; renderTeam();`);
    const html=app.innerHTML;
    assert(html.indexOf('annual-briefing-title') < html.indexOf('class="ledgers"'));
    assert.match(html,/class="planning"/);
    assert(html.indexOf('class="ledgers"') < html.indexOf('class="finance-dock"'));
    assert(html.indexOf('class="finance-dock"') < html.indexOf('class="grid"'));
    assert.doesNotMatch(html,/You are taking the chair|opens on decisions you did not make/);
    assert.match(run(`cardEl(CARD(12),ME)`),new RegExp(`class="cflag rest">Adds additional findings in annual briefing starting Year ${year+1}`));
    if(year===3) assert.match(run('cardEl(CARD(12),ME)'),/after the exercise/);
  }
  run('ME.held=[12]; ME.bought={12:1}; renderTeam();');
  assert.match(app.innerHTML,/Additional institutional research finding for your table:/);
  assert.match(run('timingText(CARD(12),ME,3)'),/starting Year 2/);
  assert.doesNotMatch(app.innerHTML,/Branch campus development and pro forma/);
});

test('renumbered catalog does not reuse previous session keys', async () => {
  const {run}=appContext();
  await run("sset('mm:state',{round:2,phase:'brief',tables:1})");
  await run("sset('mm:team:1',{held:[9,13,15]})");
  assert.equal(await run('sget(K.state)'),null);
  assert.equal(await run('sget(K.team(1))'),null);
  assert.equal(await run("sget('mm:state').then(s=>s.round)"),2);
});

test('five-year outlook respects revenue timing, cash and recorded results', () => {
  const {run}=appContext();
  run('const t=newTeam(1);const before=JSON.stringify(t);const plan=financialOutlook(t,[5,11,13],1);');
  assert.equal(run('JSON.stringify(t)'),run('before'));
  assert.equal(run('plan.rows.length'),5);
  assert.equal(run('plan.rows[0].margin'),-150000);
  assert.equal(run('plan.rows[1].margin'),3050000);
  assert.equal(run('plan.rows[2].margin'),3650000);
  assert.equal(run('plan.cumulative'),13850000);
  assert.equal(run('plan.selectionImpact'),1350000);
  assert.equal(run('plan.rows[4].reserve'),26850000);
  assert.equal(run('plan.rows[4].fund'),3750000);
  run('t.pending=[5,11];resolveRound(t,1);const later=financialOutlook(t,[13],2);');
  assert.equal(run('later.endYear'),6);
  assert.equal(run('later.rows.filter(r=>!r.recorded).length'),5);
  assert.equal(run('later.rows.length'),6);
  assert.equal(run('later.rows[0].year'),1);
  assert.equal(run('later.rows[0].recorded'),true);
  for(const [rowKey,logKey] of [['revenue','rev'],['expense','exp'],['margin','margin'],['reserve','reserve']]){
    assert.equal(run(`later.rows[0].${rowKey}`),run(`t.log[0].${logKey}`));
  }
  assert.equal(run('later.rows[1].reserve'),run('t.reserve+later.rows[1].margin'));
  assert.equal(run('later.rows[2].reserve'),run('later.rows[1].reserve+later.rows[2].margin'));
  // Advancement selected in Year 2 first earns revenue in Year 4.
  assert.equal(run('later.rows[2].revenue'),run('revenueOf(t,3)'));
  assert.equal(run('later.rows[3].revenue'),run('revenueOf(t,4)+CARD(13).rev'));
  assert.equal(run('financialOutlook(t,[],1).rows[1].reserve'),run('t.reserve+revenueOf(t,2)-expenseOf(t)'));
  const html=run('planningYears(t,[13],2)');
  assert.match(html,/Five-year financial outlook/);
  assert.doesNotMatch(html,/<p |<caption>|NaN|Infinity|scenario, not a forecast/);
  assert.equal((html.match(/<svg /g)||[]).length,1);
  assert.equal((html.match(/<tr>/g)||[]).length,7);
  assert.match(html,/Five-year financial outlook · Years 1–6/);
  assert.doesNotMatch(html,/Operating revenue and expenses/);
  assert.match(html,/Operating reserve at year-end/);
});

test('submitted cards remain highlighted, with a year-specific status', async () => {
  const {app,run}=appContext({inputs:{decName:{value:'Gev'},disName:{value:''}}});
  run("S={round:2,phase:'brief',tables:1};ME=newTeam(1);ME.held=[3];ME.bought={3:1};ROLE='team';CART=[5];renderTeam();");
  assert.match(app.innerHTML,/Selected - Year 2/);
  await run('sset(K.state,S)');await run('sset(K.team(1),ME)');await run('lockIn()');
  assert.match(app.innerHTML,/Year 2 submitted investments/);
  assert.match(app.innerHTML,/Submitted - Year 2/);
  assert.match(app.innerHTML,/Purchased - Year 1/);
  assert.match(run('cardEl(CARD(5),ME,ME.locked[2],true)'),/class="card on" disabled/);
  for(const phase of ['locked','reveal']){
    run(`S.phase='${phase}';renderTeam();`);
    assert.match(app.innerHTML,/Five-year financial outlook/);
  }
});

test('facilitator standings show actual purchases grouped by year', async () => {
  const {app,run}=appContext();
  run("S={round:1,phase:'brief',tables:2};const first=newTeam(1),second=newTeam(2);first.pending=[3];resolveRound(first,1);resolveRound(second,1);TEAMS=[first,second];BOARD=TEAMS.map(t=>({id:t.id,name:t.name,s:score(t)}));");
  await run('renderFac()');
  assert.equal((app.innerHTML.match(/Purchased investments by year/g)||[]).length,2);
  assert.match(run('purchaseHistory(first)'),/Year 1 · 1 purchased/);
  assert.match(run('purchaseHistory(first)'),/Cybersecurity uplift/);
  assert.match(run('purchaseHistory(first)'),/Year 2 · not closed/);
  assert.match(run('purchaseHistory(second)'),/No investments purchased/);
  run('first.locked[2]=[5];');
  assert.doesNotMatch(run('purchaseHistory(first)'),/MS in Clinical AI/);
  assert.doesNotMatch(run('boardTable(1)'),/Purchased investments by year/);
});

test('outlook table and reserve graph retain Year 1 while the projection advances', () => {
  const {run}=appContext();
  run('const team=newTeam(1);');
  for(let year=1;year<=3;year++){
    const html=run(`planningYears(team,[],${year})`);
    assert.equal((html.match(/<svg /g)||[]).length,1);
    assert.equal((html.match(/<tr>/g)||[]).length,year+5);
    assert.match(html,/Year 1 · (recorded|projected)<\/td>/);
    assert.match(html,new RegExp(`Five-year financial outlook · Years 1–${year+4}`));
    assert.equal((html.match(/data-year=/g)||[]).length,year+4);
    assert.match(html,/data-year="1"/);
    assert.match(html,new RegExp(`data-year="${year+4}"`));
    assert.equal((html.match(/data-status="recorded"/g)||[]).length,year-1);
    assert.equal((html.match(/data-status="projected"/g)||[]).length,5);
    assert.doesNotMatch(html,/NaN|Infinity|Operating revenue and expenses/);
    run(`team.pending=[];resolveRound(team,${year});`);
    const closed=run(`planningYears(team,[],${year})`);
    assert.equal((closed.match(/data-status="recorded"/g)||[]).length,year);
    assert.equal((closed.match(/data-status="projected"/g)||[]).length,4);
    assert.match(closed,new RegExp(`Year ${year} · recorded · Reserve: `));
  }
});
test('reserve graph handles negative and zero balances', () => {
  const {run}=appContext();
  for(const reserve of [0,-10000000,13000000]){
    const html=run(`outlookGraph(Array.from({length:5},(_,i)=>({year:i+1,reserve:${reserve},recorded:i===0})))`);
    assert.doesNotMatch(html,/NaN|Infinity/);
    assert.match(html,/reserve-recorded/);
    assert.match(html,/reserve-projected/);
  }
});

test('eight-table polling and card changes preserve CFO drafts, focus and selection', async () => {
  const {run,field,json}=appContext({liveDOM:true});
  run("S={round:1,phase:'brief',tables:8};ME=newTeam(1);ROLE='team';");
  await run('sset(K.state,S)');
  for(let i=1;i<=8;i++)await run(`sset(K.team(${i}),newTeam(${i}))`);
  await run('loop()');
  field('decName').value='Gev';
  field('disName').value='Draft argument';
  run("ME.deciders[1]='Gev';ME.dissent[1]='Draft argument';");
  field('disName').focus();field('disName').setSelectionRange(2,7,'forward');
  await run('loop()'); // An idle poll replaces ME, but does not replace the DOM.
  assert.equal(run("ME.deciders[1]||''"),'');
  run('pick(5)');
  assert.equal(field('decName').value,'Gev');
  assert.equal(field('disName').value,'Draft argument');
  assert.equal(run('document.activeElement===document.getElementById("disName")'),true);
  assert.equal(field('disName').selectionStart,2);
  assert.equal(field('disName').selectionEnd,7);
  for(let id=2;id<=8;id++){
    await run(`(async()=>{const other=await sget(K.team(${id}));other.locked[1]=[3];await sset(K.team(${id}),other)})()`);
    await run('loop()');
    assert.equal(field('decName').value,'Gev');
    assert.equal(field('disName').value,'Draft argument');
    assert.deepEqual(json('CART'),[5]);
  }
  await run('lockIn()');
  assert.equal(run('ME.deciders[1]'),'Gev');
  assert.equal(run('ME.dissent[1]'),'Draft argument');
  assert.equal(field('decName').disabled,true);
  assert.deepEqual(json('FORM_DRAFT'),{});
  await run('unlockYear()');
  assert.equal(field('decName').value,'Gev');
  await run("sset(K.state,{round:2,phase:'brief',tables:8})");
  await run('loop()');
  assert.equal(field('decName').value,'');
  assert.equal(field('disName').value,'');
});

test('facilitator drafts survive team updates and clear only after the matching action succeeds', async () => {
  const {run,field}=appContext({liveDOM:true});
  run("ROLE='fac';S={round:1,phase:'brief',tables:8};");
  await run('sset(K.state,S)');
  for(let i=1;i<=8;i++)await run(`sset(K.team(${i}),newTeam(${i}))`);
  await run('loop()');
  field('adjT').value='2';field('adjP').value='3';field('adjN').value='Mentor ruling';
  field('cashT').value='3';field('cashV').value='25000';
  await run("(async()=>{const other=await sget(K.team(8));other.cfo='Another CFO';await sset(K.team(8),other)})()");
  await run('loop()');
  assert.equal(field('adjT').value,'2');assert.equal(field('adjN').value,'Mentor ruling');
  assert.equal(field('cashT').value,'3');assert.equal(field('cashV').value,'25000');
  await run('applyAdj()');
  assert.equal(field('adjP').value,'');assert.equal(field('adjN').value,'');
  assert.equal(field('cashV').value,'25000');
  assert.equal(await run('sget(K.team(2)).then(t=>t.adj[0].pts)'),3);
  await run('applyCash()');
  assert.equal(field('cashV').value,'');
  assert.equal(await run('sget(K.team(3)).then(t=>t.reserve)'),13025000);
});

test('failed submissions retain drafts and selections, and reset removes drafts', async () => {
  const messages=[];
  const {run,field,json}=appContext({liveDOM:true,alert:message=>messages.push(message)});
  run("ROLE='team';S={round:1,phase:'brief',tables:1};ME=newTeam(1);CART=[5];");
  await run('sset(K.state,S)');await run('sset(K.team(1),ME)');
  await run('loop()');
  field('decName').value='Gev';field('disName').value='Keep this';
  run('const originalSet=sset;sset=async()=>false;');
  await run('lockIn()');
  assert.equal(messages.length,1);
  assert.deepEqual(json('CART'),[5]);
  assert.equal(run('Object.hasOwn(ME.locked,1)'),false);
  run('render()');
  assert.equal(field('decName').value,'Gev');assert.equal(field('disName').value,'Keep this');
  run('sset=originalSet;');
  await run('sdel(K.state)');await run('loop()');
  assert.deepEqual(json('FORM_DRAFT'),{});
  await run('sset(K.state,{round:1,phase:"brief",tables:1})');
  await run('loop()');
  assert.equal(field('decName').value,'');
  assert.equal(field('disName').value,'');
});

test('projection toggles between leaderboard and current public signals during deliberation', () => {
  const {app,run}=appContext();
  for(const year of [1,2,3]){
    run(`S={round:${year},phase:'brief',tables:8};BOARD=[{id:1,name:'Table 1',s:score(newTeam(1))}];renderProj();`);
    assert.match(app.innerHTML,/Show environmental signals/);
    assert.match(app.innerHTML,/<table>/);
    run('toggleProjection()');
    assert.match(app.innerHTML,/Show leaderboard/);
    assert.match(app.innerHTML,/aria-pressed="true"/);
    assert.doesNotMatch(app.innerHTML,/<table>/);
    for(const signal of JSON.parse(run(`JSON.stringify(BRIEFS[${year}].sig)`)))assert(app.innerHTML.includes(signal));
    for(const otherYear of [1,2,3]){
      assert(!app.innerHTML.includes(run(`BRIEFS[${otherYear}].priv`)));
      if(otherYear!==year)assert(!app.innerHTML.includes(run(`BRIEFS[${otherYear}].sig[0]`)));
    }
    run('renderProj()');assert.match(app.innerHTML,/Show leaderboard/);
    run('toggleProjection()');assert.match(app.innerHTML,/<table>/);
  }
});

test('projection signal view survives polling and yields to events and later stages', async () => {
  const {app,run}=appContext();
  run("ROLE='proj';S={round:1,phase:'brief',tables:8};");
  await run('sset(K.state,S)');
  for(let id=1;id<=8;id++)await run(`sset(K.team(${id}),newTeam(${id}))`);
  await run('loop()');run('toggleProjection()');
  await run("(async()=>{const team=await sget(K.team(8));team.locked[1]=[3];await sset(K.team(8),team)})()");
  await run('loop()');
  assert.match(app.innerHTML,/Show leaderboard/);
  assert.equal(run('PROJ_SIGNALS'),true);
  await run("sset(K.state,{round:1,phase:'reveal',tables:8})");await run('loop()');
  assert.match(app.innerHTML,/What happened/);
  assert.doesNotMatch(app.innerHTML,/toggleProjection/);
  run('toggleProjection()');assert.match(app.innerHTML,/What happened/);
  for(const phase of ['locked','resolved','final']){
    run(`S.phase='${phase}';renderProj();`);
    assert.doesNotMatch(app.innerHTML,/toggleProjection/);
    assert.match(app.innerHTML,/<table>/);
  }
  run("S={round:2,phase:'brief',tables:8};renderProj();");
  assert.match(app.innerHTML,/Show environmental signals/);
  assert.match(app.innerHTML,/<table>/);
  run('toggleProjection();S=null;renderProj();');
  assert.match(app.innerHTML,/Waiting for the facilitator/);
  assert.equal(run('PROJ_SIGNALS'),false);
});


test('rollback traverses stages and years, preserves decisions and rulings, and recalculates once', async () => {
  const {run,json,app}=appContext();
  run("ROLE='fac';S={round:1,phase:'brief',tables:2};const original=newTeam(1);original.locked[1]=[3,14];original.pending=[3,14];original.deciders[1]='Alex';original.dissent[1]='Save cash';");
  await run('sset(K.state,S)');await run('sset(K.team(1),original)');await run('sset(K.team(2),newTeam(2))');
  const before=json('ledgerSnapshot(original)');
  await run("setPhase('locked')");await run("setPhase('reveal')");await run('doResolve()');
  const calculated=json('ledgerSnapshot(TEAMS[0])');
  assert.equal(run('S.phase'),'calculated');
  assert.deepEqual(json('ledgerSnapshot(visibleTeam(TEAMS[0]))'),before);
  assert.match(app.innerHTML,/Show Year 1 results/);
  assert(app.innerHTML.indexOf('Roll back one stage')<app.innerHTML.indexOf('>Refresh<'));
  await run("setPhase('resolved')");
  await run("(async()=>{const t=await sget(K.team(1));t.reserve+=1234;t.adj.push({pts:2,note:'Ruling'});await sset(K.team(1),t)})()");
  await run('nextRound()');
  await run("facEnter(1)"); // Cancelled prompt keeps Year 2 untouched.
  await run('rollbackStage()');assert.equal(run('S.round'),1);assert.equal(run('S.phase'),'resolved');
  await run('rollbackStage()');assert.equal(run('S.phase'),'calculated');
  await run('rollbackStage()');assert.equal(run('S.phase'),'reveal');
  const restored=json('ledgerSnapshot(TEAMS[0])');assert.equal(restored.reserve,before.reserve+1234);
  restored.reserve-=1234;assert.deepEqual(restored,before);
  assert.equal(run('TEAMS[0].adj[0].pts'),2);
  await run('rollbackStage()');await run('rollbackStage()');assert.equal(run('S.phase'),'brief');
  assert.deepEqual(json('TEAMS[0].locked[1]'),[3,14]);assert.equal(run("TEAMS[0].deciders[1]"),'Alex');assert.equal(run("TEAMS[0].dissent[1]"),'Save cash');
  await run('rollbackStage()');assert.equal(run('S.phase'),'brief');
  await run("setPhase('locked')");await run("setPhase('reveal')");await run('doResolve()');
  const again=json('ledgerSnapshot(TEAMS[0])');again.reserve-=1234;assert.deepEqual(again,calculated);
  await run('doResolve()');assert.equal(run('TEAMS[0].log.length'),1);
  await run("setPhase('resolved')");await run('nextRound()');
  await run("(async()=>{const t=await sget(K.team(1));t.locked[2]=[1,2];t.pending=[1,2];t.deciders[2]='Jamie';await sset(K.team(1),t)})()");
  await run("setPhase('locked')");await run("setPhase('reveal')");await run('doResolve()');await run("setPhase('resolved')");
  for(let i=0;i<5;i++)await run('rollbackStage()');
  assert.equal(run('S.round'),1);assert.equal(run('S.phase'),'resolved');
  assert.deepEqual(json('TEAMS[0].locked[2]'),[1,2]);
  await run('nextRound()');await run("setPhase('locked')");await run("setPhase('reveal')");await run('doResolve()');
  assert.equal(run('TEAMS[0].log.length'),2);assert.equal(run('TEAMS[0].held.filter(id=>id===1).length'),1);
});

test('card differentials distinguish storm costs, mission benefits, and conditional insurance', () => {
  const {run,json}=appContext();
  run("const storm=EVENTS[2][0],team=newTeam(1);team.held=[1,2];const result=storm.f(team);");
  const diffs=json('eventDifferentials(storm,team,result)');
  assert.equal(diffs.length,2);
  assert.match(diffs[0].text,/card 1.*\$1,500,000 instead of \$3,000,000/);
  assert.match(diffs[1].text,/card 2.*raw mission point change was -1 instead of -5/);
  run('team.held=[3,4];const cyber=EVENTS[1][1];');
  const cyber=json('eventDifferentials(cyber,team,cyber.f(team))');
  assert.match(cyber.find(d=>d.id===4).text,/\$50,000 instead of \$300,000/);
  assert.match(cyber.find(d=>d.id===3).text,/\$50,000 instead of \$2,400,000/);
  run('team.held=[4]');assert.match(run('eventDifferentials(cyber,team,cyber.f(team))[0].text'),/no event payout.*annual premium still applies/);
});

test('projection shows all category deltas, recorded score trends and five projected years without mutating teams', () => {
  const {run,json,app}=appContext();
  run("S={round:3,phase:'resolved',tables:2};const active=newTeam(1),idle=newTeam(2);active.locked={1:[3,14],2:[1,2],3:[11]};for(let y=1;y<=3;y++){active.pending=active.locked[y];resolveRound(active,y);resolveRound(idle,y)}TEAMS=[active,idle];BOARD=TEAMS.map(t=>({id:t.id,name:t.name,s:score(t)}));const saved=JSON.stringify(TEAMS);renderProj();");
  assert.equal((app.innerHTML.match(/class="score-change/g)||[]).length,10);
  assert.match(app.innerHTML,/Score over the years/);assert.match(app.innerHTML,/Year 8/);assert.doesNotMatch(app.innerHTML,/NaN|Infinity/);
  const rows=json('scoreSeries(active)');assert.equal(rows.filter(r=>!r.recorded).length,5);
  assert.equal(rows.find(r=>r.year===3).total,run('score(active).total'));
  assert.equal(run('JSON.stringify(TEAMS)'),run('saved'));
  run("S.phase='calculated';renderProj()");assert.doesNotMatch(app.innerHTML,/Year 8/);
  assert.equal(run('scoreSeries(active).at(-1).year'),2);
});

test('final reports name actual purchases and differentials, include download links, and escape participant names', () => {
  const {run,app}=appContext();
  run("const t=newTeam(1);for(let y=1;y<=3;y++){t.pending=y===1?[1,2]:[];resolveRound(t,y)}t.deciders[2]='<img onerror=evil>';S={round:3,phase:'final',tables:1};TEAMS=[t];ME=t;BOARD=[];renderTeam();");
  assert.match(app.innerHTML,/Download full scoring guide/);assert.match(app.innerHTML,/downloadDecisionReport\(1\)/);
  assert.match(app.innerHTML,/card 1/);assert.match(app.innerHTML,/&lt;img onerror=evil&gt;/);
  const report=run('decisionMarkdown(t)');assert.match(report,/Card 1:/);assert.match(report,/\$1,500,000 instead of \$3,000,000/);
});

test('failed calculation and rollback writes are retryable without duplicate purchases', async () => {
  const {run}=appContext();
  run("ROLE='fac';S={round:1,phase:'reveal',tables:2};const t=newTeam(1);t.locked[1]=[3];const original=sset;");
  await run('sset(K.state,S)');await run('sset(K.team(1),t)');await run('sset(K.team(2),newTeam(2))');
  run('let fail=true;sset=async(k,v)=>k===K.team(2)&&fail?false:original(k,v)');
  await run('doResolve()');assert.equal(run('S.phase'),'reveal');assert.equal(run('BUSY'),false);
  run('fail=false');await run('doResolve()');assert.equal(run('S.phase'),'calculated');assert.equal(run('TEAMS[0].held.length'),1);
  run('fail=true');await run('rollbackStage()');assert.equal(run('S.phase'),'calculated');assert.equal(run('BUSY'),false);
  run('fail=false');await run('rollbackStage()');assert.equal(run('S.phase'),'reveal');assert.equal(run('TEAMS[0].held.length'),0);
});


test('retained future decisions cannot repurchase an investment moved into an earlier year', async () => {
  const {run,json}=appContext();
  run("ROLE='fac';S={round:1,phase:'reveal',tables:1};const t=newTeam(1);t.locked={1:[1],2:[1,2]};");
  await run('sset(K.state,S)');await run('sset(K.team(1),t)');
  await run('doResolve()');await run("setPhase('resolved')");await run('nextRound()');
  await run("setPhase('locked')");await run("setPhase('reveal')");await run('doResolve()');
  assert.deepEqual(json('TEAMS[0].locked[2]'),[1,2]);
  assert.deepEqual(json('TEAMS[0].log[1].purchases.map(p=>p.id)'),[2]);
  assert.equal(run('TEAMS[0].held.filter(id=>id===1).length'),1);
  assert.equal(run('TEAMS[0].bought[1]'),1);
});

test('legacy saved ledgers rewind without snapshots and retain cash rulings', async () => {
  const {run,json}=appContext();
  run("ROLE='fac';S={round:2,phase:'calculated',tables:1};const t=newTeam(1);t.locked={1:[3,14],2:[1,2]};t.pending=t.locked[1];resolveRound(t,1);const before=ledgerSnapshot(t);t.pending=t.locked[2];resolveRound(t,2);for(const l of t.log){delete l.before;delete l.scoreBefore;delete l.scoreAfter}t.reserve+=1234;");
  await run('sset(K.state,S)');await run('sset(K.team(1),t)');await run('rollbackStage()');
  const restored=json('ledgerSnapshot(TEAMS[0])');restored.reserve-=1234;
  assert.deepEqual(restored,json('before'));
  assert.deepEqual(json('TEAMS[0].locked[2]'),[1,2]);
});


test('scholarship explanations match next-year tuition and mature bridge margin protection', () => {
  const {run}=appContext();
  run('const protectedTeam=newTeam(1),exposedTeam=newTeam(2);protectedTeam.pending=[6,14];exposedTeam.pending=[6];resolveRound(protectedTeam,1);resolveRound(exposedTeam,1);');
  const explanation=run('protectedTeam.log[0].events[0].differential.find(d=>d.id===14).text');
  assert.match(explanation,/From Year 2.*\$1,411,200 per year/);
  assert.match(explanation,/margin benefit is \$611,200/);
  assert.match(explanation,/\$1,400,000 instead of \$1,190,000/);
  assert.match(explanation,/revenue protection is \$1,621,200/);
  assert.match(explanation,/margin benefit after card 14’s expense is \$821,200/);
  assert.equal(run('protectedTeam.log[0].margin-exposedTeam.log[0].margin'),-800000);
  run('resolveRound(protectedTeam,2);resolveRound(exposedTeam,2);');
  assert.equal(run('protectedTeam.log[1].margin-exposedTeam.log[1].margin'),821200);
});

test('AI revenue explanation respects maturity and succession explains redundant protection', () => {
  const {run}=appContext();
  run("const t=newTeam(1);t.held=[5,11];t.bought={5:3,11:3};const ai=EVENTS[3][0];");
  const explanation=run('eventDifferentials(ai,t,ai.f(t),3).find(d=>d.id===11).text');
  assert.match(explanation,/from Year 4.*\$3,200,000 instead of \$1,920,000/);
  assert.match(explanation,/margin benefit is \$1,180,000/);
  assert.match(explanation,/Earlier lost revenue is not restored/);
  run('t.held=[7,8];const omm=EVENTS[2].find(e=>e.n.startsWith("OMM chair"));');
  assert.match(run('eventDifferentials(omm,t,omm.f(t),2).find(d=>d.id===7).text'),/no additional protection.*takes precedence/);
  run('t.held=[5,12]');
  assert.match(run('eventDifferentials(ai,t,ai.f(t),3).find(d=>d.id===5).text'),/card 12 remains.*does not double/);
});

test('downloadable guide includes supplied event sections, manual limits and completed card 14 values', () => {
  const guide=fs.readFileSync(path.join(__dirname,'..','docs','card-impact-differential-explanations.md'),'utf8');
  assert.equal((guide.match(/^## Year [123]:/gm)||[]).length,7);
  assert.match(guide,/Combined citation consequence/);
  assert.match(guide,/points override subtracts four total points/);
  assert.match(guide,/Existing override controls do not add a recurring expense/);
  assert.match(guide,/\*\*\$821,200\*\*/);
  assert.match(guide,/\| 14 \| Scholarship and tuition discount pool .*\| 4 \| 0 \| 3 \|/);
});
