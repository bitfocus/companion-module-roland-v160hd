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
const { extractMessages } = require('../src/tcpParser')

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
	return {
		self,
		sent,
		get actions() {
			return actionsDefs
		},
	}
}

function makeFeedbacksSelf() {
	let defs = null
	const self = Object.assign(Object.create(feedbacks), Object.assign({}, constants), {
		DATA: {},
		setFeedbackDefinitions: (f) => {
			defs = f
		},
	})
	self.initFeedbacks()
	return defs
}

// ── sendRawCommand — terminator guard ────────────────────────────────────────

describe('sendRawCommand — terminator guard', () => {
	function makeApiSelf() {
		const enqueued = []
		const self = Object.assign(Object.create(api), {
			config: { verbose: false },
			log: () => {},
			_queue: { enqueue: (cmd) => enqueued.push(cmd) },
		})
		return { self, enqueued }
	}

	test('command without semicolon gets one appended', () => {
		const { self, enqueued } = makeApiSelf()
		self.sendRawCommand('VER')
		assert.equal(enqueued.length, 1)
		assert.equal(enqueued[0], 'VER;\n')
	})

	test('command that already has semicolon is sent unchanged', () => {
		const { self, enqueued } = makeApiSelf()
		self.sendRawCommand('RQH:000011,000001;')
		assert.equal(enqueued.length, 1)
		assert.equal(enqueued[0], 'RQH:000011,000001;\n')
	})

	test('DTH command with semicolon does not get a double semicolon', () => {
		const { self, enqueued } = makeApiSelf()
		self.sendRawCommand('DTH:000011,05;')
		assert.ok(!enqueued[0].includes(';;'), `double semicolon in: ${JSON.stringify(enqueued[0])}`)
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

// ── freeze — real extractMessages → updateData → checkVariables → ────────────
// ── setVariableValues pipeline (not hand-fed DATA) ───────────────────────────

describe('freeze — real device-response pipeline updates the registered variable', () => {
	function makeFreezePipelineSelf() {
		const setValuesCalls = []
		// api provides updateData; variables provides the REAL checkVariables
		// (not stubbed — that is the function under test). checkFeedbacks is
		// stubbed because feedbacks are not what this test is checking.
		const self = Object.assign(Object.create(api), Object.assign({}, variables), Object.assign({}, constants), {
			config: { verbose: false },
			DATA: {},
			tcpBuffer: '',
			log: () => {},
			logVerbose: () => {},
			checkFeedbacks: () => {},
			setVariableValues: (obj) => setValuesCalls.push(obj),
		})
		return { self, setValuesCalls }
	}

	// Drives the exact same chain the real socket 'data' handler uses:
	// extractMessages(buffer) -> updateData(msg) per message.
	function feedRawDeviceData(self, rawBuffer) {
		const { messages, remaining } = extractMessages(rawBuffer)
		assert.equal(remaining, '', 'test fixture must send only complete messages')
		for (const msg of messages) self.updateData(msg)
	}

	test('DTH:020500,01; (Freeze On) — real pipeline sets the registered "freeze" variable to "On"', () => {
		const { self, setValuesCalls } = makeFreezePipelineSelf()
		feedRawDeviceData(self, 'DTH:020500,01;')
		assert.equal(self.DATA.freeze, '01', 'parser must have written DATA.freeze from the real DTH response')
		assert.ok(setValuesCalls.length >= 1, 'checkVariables must call the real setVariableValues')
		const last = setValuesCalls[setValuesCalls.length - 1]
		assert.equal(last.freeze, 'On')
	})

	test('DTH:020500,00; (Freeze Off) — real pipeline sets the registered "freeze" variable to "Off"', () => {
		const { self, setValuesCalls } = makeFreezePipelineSelf()
		feedRawDeviceData(self, 'DTH:020500,00;')
		assert.equal(self.DATA.freeze, '00')
		const last = setValuesCalls[setValuesCalls.length - 1]
		assert.equal(last.freeze, 'Off')
	})

	test('On then Off in separate messages — the variable tracks the latest real response', () => {
		const { self, setValuesCalls } = makeFreezePipelineSelf()
		feedRawDeviceData(self, 'DTH:020500,01;')
		feedRawDeviceData(self, 'DTH:020500,00;')
		const last = setValuesCalls[setValuesCalls.length - 1]
		assert.equal(last.freeze, 'Off')
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
	// Real CHOICES_WIPE_DIRECTIONS values only (0, 1, 2) — 15 was never a
	// menu choice and doesn't exercise anything the real dropdown can send.
	test('CHOICES_WIPE_DIRECTIONS only contains 0, 1, 2', () => {
		assert.deepEqual(
			constants.CHOICES_WIPE_DIRECTIONS.map((c) => c.id),
			[0, 1, 2],
		)
	})

	for (const direction of [0, 1, 2]) {
		test(`direction ${direction}: address is "001803" and value is "${direction.toString(16).padStart(2, '0').toUpperCase()}"`, () => {
			const { sent, actions } = makeActionsSelf()
			actions.set_wipe_direction.callback({ options: { direction } }, {})
			assert.equal(sent.length, 1)
			assert.equal(sent[0].addr, '001803', 'must write to the wipe-direction register, not a neighboring one')
			assert.equal(sent[0].val, direction.toString(16).padStart(2, '0').toUpperCase())
		})
	}
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

// ── actions.js — all 18 camera actions send the camera id in the address ─────
//
// Every one of these callbacks computes its Roland address as
// `02${options.camera}<suffix>` and sends it via a single self.sendCommand
// call — confirmed by reading each definition directly. Driving each real
// action through both the "use selected, none chosen yet" path (must fall
// back to CHOICES_CAMERAS[0].id = '41', not the old invalid '01') and the
// "explicit camera" path (must use exactly that camera, ignoring the
// fallback) catches a regression in either the fallback value itself or in
// any individual action's own address computation.

const CAMERA_ACTION_NAMES = [
	'cameraCurrentPreset',
	'cameraPanLeft',
	'cameraPanRight',
	'cameraPanStop',
	'cameraTiltUp',
	'cameraTiltDown',
	'cameraTiltStop',
	'cameraPTSpeed',
	'cameraZoomInFast',
	'cameraZoomInSlow',
	'cameraZoomOutFast',
	'cameraZoomOutSlow',
	'cameraZoomStop',
	'focus',
	'autoFocusOn',
	'autoFocusOff',
	'cameraExposure',
	'cameraSetTallyChannel',
]

// Options each action needs beyond useSelected/camera, so every callback
// runs to completion and reaches its own self.sendCommand call.
const EXTRA_OPTIONS = {
	cameraCurrentPreset: { preset: '00' },
	cameraPTSpeed: { speed: 10 },
	focus: { focus: '7F' },
	cameraExposure: { exposure: '00' },
	cameraSetTallyChannel: { channel: '00' },
}

describe('actions — all 18 camera actions embed the real camera id in the sent address', () => {
	test('exactly 18 actions use the useSelected/camera fallback pattern', () => {
		assert.equal(CAMERA_ACTION_NAMES.length, 18)
	})

	for (const name of CAMERA_ACTION_NAMES) {
		test(`${name}: useSelected with no prior selection sends address containing "41", not "01"`, () => {
			const { self, sent, actions } = makeActionsSelf()
			self.selectedCamera = undefined
			actions[name].callback({ options: Object.assign({ useSelected: true }, EXTRA_OPTIONS[name]) }, {})
			assert.equal(sent.length, 1, `${name} must send exactly one command`)
			assert.equal(
				sent[0].addr.slice(2, 4),
				'41',
				`${name} sent address ${sent[0].addr}, expected camera id "41" at position 2-4`,
			)
		})

		test(`${name}: explicit camera selection sends that exact camera id, unaffected by the fallback`, () => {
			const { self, sent, actions } = makeActionsSelf()
			self.selectedCamera = undefined
			actions[name].callback({ options: Object.assign({ useSelected: false, camera: '45' }, EXTRA_OPTIONS[name]) }, {})
			assert.equal(sent.length, 1, `${name} must send exactly one command`)
			assert.equal(
				sent[0].addr.slice(2, 4),
				'45',
				`${name} sent address ${sent[0].addr}, expected the explicitly chosen camera "45"`,
			)
		})
	}
})

// ── index.js — selectedCamera initialization (runtime) ───────────────────────

describe('index.js — selectedCamera initial value', () => {
	test('constructor initializes selectedCamera to "41" (Camera 1 Roland protocol address)', () => {
		const Module = require('module')
		const FAKE_KEY = '__test_companion_base_idx__'
		let capturedClass = null

		require.cache[FAKE_KEY] = {
			id: FAKE_KEY,
			filename: FAKE_KEY,
			loaded: true,
			exports: {
				InstanceBase: class InstanceBase {
					constructor() {}
				},
				InstanceStatus: { Ok: 'ok', Connecting: 'connecting', Disconnected: 'disconnected', Error: 'error' },
				TCPHelper: class {},
				combineRgb: () => 0,
				Regex: { IP: null },
				runEntrypoint: (cls) => {
					capturedClass = cls
				},
			},
		}

		const origResolve = Module._resolveFilename.bind(Module)
		Module._resolveFilename = function (request, ...rest) {
			if (request === '@companion-module/base') return FAKE_KEY
			return origResolve(request, ...rest)
		}

		const indexPath = require.resolve('../index.js')
		delete require.cache[indexPath]

		try {
			require('../index.js')
		} finally {
			Module._resolveFilename = origResolve
			delete require.cache[FAKE_KEY]
			delete require.cache[indexPath]
		}

		assert.ok(capturedClass !== null, 'runEntrypoint must be called with the module class')
		const instance = new capturedClass({})
		assert.equal(instance.selectedCamera, '41', 'selectedCamera must initialize to "41"')
		assert.equal(
			instance.selectedCamera,
			constants.CHOICES_CAMERAS[0].id,
			'selectedCamera must match CHOICES_CAMERAS[0].id',
		)
	})
})
