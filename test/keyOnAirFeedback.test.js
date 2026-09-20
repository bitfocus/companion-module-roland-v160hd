'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const BASE_STUB = {
	InstanceStatus: { Ok: 'ok', Connecting: 'connecting', Disconnected: 'disconnected', Error: 'error' },
	TCPHelper: class {},
	combineRgb: () => 0,
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

const feedbacksModule = require('../src/feedbacks')

function makeSelf(dataOverrides) {
	const self = {
		config: { verbose: false },
		DATA: Object.assign({}, dataOverrides),
		log: () => {},
		logVerbose: () => {},
		TALLYDATA: [{ id: '01', label: 'Input 1' }],
		CHOICES_PGMPVW_SELECT: [{ id: '00', label: 'PGM' }],
		CHOICES_OUTPUTS: [{ id: '00000A', label: 'HDMI 1' }],
		CHOICES_OUTPUTSASSIGN: [{ id: '01', label: 'PGM' }],
		CHOICES_PNPKEY_SOURCES: [{ id: '00', label: 'Off' }],
		_capturedFeedbacks: null,
		setFeedbackDefinitions(fb) {
			this._capturedFeedbacks = fb
		},
	}
	feedbacksModule.initFeedbacks.call(self)
	return self
}

function checkKeyOnAir(data, pinp, bus, onoff) {
	const self = makeSelf(data)
	const fb = self._capturedFeedbacks.keyOnAir
	return fb.callback({ options: { pinp, bus, onoff } }, {})
}

// ── keyOnAir feedback ────────────────────────────────────────────────────────

describe('keyOnAir feedback — does not throw on plain object DATA', () => {
	test('callback does not throw when DATA is a plain object (no .find method)', () => {
		assert.doesNotThrow(() => checkKeyOnAir({}, '1B', '00', '01'))
	})
})

describe('keyOnAir feedback — PiP/Key 1', () => {
	test('PGM On: data_1B00 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1B00: '01' }, '1B', '00', '01'), true)
	})

	test('PGM Off: data_1B00 == 00 returns true when onoff is 00', () => {
		assert.equal(checkKeyOnAir({ data_1B00: '00' }, '1B', '00', '00'), true)
	})

	test('PGM: non-matching onoff returns false', () => {
		assert.equal(checkKeyOnAir({ data_1B00: '00' }, '1B', '00', '01'), false)
	})

	test('PGM: missing DATA key returns false', () => {
		assert.equal(checkKeyOnAir({}, '1B', '00', '01'), false)
	})

	test('PVW On: data_1B01 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1B01: '01' }, '1B', '01', '01'), true)
	})

	test('PVW Off: data_1B01 == 00 returns true when onoff is 00', () => {
		assert.equal(checkKeyOnAir({ data_1B01: '00' }, '1B', '01', '00'), true)
	})

	test('PVW: non-matching onoff returns false', () => {
		assert.equal(checkKeyOnAir({ data_1B01: '01' }, '1B', '01', '00'), false)
	})

	test('PVW: missing DATA key returns false', () => {
		assert.equal(checkKeyOnAir({}, '1B', '01', '01'), false)
	})
})

describe('keyOnAir feedback — PiP/Key 2', () => {
	test('PGM On: data_1C00 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1C00: '01' }, '1C', '00', '01'), true)
	})

	test('PGM: non-matching returns false', () => {
		assert.equal(checkKeyOnAir({ data_1C00: '00' }, '1C', '00', '01'), false)
	})

	test('PVW On: data_1C01 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1C01: '01' }, '1C', '01', '01'), true)
	})

	test('PVW: non-matching returns false', () => {
		assert.equal(checkKeyOnAir({ data_1C01: '00' }, '1C', '01', '01'), false)
	})
})

describe('keyOnAir feedback — PiP/Key 3', () => {
	test('PGM On: data_1D00 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1D00: '01' }, '1D', '00', '01'), true)
	})

	test('PGM: missing DATA key returns false', () => {
		assert.equal(checkKeyOnAir({}, '1D', '00', '01'), false)
	})

	test('PVW On: data_1D01 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1D01: '01' }, '1D', '01', '01'), true)
	})
})

describe('keyOnAir feedback — PiP/Key 4', () => {
	test('PGM On: data_1E00 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1E00: '01' }, '1E', '00', '01'), true)
	})

	test('PGM: non-matching returns false', () => {
		assert.equal(checkKeyOnAir({ data_1E00: '00' }, '1E', '00', '01'), false)
	})

	test('PVW On: data_1E01 == 01 returns true', () => {
		assert.equal(checkKeyOnAir({ data_1E01: '01' }, '1E', '01', '01'), true)
	})

	test('PVW: missing DATA key returns false', () => {
		assert.equal(checkKeyOnAir({}, '1E', '01', '01'), false)
	})
})

describe('keyOnAir feedback — cross-slot isolation', () => {
	test('Key 1 PGM data does not affect Key 2 PGM check', () => {
		assert.equal(checkKeyOnAir({ data_1B00: '01' }, '1C', '00', '01'), false)
	})

	test('PGM data does not affect PVW check for same key', () => {
		assert.equal(checkKeyOnAir({ data_1B00: '01' }, '1B', '01', '01'), false)
	})
})
