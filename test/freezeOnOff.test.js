'use strict'

// Freeze On/Off feature tests — see CLAUDE-FREEZE-PLAN.md §2 for the design
// (local pending-value overlay with bounded expiry and a dual-defense
// timer-identity guard) and CLAUDE-FREEZE-ONOFF-IMPLEMENT.md for this
// slice's exact scope (absolute On/Off actions, the 'freeze' field only).
// Revised per FREEZE-ONOFF-INDEPENDENT-REVIEW.md (2026-09-20): see the
// `withCapturedTimers`/`makeFreezeChainSelf` helpers and the two new
// describe blocks below for what changed and why.
//
// Describe blocks, each against REAL, unmodified-by-this-file production
// code:
//   1. src/actions.js  — freezeSwitchOn/Off (direct require, house
//      require.cache-stub pattern from test/smallCorrectnessFixtures.test.js)
//   2. src/feedbacks.js + src/variables.js — read the pending overlay
//   3. src/api.js — the pending-overlay primitives themselves
//   4. src/api.js — the dual timer-defense safeguards, tested separately
//   5. src/api.js — the REAL parser (extractMessages -> updateData), proving
//      it clears the overlay exactly when a real response arrives
//   6. Full chain — real action -> real pending overlay -> real, registered
//      feedback callback and variable computation -> real expiry, all
//      wired together the way index.js itself wires them
//   7. Full connection lifecycle (test-support/lifecycleHarness.js) — the
//      'connect' handler, initConnection() itself, destroy(), and the
//      polling-on/off initial read, against the REAL TCPHelper and a
//      virtual clock.
//
// None of blocks 3, 4, 5 or 6 use node:test's mock.timers (absent on Node
// 18.17.0 — see FREEZE-ONOFF-INDEPENDENT-REVIEW.md finding 4). Instead,
// `withCapturedTimers` below temporarily replaces the real global
// setTimeout/clearTimeout with a capturing stub: setTimeout records the
// callback (and, where asserted, the requested delay) and returns a fake
// id instead of scheduling anything for real, so no test ever waits on a
// real 2000ms timer or leaves one dangling. It also lets a test invoke a
// captured callback directly and deliberately, whenever it wants —
// necessary for the dual-defense tests, which must run a stale callback
// at a moment of the test's choosing, not the clock's. Block 7 already
// used a real virtual clock (test-support/lifecycleHarness.js) and needed
// no change for Node 18 compatibility.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { createEnvironment, authenticate, simulateReady } = require('../test-support/lifecycleHarness')

// ── Module stubs (mirrors test/smallCorrectnessFixtures.test.js) ────────────

const BASE_STUB = {
	InstanceStatus: { Ok: 'ok', Connecting: 'connecting', Disconnected: 'disconnected', Error: 'error' },
	TCPHelper: class {},
	combineRgb: (r, g, b) => ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff),
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
const actions = require('../src/actions')
const feedbacks = require('../src/feedbacks')
const variables = require('../src/variables')
const constants = require('../src/constants')
const { extractMessages } = require('../src/tcpParser')

// ── 1. actions.js — freezeSwitchOn/Off ───────────────────────────────────────

function makeFreezeActionsSelf(socket) {
	const sent = []
	const rawSent = []
	const pendingCalls = []
	const feedbackChecks = []
	let variableChecksCount = 0
	const self = Object.assign(Object.create(actions), Object.assign({}, constants), {
		DATA: {},
		config: {},
		socket,
		sendCommand: (addr, val) => sent.push({ addr, val }),
		sendRawCommand: (cmd) => rawSent.push(cmd),
		_setFreezePending: (field, value, onExpire) => pendingCalls.push({ field, value, onExpire }),
		checkFeedbacks: (...types) => feedbackChecks.push(types),
		checkVariables: () => variableChecksCount++,
		log: () => {},
	})
	let actionsDefs = null
	self.setActionDefinitions = (a) => {
		actionsDefs = a
	}
	self.initActions()
	return {
		self,
		sent,
		rawSent,
		pendingCalls,
		feedbackChecks,
		get variableChecksCount() {
			return variableChecksCount
		},
		get actions() {
			return actionsDefs
		},
	}
}

