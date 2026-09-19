'use strict'

// Regression coverage for the #57 (aux-effective-source-tally) x #58
// (connection-query-optimization) merge-conflict resolution in src/api.js.
//
// Two gaps here were found by an independent review of the first version of
// this file (2026-09-19) and are fixed below:
//
// 1. The original scheduler test compared call counts BETWEEN tiers in
//    aggregate over many ticks, which does not pin the actual interval
//    (`% 2`, `% 10`). A mutation to `% 3` / `% 5` passed all six original
//    tests. This file now asserts, per explicit tick number, exactly which
//    tiers fire — a wrong interval cannot pass silently.
// 2. Neither this file nor #58's own test file exercised the PGM/PVW
//    (`param2 == '21'`) or transition (`param2 == '18'`) DTH *response*
//    parsing through the real `extractMessages` -> `updateData` path — only
//    query generation was covered. Making those arms unreachable left the
//    full 144-test suite green. This file now feeds real DTH strings through
//    the production parser path and asserts the resulting DATA fields, so a
//    broken or missing sibling arm in the merged else-if chain is caught.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const BASE_STUB = {
	InstanceStatus: { Ok: 'ok', Connecting: 'connecting', Disconnected: 'disconnected', Error: 'error' },
	TCPHelper: class {},
}
let baseResolved
try {
	baseResolved = require.resolve('@companion-module/base')
} catch (_) {
	baseResolved = null
}
if (baseResolved) {
	require.cache[baseResolved] = {
		id: baseResolved,
		filename: baseResolved,
		loaded: true,
		exports: BASE_STUB,
	}
}

const api = require('../src/api')
const { extractMessages } = require('../src/tcpParser')

const FAST_TIER = ['getPinpKeyTally', 'getAuxSources']
const MEDIUM_TIER = ['getAuxMutes', 'getNextMemoryName', 'getVideoAssign']
const BACKGROUND_TIER = [
	'getPinpKeySource',
	'getFreezeData',
	'getOutputData',
	'getAuxLinkData',
	'getTransitionData',
	'getMonitorData',
	'getLastMemoryLoaded',
]
const ALL_POLLERS = [...FAST_TIER, ...MEDIUM_TIER, ...BACKGROUND_TIER]

function makePollSelf() {
	const calls = {}
	for (const name of ALL_POLLERS) calls[name] = 0
	const self = { _pollTick: undefined }
	for (const name of ALL_POLLERS) {
		self[name] = () => {
			calls[name]++
		}
	}
	return { self, calls }
}

function snapshot(calls) {
	const s = {}
	for (const name of ALL_POLLERS) s[name] = calls[name]
	return s
}

// ── Scheduler: getVideoAssign integrated into the MEDIUM tier ───────────────

