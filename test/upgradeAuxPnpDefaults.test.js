'use strict'

// Regression tests for src/upgrades.js's migration of feedbacks saved with
// the pre-fix invalid defaults: auxTally/auxMute/auxLink's `aux` option
// (was '11', not a valid choice) and pnpKeySource's `pinp` option (was
// '1B', not a valid choice). Both defaults were corrected in this branch's
// ported small-correctness bundle; existing saved buttons need this
// upgrade script to actually see the corrected value.

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

const upgrades = require('../src/upgrades')
const feedbacksModule = require('../src/feedbacks')

const MIGRATION = upgrades[1] // index 0 is the pre-existing no-op script; must stay untouched

function makeFeedback(feedbackId, options, overrides) {
	return Object.assign(
		{
			id: 'fb-' + Math.random().toString(36).slice(2),
			controlId: 'ctrl-1',
			feedbackId,
			options: Object.assign({}, options),
		},
		overrides,
	)
}

function runMigration(feedbacks) {
	return MIGRATION({ currentConfig: null }, { config: null, actions: [], feedbacks })
}

// Build a real feedbacks self for callback-level red/green verification.
function makeFeedbacksSelf(dataOverrides) {
	const self = {
		config: { verbose: false },
		DATA: Object.assign({}, dataOverrides),
		log: () => {},
		logVerbose: () => {},
		TALLYDATA: [{ id: '01', label: 'Input 1' }],
		CHOICES_PGMPVW_SELECT: [
			{ id: '00', label: 'PGM' },
			{ id: '01', label: 'PVW' },
		],
		CHOICES_OUTPUTS: [{ id: '00000A', label: 'HDMI 1' }],
		CHOICES_OUTPUTSASSIGN: [{ id: '01', label: 'PGM' }],
		CHOICES_PNPKEY_SOURCES: [
			{ id: '00', label: 'Off' },
			{ id: '01', label: 'Input 1' },
		],
		_capturedFeedbacks: null,
		setFeedbackDefinitions(fb) {
			this._capturedFeedbacks = fb
		},
	}
	feedbacksModule.initFeedbacks.call(self)
	return self
}

describe('upgrades.js — index 0 (pre-existing no-op) is unchanged', () => {
	test('still returns an empty no-op result', () => {
		const result = upgrades[0]({ currentConfig: null }, { config: null, actions: [], feedbacks: [] })
		assert.deepEqual(result, { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] })
	})

	test('exactly two upgrade scripts are registered, in order', () => {
		assert.equal(upgrades.length, 2)
		assert.equal(typeof upgrades[0], 'function')
		assert.equal(typeof upgrades[1], 'function')
	})
})