describe('actions — freezeSwitchOn/Off', () => {
	test('connected: On sends absolute 01, enqueues a readback, sets a pending overlay, and refreshes feedback/variable synchronously', () => {
		const result = makeFreezeActionsSelf({ isConnected: true })
		result.actions.freezeSwitchOn.callback({ options: {} }, {})

		assert.deepEqual(result.sent, [{ addr: '020500', val: '01' }])
		assert.deepEqual(result.rawSent, ['RQH:020500,000001;'])
		assert.equal(result.pendingCalls.length, 1)
		assert.equal(result.pendingCalls[0].field, 'freeze')
		assert.equal(result.pendingCalls[0].value, '01')
		assert.equal(typeof result.pendingCalls[0].onExpire, 'function')
		assert.ok(
			result.feedbackChecks.some((types) => types.includes('freeze')),
			'checkFeedbacks("freeze") called synchronously',
		)
		// .variableChecksCount is a live getter — must be read AFTER the
		// callback runs, not destructured beforehand (a destructured getter
		// copies its value at that instant, which would always read 0 here).
		assert.ok(result.variableChecksCount >= 1, 'checkVariables called synchronously')
	})

	test('connected: Off sends absolute 00, enqueues a readback, sets a pending overlay', () => {
		const { sent, rawSent, pendingCalls, actions: defs } = makeFreezeActionsSelf({ isConnected: true })
		defs.freezeSwitchOff.callback({ options: {} }, {})

		assert.deepEqual(sent, [{ addr: '020500', val: '00' }])
		assert.deepEqual(rawSent, ['RQH:020500,000001;'])
		assert.equal(pendingCalls[0].field, 'freeze')
		assert.equal(pendingCalls[0].value, '00')
	})

	test('On sends 01 even when DATA.freeze already reads 01 — absolute command, not a toggle', () => {
		const { self, sent, actions: defs } = makeFreezeActionsSelf({ isConnected: true })
		self.DATA.freeze = '01'
		defs.freezeSwitchOn.callback({ options: {} }, {})
		assert.equal(sent[0].val, '01')
	})

	test('Off sends 00 even when DATA.freeze already reads 00 — absolute command, not a toggle', () => {
		const { self, sent, actions: defs } = makeFreezeActionsSelf({ isConnected: true })
		self.DATA.freeze = '00'
		defs.freezeSwitchOff.callback({ options: {} }, {})
		assert.equal(sent[0].val, '00')
	})

	test('disconnected (socket undefined): the command is still sent, but the pending overlay/readback/refresh are all skipped', () => {
		const result = makeFreezeActionsSelf(undefined)
		result.actions.freezeSwitchOn.callback({ options: {} }, {})

		assert.deepEqual(
			result.sent,
			[{ addr: '020500', val: '01' }],
			'the raw command is still sent — unchanged fallback behavior',
		)
		assert.deepEqual(result.rawSent, [], 'no readback is enqueued while disconnected')
		assert.deepEqual(result.pendingCalls, [], 'no pending overlay is set while disconnected')
		assert.deepEqual(result.feedbackChecks, [], 'no feedback refresh while disconnected')
		assert.equal(result.variableChecksCount, 0, 'no variable refresh while disconnected')
	})

	test('socket present but not connected (isConnected: false): same disconnected fallback path', () => {
		const { sent, rawSent, pendingCalls, actions: defs } = makeFreezeActionsSelf({ isConnected: false })
		defs.freezeSwitchOff.callback({ options: {} }, {})

		assert.deepEqual(sent, [{ addr: '020500', val: '00' }])
		assert.deepEqual(rawSent, [])
		assert.deepEqual(pendingCalls, [])
	})
})

// ── 2. feedbacks.js / variables.js — read the pending overlay ───────────────

describe('feedbacks.freeze — reads the pending overlay via _freezeValue, not DATA directly', () => {
	function makeFeedbacksSelf(freezeValueStub, dataFreeze) {
		let defs = null
		const self = Object.assign(Object.create(feedbacks), Object.assign({}, constants), {
			DATA: { freeze: dataFreeze },
			_freezeValue: freezeValueStub,
			setFeedbackDefinitions: (f) => {
				defs = f
			},
		})
		self.initFeedbacks()
		return defs
	}

	test('returns true when _freezeValue("freeze") is "01"', () => {
		const defs = makeFeedbacksSelf(() => '01', '01')
		assert.equal(defs.freeze.callback({ options: {} }, {}), true)
	})

	test('returns false when _freezeValue("freeze") is "00"', () => {
		const defs = makeFeedbacksSelf(() => '00', '00')
		assert.equal(defs.freeze.callback({ options: {} }, {}), false)
	})

	test('reflects a pending overlay even when DATA.freeze disagrees — proves it does not read DATA directly', () => {
		const defs = makeFeedbacksSelf((field) => (field === 'freeze' ? '01' : undefined), '00')
		assert.equal(
			defs.freeze.callback({ options: {} }, {}),
			true,
			'must follow the pending overlay, not stale DATA.freeze',
		)
	})
})