describe('_doPoll — VIDEO ASSIGN integrated into the MEDIUM tier (#57 x #58 merge)', () => {
	test('getVideoAssign is present in the real _doPoll implementation', () => {
		const src = api._doPoll.toString()
		assert.ok(src.includes('getVideoAssign'), '_doPoll must call self.getVideoAssign()')
	})

	test('getVideoAssign is NOT scheduled in the FAST or BACKGROUND tier text blocks', () => {
		const src = api._doPoll.toString()
		const fastBlock = src.slice(src.indexOf('Fast tier'), src.indexOf('Medium tier'))
		const backgroundBlock = src.slice(src.indexOf('Background tier'))
		assert.ok(!fastBlock.includes('getVideoAssign'), 'getVideoAssign must not run on every tick (fast tier)')
		assert.ok(
			!backgroundBlock.includes('getVideoAssign'),
			'getVideoAssign must not be relegated to the background tier',
		)
	})

	test("immediate initial poll (startInterval's self._doPoll(true)) requests every tier exactly once, including VIDEO ASSIGN", () => {
		const { self, calls } = makePollSelf()
		api._doPoll.call(self, true)
		for (const name of ALL_POLLERS) {
			assert.equal(calls[name], 1, `${name} should run exactly once on the immediate initial poll`)
		}
	})

	// Exact per-tick assertions: a wrong modulo (e.g. `% 3` instead of `% 2`,
	// or `% 5` instead of `% 10`) must fail here, not just an aggregate ratio
	// over many ticks. `_pollTick` is 1 after the immediate call, then 2, 3, ...
	test('exact tick-by-tick tier firing, ticks 1 through 22 (immediate + 21 regular)', () => {
		const { self, calls } = makePollSelf()

		api._doPoll.call(self, true) // tick 1 (immediate)
		assert.equal(self._pollTick, 1)
		for (const name of FAST_TIER) assert.equal(calls[name], 1, `${name} @ tick 1 (immediate)`)
		for (const name of MEDIUM_TIER) assert.equal(calls[name], 1, `${name} @ tick 1 (immediate)`)
		for (const name of BACKGROUND_TIER) assert.equal(calls[name], 1, `${name} @ tick 1 (immediate)`)

		const before = {}
		for (let tick = 2; tick <= 22; tick++) {
			Object.assign(before, snapshot(calls))
			api._doPoll.call(self, false)
			assert.equal(self._pollTick, tick, `_pollTick must equal ${tick} after this call`)

			// Fast tier: every tick, no exceptions.
			for (const name of FAST_TIER) {
				assert.equal(calls[name], before[name] + 1, `${name} must fire on tick ${tick} (fast tier, every tick)`)
			}

			// Medium tier: exactly on ticks where tick % 2 === 0.
			const mediumShouldFire = tick % 2 === 0
			for (const name of MEDIUM_TIER) {
				const fired = calls[name] === before[name] + 1
				const unchanged = calls[name] === before[name]
				assert.ok(fired || unchanged, `${name} call count must move by 0 or 1 on tick ${tick}`)
				assert.equal(
					fired,
					mediumShouldFire,
					`${name} @ tick ${tick}: expected fire=${mediumShouldFire} (tick % 2 === 0), got fire=${fired}`,
				)
			}

			// Background tier: exactly on ticks where tick % 10 === 0.
			const backgroundShouldFire = tick % 10 === 0
			for (const name of BACKGROUND_TIER) {
				const fired = calls[name] === before[name] + 1
				const unchanged = calls[name] === before[name]
				assert.ok(fired || unchanged, `${name} call count must move by 0 or 1 on tick ${tick}`)
				assert.equal(
					fired,
					backgroundShouldFire,
					`${name} @ tick ${tick}: expected fire=${backgroundShouldFire} (tick % 10 === 0), got fire=${fired}`,
				)
			}
		}

		// Sanity totals over ticks 1..22: fast=22, medium fires on {1,2,4,6,...,22}=12, background fires on {1,10,20}=3.
		for (const name of FAST_TIER) assert.equal(calls[name], 22)
		for (const name of MEDIUM_TIER) assert.equal(calls[name], 12)
		for (const name of BACKGROUND_TIER) assert.equal(calls[name], 3)
	})

	test('_pollTick advances by exactly one per call, regardless of immediate flag', () => {
		const { self } = makePollSelf()
		api._doPoll.call(self, true)
		assert.equal(self._pollTick, 1)
		api._doPoll.call(self, false)
		assert.equal(self._pollTick, 2)
		api._doPoll.call(self, false)
		assert.equal(self._pollTick, 3)
	})

	test('no other production caller of getVideoAssign exists besides _doPoll (single scheduling site)', () => {
		const path = require('path')
		const apiSrc = require('fs').readFileSync(path.join(__dirname, '../src/api.js'), 'utf8')
		const callSites = apiSrc.match(/self\.getVideoAssign\(\)/g) || []
		assert.equal(callSites.length, 1, `expected exactly one self.getVideoAssign() call site, found ${callSites.length}`)
	})
})

