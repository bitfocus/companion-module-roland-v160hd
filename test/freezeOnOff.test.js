'use strict'

// Freeze On/Off feature tests — see CLAUDE-FREEZE-PLAN.md §2 for the design
// (local pending-value overlay with bounded expiry and a dual-defense
// timer-identity guard) and CLAUDE-FREEZE-ONOFF-IMPLEMENT.md for this
// slice's exact scope (absolute On/Off actions, the 'freeze' field only).
//
// Four describe blocks, each against REAL, unmodified-by-this-file
// production code:
//   1. src/actions.js  — freezeSwitchOn/Off (direct require, house
//      require.cache-stub pattern from test/smallCorrectnessFixtures.test.js)
//   2. src/feedbacks.js + src/variables.js — read the pending overlay
//   3. src/api.js — the pending-overlay primitives themselves, using
//      node:test's mock.timers for deterministic expiry (same pattern as
//      test/commandQueue.test.js)
//   4. src/api.js — the REAL parser (extractMessages -> updateData), proving
//      it clears the overlay exactly when a real response arrives
//   5. Full connection lifecycle (test-support/lifecycleHarness.js) — the
//      'connect' handler, destroy(), and the polling-on/off initial read,
//      against the REAL TCPHelper and a virtual clock.

const { test, describe, beforeEach, afterEach, mock } = require('node:test')
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

// ── 3. api.js — pending-overlay primitives (deterministic virtual time) ────

function makeApiSelf() {
	return Object.assign(Object.create(api), {
		config: { verbose: false },
		log: () => {},
	})
}

describe('api.js — freeze pending overlay primitives', () => {
	beforeEach(() => {
		mock.timers.enable(['setTimeout'])
	})
	afterEach(() => {
		mock.timers.reset()
	})

	test('_freezeValue falls back to DATA[field] when nothing is pending', () => {
		const self = makeApiSelf()
		self.DATA = { freeze: '00' }
		assert.equal(self._freezeValue('freeze'), '00')
	})

	test('_freezeValue returns the pending value when one is set, ignoring DATA[field]', () => {
		const self = makeApiSelf()
		self.DATA = { freeze: '00' }
		self._setFreezePending('freeze', '01', () => {})
		assert.equal(self._freezeValue('freeze'), '01')
	})

	test('a pending value expires after FREEZE_PENDING_TIMEOUT_MS (2000ms), calling onExpire exactly once and falling back to DATA', () => {
		const self = makeApiSelf()
		self.DATA = { freeze: '00' }
		let expireCount = 0
		self._setFreezePending('freeze', '01', () => expireCount++)

		mock.timers.tick(1999)
		assert.equal(self._freezeValue('freeze'), '01', 'still pending 1ms before the deadline')
		assert.equal(expireCount, 0)

		mock.timers.tick(1)
		assert.equal(expireCount, 1, 'onExpire fires exactly once at the deadline')
		assert.equal(self._freezeValue('freeze'), '00', 'falls back to DATA once expired')
	})

	test('_clearFreezePending cancels the timer and removes the record — no onExpire, no later state change', () => {
		const self = makeApiSelf()
		self.DATA = { freeze: '00' }
		let expireCount = 0
		self._setFreezePending('freeze', '01', () => expireCount++)
		self._clearFreezePending('freeze')
		assert.equal(self._freezeValue('freeze'), '00')

		mock.timers.tick(5000)
		assert.equal(expireCount, 0, 'the cancelled timer never fires')
	})

	test('_clearFreezePending on a field with nothing pending is a safe no-op', () => {
		const self = makeApiSelf()
		self.DATA = {}
		assert.doesNotThrow(() => self._clearFreezePending('freeze'))
	})

	test("_clearAllFreezePending cancels every field's timer", () => {
		const self = makeApiSelf()
		self.DATA = {}
		let aExpire = 0
		let bExpire = 0
		self._setFreezePending('freeze', '01', () => aExpire++)
		self._setFreezePending('freeze_type', '00', () => bExpire++)

		self._clearAllFreezePending()
		mock.timers.tick(5000)

		assert.equal(aExpire, 0)
		assert.equal(bExpire, 0)
		assert.deepEqual(self._freezePending, {})
	})

	test('_clearAllFreezePending on an instance with nothing pending is a safe no-op', () => {
		const self = makeApiSelf()
		assert.doesNotThrow(() => self._clearAllFreezePending())
	})

	test('On -> Off before the first response arrives: only the newest pending value survives, and the oldest timer does not wrongly clear it at its original deadline', () => {
		const self = makeApiSelf()
		self.DATA = { freeze: '00' }
		const expireCalls = []
		self._setFreezePending('freeze', '01', () => expireCalls.push('first-onExpire'))

		mock.timers.tick(1000) // t=1000; the first record's own deadline is t=2000
		self._setFreezePending('freeze', '00', () => expireCalls.push('second-onExpire'))

		mock.timers.tick(1000) // t=2000 — the FIRST record's original deadline
		assert.equal(
			self._freezeValue('freeze'),
			'00',
			"the second (newer) pending value must survive the first record's deadline",
		)
		assert.deepEqual(expireCalls, [], "the first record's timer was cancelled — its onExpire must not fire")

		mock.timers.tick(1000) // t=3000 — the SECOND record's own 2000ms deadline
		assert.equal(self._freezeValue('freeze'), '00', 'expired back to DATA')
		assert.deepEqual(expireCalls, ['second-onExpire'], 'only the second record ever expires')
	})

	test('defense #2 (record-identity check) alone prevents a wrong deletion, even when clearTimeout is bypassed for the superseding write', () => {
		// Simulates "a future code path misses a cancellation": temporarily
		// stubs out global clearTimeout so the FIRST write's timer is never
		// actually cancelled when the second write supersedes it a moment
		// later — proving the timeout callback's own closure-captured
		// record-identity check (`self._freezePending[field] !== record`) is
		// what stops the wrong deletion here, independent of clearTimeout
		// (which this test disables for that one call).
		const self = makeApiSelf()
		self.DATA = { freeze: 'FALLBACK' }
		const expireCalls = []
		self._setFreezePending('freeze', '01', () => expireCalls.push('first-onExpire'))

		const realClearTimeout = global.clearTimeout
		global.clearTimeout = () => {} // the first record's timer is now NOT cancelled below
		self._setFreezePending('freeze', '00', () => expireCalls.push('second-onExpire'))
		global.clearTimeout = realClearTimeout

		assert.equal(
			self._freezeValue('freeze'),
			'00',
			'the second (newer) pending value is what is shown right after the write',
		)

		mock.timers.tick(1999)
		assert.deepEqual(expireCalls, [], 'neither timer has reached its deadline yet')

		// Both the (never-cancelled) first timer and the second timer share
		// the same 2000ms deadline, since no time passed between the two
		// _setFreezePending calls above. The first one's callback runs, sees
		// its own record no longer matches self._freezePending.freeze, and
		// returns early.
		mock.timers.tick(1)
		assert.deepEqual(
			expireCalls,
			['second-onExpire'],
			'only the second record actually expires — the first is rejected by the identity check alone',
		)
		assert.equal(
			self._freezeValue('freeze'),
			'FALLBACK',
			'falls back to DATA once the second (real) pending record expires',
		)
	})
})