describe('variables — freeze variable reads the pending overlay via _freezeValue', () => {
	function makeVariablesSelf(freezeValueStub, dataFreeze) {
		const setValuesCalls = []
		const self = Object.assign(Object.create(variables), Object.assign({}, constants), {
			TALLYDATA: [],
			DATA: { freeze: dataFreeze },
			CHOICES_OUTPUTSASSIGN: [],
			CHOICES_PGMPVW_SELECT: [],
			_freezeValue: freezeValueStub,
			log: () => {},
			setVariableValues: (obj) => setValuesCalls.push(obj),
		})
		self.checkVariables()
		return setValuesCalls
	}

	test('"On" when _freezeValue returns "01"', () => {
		const calls = makeVariablesSelf(() => '01', '00')
		assert.ok(calls.length >= 1, 'checkVariables must not throw before reaching setVariableValues')
		assert.equal(calls.at(-1).freeze, 'On')
	})

	test('"Off" when _freezeValue returns "00"', () => {
		const calls = makeVariablesSelf(() => '00', '01')
		assert.equal(calls.at(-1).freeze, 'Off')
	})

	test('reflects a pending overlay that disagrees with DATA.freeze — proves it does not read DATA directly', () => {
		const calls = makeVariablesSelf((field) => (field === 'freeze' ? '01' : undefined), '00')
		assert.equal(calls.at(-1).freeze, 'On', 'must follow the pending overlay, not the stale DATA.freeze')
	})
})

// ── 3. api.js — pending-overlay primitives ──────────────────────────────────

function makeApiSelf() {
	return Object.assign(Object.create(api), {
		config: { verbose: false },
		log: () => {},
	})
}

// Node 18.17.0-safe timer control (node:test's mock.timers is unavailable
// there — see the file header). Temporarily replaces the real global
// setTimeout/clearTimeout with a capturing stub for the duration of `fn`:
// setTimeout records the callback and requested delay and returns a fake
// id instead of scheduling anything for real; clearTimeout normally
// forgets that id, unless `bypassNextClear()` was called, in which case
// the NEXT clearTimeout call is a deliberate no-op (simulating a code path
// that misses cancellation) and the callback stays invocable. Restores the
// real globals in a `finally`, so a throwing test never leaks the stub.
function withCapturedTimers(fn) {
	const realSetTimeout = global.setTimeout
	const realClearTimeout = global.clearTimeout
	const callbacks = new Map()
	const delays = new Map()
	const clearedIds = new Set()
	let nextId = 0
	let bypassNextClear = false
	global.setTimeout = (cb, delay) => {
		const id = ++nextId
		callbacks.set(id, cb)
		delays.set(id, delay)
		return id
	}
	global.clearTimeout = (id) => {
		if (bypassNextClear) {
			bypassNextClear = false
			return
		}
		callbacks.delete(id)
		clearedIds.add(id)
	}
	try {
		return fn({
			invoke: (id) => {
				const cb = callbacks.get(id)
				assert.ok(cb, `no live captured callback for timer id ${id} — it was already cleared or never scheduled`)
				cb()
			},
			delayOf: (id) => delays.get(id),
			wasCleared: (id) => clearedIds.has(id),
			bypassNextClear: () => {
				bypassNextClear = true
			},
		})
	} finally {
		global.setTimeout = realSetTimeout
		global.clearTimeout = realClearTimeout
	}
}