// ── DTH response parsing: the merged sibling else-if arms ───────────────────
// #57 contributes `param2 == '00'` (VIDEO ASSIGN); #58 contributes
// `param2 == '21'` (PGM/PVW) and `param2 == '18'` (transition). These tests
// feed real device strings through extractMessages -> updateData and assert
// on DATA, proving all three sibling arms are reachable and correctly wired
// in the merged chain — not just that queries are generated for them.

function makeParserSelf(overrides = {}) {
	return {
		config: { verbose: false },
		DATA: {},
		log: () => {},
		logVerbose: () => {},
		setVariableValues: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		CHOICES_PNPKEY_SOURCES: [],
		_parseHexBlock: api._parseHexBlock,
		...overrides,
	}
}

function feedDTHViaParser(rawTcp) {
	const self = makeParserSelf()
	const { messages } = extractMessages(rawTcp)
	assert.equal(messages.length, 1, 'expected exactly one message from parser')
	api.updateData.call(self, messages[0])
	return self.DATA
}

describe("DTH response parsing — param2 == '21' (PGM/PVW), production parser path", () => {
	test('DTH:002100,0522; (2-byte block) sets pgmsource + pvwsource', () => {
		const data = feedDTHViaParser('DTH:002100,0522;')
		assert.equal(data.pgmsource, '05')
		assert.equal(data.pvwsource, '22')
	})

	test('DTH:002100,07; (1-byte) sets pgmsource only, via the PGM/PVW arm', () => {
		const data = feedDTHViaParser('DTH:002100,07;')
		assert.equal(data.pgmsource, '07')
		assert.equal(data.pvwsource, undefined)
	})

	test('DTH:002101,08; (1-byte PVW notification) sets pvwsource only', () => {
		const data = feedDTHViaParser('DTH:002101,08;')
		assert.equal(data.pvwsource, '08')
		assert.equal(data.pgmsource, undefined)
	})
})

describe("DTH response parsing — param2 == '18' (transition), production parser path", () => {
	test('DTH:001800,00010203; (4-byte block) sets all four transition fields', () => {
		const data = feedDTHViaParser('DTH:001800,00010203;')
		assert.equal(data.transitiontype, 0)
		assert.equal(data.mixtype, 1)
		assert.equal(data.wipetype, 2)
		assert.equal(data.wipedirection, 3)
	})

	test('DTH:001800,01; (1-byte) sets transitiontype only', () => {
		const data = feedDTHViaParser('DTH:001800,01;')
		assert.equal(data.transitiontype, 1)
		assert.equal(data.mixtype, undefined)
	})

	test('DTH:001801,02; sets mixtype only', () => {
		const data = feedDTHViaParser('DTH:001801,02;')
		assert.equal(data.mixtype, 2)
	})

	test('DTH:001802,04; sets wipetype only', () => {
		const data = feedDTHViaParser('DTH:001802,04;')
		assert.equal(data.wipetype, 4)
	})

	test('DTH:001803,01; sets wipedirection only', () => {
		const data = feedDTHViaParser('DTH:001803,01;')
		assert.equal(data.wipedirection, 1)
	})
})

describe('DTH response parsing — three sibling arms coexist correctly', () => {
	test('VIDEO ASSIGN (param2==00), PGM/PVW (param2==21) and transition (param2==18) each update only their own DATA fields', () => {
		let self = makeParserSelf()
		api.updateData.call(self, 'DTH:000005,07;') // INPUT 6 video assign (param2=='00', individual)
		api.updateData.call(self, 'DTH:002100,0522;') // PGM/PVW block (param2=='21')
		api.updateData.call(self, 'DTH:001801,02;') // mix type (param2=='18')

		assert.deepEqual(self.DATA.inputAssign[5], '07')
		assert.equal(self.DATA.pgmsource, '05')
		assert.equal(self.DATA.pvwsource, '22')
		assert.equal(self.DATA.mixtype, 2)
		// Each arm wrote only its own fields — no cross-contamination.
		assert.equal(self.DATA.transitiontype, undefined)
		assert.equal(self.DATA.wipetype, undefined)
	})
})
