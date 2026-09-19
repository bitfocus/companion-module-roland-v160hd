'use strict'

// Regression coverage for the #57 (aux-effective-source-tally) x #58
// (connection-query-optimization) merge-conflict resolution in src/api.js.
// Neither PR's own test file exercises _doPoll's tier scheduler directly,
// so this file specifically pins the new scheduler connection: getVideoAssign
// (from #57) must run inside #58's MEDIUM tier, once per applicable tick and
// once during the immediate initial poll, without duplicate scheduling and
// without disturbing the FAST/BACKGROUND tier timing.

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

	test('VIDEO ASSIGN is requested once per applicable MEDIUM tick, in lockstep with the rest of the medium tier', () => {
		const { self, calls } = makePollSelf()
		api._doPoll.call(self, true) // tick 1, immediate

		const TICKS = 21
		for (let n = 0; n < TICKS; n++) {
			api._doPoll.call(self, false)
		}

		// Fast tier: every tick, including the immediate call.
		assert.equal(calls.getPinpKeyTally, TICKS + 1)
		assert.equal(calls.getAuxSources, TICKS + 1)

		// Medium tier: immediate + every 2nd subsequent tick. getVideoAssign
		// must track getAuxMutes/getNextMemoryName exactly — no duplicate and
		// no missed scheduling relative to the rest of its own tier.
		assert.equal(calls.getVideoAssign, calls.getAuxMutes, 'getVideoAssign must fire exactly with the medium tier')
		assert.equal(calls.getVideoAssign, calls.getNextMemoryName, 'getVideoAssign must fire exactly with the medium tier')
		assert.ok(calls.getVideoAssign > 1, 'getVideoAssign must fire on more than just the immediate poll')
		assert.ok(
			calls.getVideoAssign < TICKS + 1,
			'getVideoAssign must not fire on every tick (would mean it leaked into the fast tier)',
		)

		// Background tier: immediate + every 10th subsequent tick.
		assert.equal(calls.getFreezeData, calls.getPinpKeySource)
		assert.equal(calls.getFreezeData, calls.getOutputData)
		assert.ok(
			calls.getFreezeData < calls.getVideoAssign,
			'background tier must fire strictly less often than the medium tier over 21 ticks',
		)
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
