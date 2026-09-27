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
const constants = require('../src/constants')

// Build a minimal self suitable for calling initFeedbacks. Uses the REAL
// CHOICES_OUTPUTS/CHOICES_OUTPUTSASSIGN from src/constants.js (not a
// hand-picked fake list) so tests that read an id from this list — e.g. the
// USB alias tests below — exercise the actual dropdown a user would see.
function makeSelf(dataOverrides) {
	const self = Object.assign(
		{
			config: { verbose: false },
			DATA: Object.assign({}, dataOverrides),
			log: () => {},
			logVerbose: () => {},
			TALLYDATA: [{ id: '01', label: 'Input 1' }],
			CHOICES_PGMPVW_SELECT: [{ id: '00', label: 'PGM' }],
			CHOICES_PNPKEY_SOURCES: [{ id: '00', label: 'Off' }],
			_capturedFeedbacks: null,
			setFeedbackDefinitions(fb) {
				this._capturedFeedbacks = fb
			},
		},
		{ CHOICES_OUTPUTS: constants.CHOICES_OUTPUTS, CHOICES_OUTPUTSASSIGN: constants.CHOICES_OUTPUTSASSIGN },
	)
	feedbacksModule.initFeedbacks.call(self)
	return self
}

// Invoke the outputAssign feedback callback with specific DATA and options.
function checkOutputAssign(data, output, assign) {
	const self = makeSelf(data)
	const fb = self._capturedFeedbacks.outputAssign
	return fb.callback({ options: { output, assign } }, {})
}

// ── outputAssign feedback ────────────────────────────────────────────────────

describe('outputAssign feedback — HDMI outputs', () => {
	test('HDMI 1 returns true when hdmi1assign matches', () => {
		assert.equal(checkOutputAssign({ hdmi1assign: '01' }, '00000A', '01'), true)
	})

	test('HDMI 1 returns false when hdmi1assign does not match', () => {
		assert.equal(checkOutputAssign({ hdmi1assign: '02' }, '00000A', '01'), false)
	})

	test('HDMI 1 returns false when hdmi1assign is undefined', () => {
		assert.equal(checkOutputAssign({}, '00000A', '01'), false)
	})

	test('HDMI 2 returns true when hdmi2assign matches', () => {
		assert.equal(checkOutputAssign({ hdmi2assign: '03' }, '00000B', '03'), true)
	})

	test('HDMI 2 returns false when hdmi2assign does not match', () => {
		assert.equal(checkOutputAssign({ hdmi2assign: '01' }, '00000B', '03'), false)
	})

	test('HDMI 3 returns true when hdmi3assign matches', () => {
		assert.equal(checkOutputAssign({ hdmi3assign: '02' }, '00000C', '02'), true)
	})

	test('HDMI 3 returns false when hdmi3assign does not match', () => {
		assert.equal(checkOutputAssign({ hdmi3assign: '04' }, '00000C', '02'), false)
	})
})

describe('outputAssign feedback — SDI outputs', () => {
	test('SDI 1 returns true when sdi1assign matches', () => {
		assert.equal(checkOutputAssign({ sdi1assign: '01' }, '00000D', '01'), true)
	})

	test('SDI 1 returns false when sdi1assign does not match', () => {
		assert.equal(checkOutputAssign({ sdi1assign: '02' }, '00000D', '01'), false)
	})

	test('SDI 1 returns false when sdi1assign is undefined', () => {
		assert.equal(checkOutputAssign({}, '00000D', '01'), false)
	})

	test('SDI 2 returns true when sdi2assign matches', () => {
		assert.equal(checkOutputAssign({ sdi2assign: '05' }, '00000E', '05'), true)
	})

	test('SDI 2 returns false when sdi2assign does not match', () => {
		assert.equal(checkOutputAssign({ sdi2assign: '01' }, '00000E', '05'), false)
	})

	test('SDI 3 returns true when sdi3assign matches', () => {
		assert.equal(checkOutputAssign({ sdi3assign: '03' }, '00000F', '03'), true)
	})

	test('SDI 3 returns false when sdi3assign does not match', () => {
		assert.equal(checkOutputAssign({ sdi3assign: '01' }, '00000F', '03'), false)
	})
})