describe('api.js — freeze pending overlay primitives', () => {
	test('_freezeValue falls back to DATA[field] when nothing is pending', () => {
		const self = makeApiSelf()
		self.DATA = { freeze: '00' }
		assert.equal(self._freezeValue('freeze'), '00')
	})

	test('_freezeValue returns the pending value when one is set, ignoring DATA[field]', () => {
		withCapturedTimers(() => {
			const self = makeApiSelf()
			self.DATA = { freeze: '00' }
			self._setFreezePending('freeze', '01', () => {})
			assert.equal(self._freezeValue('freeze'), '01')
		})
	})

	test('_setFreezePending schedules its expiry at exactly FREEZE_PENDING_TIMEOUT_MS (2000ms)', () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self._setFreezePending('freeze', '01', () => {})
			const id = self._freezePending.freeze.timer
			assert.equal(timers.delayOf(id), 2000)
		})
	})

	test('the expiry callback removes the record, calls onExpire exactly once, and falls back to DATA — invoking it again afterward is a safe no-op', () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = { freeze: '00' }
			let expireCount = 0
			self._setFreezePending('freeze', '01', () => expireCount++)
			const id = self._freezePending.freeze.timer
			assert.equal(self._freezeValue('freeze'), '01', 'pending before expiry')

			timers.invoke(id)
			assert.equal(expireCount, 1, 'onExpire fires exactly once when its own timer callback runs')
			assert.equal(self._freezeValue('freeze'), '00', 'falls back to DATA once expired')

			timers.invoke(id) // the very same already-consumed callback, invoked again
			assert.equal(expireCount, 1, 'a second run of the same callback does not fire onExpire again')
		})
	})

	test('_clearFreezePending cancels the real timer and removes the record — no onExpire, no later state change', () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = { freeze: '00' }
			let expireCount = 0
			self._setFreezePending('freeze', '01', () => expireCount++)
			const id = self._freezePending.freeze.timer

			self._clearFreezePending('freeze')

			assert.ok(timers.wasCleared(id), 'clearTimeout was actually called for this exact timer id')
			assert.equal(self._freezePending.freeze, undefined)
			assert.equal(self._freezeValue('freeze'), '00')
			assert.equal(expireCount, 0)
		})
	})

	test('_clearFreezePending on a field with nothing pending is a safe no-op', () => {
		const self = makeApiSelf()
		self.DATA = {}
		assert.doesNotThrow(() => self._clearFreezePending('freeze'))
	})

	test("_clearAllFreezePending cancels every field's real timer", () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = {}
			let aExpire = 0
			let bExpire = 0
			self._setFreezePending('freeze', '01', () => aExpire++)
			const idA = self._freezePending.freeze.timer
			self._setFreezePending('freeze_type', '00', () => bExpire++)
			const idB = self._freezePending.freeze_type.timer

			self._clearAllFreezePending()

			assert.ok(timers.wasCleared(idA) && timers.wasCleared(idB), 'both real timers were actually cancelled')
			assert.equal(aExpire, 0)
			assert.equal(bExpire, 0)
			assert.deepEqual(self._freezePending, {})
		})
	})

	test('_clearAllFreezePending on an instance with nothing pending is a safe no-op', () => {
		const self = makeApiSelf()
		assert.doesNotThrow(() => self._clearAllFreezePending())
	})

	test("On -> Off before any response arrives: the superseded first record is properly cancelled (defense #1), and only the second record's own timer remains live", () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = { freeze: 'FALLBACK' }
			const expireCalls = []
			self._setFreezePending('freeze', '01', () => expireCalls.push('first'))
			const firstId = self._freezePending.freeze.timer

			self._setFreezePending('freeze', '00', () => expireCalls.push('second'))
			const secondId = self._freezePending.freeze.timer

			assert.ok(timers.wasCleared(firstId), "the superseded first record's timer is explicitly cancelled (defense #1)")
			assert.notEqual(firstId, secondId)
			assert.equal(self._freezeValue('freeze'), '00', 'only the second (newer) value is shown')

			timers.invoke(secondId)
			assert.deepEqual(expireCalls, ['second'], 'only the second record ever expires')
			assert.equal(self._freezeValue('freeze'), 'FALLBACK')
		})
	})
})

// ── 4. api.js — the two timer-defense safeguards, tested SEPARATELY ────────
//
// Per FREEZE-ONOFF-INDEPENDENT-REVIEW.md finding 3: the block above already
// proves defense #1 (explicit clearTimeout on supersession). These tests
// prove defense #2 — the timeout callback's own record-identity check —
// holds independently of defense #1, by deliberately bypassing
// clearTimeout and then running the stale callback by hand. Critically,
// each test uses the SAME value for both the superseded and the
// superseding write: a value-based comparison (e.g.
// `self._freezePending[field]?.value !== record.value`) would wrongly
// treat the stale callback as "still matching" here, since the values are
// equal — only a true object-identity comparison tells the two records
// apart. This is exactly the mutation the independent review used to
// prove the prior version of this file couldn't tell the difference.

