'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const BASE_STUB = {
	InstanceStatus: { Ok: 'ok', Connecting: 'connecting', Disconnected: 'disconnected', Error: 'error' },
	TCPHelper: class {},
	combineRgb: (r, g, b) => (r << 16) | (g << 8) | b,
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
const feedbacksDef = require('../src/feedbacks')
const actionsDef = require('../src/actions')
const constants = require('../src/constants')
const { extractMessages } = require('../src/tcpParser')

// Build a module instance stub and capture the auxTally callback via setFeedbackDefinitions.
function makeInstance(dataOverrides) {
	const self = {
		config: { verbose: false },
		DATA: Object.assign({ inputAssign: new Array(20).fill(undefined) }, dataOverrides || {}),
		log: () => {},
		logVerbose: () => {},
		setVariableValues: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		TALLYDATA: constants.TALLYDATA.map((t) => Object.assign({}, t)),
		CHOICES_PGMPVW_SELECT: constants.CHOICES_PGMPVW_SELECT,
		CHOICES_PNPKEY_SOURCES: constants.CHOICES_PNPKEY_SOURCES,
		CHOICES_OUTPUTS: constants.CHOICES_OUTPUTS,
		CHOICES_OUTPUTSASSIGN: constants.CHOICES_OUTPUTSASSIGN || [{ id: '00', label: 'Placeholder' }],
		_parseHexBlock: api._parseHexBlock,
		_resolveInputToPhysical: api._resolveInputToPhysical,
	}

	let auxTallyCallback
	self.setFeedbackDefinitions = (defs) => {
		auxTallyCallback = defs.auxTally.callback
	}
	feedbacksDef.initFeedbacks.call(self)
	self._auxTally = auxTallyCallback
	return self
}

function auxTally(self, aux, assign) {
	return self._auxTally({ options: { aux, assign } }, {})
}

// Feed a DTH message directly to updateData.
function feedDTH(self, dth) {
	api.updateData.call(self, dth + ';')
}

// ── VIDEO ASSIGN DTH parsing ─────────────────────────────────────────────────

describe('VIDEO ASSIGN DTH parsing', () => {
	test('10-byte block at 000000 populates inputAssign[0..9]', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		// INPUT 1 → HDMI 1 (00), INPUT 2 → HDMI 2 (01), … INPUT 6 → HDMI 6 (05), …
		const block = '00010203040506070809'
		feedDTH(self, 'DTH:000000,' + block)
		assert.deepEqual(self.DATA.inputAssign.slice(0, 10), ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'])
	})

	test('10-byte block at 000024 populates inputAssign[10..19]', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		const block = '0A0B0C0D0E0F101112FF'
		feedDTH(self, 'DTH:000024,' + block)
		assert.deepEqual(self.DATA.inputAssign.slice(10, 20), ['0A', '0B', '0C', '0D', '0E', '0F', '10', '11', '12', 'FF'])
	})

	test('000000 block leaves inputAssign[10..19] unchanged', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		// Preset INPUT 11 slot
		self.DATA.inputAssign[10] = '08'
		feedDTH(self, 'DTH:000000,' + '00'.repeat(10))
		assert.equal(self.DATA.inputAssign[10], '08')
	})

	test('malformed 000000 block (invalid hex) does not overwrite inputAssign', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000000,' + '00010203040506070809')
		const before = [...self.DATA.inputAssign.slice(0, 10)]
		// Feed non-hex / wrong-length value — must not change state
		feedDTH(self, 'DTH:000000,ZZZZZZZZZZZZZZZZZZZZ')
		assert.deepEqual(self.DATA.inputAssign.slice(0, 10), before)
	})

	test('malformed 000000 block (wrong length) does not partially overwrite', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000000,' + '05'.repeat(10)) // set all INPUT 1-10 → HDMI 6
		const before = [...self.DATA.inputAssign.slice(0, 10)]
		// 9-byte block (18 hex chars) — wrong length, not 1 byte and not 10 bytes
		feedDTH(self, 'DTH:000000,' + '01'.repeat(9))
		assert.deepEqual(self.DATA.inputAssign.slice(0, 10), before)
	})
})

// ── _resolveInputToPhysical ──────────────────────────────────────────────────

