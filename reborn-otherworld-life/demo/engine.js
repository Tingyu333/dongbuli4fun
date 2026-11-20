// 重生異世界人生・引擎
// 一生怎麼跑，逐條照私人 repo 的 tools/sim_01.py（模擬器）寫，玩起來的機率才會跟模擬一致。
// 畫面在 index.html；這支只管規則，瀏覽器和 node（驗證用）都能跑。
//
// 用法：
//   const sc = new Reborn.Scene(data);
//   const life = new Reborn.Life(sc, seed, ctl);   // ctl.policy(life) 回傳今年的方針
//   const it = life.run();                          // generator
//   let r = it.next();  r.value = {type:'choice', ...} 要玩家選；{type:'year'} 一年結束
//   it.next(選項編號) 繼續
(function (root) {
    'use strict';

    // ---------- 亂數（種子固定就會骰出一樣的結果，rules 15-1） ----------
    function makeRng(seed) {
        let a = seed >>> 0;
        const f = function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));   // Python randint
        f.choice = arr => arr[Math.floor(f() * arr.length)];
        return f;
    }

    function wpick(rng, items, weights) {
        let total = 0;
        for (const w of weights) total += w;
        if (total <= 0) return null;
        let r = rng() * total;
        for (let i = 0; i < items.length; i++) {
            r -= weights[i];
            if (r < 0) return items[i];
        }
        return items[items.length - 1];
    }
    const tablePick = (rng, rows) => wpick(rng, rows, rows.map(r => r.prob));
    const TIER_ORDER = ['必成', '安全', '普通', '冒險', '賭命'];

    // ---------- 資料檔解碼（tools/pack_01.py 的反過來） ----------
    const KEY = 0x5EB0C1A7;
    function unxor(bytes) {
        let s = KEY & 0x7fffffff;
        for (let i = 0; i < bytes.length; i++) {
            s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
            bytes[i] ^= (s >>> 16) & 0xff;
        }
        return bytes;
    }
    function b64bytes(b64) {
        if (typeof atob === 'function') {
            const bin = atob(b64);
            const out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
        }
        return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    // inflate：給一個函式（瀏覽器用 DecompressionStream、node 用 zlib）
    async function decodeData(text, inflate) {
        if (text.slice(0, 4) !== 'RBL1') throw new Error('資料檔格式不對');
        const packed = unxor(b64bytes(text.slice(4).trim()));
        const raw = await inflate(packed);
        return JSON.parse(raw);
    }
    async function browserInflate(bytes) {
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        return await new Response(stream).text();
    }

    // =====================================================================
    // 場景（載入、預先編譯）
    // =====================================================================
    class Scene {
        constructor(data) {
            this.d = data;
            const p = this.p = data.params;
            this.L = p.level;
            this.events = {};
            for (const e of data.events) this.events[e.id] = e;
            this.order = p.tags;
            this.ordered = new Set(Object.keys(p.tag_order).filter(k => p.tag_order[k] === true));
            this.prefix = p.tag_prefix_match;
            for (const e of data.events) {
                e._cond = this.compile(e.cond);
                for (const o of e.options) o._cond = this.compile(o.cond);
                const w = p.weight_override[e.id];
                e._w = typeof w === 'number' ? w : e.weight;
            }
            for (const en of data.endings) en._cond = this.compile(en.cond);
            const ordIdx = {};
            p.ending_order.forEach((no, i) => { ordIdx[no] = i; });
            this.endings = data.endings.slice().sort((a, b) => ordIdx[a.no] - ordIdx[b.no]);
            const targeted = new Set();
            for (const e of data.events) if (e.followup) for (const t of e.followup.targets) targeted.add(t.id);
            this.fixed = {};
            for (const e of data.events) {
                if (e.scheduled_age !== null && e.scheduled_age !== undefined) {
                    (this.fixed[e.scheduled_age] = this.fixed[e.scheduled_age] || []).push(e.id);
                }
            }
            for (const [eid, age] of Object.entries(p.schedule_override || {})) {
                if (this.events[eid] && Number.isInteger(age)) {
                    const lst = this.fixed[age] = this.fixed[age] || [];
                    if (!lst.includes(eid)) lst.push(eid);
                }
            }
            const fixedIds = new Set();
            for (const lst of Object.values(this.fixed)) for (const i of lst) fixedIds.add(i);
            this.fixedGroups = {};
            for (const [age, ids] of Object.entries(this.fixed)) {
                const groups = new Map();
                for (const i of ids) {
                    const key = i.split('-').slice(0, 2).join('-');
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(i);
                }
                this.fixedGroups[age] = [...groups.values()];
            }
            this.variants = {};
            for (const en of data.endings) {
                for (const t of en.texts) if (t.variant) t._cond = this.compile(t.variant_cond || []);
                for (const t of en.titles || []) if (t.variant) t._cond = this.compile(t.variant_cond || []);
            }
            const ex = p.exposure;
            this.fuses = ex.fuses.filter(i => this.events[i]).map(i => this.events[i]);
            const excluded = new Set([...targeted, ...fixedIds, ...ex.fuses, ...ex.trial_events]);
            this.bigPool = data.events.filter(e => e.kind === '大' && !excluded.has(e.id));
            this.smallPool = data.events.filter(e => e.kind === '小' && !excluded.has(e.id));
            this.cps = {};
            this.cpAge = {};
            for (const [k, v] of Object.entries(p.choice_points)) { this.cps[+k] = v; this.cpAge[v] = +k; }
            this.cands = {};
            for (const e of data.events) {
                if (e.kind === '選擇' && e.point !== null && e.point !== undefined) {
                    (this.cands[e.point] = this.cands[e.point] || []).push(e);
                }
            }
            this.trial = new Set(ex.trial_events);
            const ageRange = e => {
                let lo = 0, hi = 999;
                for (const g of e.cond) {
                    if (g.length === 1 && g[0].t === 'age') { lo = Math.max(lo, g[0].min); hi = Math.min(hi, g[0].max); }
                }
                return [lo, hi];
            };
            this.bigByAge = [];
            this.smallByAge = [];
            for (let a = 0; a <= p.max_age; a++) {
                this.bigByAge.push(this.bigPool.filter(e => { const r = ageRange(e); return r[0] <= a && a <= r[1]; }));
                this.smallByAge.push(this.smallPool.filter(e => { const r = ageRange(e); return r[0] <= a && a <= r[1]; }));
            }
            this.systems = {};
            for (const s of p.systems) this.systems[s.name] = s;
            for (const e of data.events) {
                e._sys = null;
                for (const g of e.cond) for (const a of g) {
                    if (e._sys === null && a.t === 'cmp' && a.var === '系統' && a.op === '=') e._sys = a.value;
                }
            }
            this.rareBig = new Set((data.stats && data.stats.rare_big) || []);
        }

        // ----- 條件：外層每一組都要符合，組裡面任一個符合就算 -----
        compile(cond) {
            const groups = cond.map(g => g.map(a => this.compileAtom(a)));
            if (!groups.length) return () => true;
            return life => {
                for (const g of groups) {
                    let ok = false;
                    for (const a of g) { if (a(life)) { ok = true; break; } }
                    if (!ok) return false;
                }
                return true;
            };
        }

        compileAtom(a) {
            const t = a.t;
            if (t === 'age') { const lo = a.min, hi = a.max; return life => lo <= life.age && life.age <= hi; }
            if (t === 'flag') {
                const name = a.name;
                return a.neg ? (life => !life.flags.has(name)) : (life => life.flags.has(name));
            }
            const v = a.var, op = a.op, val = a.value;
            if (this.p.tags[v]) {
                const prefixes = this.prefix[v] || [];
                if (op === '=' || op === '≠') {
                    const eq = prefixes.includes(val)
                        ? (life => (life.tags[v] || '').startsWith(val))
                        : (life => life.tags[v] === val);
                    return op === '=' ? eq : (life => !eq(life));
                }
                const seq = this.order[v];
                const iv = seq.indexOf(val);
                const cmp = { '≥': x => x >= iv, '≤': x => x <= iv, '>': x => x > iv, '<': x => x < iv }[op];
                return life => cmp(seq.indexOf(life.tags[v]));
            }
            if (v === '結束原因') return op === '=' ? (life => life.cause === val) : (life => life.cause !== val);
            if (v === '死因標記') return op === '=' ? (life => life.deathTags.has(val)) : (life => !life.deathTags.has(val));
            const get = {
                '戰力': life => life.power(),
                '主屬性': life => life.v[life.mainAttr()],
                '工作比例': life => life.workRatio(),
            }[v] || (life => life.v[v] || 0);
            return {
                '≥': life => get(life) >= val, '≤': life => get(life) <= val,
                '>': life => get(life) > val, '<': life => get(life) < val,
                '=': life => get(life) === val, '≠': life => get(life) !== val,
            }[op];
        }
    }

    // =====================================================================
    // 一生
    // =====================================================================
    // ctl.policy(life)：每年開始時問今年的方針（玩家的存檔、或驗證用的機器人）
    class Life {
        constructor(sc, seed, ctl) {
            this.sc = sc;
            this.seed = seed >>> 0;
            this.rng = makeRng(this.seed);
            this.ctl = ctl || {};
            const p = this.p = sc.p;
            const rng = this.rng;
            this.v = {};
            for (const k of p.bars) this.v[k] = 0;
            for (const a of p.affection) this.v['好感.' + a] = 0;
            for (const [k, val] of Object.entries(p.start_default)) this.v[k] = +val;
            const o = wpick(rng, p.origins, p.origins.map(x => x.prob));
            this.origin = o;
            for (const [k, val] of Object.entries(o.start)) this.v[k] = +val;
            for (const [k, val] of Object.entries(o.affection || {})) this.v['好感.' + k] = +val;
            this.tags = Object.assign({}, p.tag_start);
            this.tags['出身'] = o.name;
            Object.assign(this.tags, o.tags || {});
            this.tags['性別'] = wpick(rng, Object.keys(p.gender), Object.values(p.gender));
            this.tags['前世死因'] = wpick(rng, Object.keys(p.past_death), Object.values(p.past_death));
            const s = wpick(rng, p.systems, p.systems.map(x => x.prob));
            this.sys = s;
            this.tags['系統'] = s.name;
            this.sysXp = 0;
            this.sysReady = p.system.active_start_age;
            this.haloUsed = false;
            const sp = p.system;
            this.taskAges = [];
            for (let i = 0; i < sp.tasks; i++) {
                if (rng() < sp.task_clear) this.taskAges.push(rng.int(sp.task_age[0], sp.task_age[1]));
            }
            this.comeback = o.comeback;
            this.talentComeback = 1.0;
            this.train = null;
            this.agingDelay = o.aging_delay || 0;
            this.flags = new Set();
            this.age = 0;
            this.cause = null;
            this.policy = p.start_policy;
            this.adultYears = 0;
            this.adultWork = 0;
            this.policyYears = {};
            this.scheduled = {};
            this.used = new Set();
            this.lastSmall = null;
            this.smallCounts = {};
            this.smallLastAge = {};
            this.played = {};
            this.choicesSeen = 0;
            this.extraChoices = 0;
            this.modernUsed = 0;
            this.deathEvent = null;
            this.deathOption = null;
            this.noCandidate = [];
            this.deathTags = new Set();
            this.deathText = null;
            this.met = new Set(Object.entries(o.affection || {}).filter(kv => kv[1] > 0).map(kv => '好感.' + kv[0]));
            // NPC 性別（只影響文字；用另一條亂數，不動到一生的亂數順序）
            const ur = makeRng(this.seed ^ 0x9E3779B9);
            this.npcGender = {};
            for (const [k, t] of Object.entries(p.npc_gender || {})) this.npcGender[k] = wpick(ur, Object.keys(t), Object.values(t));
            this.log = [];      // 給畫面看的流水帳
            this._fx = null;    // 正在收集的數值變化
            this.lastLv = 1;
        }

        // ---------- 小工具 ----------
        power() { return Math.max(this.v['力量'], this.v['魔力']); }
        mainAttr() {
            const t = this.tags['天賦'];
            if (t === '劍') return '力量';
            if (t === '魔法') return '魔力';
            return this.v['力量'] >= this.v['魔力'] ? '力量' : '魔力';
        }
        workRatio() { return this.adultYears ? 100 * this.adultWork / this.adultYears : 0; }
        sysLv() {
            let lv = 1;
            this.p.system.xp_to_lv.forEach((need, i) => { if (this.sysXp >= need) lv = i + 1; });
            return lv;
        }
        dead() { return this.cause !== null; }
        // 流水帳的每一條都帶當下的數值（畫面上的數字跟著播放的進度走）
        emit(item) { item.age = this.age; item.v = Object.assign({}, this.v); this.log.push(item); return item; }

        add(v, amount) {
            if (v === '主屬性') v = this.mainAttr();
            if (amount > 0 && v.startsWith('好感.')) this.met.add(v);
            const before = this.v[v] || 0;
            this.v[v] = Math.max(0, Math.min(100, before + amount));
            if (this._fx && this.v[v] !== before) this._fx.push({ var: v, d: this.v[v] - before });
        }
        setTag(v, val) {
            if (this.sc.ordered.has(v)) {
                const seq = this.sc.order[v];
                if (seq.includes(val) && seq.includes(this.tags[v]) && seq.indexOf(val) < seq.indexOf(this.tags[v])) return;
            }
            if (this._fx && this.tags[v] !== val) this._fx.push({ tag: v, val });
            this.tags[v] = val;
        }

        // 套用一串結果；回傳 true 表示這一生結束了
        apply(effects, causeIfDead, eventId, res) {
            causeIfDead = causeIfDead || '健康';
            for (const a of effects) {
                const t = a.t;
                if (t === 'add') this.add(a.var, a.sign * this.sc.L[a.level]);
                else if (t === 'set') {
                    if (a.var in this.v) {
                        const before = this.v[a.var];
                        this.v[a.var] = Math.max(0, Math.min(100, a.value));
                        if (this._fx && before !== this.v[a.var]) this._fx.push({ var: a.var, d: this.v[a.var] - before });
                    } else this.setTag(a.var, a.value);
                } else if (t === 'flag') this.flags.add(a.name);
                else if (t === 'xp') this.sysXp += a.amount;
                else if (t === 'tagup') {
                    const seq = this.sc.order[a.var];
                    const cur = seq.indexOf(this.tags[a.var]);
                    let nw = cur + 1;
                    if (a.min) nw = Math.max(nw, seq.indexOf(a.min));
                    if (a.max) nw = Math.min(nw, seq.indexOf(a.max));
                    const val = seq[Math.max(cur, nw)];
                    if (this._fx && this.tags[a.var] !== val) this._fx.push({ tag: a.var, val });
                    this.tags[a.var] = val;
                } else if (t === 'end') {
                    if (this.sys.active === '光環' && !this.haloUsed) {
                        this.haloUsed = true;
                        if ((this.p.system.xp_mode || 'per_use') === 'per_use') this.sysXp += this.p.system.active_xp;
                        this.flags.add('_光環救命');
                        this.emit({ type: 'sys', key: 'halo' });
                        this.apply(this.p.system.halo_parsed, causeIfDead, eventId, res);
                        if (this.dead()) return true;
                        continue;
                    }
                    this.v['健康'] = 0;
                    this.cause = this.sc.trial.has(eventId) ? '審判' : causeIfDead;
                    this.deathEvent = eventId;
                    this.markDeath(res);
                    return true;
                }
            }
            if (this.v['健康'] <= 0 && !this.dead()) {
                this.cause = causeIfDead;
                this.deathEvent = eventId;
                this.markDeath(res);
                return true;
            }
            return false;
        }
        markDeath(res) {
            if (res) {
                this.deathTags = new Set(res.death_tags || []);
                this.deathText = res.death_cause || null;
            }
        }

        // ---------- 方針 ----------
        unlocked(age) {
            const p = this.p;
            return p.policies.filter(x => age >= p.policy_unlock[x]);
        }
        passive() {
            const p = this.p;
            const pp = p.policy_passive[this.policy];
            for (const [k, d] of Object.entries(pp)) {
                if (k === '主屬性') {
                    if (this.train) for (const [kk, dd] of Object.entries(this.train)) this.add(kk, dd * d);
                    else this.add('主屬性', d);
                } else this.add(k, d);
            }
            const sa = p.social_affection;
            if (sa && this.policy === sa.policy) for (const v of [...this.met]) this.add(v, sa.amount);
            const fb = p.faction_bonus[this.tags['勢力']];
            if (fb && (fb.policy === null || fb.policy === this.policy)) for (const [k, d] of Object.entries(fb.effects)) this.add(k, d);
            const y = p.yearly;
            this.v['記憶'] = Math.max(0, this.v['記憶'] - y.memory_decay);
            const a = this.age - this.agingDelay;
            for (const [start, d] of y.aging) {
                if (a >= start) { this.add('健康', -d); break; }
            }
            if (this.v['財富'] <= 0) this.add('幸福', y.debt_happy);
            if (this.v['幸福'] <= 0) this.add('健康', y.despair_health);
            if (this.v['惡名'] >= y.wanted_line) this.add('幸福', y.wanted_happy);
            if (this.age >= 15) {
                this.adultYears += 1;
                if (this.policy === '修練' || this.policy === '賺錢') this.adultWork += 1;
            }
            this.policyYears[this.policy] = (this.policyYears[this.policy] || 0) + 1;
        }

        // ---------- 系統 ----------
        sysReadyNow() { return this.age >= this.sysReady; }
        useActive() {
            this.sysReady = this.age + this.sys.cooldown;
            if ((this.p.system.xp_mode || 'per_use') === 'per_use') this.sysXp += this.p.system.active_xp;
        }
        yearlySystem() {
            const sp = this.p.system;
            const act = this.sys.active;
            if (sp.xp_mode === 'every_3_years' && this.age >= sp.active_start_age &&
                (this.age - sp.active_start_age) % sp.xp_every === 0) this.sysXp += sp.active_xp;
            if ((act === '背包' || act === '發票') && this.sysReadyNow()) {
                this.useActive();
                const table = sp[act === '背包' ? 'bag_table' : 'invoice_table'];
                const row = tablePick(this.rng, table);
                this._fx = [];
                this.apply(row.effects_parsed);
                this.emit({ type: 'sys', key: act === '背包' ? 'bag' : 'invoice', row: table.indexOf(row), fx: this._fx });
                this._fx = null;
            }
            const n = this.taskAges.filter(x => x === this.age).length;
            if (n) {
                this.sysXp += sp.task_xp * n;
                this.emit({ type: 'sys', key: 'task', n, done: this.taskAges.filter(x => x <= this.age).length });
            }
        }
        sysBonus(domain) {
            const sp = this.p.system;
            if (this.sys.domain === '全部') return this.sysLv() * sp.bonus_all_per_lv;
            if (domain && this.sys.domain === domain) return this.sysLv() * sp.bonus_per_lv;
            return 0;
        }

        // ---------- 年度結算 ----------
        yearlyChecks() {
            const p = this.p;
            const ranks = this.sc.order['冒險者等級'];
            const r = this.tags['冒險者等級'];
            if (r !== '未登記' && r !== 'S') {
                const nxt = ranks[ranks.indexOf(r) + 1];
                const [needP, needF] = p.rank_req[nxt];
                if (this.power() >= needP && this.v['名聲'] >= needF) {
                    this._fx = [];
                    this.tags['冒險者等級'] = nxt;
                    if (p.rank_fame[nxt]) this.add('名聲', this.sc.L[p.rank_fame[nxt]]);
                    this.emit({ type: 'rank', val: nxt, fx: this._fx });
                    this._fx = null;
                }
            }
            const tr = p.title_rules;
            const titles = this.sc.order['爵位'];
            const t = titles.indexOf(this.tags['爵位']);
            if (t === 0 && ((this.tags['勢力'] === tr.knight_faction && this.v['名聲'] >= tr.knight_fame) ||
                (ranks.indexOf(this.tags['冒險者等級']) >= ranks.indexOf('A') && this.v['名聲'] >= tr.knight_rank_fame))) {
                this.tags['爵位'] = '騎士';
                this.emit({ type: 'title', val: '騎士' });
            } else if (t <= 1 && this.v['名聲'] >= tr.baron_fame && (t === 1 || this.v['財富'] >= tr.baron_buy_wealth)) {
                this.tags['爵位'] = '男爵';
                this.emit({ type: 'title', val: '男爵', bought: t !== 1 });
            }
            const ex = p.exposure;
            if (this.flags.has('逃亡者') && this.flags.has('異端') && this.v['曝光'] >= ex.trigger &&
                !Object.values(this.scheduled).some(lst => lst.includes(ex.retrial_event))) {
                this.flags.delete('逃亡者');
                (this.scheduled[this.age + 1] = this.scheduled[this.age + 1] || []).push(ex.retrial_event);
            }
        }

        // ---------- 事件 ----------
        weight(e) {
            let w = e._w * ((this.p.category_weight_mult || {})[e.category] || 1.0);
            if (e._sys) w *= this.p.system_event_mult || 1.0;
            if (e.category === this.policy) w *= this.p.policy_event_mult;
            if (e.category === '前世') w *= this.v['記憶'] / 100;
            if (e.weight_mult === '逆襲權重') w *= this.comeback * this.talentComeback;
            return w;
        }

        * play(e) {
            if (!e._cond(this)) return false;
            this.played[e.id] = (this.played[e.id] || 0) + 1;
            if (e.kind === '選擇') {
                this.extraChoices += 1;
                yield* this.resolveChoice(e, null);
            } else {
                this._fx = [];
                const item = this.emit({ type: e.kind === '大' ? 'big' : 'small', id: e.id, fx: this._fx });
                this.apply(e.result, '健康', e.id, e);
                this._fx = null;
                if (this.dead()) item.died = true;
            }
            if (e.kind === '選擇' || e.kind === '大') this.used.add(e.id);
            const fu = e.followup;
            if (fu && !this.dead()) this.scheduleFollowup(fu);
            return true;
        }

        scheduleFollowup(fu) {
            const tg = fu.targets;
            let pick;
            if (fu.mode === 'prob') pick = [wpick(this.rng, tg.map(t => t.id), tg.map(t => t.prob))];
            else if (fu.mode === 'saint') {
                const s = this.p.exposure.saint;
                let pr = s.base + (this.v['名聲'] - this.v['惡名']) * s.k;
                if (this.tags['勢力'] === '教會') pr += s.church_bonus;
                pr = Math.max(s.min, Math.min(s.max, pr));
                pick = [this.rng() * 100 < pr ? tg[0].id : tg[1].id];
                this.emit({ type: 'saint', pct: pr, saint: pick[0] === tg[0].id });
            } else pick = [tg.map(t => t.id).join('/')];
            const k = this.age + fu.delay;
            (this.scheduled[k] = this.scheduled[k] || []).push(...pick);
        }

        * runFollowups() {
            const due = this.scheduled[this.age] || [];
            delete this.scheduled[this.age];
            let played = false;
            const rest = [];
            for (const item of due) {
                if (played) { rest.push(item); continue; }
                const ok = item.split('/').filter(i => this.sc.events[i] && this.sc.events[i]._cond(this)).map(i => this.sc.events[i]);
                if (ok.length) {
                    yield* this.play(this.rng.choice(ok));
                    played = true;
                    if (this.dead()) return true;
                }
            }
            if (rest.length) (this.scheduled[this.age + 1] = this.scheduled[this.age + 1] || []).push(...rest);
            return played;
        }

        * bigEvent() {
            const pool = this.sc.bigByAge[this.age].filter(e => !this.used.has(e.id) && e._cond(this));
            if (!pool.length) return false;
            const e = wpick(this.rng, pool, pool.map(x => this.weight(x)));
            return e !== null && (yield* this.play(e));
        }

        * smallEvent() {
            const cd = this.p.small_cooldown_years || 0;
            const cap = this.p.small_max_per_run || 0;
            const pool = this.sc.smallByAge[this.age].filter(e =>
                e.id !== this.lastSmall && !(e.once && this.used.has(e.id)) &&
                !(cd && this.age - (e.id in this.smallLastAge ? this.smallLastAge[e.id] : -999) < cd) &&
                !(cap && (this.smallCounts[e.id] || 0) >= cap) && e._cond(this));
            if (!pool.length) return false;
            const e = wpick(this.rng, pool, pool.map(x => this.weight(x)));
            if (e === null) return false;
            this.lastSmall = e.id;
            this.smallLastAge[e.id] = this.age;
            this.smallCounts[e.id] = (this.smallCounts[e.id] || 0) + 1;
            if (e.once) this.used.add(e.id);
            return yield* this.play(e);
        }

        // ---------- 選擇 ----------
        val(v) {
            if (v === '戰力') return this.power();
            if (v === '主屬性') return this.v[this.mainAttr()];
            return this.v[v] || 0;
        }
        // 成功率和明細（畫面上點開看得到）
        rateInfo(o, navi) {
            const tier = this.p.tiers[o.tier];
            if (o.tier === '必成') return { rate: 100, parts: [] };
            const parts = [{ label: o.tier + '檔基礎', d: tier.base }];
            let r = tier.base;
            const look = o.look;
            if (look.length === 1) {
                const d = (this.val(look[0]) - 50) * this.p.var_bonus;
                r += d;
                parts.push({ label: look[0] + ' ' + Math.round(this.val(look[0])), d });
            } else if (look.length) {
                for (const x of look) {
                    const d = (this.val(x) - 50) * this.p.var_bonus / look.length;
                    r += d;
                    parts.push({ label: x + ' ' + Math.round(this.val(x)), d });
                }
            }
            const sb = this.sysBonus(o.domain);
            if (sb) { r += sb; parts.push({ label: '系統 Lv' + this.sysLv(), d: sb }); }
            if (navi) { r += this.p.system.navi_bonus; parts.push({ label: '重新規劃路線', d: this.p.system.navi_bonus }); }
            const rate = Math.max(this.p.rate_min, Math.min(this.p.rate_max, r));
            return { rate, raw: r, parts };
        }
        rate(o, navi) { return this.rateInfo(o, navi).rate; }
        visible(e) {
            const memOk = this.v['記憶'] >= this.p.modern.memory_min;
            return e.options.filter(o => o._cond(this) && (memOk || !o.modern));
        }

        // 停下來讓玩家選：yield 一個請求，next(選項編號) 回來
        * resolveChoice(e, cp) {
            const opts = this.visible(e);
            if (!opts.length) return;
            const rng = this.rng;
            const rolls = new Map();
            for (const o of opts) rolls.set(o, rng() * 100);
            let known = null;
            const act = this.sys.active;
            if (act === '鑑定' && this.sysReadyNow() && opts.filter(o => o.tier !== '必成').length >= 2) {
                this.useActive();
                known = new Set(opts.filter(o => rolls.get(o) < this.rate(o)));
            }
            const naviReady = act === '導航' && this.sysReadyNow();
            const appealReady = act === '申覆' && this.sysReadyNow();
            const req = {
                type: 'choice', ev: e, cp, age: this.age,
                opts: opts.map(o => {
                    const navi = naviReady && o.domain === '行動';
                    const info = this.rateInfo(o, navi);
                    return { o, no: o.no, rate: info.rate, parts: info.parts, navi,
                        lethal: o.tier === '賭命' ? (100 - info.rate) * this.p.tiers['賭命'].lethal : 0,
                        known: known ? known.has(o) : null };
                }),
                appraised: !!known, appealReady,
            };
            let no = yield req;
            let o = opts.find(x => x.no === no);
            if (!o) o = opts[0];
            const navi = naviReady && o.domain === '行動';
            if (navi) this.useActive();
            this._fx = [];
            if (o.modern) {
                this.modernUsed += 1;
                this.add('曝光', this.sc.L[this.p.modern.auto_expose]);
            }
            const rate = this.rate(o, navi);
            const ok = rolls.get(o) < rate;
            // roll：這次骰到幾（0～100），比成功率小就成功；畫面上的指針停在這裡
            const item = this.emit({ type: 'result', id: e.id, cp, no: o.no, ok, rate, roll: rolls.get(o), navi, modern: !!o.modern, tier: o.tier, fx: this._fx });
            const cause = '選擇';
            const done = () => { this._fx = null; if (this.dead()) item.died = true; };
            if (ok) {
                item.line = 'success';
                this.apply(o.success.effects, cause, e.id, o.success);
                return done();
            }
            let rline;
            if (o.tier === '賭命') {
                if (rng() < this.p.tiers['賭命'].lethal) {
                    this.deathOption = [e.id, o.no];
                    item.line = 'fail_end';
                    this.apply((o.fail_end || {}).effects || [{ t: 'end' }], cause, e.id, o.fail_end);
                    if (!this.dead()) this.deathOption = null;
                    return done();
                }
                rline = o.fail_alive || {};
                item.line = 'fail_alive';
            } else {
                rline = o.fail || {};
                item.line = 'fail';
            }
            const res = rline.effects || [];
            const ends = res.some(a => a.t === 'end');
            if (appealReady && (!ends || this.p.system.appeal_can_save_end)) {
                this.useActive();
                item.appealed = true;
                return done();
            }
            this.deathOption = [e.id, o.no];
            this.apply(res, cause, e.id, rline);
            if (!this.dead()) this.deathOption = null;
            return done();
        }

        * choicePoint(cp) {
            this.choicesSeen += 1;
            const cands = this.sc.cands[cp].filter(e => !this.used.has(e.id) && e._cond(this));
            if (!cands.length) { this.noCandidate.push(cp); return; }
            const e = wpick(this.rng, cands, cands.map(x => x._w));
            this.played[e.id] = (this.played[e.id] || 0) + 1;
            this.used.add(e.id);
            yield* this.resolveChoice(e, cp);
        }

        // ---------- 一整輪 ----------
        * run() {
            const p = this.p, sc = this.sc, rng = this.rng;
            const ex = p.exposure;
            for (let age = 0; age <= p.max_age; age++) {
                this.age = age;
                this.emit({ type: 'year' });
                if (age === p.talent_age) {
                    const t = wpick(rng, p.talents, p.talents.map(x => x.prob));
                    this.tags['天賦'] = t.name;
                    this.train = t.train;
                    this.talentComeback = t.comeback;
                    this._fx = [];
                    this.apply(t.effects_parsed);
                    this.emit({ type: 'talent', val: t.name, prob: t.prob, fx: this._fx });
                    this._fx = null;
                }
                let pol = this.ctl.policy ? this.ctl.policy(this) : this.policy;
                if (!this.unlocked(age).includes(pol)) pol = p.start_policy;
                this.policy = pol;
                this.passive();
                if (this.apply([])) break;
                this.yearlySystem();
                for (const [k, sets] of Object.entries(p.world.timeline)) {
                    if (+k === age) for (const [v, val] of Object.entries(sets)) {
                        this.tags[v] = val;
                        this.emit({ type: 'world', tag: v, val });
                    }
                }
                for (const group of sc.fixedGroups[age] || []) {
                    for (const eid of group) { if (yield* this.play(sc.events[eid])) break; }
                    if (this.dead()) break;
                }
                if (this.dead()) break;
                if (age in sc.cpAge) {
                    if (this.scheduled[age] && this.scheduled[age].length) {
                        (this.scheduled[age + 1] = this.scheduled[age + 1] || []).push(...this.scheduled[age]);
                        delete this.scheduled[age];
                    }
                    yield* this.choicePoint(sc.cpAge[age]);
                    if (this.ctl.afterChoicePoint) this.ctl.afterChoicePoint(this);
                } else {
                    let done = yield* this.runFollowups();
                    if (this.dead()) break;
                    if (!done && this.v['曝光'] >= ex.trigger && !this.flags.has('曝光過')) {
                        const fuses = sc.fuses.filter(e => e._cond(this));
                        if (fuses.length) done = yield* this.play(rng.choice(fuses));
                    }
                    for (const tr of p.priority_tracks || []) {
                        if (done || rng() >= tr.rate) continue;
                        const pref = tr.prefixes || [tr.prefix || ''];
                        const excl = new Set(tr.exclude || []);
                        const pool = sc.bigByAge[age].filter(e => pref.some(x => e.id.startsWith(x)) && !excl.has(e.id) &&
                            !this.used.has(e.id) && e._cond(this));
                        if (pool.length) done = yield* this.play(wpick(rng, pool, pool.map(x => this.weight(x))));
                    }
                    if (!done) {
                        if (rng() < p.event_rates.big) done = yield* this.bigEvent();
                        if (!done && rng() < p.event_rates.small) yield* this.smallEvent();
                    }
                }
                if (age === p.world.final_age && (this.tags['魔王狀態'] === '甦醒' || this.tags['魔王狀態'] === '進軍')) {
                    this.tags['魔王狀態'] = p.world.final_default;
                    this.emit({ type: 'world', tag: '魔王狀態', val: p.world.final_default });
                }
                if (this.dead() || this.apply([])) break;
                this.yearlyChecks();
                const lv = this.sysLv();
                if (lv > this.lastLv) { this.lastLv = lv; this.emit({ type: 'sys', key: 'levelup', lv }); }
                yield { type: 'year', age };
            }
            if (!this.dead()) this.cause = '上限';
            this.emit({ type: 'end', cause: this.cause });
            return this;
        }

        ending() {
            for (const en of this.sc.endings) if (en._cond(this)) return en;
            return null;
        }
        pickVariant(list) {
            if (!list || !list.length) return null;
            return list.find(t => t.variant && t._cond && t._cond(this)) || list.find(t => !t.variant) || list[0];
        }
    }

    // 模擬器的三種玩家（驗證用：跟 sim_01.py 的 Life.pick／choose_policy 一樣）
    function makeBot(kind, seed, p) {
        const rng = makeRng(seed);
        let fav = null, after = false;
        const pl = p.players;
        const choose = life => {
            const unlocked = life.unlocked(life.age);
            if (kind === '謹慎' && life.v['健康'] < pl.careful_rest_health) return '養生';
            if (unlocked.includes(fav) && rng() < pl.fav_rate) return fav;
            return rng.choice(unlocked);
        };
        return {
            policy(life) {
                if (fav === null) fav = rng.choice(p.policies);
                const a = life.age;
                if (after || a === 6 || a === 15 || (a >= 6 && rng() < pl.switch_rate)) { after = false; return choose(life); }
                return life.policy;
            },
            afterChoicePoint() { after = true; },
            pick(req) {
                let pool = req.opts;
                if (req.appraised) {
                    const k = pool.filter(x => x.known);
                    if (k.length) pool = k;
                }
                if (kind === '莽撞') {
                    const top = Math.max(...pool.map(x => TIER_ORDER.indexOf(x.o.tier)));
                    return rng.choice(pool.filter(x => TIER_ORDER.indexOf(x.o.tier) === top)).no;
                }
                if (kind === '謹慎') {
                    const safe = pool.filter(x => x.o.tier !== '賭命' && !(x.o.tier === '冒險' && req.health <= 20));
                    pool = safe.length ? safe : pool;
                }
                const modern = pool.filter(x => x.o.modern);
                if (modern.length && rng() < pl.modern_pick) return modern[0].no;
                return rng.choice(pool).no;
            },
        };
    }

    // 一口氣跑完（驗證用）
    function runBot(sc, seed, kind) {
        const bot = makeBot(kind, seed ^ 0x2545F491, sc.p);
        const life = new Life(sc, seed, bot);
        const it = life.run();
        let r = it.next();
        while (!r.done) {
            if (r.value.type === 'choice') { r.value.health = life.v['健康']; r = it.next(bot.pick(r.value)); }
            else r = it.next();
        }
        return life;
    }

    const api = { makeRng, wpick, Scene, Life, decodeData, browserInflate, makeBot, runBot, TIER_ORDER };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.Reborn = api;
})(typeof window !== 'undefined' ? window : globalThis);