describe('upgrades.js — migration index 1: stale aux/pnp defaults', () => {
	test('auxTally saved with the stale aux:"11" default is migrated to "aux1"', () => {
		const fb = makeFeedback('auxTally', { aux: '11', assign: '01' })
		const result = runMigration([fb])
		assert.equal(result.updatedFeedbacks.length, 1)
		assert.equal(result.updatedFeedbacks[0], fb)
		assert.equal(fb.options.aux, 'aux1')
		assert.equal(fb.options.assign, '01', 'the other option must be left untouched')
	})

	test('auxMute and auxLink saved with the stale aux:"11" default are also migrated', () => {
		const mute = makeFeedback('auxMute', { aux: '11', mute: '01' })
		const link = makeFeedback('auxLink', { aux: '11', link: '00' })
		const result = runMigration([mute, link])
		assert.equal(result.updatedFeedbacks.length, 2)
		assert.equal(mute.options.aux, 'aux1')
		assert.equal(link.options.aux, 'aux1')
	})

	test('pnpKeySource saved with the stale pinp:"1B" default is migrated to "pnpkey1"', () => {
		const fb = makeFeedback('pnpKeySource', { pinp: '1B', source: '00' })
		const result = runMigration([fb])
		assert.equal(result.updatedFeedbacks.length, 1)
		assert.equal(fb.options.pinp, 'pnpkey1')
		assert.equal(fb.options.source, '00', 'the other option must be left untouched')
	})

	test('keyOnAir\'s own pinp:"1B" option is a different, still-valid value and must NOT be touched', () => {
		const fb = makeFeedback('keyOnAir', { pinp: '1B', bus: '00', onoff: '01' })
		const result = runMigration([fb])
		assert.equal(result.updatedFeedbacks.length, 0)
		assert.equal(fb.options.pinp, '1B', 'keyOnAir pinp:"1B" is PnP/Key 1, a real protocol value, not a stale default')
	})

	test('already-correct aux/pnp selections are left untouched', () => {
		const auxOk = makeFeedback('auxTally', { aux: 'aux2', assign: '00' })
		const pnpOk = makeFeedback('pnpKeySource', { pinp: 'pnpkey3', source: '01' })
		const result = runMigration([auxOk, pnpOk])
		assert.equal(result.updatedFeedbacks.length, 0)
		assert.equal(auxOk.options.aux, 'aux2')
		assert.equal(pnpOk.options.pinp, 'pnpkey3')
	})

	test('unrelated feedbacks are left untouched', () => {
		const freeze = makeFeedback('freeze', {})
		const outputAssign = makeFeedback('outputAssign', { output: '00000A', assign: '01' })
		const result = runMigration([freeze, outputAssign])
		assert.equal(result.updatedFeedbacks.length, 0)
	})

	test('running the migration a second time makes no further changes (idempotent / safe after already-run)', () => {
		const fb = makeFeedback('auxTally', { aux: '11', assign: '01' })
		const first = runMigration([fb])
		assert.equal(first.updatedFeedbacks.length, 1)
		const second = runMigration([fb])
		assert.equal(second.updatedFeedbacks.length, 0)
		assert.equal(fb.options.aux, 'aux1')
	})

	test('does not touch actions or config', () => {
		const fb = makeFeedback('auxTally', { aux: '11', assign: '01' })
		const result = runMigration([fb])
		assert.deepEqual(result.updatedActions, [])
		assert.equal(result.updatedConfig, null)
	})
})

describe('upgrades.js — migrated options actually work against the real feedback callback (red/green)', () => {
	test('auxTally: old "11" value never matches (red), migrated "aux1" value matches real DATA (green)', () => {
		const self = makeFeedbacksSelf({ aux1source: '01' })
		const auxTally = self._capturedFeedbacks.auxTally

		// Red: the pre-fix default option ('11') is not a key in the callback's
		// own auxMap, so it can never return true regardless of device state.
		assert.equal(auxTally.callback({ options: { aux: '11', assign: '01' } }), false)

		// Green: after migration, the same button (now aux:'aux1') matches.
		const fb = makeFeedback('auxTally', { aux: '11', assign: '01' })
		runMigration([fb])
		assert.equal(auxTally.callback({ options: fb.options }), true)
	})

	test('pnpKeySource: old "1B" value is not a valid choice for this dropdown (red); migrated "pnpkey1" both is valid and matches real DATA (green)', () => {
		const self = makeFeedbacksSelf({ pnpkey1source: '01' })
		const pnpKeySource = self._capturedFeedbacks.pnpKeySource

		// Red: the pre-fix default ('1B') does not correspond to any of the
		// feedback's own dropdown choices — a saved button on this value can
		// never represent an actual user selection of PnP/Key 1..4.
		const validIds = new Set(pnpKeySource.options[0].choices.map((c) => c.id))
		assert.equal(validIds.has('1B'), false, 'the old default was never a valid choice for this dropdown')
		assert.equal(validIds.has('pnpkey1'), true)
		assert.equal(pnpKeySource.callback({ options: { pinp: '1B', source: '01' } }), false)

		// Green: after migration, the option is a real, selectable choice
		// and the callback matches actual device state.
		const fb = makeFeedback('pnpKeySource', { pinp: '1B', source: '01' })
		runMigration([fb])
		assert.equal(fb.options.pinp, 'pnpkey1')
		assert.equal(pnpKeySource.callback({ options: fb.options }), true)
	})

	test('keyOnAir: pinp:"1B" (PnP/Key 1) is one of the feedback\'s own valid choices, unaffected by the migration', () => {
		const self = makeFeedbacksSelf({ data_1B00: '01' })
		const keyOnAir = self._capturedFeedbacks.keyOnAir
		const validIds = new Set(keyOnAir.options[0].choices.map((c) => c.id))
		assert.equal(validIds.has('1B'), true, 'keyOnAir\'s own pinp choices include "1B" (PnP/Key 1) legitimately')
		assert.equal(keyOnAir.callback({ options: { pinp: '1B', bus: '00', onoff: '01' } }), true)
	})
})