describe('api.js — dual timer-defense safeguards, tested separately', () => {
	test('defense #2 alone (same value, cancellation bypassed): the identity check — not a value comparison — rejects the stale callback', () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = { freeze: 'FALLBACK' }
			const expireCalls = []

			self._setFreezePending('freeze', '01', () => expireCalls.push('first'))
			const firstId = self._freezePending.freeze.timer
			const firstRecord = self._freezePending.freeze

			timers.bypassNextClear()
			self._setFreezePending('freeze', '01', () => expireCalls.push('second')) // SAME value as the first write
			const secondRecord = self._freezePending.freeze
			assert.notEqual(firstRecord, secondRecord, 'two distinct record objects, despite carrying the same value')

			timers.invoke(firstId) // the stale, never-really-cancelled first callback, run deliberately
			assert.deepEqual(
				expireCalls,
				[],
				"the identity check rejects the stale callback even though its value equals the current record's value",
			)
			assert.equal(self._freezePending.freeze, secondRecord, 'the second record is untouched')
			assert.equal(self._freezeValue('freeze'), '01', 'still showing the (second, current) pending value')
		})
	})

	test('defense #2 alone, after a reconnect installs a new same-valued pending record: the stale pre-reconnect callback is still rejected', () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = { freeze: 'FALLBACK' }
			const expireCalls = []

			self._setFreezePending('freeze', '01', () => expireCalls.push('pre-reconnect'))
			const staleId = self._freezePending.freeze.timer

			// What the 'connect' handler and initConnection()'s own teardown
			// both call — its clearTimeout for this one timer is bypassed,
			// simulating a path that misses cancellation.
			timers.bypassNextClear()
			self._clearAllFreezePending()
			assert.equal(
				self._freezePending.freeze,
				undefined,
				'the record itself is removed regardless of whether its own clearTimeout call was bypassed',
			)

			// The new session sets its own pending record for the same
			// field, coincidentally the same value as the stale one.
			self._setFreezePending('freeze', '01', () => expireCalls.push('post-reconnect'))
			const newRecord = self._freezePending.freeze

			timers.invoke(staleId)
			assert.deepEqual(
				expireCalls,
				[],
				"the stale pre-reconnect callback must not delete the new session's pending record",
			)
			assert.equal(self._freezePending.freeze, newRecord, "the new session's pending record is untouched")
		})
	})

	test('defense #2 alone, after destroy() has cleared everything: the stale callback is rejected and triggers no consumer update', () => {
		withCapturedTimers((timers) => {
			const self = makeApiSelf()
			self.DATA = { freeze: 'FALLBACK' }
			const expireCalls = []

			self._setFreezePending('freeze', '01', () => expireCalls.push('pre-destroy'))
			const staleId = self._freezePending.freeze.timer

			timers.bypassNextClear()
			self._clearAllFreezePending() // what destroy() calls
			assert.equal(self._freezePending.freeze, undefined)

			timers.invoke(staleId)
			assert.deepEqual(
				expireCalls,
				[],
				'no onExpire after destroy — nothing should react to a stale timer on a torn-down instance',
			)
			assert.equal(
				self._freezePending.freeze,
				undefined,
				'still nothing pending — the stale callback did not resurrect a record',
			)
		})
	})
})

// ── 5. api.js — the REAL parser clears the pending overlay ─────────────────

describe('src/api.js — real parser path clears the freeze pending overlay', () => {
	function makeFreezePipelineSelf() {
		return Object.assign(Object.create(api), {
			config: { verbose: false },
			DATA: {},
			tcpBuffer: '',
			log: () => {},
			logVerbose: () => {},
			checkFeedbacks: () => {},
			checkVariables: () => {},
			setVariableValues: () => {},
		})
	}

	// Drives the exact same chain the real socket 'data' handler uses:
	// extractMessages(buffer) -> updateData(msg) per message.
	function feedRawDeviceData(self, rawBuffer) {
		const { messages, remaining } = extractMessages(rawBuffer)
		assert.equal(remaining, '', 'test fixture must send only complete messages')
		for (const msg of messages) self.updateData(msg)
	}

	test('single-byte DTH:020500,01; (matching the pending value) clears the pending overlay', () => {
		withCapturedTimers(() => {
			const self = makeFreezePipelineSelf()
			self._setFreezePending('freeze', '01', () => {})
			feedRawDeviceData(self, 'DTH:020500,01;')
			assert.equal(self._freezePending.freeze, undefined, 'pending overlay cleared')
			assert.equal(self.DATA.freeze, '01')
		})
	})

	test('single-byte DTH:020500,00; (NOT matching the pending "01" value) still clears the pending overlay — any real response supersedes a pending write', () => {
		withCapturedTimers(() => {
			const self = makeFreezePipelineSelf()
			self._setFreezePending('freeze', '01', () => {})
			feedRawDeviceData(self, 'DTH:020500,00;')
			assert.equal(
				self._freezePending.freeze,
				undefined,
				'pending overlay cleared even though the device reported the OTHER value',
			)
			assert.equal(self.DATA.freeze, '00')
		})
	})

	test('the 18-byte block readback response also clears the pending overlay', () => {
		withCapturedTimers(() => {
			const self = makeFreezePipelineSelf()
			self._setFreezePending('freeze', '01', () => {})
			// 18 bytes: freeze on/off (01), freeze_type (00), 16x freeze_select bytes.
			const block = '01' + '00' + '00'.repeat(16)
			feedRawDeviceData(self, `DTH:020500,${block};`)
			assert.equal(self._freezePending.freeze, undefined)
			assert.equal(self.DATA.freeze, '01')
		})
	})

	test('a malformed (non-hex) freeze value does NOT clear the pending overlay', () => {
		withCapturedTimers(() => {
			const self = makeFreezePipelineSelf()
			self._setFreezePending('freeze', '01', () => {})
			// Neither a valid 1-byte nor 18-byte hex value: falls into the
			// "Unexpected value" warn branch, which must not touch the
			// pending overlay — a garbled response is not a real confirmation.
			feedRawDeviceData(self, 'DTH:020500,ZZ;')
			assert.equal(self._freezePending.freeze.value, '01', 'pending overlay is untouched by a malformed response')
		})
	})

	test('a neighboring freeze_type response does not clear the "freeze" field\'s own pending overlay', () => {
		withCapturedTimers(() => {
			const self = makeFreezePipelineSelf()
			self._setFreezePending('freeze', '01', () => {})
			feedRawDeviceData(self, 'DTH:020501,00;') // freeze_type, not freeze itself
			assert.equal(
				self._freezePending.freeze.value,
				'01',
				"unrelated field response must not clear freeze's pending overlay",
			)
		})
	})
})

