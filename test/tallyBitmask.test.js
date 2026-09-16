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

const feedbacksDef = require('../src/feedbacks')
const constants = require('../src/constants')

function makeTallyInstance(tallyStatuses) {
	const TALLYDATA = constants.TALLYDATA.map((t) => Object.assign({}, t))
	for (const [id, status] of Object.entries(tallyStatuses)) {
		const obj = TALLYDATA.find((t) => t.id == id)
		if (obj) obj.status = status
	}

	const self = {
		config: { verbose: false },
		DATA: {},
		log: () => {},
		logVerbose: () => {},
		setVariableValues: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		TALLYDATA,
		CHOICES_PGMPVW_SELECT: constants.CHOICES_PGMPVW_SELECT,
		CHOICES_PNPKEY_SOURCES: constants.CHOICES_PNPKEY_SOURCES,
		CHOICES_OUTPUTS: constants.CHOICES_OUTPUTS,
		CHOICES_OUTPUTSASSIGN: constants.CHOICES_OUTPUTSASSIGN || [{ id: '00', label: 'Placeholder' }],
		_resolveInputToPhysical: () => {},
	}

	let tallyCallback
	self.setFeedbackDefinitions = (defs) => {
		tallyCallback = defs.tally.callback
	}
	feedbacksDef.initFeedbacks.call(self)

	return (inputId, state) => tallyCallback({ options: { input: inputId, state } }, {})
}

// ── tally bitmask — all four status values ────────────────────────────────────

describe('tally feedback — bitmask interpretation', () => {
	describe('status 0x00 (neither PGM nor PVW)', () => {
		const tally = makeTallyInstance({ 1: 0 })

		test('program false', () => assert.equal(tally(1, 'program'), false))
		test('preview false', () => assert.equal(tally(1, 'preview'), false))
		test('both false',    () => assert.equal(tally(1, 'both'),    false))
	})

	describe('status 0x01 (program bit only)', () => {
		const tally = makeTallyInstance({ 1: 1 })

		test('program true',  () => assert.equal(tally(1, 'program'), true))
		test('preview false', () => assert.equal(tally(1, 'preview'), false))
		test('both false',    () => assert.equal(tally(1, 'both'),    false))
	})

	describe('status 0x02 (preview bit only)', () => {
		const tally = makeTallyInstance({ 1: 2 })

		test('program false', () => assert.equal(tally(1, 'program'), false))
		test('preview true',  () => assert.equal(tally(1, 'preview'), true))
		test('both false',    () => assert.equal(tally(1, 'both'),    false))
	})

	describe('status 0x03 (both bits set)', () => {
		const tally = makeTallyInstance({ 1: 3 })

		test('program true',  () => assert.equal(tally(1, 'program'), true))
		test('preview true',  () => assert.equal(tally(1, 'preview'), true))
		test('both true',     () => assert.equal(tally(1, 'both'),    true))
	})
})

// ── regression: preview bit survives status becoming 0x03 ────────────────────

describe('tally feedback — regression: preview true when status is 0x03', () => {
	test('source on PVW (0x02) then status becomes 0x03: PVW feedback remains true', () => {
		// Simulate: source initially only on preview (status 0x02).
		// Roland then sends 0x03 because AUX/program tally bit is also raised.
		// Preview feedback must still be true.
		const tallyAt02 = makeTallyInstance({ 2: 2 })
		assert.equal(tallyAt02(2, 'preview'), true, 'preview true at 0x02')
		assert.equal(tallyAt02(2, 'program'), false, 'program false at 0x02')

		const tallyAt03 = makeTallyInstance({ 2: 3 })
		assert.equal(tallyAt03(2, 'preview'), true,  'preview still true at 0x03')
		assert.equal(tallyAt03(2, 'program'), true,  'program also true at 0x03')
		assert.equal(tallyAt03(2, 'both'),    true,  'both true at 0x03')
	})

	test('independent tally sources do not affect each other', () => {
		// source 1 on program (0x01), source 2 on preview (0x02)
		const tally = makeTallyInstance({ 1: 1, 2: 2 })
		assert.equal(tally(1, 'program'), true)
		assert.equal(tally(1, 'preview'), false)
		assert.equal(tally(2, 'program'), false)
		assert.equal(tally(2, 'preview'), true)
	})
})
