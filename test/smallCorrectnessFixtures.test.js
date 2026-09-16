'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

// ── Module stubs ─────────────────────────────────────────────────────────────

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
const variables = require('../src/variables')
const feedbacks = require('../src/feedbacks')
const actions = require('../src/actions')
const constants = require('../src/constants')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActionsSelf() {
	const sent = []
	const self = Object.assign(Object.create(actions), Object.assign({}, constants), {
		DATA: {},
		config: {},
		sendCommand: (addr, val) => sent.push({ addr, val }),
		sendRawCommand: () => {},
		log: () => {},
	})
	let actionsDefs = null
	self.setActionDefinitions = (a) => {
		actionsDefs = a
	}
	self.initActions()
	return { self, sent, get actions() { return actionsDefs } }
}

function makeFeedbacksSelf() {
	let defs = null
	const self = Object.assign(Object.create(feedbacks), Object.assign({}, constants), {
		DATA: {},
		setFeedbackDefinitions: (f) => { defs = f },
	})
	self.initFeedbacks()
	return defs
}

// ── sendRawCommand — terminator guard ────────────────────────────────────────

describe('sendRawCommand — terminator guard', () => {
	function makeApiSelf() {
		const sent = []
		const self = Object.assign(Object.create(api), {
			config: { verbose: false },
			socket: { isConnected: true, send: (cmd) => sent.push(cmd) },
			log: () => {},
		})
		return { self, sent }
	}

	test('command without semicolon gets one appended', () => {
		const { self, sent } = makeApiSelf()
		self.sendRawCommand('VER')
		assert.equal(sent.length, 1)
		assert.equal(sent[0], 'VER;\n')
	})

	test('command that already has semicolon is sent unchanged', () => {
		const { self, sent } = makeApiSelf()
		self.sendRawCommand('RQH:000011,000001;')
		assert.equal(sent.length, 1)
		assert.equal(sent[0], 'RQH:000011,000001;\n')
	})

	test('DTH command with semicolon does not get a double semicolon', () => {
		const { self, sent } = makeApiSelf()
		self.sendRawCommand('DTH:000011,05;')
		assert.ok(!sent[0].includes(';;'), `double semicolon in: ${JSON.stringify(sent[0])}`)
	})
})

// ── variables.js — freeze variableId ─────────────────────────────────────────

describe('variables — freeze variableId', () => {
	test('freeze variable is registered with variableId, not variableI', () => {
		const registered = []
		const self = Object.assign(Object.create(variables), Object.assign({}, constants), {
			setVariableDefinitions: (vars) => registered.push(...vars),
		})
		self.initVariables()
		const freezeVar = registered.find((v) => v.name === 'Freeze On/Off')
		assert.ok(freezeVar, 'Freeze On/Off variable not registered at all')
		assert.equal(freezeVar.variableId, 'freeze')
		assert.ok(!('variableI' in freezeVar), 'variableI typo key must not exist')
	})
})

// ── feedbacks.js — aux feedback defaults ─────────────────────────────────────

describe('feedbacks — auxTally default is valid choice id', () => {
	test("auxTally aux option default is 'aux1'", () => {
		const defs = makeFeedbacksSelf()
		const opt = defs.auxTally.options.find((o) => o.id === 'aux')
		assert.equal(opt.default, 'aux1')
	})
})

describe('feedbacks — auxMute default is valid choice id', () => {
	test("auxMute aux option default is 'aux1'", () => {
		const defs = makeFeedbacksSelf()
		const opt = defs.auxMute.options.find((o) => o.id === 'aux')
		assert.equal(opt.default, 'aux1')
	})
})

describe('feedbacks — auxLink default is valid choice id', () => {
	test("auxLink aux option default is 'aux1'", () => {
		const defs = makeFeedbacksSelf()
		const opt = defs.auxLink.options.find((o) => o.id === 'aux')
		assert.equal(opt.default, 'aux1')
	})
})

// ── feedbacks.js — pnpKeySource default ──────────────────────────────────────

describe('feedbacks — pnpKeySource default is valid choice id', () => {
	test("pnpKeySource pinp option default is 'pnpkey1'", () => {
		const defs = makeFeedbacksSelf()
		const opt = defs.pnpKeySource.options.find((o) => o.id === 'pinp')
		assert.equal(opt.default, 'pnpkey1')
	})
})

// ── actions.js — set_wipe_direction uses options.direction ────────────────────

describe('actions — set_wipe_direction sends options.direction', () => {
	test('direction value 0 sends "00"', () => {
		const { sent, actions } = makeActionsSelf()
		actions.set_wipe_direction.callback({ options: { direction: 0 } }, {})
		assert.equal(sent.length, 1)
		assert.equal(sent[0].val, '00')
	})

	test('direction value 1 sends "01"', () => {
		const { sent, actions } = makeActionsSelf()
		actions.set_wipe_direction.callback({ options: { direction: 1 } }, {})
		assert.equal(sent.length, 1)
		assert.equal(sent[0].val, '01')
	})

	test('direction value 15 sends "0F"', () => {
		const { sent, actions } = makeActionsSelf()
		actions.set_wipe_direction.callback({ options: { direction: 15 } }, {})
		assert.equal(sent[0].val, '0F')
	})
})

// ── actions.js — selectedCamera fallback is '41' ──────────────────────────────

describe('actions — selectedCamera fallback is CHOICES_CAMERAS[0].id (41)', () => {
	test('selectedCamera undefined → falls back to 41', () => {
		const { self, actions } = makeActionsSelf()
		self.selectedCamera = undefined
		actions.cameraCurrentPreset.callback({ options: { useSelected: true, preset: 1 } }, {})
		assert.equal(self.selectedCamera, '41')
	})

	test('selectedCamera set explicitly → not overwritten', () => {
		const { self, actions } = makeActionsSelf()
		self.selectedCamera = '42'
		actions.cameraCurrentPreset.callback({ options: { useSelected: true, preset: 1 } }, {})
		assert.equal(self.selectedCamera, '42')
	})

	test('fallback matches CHOICES_CAMERAS first entry id', () => {
		const { self, actions } = makeActionsSelf()
		self.selectedCamera = undefined
		actions.cameraCurrentPreset.callback({ options: { useSelected: true, preset: 1 } }, {})
		assert.equal(self.selectedCamera, constants.CHOICES_CAMERAS[0].id)
	})
})