describe('outputAssign feedback — USB output', () => {
	// The dropdown a user actually sees comes from CHOICES_OUTPUTS in
	// src/constants.js, whose USB entry's id is '000110' — NOT '000010'.
	// Before the alias fix, selecting USB from the real dropdown and
	// matching options.assign against actual DATA.usbassign always
	// returned false, regardless of device state.
	const realUsbId = constants.CHOICES_OUTPUTS.find((o) => o.label.toLowerCase().includes('usb')).id

	test('the real CHOICES_OUTPUTS dropdown id for USB is "000110"', () => {
		assert.equal(realUsbId, '000110')
	})

	test('USB returns true when usbassign matches, using the REAL dropdown id', () => {
		assert.equal(checkOutputAssign({ usbassign: '04' }, realUsbId, '04'), true)
	})

	test('USB returns false when usbassign does not match, using the REAL dropdown id', () => {
		assert.equal(checkOutputAssign({ usbassign: '01' }, realUsbId, '04'), false)
	})

	test('USB returns false when usbassign is undefined, using the REAL dropdown id', () => {
		assert.equal(checkOutputAssign({}, realUsbId, '04'), false)
	})

	test('the pre-existing "000010" value keeps working as a compatibility alias', () => {
		assert.equal(checkOutputAssign({ usbassign: '04' }, '000010', '04'), true)
	})

	test('"000010" and the real dropdown id "000110" agree for the same DATA state', () => {
		const data = { usbassign: '07' }
		assert.equal(checkOutputAssign(data, '000010', '07'), checkOutputAssign(data, realUsbId, '07'))
	})

	test('USB returns false when usbassign does not match, legacy "000010" alias', () => {
		assert.equal(checkOutputAssign({ usbassign: '01' }, '000010', '04'), false)
	})

	test('USB returns false when usbassign is undefined, legacy "000010" alias', () => {
		assert.equal(checkOutputAssign({}, '000010', '04'), false)
	})

	test('the USB alias fix does not change CHOICES_OUTPUTS itself (shared with the output_assign action)', () => {
		assert.equal(constants.CHOICES_OUTPUTS.find((o) => o.label.toLowerCase().includes('usb')).id, '000110')
		assert.equal(constants.CHOICES_OUTPUTS.length, 7, 'no entries added or removed')
	})
})

describe('outputAssign feedback — wrong output code returns false', () => {
	test('unknown output code returns false even when assign matches some field', () => {
		assert.equal(checkOutputAssign({ hdmi1assign: '01' }, 'FFFFFF', '01'), false)
	})
})

// ── real parser response → DATA → outputAssign feedback, all 7 outputs ──────
// Drives a real DTH:00000A,...; 7-byte block response through the real
// updateData()/_parseHexBlock() parser (not hand-fed DATA), then checks the
// real outputAssign feedback for every output using the real CHOICES_OUTPUTS/
// CHOICES_OUTPUTSASSIGN choice lists.

describe('outputAssign feedback — full parser-to-feedback path, all 7 outputs', () => {
	const api = require('../src/api')

	// hdmi1=Program(00), hdmi2=Sub Program(01), hdmi3=Preview(02),
	// sdi1=Aux 1(03), sdi2=Aux 2(04), sdi3=Aux 3(05), usb=DSK 1 Source(06) —
	// all real CHOICES_OUTPUTSASSIGN ids, one 7-byte block DTH response.
	const OUTPUTS = [
		{ output: '00000A', field: 'hdmi1assign', assign: '00', label: 'HDMI 1' },
		{ output: '00000B', field: 'hdmi2assign', assign: '01', label: 'HDMI 2' },
		{ output: '00000C', field: 'hdmi3assign', assign: '02', label: 'HDMI 3' },
		{ output: '00000D', field: 'sdi1assign', assign: '03', label: 'SDI 1' },
		{ output: '00000E', field: 'sdi2assign', assign: '04', label: 'SDI 2' },
		{ output: '00000F', field: 'sdi3assign', assign: '05', label: 'SDI 3' },
		{
			output: constants.CHOICES_OUTPUTS.find((o) => o.label.toLowerCase().includes('usb')).id,
			field: 'usbassign',
			assign: '06',
			label: 'USB (real dropdown id)',
		},
	]

	function runRealBlockResponse() {
		const self = makeSelf({})
		Object.assign(self, api) // add the real updateData/_parseHexBlock onto the same self
		self.config = { verbose: false }
		self.log = () => {}
		self.logVerbose = () => {}
		// 7 bytes, one hex pair per output, in DATA-parser order:
		// hdmi1, hdmi2, hdmi3, sdi1, sdi2, sdi3, usb.
		self.updateData('DTH:00000A,00010203040506;')
		return self
	}

	test('one real 7-byte block response sets all seven DATA.*assign fields', () => {
		const self = runRealBlockResponse()
		assert.equal(self.DATA.hdmi1assign, '00')
		assert.equal(self.DATA.hdmi2assign, '01')
		assert.equal(self.DATA.hdmi3assign, '02')
		assert.equal(self.DATA.sdi1assign, '03')
		assert.equal(self.DATA.sdi2assign, '04')
		assert.equal(self.DATA.sdi3assign, '05')
		assert.equal(self.DATA.usbassign, '06')
	})

	for (const { output, field, assign, label } of OUTPUTS) {
		test(`${label}: real parser response → outputAssign feedback returns true for the matching assign`, () => {
			const self = runRealBlockResponse()
			const fb = self._capturedFeedbacks.outputAssign
			assert.equal(fb.callback({ options: { output, assign } }, {}), true)
		})

		test(`${label}: real parser response → outputAssign feedback returns false for a non-matching assign`, () => {
			const self = runRealBlockResponse()
			const fb = self._capturedFeedbacks.outputAssign
			const wrongAssign = assign === '00' ? '01' : '00'
			assert.equal(fb.callback({ options: { output, assign: wrongAssign } }, {}), false)
		})
	}

	test('the legacy "000010" USB alias also matches the real parsed value', () => {
		const self = runRealBlockResponse()
		const fb = self._capturedFeedbacks.outputAssign
		assert.equal(fb.callback({ options: { output: '000010', assign: '06' } }, {}), true)
	})
})