describe('_resolveInputToPhysical', () => {
	test('returns physical assignment for INPUT 1 (20)', () => {
		const self = makeInstance()
		self.DATA.inputAssign[0] = '00' // INPUT 1 → HDMI 1
		assert.equal(api._resolveInputToPhysical.call(self, '20'), '00')
	})

	test('returns physical assignment for INPUT 6 (25) → HDMI 6 (05)', () => {
		const self = makeInstance()
		self.DATA.inputAssign[5] = '05'
		assert.equal(api._resolveInputToPhysical.call(self, '25'), '05')
	})

	test('returns rawId uppercased for physical source (no INPUT mapping)', () => {
		const self = makeInstance()
		assert.equal(api._resolveInputToPhysical.call(self, '05'), '05')
	})

	test('falls back to rawId when inputAssign slot is undefined', () => {
		const self = makeInstance()
		// inputAssign[5] stays undefined
		assert.equal(api._resolveInputToPhysical.call(self, '25'), '25')
	})

	test('falls back to rawId when inputAssign is not set at all', () => {
		const self = makeInstance()
		self.DATA.inputAssign = null
		assert.equal(api._resolveInputToPhysical.call(self, '25'), '25')
	})
})

// ── auxTally feedback with physical source resolution ────────────────────────

describe('auxTally feedback — physical source resolution', () => {
	test('direct HDMI source match still works without inputAssign', () => {
		const self = makeInstance({ aux1source: '05' })
		assert.equal(auxTally(self, 'aux1', '05'), true)
		assert.equal(auxTally(self, 'aux1', '04'), false)
	})

	test('INPUT6 (25) → HDMI6 (05): both INPUT6 and HDMI6 feedbacks are true', () => {
		const self = makeInstance({ aux1source: '25' })
		self.DATA.inputAssign[5] = '05' // INPUT 6 → HDMI 6
		assert.equal(auxTally(self, 'aux1', '25'), true, 'INPUT 6 direct match')
		assert.equal(auxTally(self, 'aux1', '05'), true, 'HDMI 6 via assignment')
	})

	test('changing INPUT6 assignment from HDMI6 to SDI1 updates effective feedback', () => {
		const self = makeInstance({ aux1source: '25' })
		self.DATA.inputAssign[5] = '05' // INPUT 6 → HDMI 6
		assert.equal(auxTally(self, 'aux1', '05'), true)

		self.DATA.inputAssign[5] = '08' // INPUT 6 → SDI 1
		assert.equal(auxTally(self, 'aux1', '05'), false, 'HDMI 6 no longer active')
		assert.equal(auxTally(self, 'aux1', '08'), true, 'SDI 1 now active')
	})

	test('unrelated HDMI feedbacks stay false when INPUT6→HDMI6', () => {
		const self = makeInstance({ aux1source: '25' })
		self.DATA.inputAssign[5] = '05' // INPUT 6 → HDMI 6
		assert.equal(auxTally(self, 'aux1', '04'), false, 'HDMI 5 must be false')
		assert.equal(auxTally(self, 'aux1', '06'), false, 'HDMI 7 must be false')
	})

	test('INPUT source feedback does not resolve through assignment (exact match only)', () => {
		const self = makeInstance({ aux1source: '05' }) // HDMI 6 directly
		self.DATA.inputAssign[5] = '05' // INPUT 6 also points to HDMI 6
		// Feedback for INPUT 6 (25) must NOT match when raw source is HDMI 6 (05)
		assert.equal(auxTally(self, 'aux1', '25'), false, 'INPUT 6 feedback must not match HDMI 6 raw source')
	})

	test('AUX2 and AUX3 channels resolve independently', () => {
		const self = makeInstance({ aux1source: '20', aux2source: '25', aux3source: '22' })
		self.DATA.inputAssign[0] = '00' // INPUT 1 → HDMI 1
		self.DATA.inputAssign[5] = '05' // INPUT 6 → HDMI 6
		self.DATA.inputAssign[2] = '0A' // INPUT 3 → SDI 3

		assert.equal(auxTally(self, 'aux1', '00'), true, 'AUX1: INPUT 1 via HDMI 1')
		assert.equal(auxTally(self, 'aux2', '05'), true, 'AUX2: INPUT 6 via HDMI 6')
		assert.equal(auxTally(self, 'aux3', '0A'), true, 'AUX3: INPUT 3 via SDI 3')
		assert.equal(auxTally(self, 'aux1', '05'), false, 'AUX1: HDMI 6 must be false')
	})
})