// ── 6. Full chain — real action -> pending -> real feedback/variable -> ────
// ── real expiry, wired together the way index.js itself wires them ────────
//
// Per FREEZE-ONOFF-INDEPENDENT-REVIEW.md finding 2: the blocks above each
// call real production functions, but in isolation — action tests stub
// _setFreezePending, feedback/variable tests stub _freezeValue, and the
// parser tests stub the consumers entirely. None of them, individually,
// proves the full path a button press actually takes. This block wires
// actions.js + feedbacks.js + variables.js + api.js + constants.js onto
// one `self`, exactly as index.js's own `Object.assign(this, {...actions,
// ...feedbacks, ...variables, ...api, ...constants})` does, and only stubs
// the genuine Companion-SDK boundary calls (setFeedbackDefinitions,
// setVariableDefinitions, setVariableValues, sendCommand/sendRawCommand,
// log). checkFeedbacks is stubbed too — the real SDK provides it, not
// feedbacks.js — but the stub immediately re-evaluates the real,
// registered `freeze` feedback callback and records the result, mirroring
// what Companion does the moment a feedback is marked dirty. checkVariables
// is the REAL one from variables.js; only its own terminal
// setVariableValues call is stubbed. This is what lets a test observe the
// value actually published to Companion at each update call, not just
// read some internal field once at the end.

function makeFreezeChainSelf(connected) {
	const sent = []
	const rawSent = []
	const feedbackEvents = [] // { types, freezeValue } — one per checkFeedbacks call
	const variablePublishes = [] // each real setVariableValues call's object

	let feedbackDefs = null
	let actionDefs = null

	const self = Object.assign({}, actions, feedbacks, variables, api, constants, {
		DATA: {},
		_freezePending: {}, // matches index.js's own constructor initialization
		config: { verbose: false },
		socket: connected ? { isConnected: true } : undefined,
		sendCommand: (addr, val) => sent.push({ addr, val }),
		sendRawCommand: (cmd) => rawSent.push(cmd),
		log: () => {},
		logVerbose: () => {},
		setFeedbackDefinitions: (f) => {
			feedbackDefs = f
		},
		setVariableDefinitions: () => {},
		setActionDefinitions: (a) => {
			actionDefs = a
		},
		setVariableValues: (obj) => variablePublishes.push(obj),
		checkFeedbacks: function (...types) {
			feedbackEvents.push({ types, freezeValue: feedbackDefs.freeze.callback({ options: {} }, {}) })
		},
	})
	self.initFeedbacks()
	self.initVariables()
	self.initActions()

	// initActions()/initFeedbacks() only ever hand their definitions to
	// setActionDefinitions/setFeedbackDefinitions (the real Companion SDK
	// call) — they are never assigned onto `self` itself. Tests must call
	// through `actions.freezeSwitchOn.callback(...)`, not
	// `self.freezeSwitchOn.callback(...)`.
	return { self, actionDefs, sent, rawSent, feedbackEvents, variablePublishes }
}

