'use strict'

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

function makeSelf() {
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
	}
}

// Record which RQH commands a polling function emits.
function captureRQH(fn) {
	const cmds = []
	const self = { ...makeSelf(), sendRawCommand: (cmd) => cmds.push(cmd) }
	fn.call(self)
	return cmds
}

// Feed a single DTH message to updateData and return the resulting DATA object.
function feedDTH(dth) {
	const self = makeSelf()
	api.updateData.call(self, dth + ';')
	return self.DATA
}

// ── _parseHexBlock ───────────────────────────────────────────────────────────

describe('_parseHexBlock', () => {
	test('returns null for wrong length', () => {
		assert.equal(api._parseHexBlock('AB', 2), null)
	})

	test('returns null for non-hex characters', () => {
		assert.equal(api._parseHexBlock('ABCDGH', 3), null)
	})

	test('returns null for empty string when bytes > 0', () => {
		assert.equal(api._parseHexBlock('', 1), null)
	})

	test('returns uppercased byte array for valid 2-byte block', () => {
		assert.deepEqual(api._parseHexBlock('0102', 2), ['01', '02'])
	})

	test('returns uppercased byte array for valid 6-byte block', () => {
		assert.deepEqual(api._parseHexBlock('0a0b0c0d0e0f', 6), ['0A', '0B', '0C', '0D', '0E', '0F'])
	})

	test('returns single-element array for valid 1-byte block', () => {
		assert.deepEqual(api._parseHexBlock('FF', 1), ['FF'])
	})
})

// ── Polling query counts ─────────────────────────────────────────────────────

describe('getPinpKeyTally emits 4 queries', () => {
	test('four 2-byte PGM+PVW tally queries', () => {
		const cmds = captureRQH(api.getPinpKeyTally)
		assert.equal(cmds.length, 4)
		assert.ok(cmds.includes('RQH:001B00,000002;'))
		assert.ok(cmds.includes('RQH:001C00,000002;'))
		assert.ok(cmds.includes('RQH:001D00,000002;'))
		assert.ok(cmds.includes('RQH:001E00,000002;'))
	})
})

describe('getPinpKeySource emits 4 queries', () => {
	test('four 1-byte source queries', () => {
		const cmds = captureRQH(api.getPinpKeySource)
		assert.equal(cmds.length, 4)
		assert.ok(cmds.includes('RQH:001B02,000001;'))
		assert.ok(cmds.includes('RQH:001C02,000001;'))
		assert.ok(cmds.includes('RQH:001D02,000001;'))
		assert.ok(cmds.includes('RQH:001E02,000001;'))
	})
})

describe('getAuxSources emits 3 queries', () => {
	test('pgm+pvw combined, aux1 separate, aux2+3 combined', () => {
		const cmds = captureRQH(api.getAuxSources)
		assert.equal(cmds.length, 3)
		assert.ok(cmds.includes('RQH:002100,000002;'))
		assert.ok(cmds.includes('RQH:000011,000001;'))
		assert.ok(cmds.includes('RQH:00002E,000002;'))
	})
})

describe('getAuxMutes emits 3 queries', () => {
	test('aux 1, 2, 3 mute queries', () => {
		const cmds = captureRQH(api.getAuxMutes)
		assert.equal(cmds.length, 3)
		assert.ok(cmds.includes('RQH:012203,000001;'))
		assert.ok(cmds.includes('RQH:012503,000001;'))
		assert.ok(cmds.includes('RQH:012603,000001;'))
	})
})

describe('getOutputData emits 1 query', () => {
	test('hdmi1-3+sdi1-3+usb combined in one 7-byte block', () => {
		const cmds = captureRQH(api.getOutputData)
		assert.equal(cmds.length, 1)
		assert.ok(cmds.includes('RQH:00000A,000007;'))
	})
})

describe('getAuxLinkData emits 2 queries', () => {
	test('aux link mode separate, aux1-3 link combined', () => {
		const cmds = captureRQH(api.getAuxLinkData)
		assert.equal(cmds.length, 2)
		assert.ok(cmds.includes('RQH:02010D,000001;'))
		assert.ok(cmds.includes('RQH:020154,000003;'))
	})
})

// ── DTH: Aux 2+3 source ──────────────────────────────────────────────────────