// ── getVideoAssign emits correct RQH commands ────────────────────────────────

describe('getVideoAssign RQH commands', () => {
	test('emits two RQH queries covering INPUT 1–10 and INPUT 11–20', () => {
		const cmds = []
		const self = { sendRawCommand: (cmd) => cmds.push(cmd) }
		api.getVideoAssign.call(self)
		assert.ok(cmds.some((c) => c.includes('RQH:000000,00000A')), 'INPUT 1–10 query')
		assert.ok(cmds.some((c) => c.includes('RQH:000024,00000A')), 'INPUT 11–20 query')
		assert.equal(cmds.length, 2)
	})
})

// ── Individual VIDEO ASSIGN DTH notifications ────────────────────────────────

describe('VIDEO ASSIGN individual DTH notifications', () => {
	test('INPUT 1 individual notification (000000, 1-byte)', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000000,03')
		assert.equal(self.DATA.inputAssign[0], '03')
	})

	test('INPUT 6 individual notification (000005)', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000005,07')
		assert.equal(self.DATA.inputAssign[5], '07')
	})

	test('INPUT 10 individual notification (000009)', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000009,0A')
		assert.equal(self.DATA.inputAssign[9], '0A')
	})

	test('INPUT 11 individual notification (000024)', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000024,05')
		assert.equal(self.DATA.inputAssign[10], '05')
	})

	test('INPUT 16 individual notification (000029)', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000029,0A')
		assert.equal(self.DATA.inputAssign[15], '0A')
	})

	test('INPUT 20 individual notification (00002D)', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:00002D,0F')
		assert.equal(self.DATA.inputAssign[19], '0F')
	})

	test('individual notifications do not disturb sibling slots', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000000,' + '05'.repeat(10)) // set all INPUT 1-10 → HDMI 6
		feedDTH(self, 'DTH:000005,07') // change INPUT 6 → HDMI 8
		assert.equal(self.DATA.inputAssign[5], '07', 'INPUT 6 updated')
		assert.equal(self.DATA.inputAssign[4], '05', 'INPUT 5 unchanged')
		assert.equal(self.DATA.inputAssign[6], '05', 'INPUT 7 unchanged')
	})

	test('malformed individual notification does not overwrite previous value', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000005,07')
		assert.equal(self.DATA.inputAssign[5], '07')
		feedDTH(self, 'DTH:000005,ZZ') // invalid hex
		assert.equal(self.DATA.inputAssign[5], '07', 'slot unchanged after malformed')
	})

	test('INPUT 11–20 individual notifications do not disturb INPUT 1–10', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		feedDTH(self, 'DTH:000000,' + '00'.repeat(10)) // INPUT 1-10 → HDMI 1
		feedDTH(self, 'DTH:000029,0A') // INPUT 16 → SDI 3
		assert.equal(self.DATA.inputAssign[0], '00', 'INPUT 1 unchanged')
		assert.equal(self.DATA.inputAssign[15], '0A', 'INPUT 16 updated')
	})
})

// ── Production parser path (extractMessages → updateData) ────────────────────

describe('VIDEO ASSIGN — production parser path', () => {
	test('10-byte block reaches inputAssign via extractMessages', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		const raw = 'DTH:000000,00010203040506070809;'
		const { messages } = extractMessages(raw)
		assert.equal(messages.length, 1)
		api.updateData.call(self, messages[0])
		assert.deepEqual(self.DATA.inputAssign.slice(0, 10), ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'])
	})

	test('individual DTH notification reaches inputAssign via extractMessages', () => {
		const self = { ...makeInstance(), sendRawCommand: () => {} }
		const raw = 'DTH:000005,07;'
		const { messages } = extractMessages(raw)
		assert.equal(messages.length, 1)
		api.updateData.call(self, messages[0])
		assert.equal(self.DATA.inputAssign[5], '07')
	})
})

// ── input_assign action — optimistic cache update ────────────────────────────