describe('full chain — real action -> real pending overlay -> real feedback/variable publish -> real expiry', () => {
	test('freezeSwitchOn: DATA stays unchanged before any response, but the real registered feedback and the real published "freeze" variable already show On', () => {
		const { self, actionDefs, feedbackEvents, variablePublishes } = makeFreezeChainSelf(true)
		self.DATA.freeze = '00'

		withCapturedTimers(() => {
			actionDefs.freezeSwitchOn.callback({ options: {} }, {})
		})

		assert.equal(self.DATA.freeze, '00', 'DATA is written only by the parser, never by the action')
		assert.ok(feedbackEvents.length >= 1, 'checkFeedbacks was actually called')
		assert.equal(
			feedbackEvents.at(-1).freezeValue,
			true,
			'the real feedback callback, evaluated at the real checkFeedbacks call, already reports On',
		)
		assert.ok(variablePublishes.length >= 1, 'checkVariables (the real one) actually published something')
		assert.equal(variablePublishes.at(-1).freeze, 'On', 'the real published "freeze" variable value already reads On')
	})

	test('freezeSwitchOff: symmetric — the real feedback/variable already show Off before any response', () => {
		const { self, actionDefs, feedbackEvents, variablePublishes } = makeFreezeChainSelf(true)
		self.DATA.freeze = '01'

		withCapturedTimers(() => {
			actionDefs.freezeSwitchOff.callback({ options: {} }, {})
		})

		assert.equal(self.DATA.freeze, '01')
		assert.equal(feedbackEvents.at(-1).freezeValue, false)
		assert.equal(variablePublishes.at(-1).freeze, 'Off')
	})

	test('expiry (the real onExpire from actions.js) republishes the real feedback and variable back to DATA — exactly what a mutation removing those calls would break', () => {
		withCapturedTimers((timers) => {
			const { self, actionDefs, feedbackEvents, variablePublishes } = makeFreezeChainSelf(true)
			self.DATA.freeze = '00'

			actionDefs.freezeSwitchOn.callback({ options: {} }, {})
			const id = self._freezePending.freeze.timer
			const eventsBeforeExpiry = feedbackEvents.length
			const publishesBeforeExpiry = variablePublishes.length
			assert.equal(feedbackEvents.at(-1).freezeValue, true, 'On is published before expiry')

			timers.invoke(id) // the real onExpire from actions.js's freezeSwitchOn runs here

			assert.ok(feedbackEvents.length > eventsBeforeExpiry, 'expiry must trigger a further checkFeedbacks call')
			assert.equal(feedbackEvents.at(-1).freezeValue, false, 'the real feedback now reports Off — back to DATA')
			assert.ok(variablePublishes.length > publishesBeforeExpiry, 'expiry must trigger a further checkVariables call')
			assert.equal(variablePublishes.at(-1).freeze, 'Off', "the real published variable is back to DATA's Off")
		})
	})

	test('the real single-byte parser response clears the pending overlay, and the real feedback/variable end up backed by real DATA, not a guess', () => {
		const { self, actionDefs, feedbackEvents } = makeFreezeChainSelf(true)
		self.DATA.freeze = '00'

		withCapturedTimers(() => {
			actionDefs.freezeSwitchOn.callback({ options: {} }, {})
		})
		assert.equal(feedbackEvents.at(-1).freezeValue, true, 'pending On shown before the device confirms')

		const { messages } = extractMessages('DTH:020500,01;')
		for (const msg of messages) self.updateData(msg)

		assert.equal(self.DATA.freeze, '01', 'the real parser wrote DATA')
		assert.equal(self._freezePending.freeze, undefined, 'pending cleared by the real parser')
		assert.equal(feedbackEvents.at(-1).freezeValue, true, 'still On — now backed by real DATA, not a pending guess')
	})

	test('disconnected: freezeSwitchOn still sends the command, but never touches the pending overlay or the real feedback/variable', () => {
		const { self, actionDefs, sent, feedbackEvents, variablePublishes } = makeFreezeChainSelf(false)
		self.DATA.freeze = '00'

		actionDefs.freezeSwitchOn.callback({ options: {} }, {})

		assert.deepEqual(sent, [{ addr: '020500', val: '01' }])
		assert.equal(self._freezePending.freeze, undefined)
		assert.deepEqual(feedbackEvents, [])
		assert.deepEqual(variablePublishes, [])
	})
})

// ── 7. Connection lifecycle — freeze pending overlay integration ───────────