describe('DTH aux 2+3 source', () => {
	test('2-byte block splits into aux2source and aux3source', () => {
		const data = feedDTH('DTH:00002E,0203')
		assert.equal(data.aux2source, '02')
		assert.equal(data.aux3source, '03')
	})

	test('single-byte response sets only aux2source', () => {
		const data = feedDTH('DTH:00002E,05')
		assert.equal(data.aux2source, '05')
		assert.equal(data.aux3source, undefined)
	})

	test('single-byte aux3 notification (2F) still sets aux3source', () => {
		const data = feedDTH('DTH:00002F,07')
		assert.equal(data.aux3source, '07')
	})

	test('wrong-length value is not stored', () => {
		const data = feedDTH('DTH:00002E,ABC')
		assert.equal(data.aux2source, undefined)
		assert.equal(data.aux3source, undefined)
	})

	test('non-hex single-byte value is not stored', () => {
		const data = feedDTH('DTH:00002E,GG')
		assert.equal(data.aux2source, undefined)
	})
})

// ── DTH: PiP/Key PGM+PVW ────────────────────────────────────────────────────

describe('DTH PiP/Key 1 PGM+PVW (1B00)', () => {
	test('2-byte block sets data_1B00 and data_1B01', () => {
		const data = feedDTH('DTH:001B00,0100')
		assert.equal(data['data_1B00'], '01')
		assert.equal(data['data_1B01'], '00')
	})

	test('single-byte response sets data_1B00 only', () => {
		const data = feedDTH('DTH:001B00,01')
		assert.equal(data['data_1B00'], '01')
		assert.equal(data['data_1B01'], undefined)
	})

	test('malformed value is not stored', () => {
		const data = feedDTH('DTH:001B00,XYZ')
		assert.equal(data['data_1B00'], undefined)
		assert.equal(data['data_1B01'], undefined)
	})
})

describe('DTH PiP/Key 2 PGM+PVW (1C00)', () => {
	test('2-byte block sets data_1C00 and data_1C01', () => {
		const data = feedDTH('DTH:001C00,0101')
		assert.equal(data['data_1C00'], '01')
		assert.equal(data['data_1C01'], '01')
	})

	test('single-byte response sets data_1C00 only', () => {
		const data = feedDTH('DTH:001C00,00')
		assert.equal(data['data_1C00'], '00')
		assert.equal(data['data_1C01'], undefined)
	})
})

describe('DTH PiP/Key 3 PGM+PVW (1D00)', () => {
	test('2-byte block sets data_1D00 and data_1D01', () => {
		const data = feedDTH('DTH:001D00,0001')
		assert.equal(data['data_1D00'], '00')
		assert.equal(data['data_1D01'], '01')
	})
})

describe('DTH PiP/Key 4 PGM+PVW (1E00)', () => {
	test('2-byte block sets data_1E00 and data_1E01', () => {
		const data = feedDTH('DTH:001E00,0100')
		assert.equal(data['data_1E00'], '01')
		assert.equal(data['data_1E01'], '00')
	})
})

// ── DTH: HDMI+SDI output assign ──────────────────────────────────────────────

describe('DTH HDMI1-3+SDI1-3 output assign', () => {
	test('7-byte block sets all seven assign fields including USB', () => {
		const data = feedDTH('DTH:00000A,01020304050607')
		assert.equal(data.hdmi1assign, '01')
		assert.equal(data.hdmi2assign, '02')
		assert.equal(data.hdmi3assign, '03')
		assert.equal(data.sdi1assign, '04')
		assert.equal(data.sdi2assign, '05')
		assert.equal(data.sdi3assign, '06')
		assert.equal(data.usbassign, '07')
	})

	test('single-byte notification sets only hdmi1assign', () => {
		const data = feedDTH('DTH:00000A,03')
		assert.equal(data.hdmi1assign, '03')
		assert.equal(data.hdmi2assign, undefined)
		assert.equal(data.sdi1assign, undefined)
		assert.equal(data.usbassign, undefined)
	})

	test('individual HDMI/SDI notifications still set their fields', () => {
		const data2 = feedDTH('DTH:00000B,02')
		assert.equal(data2.hdmi2assign, '02')
		const data3 = feedDTH('DTH:00000C,03')
		assert.equal(data3.hdmi3assign, '03')
		const dataS1 = feedDTH('DTH:00000D,01')
		assert.equal(dataS1.sdi1assign, '01')
		const dataS2 = feedDTH('DTH:00000E,01')
		assert.equal(dataS2.sdi2assign, '01')
		const dataS3 = feedDTH('DTH:00000F,01')
		assert.equal(dataS3.sdi3assign, '01')
	})

	test('USB assign still handled independently', () => {
		const data = feedDTH('DTH:000010,04')
		assert.equal(data.usbassign, '04')
	})

	test('wrong-length value is not stored', () => {
		const data = feedDTH('DTH:00000A,010203040506')
		assert.equal(data.hdmi1assign, undefined)
		assert.equal(data.hdmi2assign, undefined)
		assert.equal(data.usbassign, undefined)
	})

	test('non-hex value is not stored', () => {
		const data = feedDTH('DTH:00000A,GG')
		assert.equal(data.hdmi1assign, undefined)
	})
})