function makeActionInstance(dataOverrides) {
	const self = {
		config: { verbose: false },
		DATA: Object.assign({ inputAssign: new Array(20).fill(undefined) }, dataOverrides || {}),
		log: () => {},
		logVerbose: () => {},
		setVariableValues: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		TALLYDATA: constants.TALLYDATA.map((t) => Object.assign({}, t)),
		...Object.fromEntries(Object.entries(constants).filter(([k]) => k.startsWith('CHOICES_'))),
		CHOICES_OUTPUTSASSIGN: constants.CHOICES_OUTPUTSASSIGN || [{ id: '00', label: 'Placeholder' }],
		_parseHexBlock: api._parseHexBlock,
		_resolveInputToPhysical: api._resolveInputToPhysical,
		sendCommand: () => {},
		sendRawCommand: () => {},
	}

	let inputAssignCallback
	self.setFeedbackDefinitions = (defs) => {}
	self.setActionDefinitions = (defs) => {
		inputAssignCallback = defs.input_assign && defs.input_assign.callback
	}
	actionsDef.initActions.call(self)
	self._inputAssign = inputAssignCallback

	// Also capture auxTally
	let auxTallyCallback
	const feedSelf = Object.assign({}, self, {
		setFeedbackDefinitions: (defs) => { auxTallyCallback = defs.auxTally.callback },
	})
	feedbacksDef.initFeedbacks.call(feedSelf)
	// Share the DATA object so action changes are visible to feedback
	self._auxTally = (aux, assign) => auxTallyCallback.call(feedSelf, { options: { aux, assign } }, {})
	// Keep feedSelf DATA in sync
	Object.defineProperty(feedSelf, 'DATA', { get: () => self.DATA })

	return self
}

describe('input_assign action — optimistic cache update', () => {
	test('INPUT 6 assignment immediately updates DATA.inputAssign[5]', () => {
		const self = makeActionInstance()
		// options.input=5 (INPUT 6), options.assign=5 (HDMI 6 = id 5 in CHOICES_INPUTSASSIGN)
		self._inputAssign({ options: { input: 5, assign: 5 } }, {})
		assert.equal(self.DATA.inputAssign[5], '05')
	})

	test('optimistic update makes HDMI 6 AUX tally true when aux1=INPUT 6', () => {
		const self = makeActionInstance({ aux1source: '25' }) // AUX 1 = INPUT 6
		// Before: no assignment known
		assert.equal(self._auxTally('aux1', '05'), false, 'before: HDMI 6 false')
		// Assign INPUT 6 → HDMI 6
		self._inputAssign({ options: { input: 5, assign: 5 } }, {})
		assert.equal(self._auxTally('aux1', '05'), true, 'after: HDMI 6 true via optimistic update')
	})

	test('INPUT-targeted feedback stays exact/raw after action optimistic update', () => {
		const self = makeActionInstance({ aux1source: '05' }) // AUX 1 = HDMI 6 directly
		// Even if inputAssign maps INPUT 6 to HDMI 6, INPUT 6 feedback must NOT match HDMI 6 raw source
		self._inputAssign({ options: { input: 5, assign: 5 } }, {})
		assert.equal(self._auxTally('aux1', '25'), false, 'INPUT 6 feedback must not match HDMI 6 raw source')
		assert.equal(self._auxTally('aux1', '05'), true, 'HDMI 6 direct match still works')
	})

	test('subsequent hardware DTH overwrites optimistic cache', () => {
		const self = makeActionInstance({ aux1source: '25' })
		// Optimistic: INPUT 6 → HDMI 6
		self._inputAssign({ options: { input: 5, assign: 5 } }, {})
		assert.equal(self.DATA.inputAssign[5], '05')
		assert.equal(self._auxTally('aux1', '05'), true)

		// Hardware confirms different value (e.g. SDI 1 = 08)
		api.updateData.call(self, 'DTH:000005,08;')
		assert.equal(self.DATA.inputAssign[5], '08', 'cache updated by hardware DTH')
		assert.equal(self._auxTally('aux1', '05'), false, 'HDMI 6 now false')
		assert.equal(self._auxTally('aux1', '08'), true, 'SDI 1 now true')
	})
})