describe('connection lifecycle — freeze pending overlay integration', () => {
	test('a fresh connect clears any pending freeze overlay left from before this session and refreshes feedback + variable', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		const feedbackCalls = []
		const variableCalls = []
		env.self.checkFeedbacks = (...types) => feedbackCalls.push(types)
		env.self.checkVariables = () => variableCalls.push(true)

		env.self._setFreezePending('freeze', '01', () => {})
		assert.notEqual(env.self._freezePending.freeze, undefined, 'pending overlay is set before the reconnect')

		// A config save re-runs initConnection, opening a fresh TCPHelper.
		// The 'connect' handler fires once the raw TCP connection succeeds
		// (simulateReady) — before the Roland password/Welcome handshake,
		// which this test does not need to drive.
		env.self.initConnection()
		env.advance()
		simulateReady(env.helpers[env.helpers.length - 1])

		assert.equal(
			env.self._freezePending.freeze,
			undefined,
			"the 'connect' handler clears any pending overlay left from before this session",
		)
		assert.ok(
			feedbackCalls.some((types) => types.includes('freeze')),
			"the 'connect' handler refreshes the freeze feedback",
		)
		assert.ok(variableCalls.length > 0, "the 'connect' handler refreshes variables")
	})

	test('a connection REPLACEMENT clears any pending freeze overlay immediately inside initConnection() itself, even if the new connection never reaches "connect" (e.g. an emptied/unreachable host)', () => {
		// Regression test for FREEZE-ONOFF-INDEPENDENT-REVIEW.md finding 1:
		// the prior version of this fix only cleared the pending overlay
		// inside the NEW socket's own 'connect' handler, so a config change
		// to an unreachable or empty host left the OLD connection's pending
		// value and timer alive indefinitely on top of an already-destroyed
		// socket — reproduced here by emptying config.host, which means
		// initConnection() tears down the old socket but never even creates
		// a new TCPHelper, so 'connect' can never fire for this call.
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		const feedbackCalls = []
		const variableCalls = []
		env.self.checkFeedbacks = (...types) => feedbackCalls.push(types)
		env.self.checkVariables = () => variableCalls.push(true)

		env.self._setFreezePending('freeze', '01', () => {})
		assert.notEqual(env.self._freezePending.freeze, undefined, 'pending overlay is set before the host is emptied')

		env.self.config.host = '' // simulates a config save to an unreachable/empty host
		env.self.initConnection()
		// Deliberately no env.advance()/simulateReady() afterward — proving
		// the clear happens synchronously inside initConnection() itself, on
		// teardown, not only from a 'connect' handler that in this scenario
		// is never even wired up.

		assert.equal(
			env.self._freezePending.freeze,
			undefined,
			'initConnection() itself clears the pending overlay on teardown, before any new connection is attempted',
		)
		assert.ok(
			feedbackCalls.some((types) => types.includes('freeze')),
			'initConnection() refreshes the freeze feedback so a stale pending value cannot stay shown on the button',
		)
		assert.ok(variableCalls.length > 0, 'initConnection() refreshes variables for the same reason')
	})

	test('destroy() cancels a live pending-value timer — it never fires, and no feedback/variable refresh happens afterward', async () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		const feedbackCalls = []
		const variableCalls = []
		env.self.checkFeedbacks = (...types) => feedbackCalls.push(types)
		env.self.checkVariables = () => variableCalls.push(true)

		let expired = false
		env.self._setFreezePending('freeze', '01', () => {
			expired = true
		})

		await env.self.destroy()
		env.advance(5000) // well past FREEZE_PENDING_TIMEOUT_MS (2000ms)

		assert.equal(expired, false, 'the pending timer was cancelled by destroy() — onExpire never fires')
		assert.deepEqual(feedbackCalls, [], 'destroy() itself must not trigger a feedback refresh')
		assert.deepEqual(variableCalls, [], 'destroy() itself must not trigger a variable refresh')
	})

	test('polling disabled: exactly one freeze query is sent right after authentication', () => {
		const env = createEnvironment({ polling: false })
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(1000)

		const freezeQueries = env.helpers[0]._socket.sent.filter((msg) => msg.startsWith('RQH:020500,000012;'))
		assert.equal(
			freezeQueries.length,
			1,
			'expected exactly one freeze query, got: ' + JSON.stringify(env.helpers[0]._socket.sent),
		)
	})

	test('polling enabled: exactly one freeze query is sent right after authentication (no duplicate from the Welcome-branch fallback)', () => {
		const env = createEnvironment({ polling: true })
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(1000)

		const freezeQueries = env.helpers[0]._socket.sent.filter((msg) => msg.startsWith('RQH:020500,000012;'))
		assert.equal(
			freezeQueries.length,
			1,
			'expected exactly one freeze query, got: ' + JSON.stringify(env.helpers[0]._socket.sent),
		)
	})

	test('the existing queue priority/pacing is unchanged: the freeze write is HIGH and always precedes both its own LOW readback and a later HIGH write never gets overtaken by that readback', () => {
		// Drives the exact same two calls freezeSwitchOn's callback makes
		// (self.sendCommand then self.sendRawCommand('RQH:...')) directly
		// against the real src/api.js/src/commandQueue.js loaded by this
		// harness — actions.js itself is not loaded here (see
		// lifecycleHarness.js), but these are the unchanged, unmodified
		// production functions actions.js calls into.
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)
		const sentBefore = env.helpers[0]._socket.sent.length

		env.self.sendCommand('020500', '01') // HIGH — the freeze write itself
		env.self.sendRawCommand('RQH:020500,000001;') // LOW — its own readback
		env.self.sendCommand('002100', '01') // HIGH — an unrelated, later-queued write

		env.advance(200)

		const sentAfter = env.helpers[0]._socket.sent.slice(sentBefore)
		const freezeWriteIdx = sentAfter.findIndex((m) => m.startsWith('DTH:020500,01;'))
		const freezeReadbackIdx = sentAfter.findIndex((m) => m.startsWith('RQH:020500,000001;'))
		const laterHighIdx = sentAfter.findIndex((m) => m.startsWith('DTH:002100,01;'))

		assert.ok(
			freezeWriteIdx !== -1 && freezeReadbackIdx !== -1 && laterHighIdx !== -1,
			'all three commands were sent: ' + JSON.stringify(sentAfter),
		)
		assert.ok(
			freezeWriteIdx < freezeReadbackIdx,
			'the write is sent before its own readback — the LOW read never overtakes it',
		)
		assert.ok(
			laterHighIdx < freezeReadbackIdx,
			'the later-queued HIGH write is not overtaken by the earlier-queued LOW readback — unchanged HIGH-before-LOW priority',
		)
	})
})