// ── DTH: Aux link ────────────────────────────────────────────────────────────

describe('DTH Aux 1-3 link', () => {
	test('3-byte block sets aux1link, aux2link, aux3link', () => {
		const data = feedDTH('DTH:020154,010001')
		assert.equal(data.aux1link, '01')
		assert.equal(data.aux2link, '00')
		assert.equal(data.aux3link, '01')
	})

	test('single-byte response sets only aux1link', () => {
		const data = feedDTH('DTH:020154,01')
		assert.equal(data.aux1link, '01')
		assert.equal(data.aux2link, undefined)
		assert.equal(data.aux3link, undefined)
	})

	test('individual aux2/aux3 link notifications still set their fields', () => {
		const data2 = feedDTH('DTH:020155,01')
		assert.equal(data2.aux2link, '01')
		const data3 = feedDTH('DTH:020156,00')
		assert.equal(data3.aux3link, '00')
	})

	test('aux link mode query still handled independently', () => {
		const data = feedDTH('DTH:02010D,01')
		assert.equal(data.auxlinkmode, '01')
	})

	test('malformed value is not stored', () => {
		const data = feedDTH('DTH:020154,XY')
		assert.equal(data.aux1link, undefined)
		assert.equal(data.aux2link, undefined)
		assert.equal(data.aux3link, undefined)
	})
})

// ── AUX tally feedback regression ────────────────────────────────────────────
// Regression: debounce in updateData deferred checkFeedbacks by 40ms and was
// continuously reset by ACK messages, so AUX tally feedbacks never updated.
// Verify that a DTH message triggers checkFeedbacks synchronously on both the
// production parser path (extractMessages → updateData) and the direct path.

// Drive updateData through the real parser (production-realistic path).
function feedDTHViaParser(rawTcp) {
	let feedbackCalls = 0
	const self = {
		...makeSelf(),
		checkFeedbacks: () => {
			feedbackCalls++
		},
	}
	const { messages } = extractMessages(rawTcp)
	assert.equal(messages.length, 1, 'expected exactly one message from parser')
	api.updateData.call(self, messages[0])
	return { data: self.DATA, feedbackCalls }
}

describe('AUX tally feedback regression — production parser path', () => {
	test('DTH:000011,21; via parser updates aux1source and invokes checkFeedbacks', () => {
		const { data, feedbackCalls } = feedDTHViaParser('DTH:000011,21;')
		assert.equal(data.aux1source, '21')
		assert.equal(feedbackCalls, 1)
	})

	test('DTH:00002E,2122; via parser updates aux2+aux3source and invokes checkFeedbacks once', () => {
		const { data, feedbackCalls } = feedDTHViaParser('DTH:00002E,2122;')
		assert.equal(data.aux2source, '21')
		assert.equal(data.aux3source, '22')
		assert.equal(feedbackCalls, 1)
	})
})

function feedDTHWithSpy(dth) {
	let feedbackCalls = 0
	const self = {
		...makeSelf(),
		checkFeedbacks: () => { feedbackCalls++ },
	}
	api.updateData.call(self, dth + ';')
	return { data: self.DATA, feedbackCalls }
}

