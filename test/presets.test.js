'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const constants = require('../src/constants')

// Inject a minimal @companion-module/base stub before presets.js is loaded.
// This avoids the broken node_modules chain (ajv, tslib, etc.) that exists in
// the upstream repo's development environment.
const baseStub = { combineRgb: () => 0 }
require.cache[require.resolve('@companion-module/base')] = {
	id: require.resolve('@companion-module/base'),
	filename: require.resolve('@companion-module/base'),
	loaded: true,
	exports: baseStub,
}

const presetsModule = require('../src/presets')

// Helper: run initPresets with an isolated mock self and capture the result.
function buildPresets(sourceChoices) {
	let captured = null
	const self = {
		CHOICES_PNPKEY_SOURCES: sourceChoices ?? constants.CHOICES_PNPKEY_SOURCES,
		setPresetDefinitions: (p) => {
			captured = p
		},
	}
	presetsModule.initPresets.call(self)
	return captured
}

// Collect every action step across all presets that targets a given actionId.
function actionsFor(presets, actionId) {
	const found = []
	for (const [id, preset] of Object.entries(presets)) {
		for (const step of preset.steps ?? []) {
			for (const action of step.down ?? []) {
				if (action.actionId === actionId) {
					found.push({ presetId: id, action })
				}
			}
		}
	}
	return found
}

describe('PiP/Key source presets', () => {
	test('every pnpkey_setsource action supplies options.source', () => {
		const presets = buildPresets()
		const actions = actionsFor(presets, 'pnpkey_setsource')

		assert.ok(actions.length > 0, 'at least one pnpkey_setsource preset must be generated')

		for (const { presetId, action } of actions) {
			assert.ok('source' in action.options, `preset ${presetId}: options.source is missing`)
		}
	})

	test('no pnpkey_setsource action uses options.assign', () => {
		const presets = buildPresets()
		const actions = actionsFor(presets, 'pnpkey_setsource')

		for (const { presetId, action } of actions) {
			assert.ok(!('assign' in action.options), `preset ${presetId}: options.assign must not be present`)
		}
	})

	test('generates one preset per PiP slot per source choice (4 × 52 = 208)', () => {
		const choices = constants.CHOICES_PNPKEY_SOURCES
		const presets = buildPresets(choices)
		const actions = actionsFor(presets, 'pnpkey_setsource')

		const PIP_SLOTS = 4
		assert.equal(actions.length, PIP_SLOTS * choices.length)
	})
})