// ── 4. api.js — the REAL parser clears the pending overlay ─────────────────

describe('src/api.js — real parser path clears the freeze pending overlay', () => {
	beforeEach(() => {
		mock.timers.enable(['setTimeout'])
	})
	afterEach(() => {
		mock.timers.reset()
	})

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
		const self = makeFreezePipelineSelf()
		self._setFreezePending('freeze', '01', () => {})
		feedRawDeviceData(self, 'DTH:020500,01;')
		assert.equal(self._freezePending.freeze, undefined, 'pending overlay cleared')
		assert.equal(self.DATA.freeze, '01')
	})

	test('single-byte DTH:020500,00; (NOT matching the pending "01" value) still clears the pending overlay — any real response supersedes a pending write', () => {
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

	test('the 18-byte block readback response also clears the pending overlay', () => {
		const self = makeFreezePipelineSelf()
		self._setFreezePending('freeze', '01', () => {})
		// 18 bytes: freeze on/off (01), freeze_type (00), 16x freeze_select bytes.
		const block = '01' + '00' + '00'.repeat(16)
		feedRawDeviceData(self, `DTH:020500,${block};`)
		assert.equal(self._freezePending.freeze, undefined)
		assert.equal(self.DATA.freeze, '01')
	})

	test('a malformed (non-hex) freeze value does NOT clear the pending overlay', () => {
		const self = makeFreezePipelineSelf()
		self._setFreezePending('freeze', '01', () => {})
		// Neither a valid 1-byte nor 18-byte hex value: falls into the
		// "Unexpected value" warn branch, which must not touch the pending
		// overlay — a garbled response is not a real confirmation.
		feedRawDeviceData(self, 'DTH:020500,ZZ;')
		assert.equal(self._freezePending.freeze.value, '01', 'pending overlay is untouched by a malformed response')
	})

	test('a neighboring freeze_type response does not clear the "freeze" field\'s own pending overlay', () => {
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

// ── 5. Connection lifecycle — freeze pending overlay integration ───────────

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