describe('AUX tally feedback regression', () => {
	test('DTH:000011,21 updates aux1source and invokes checkFeedbacks synchronously', () => {
		const { data, feedbackCalls } = feedDTHWithSpy('DTH:000011,21')
		assert.equal(data.aux1source, '21')
		assert.equal(feedbackCalls, 1)
	})

	test('DTH:00002E,0320 (2-byte) updates aux2+3source and invokes checkFeedbacks synchronously', () => {
		const { data, feedbackCalls } = feedDTHWithSpy('DTH:00002E,0320')
		assert.equal(data.aux2source, '03')
		assert.equal(data.aux3source, '20')
		assert.equal(feedbackCalls, 1)
	})
})

// ── ERR:0 / extractMessages compatibility ────────────────────────────────────
// The Roland V-160HD sends "ERR:0;" over TCP.  extractMessages() strips the
// trailing ';' delimiter before handing messages to updateData(), so updateData
// must compare against "ERR:0" (no semicolon), not "ERR:0;".
//
// These tests pin the correct behaviour at both layers so any future regression
// (e.g. reconstructing the api.js block from the development branch) is caught
// immediately.  The fall-through tests use spies on checkFeedbacks/checkVariables
// to prove that ERR:0 is handled by its own branch and does not enter normal
// data processing.

describe('ERR:0 / extractMessages layer', () => {
	test('extractMessages("ERR:0;") returns exactly one message: "ERR:0"', () => {
		const { messages, remaining } = extractMessages('ERR:0;')
		assert.equal(messages.length, 1)
		assert.equal(messages[0], 'ERR:0')
		assert.equal(remaining, '')
	})

	test('extractMessages handles ERR:0; embedded in a larger buffer', () => {
		const { messages } = extractMessages('ACK;ERR:0;VER:1.00;')
		assert.ok(messages.includes('ERR:0'), '"ERR:0" must appear in parsed messages')
	})
})

describe('ERR:0 updateData — does not fall through to normal processing', () => {
	function makeSpySelf() {
		const calls = { checkFeedbacks: 0, checkVariables: 0 }
		return {
			self: {
				...makeSelf(),
				checkFeedbacks: () => { calls.checkFeedbacks++ },
				checkVariables: () => { calls.checkVariables++ },
			},
			calls,
		}
	}

	test('updateData("ERR:0") does not invoke checkFeedbacks or checkVariables', () => {
		const { self, calls } = makeSpySelf()
		api.updateData.call(self, 'ERR:0')
		assert.equal(calls.checkFeedbacks, 0, 'checkFeedbacks must not be called for ERR:0')
		assert.equal(calls.checkVariables, 0, 'checkVariables must not be called for ERR:0')
	})

	test('ERR:0 via parser does not invoke checkFeedbacks or checkVariables', () => {
		const { self, calls } = makeSpySelf()
		const { messages } = extractMessages('ERR:0;')
		assert.equal(messages.length, 1)
		api.updateData.call(self, messages[0])
		assert.equal(calls.checkFeedbacks, 0, 'checkFeedbacks must not be called for ERR:0 (parser path)')
		assert.equal(calls.checkVariables, 0, 'checkVariables must not be called for ERR:0 (parser path)')
	})

	test('a normal DTH message DOES invoke checkFeedbacks — spy is working', () => {
		const { self, calls } = makeSpySelf()
		api.updateData.call(self, 'DTH:000011,21;')
		assert.equal(calls.checkFeedbacks, 1, 'checkFeedbacks must be called for a normal DTH')
	})
})

// ── No dropped registers ─────────────────────────────────────────────────────

describe('no register dropped or duplicated', () => {
	test('six consolidated helpers emit 17 unique commands with no duplicates', () => {
		const cmds = []
		const collector = { ...makeSelf(), sendRawCommand: (c) => cmds.push(c) }

		// getFreezeData, transition, monitor, and memory queries are separate.
		for (const fn of [
			api.getAuxSources,
			api.getAuxMutes,
			api.getOutputData,
			api.getPinpKeyTally,
			api.getPinpKeySource,
			api.getAuxLinkData,
		]) {
			fn.call(collector)
		}

		// 3 (auxSources) + 3 (auxMutes) + 1 (output) + 4 (pipTally) + 4 (pipSource) + 2 (auxLink) = 17
		const unique = new Set(cmds)
		assert.equal(unique.size, cmds.length, 'no duplicate commands')
		assert.equal(cmds.length, 17)
	})
})
