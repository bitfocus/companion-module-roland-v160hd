const assert = require('node:assert/strict')
const { test } = require('node:test')

function instance() {
	const self = {
		...structuredClone(require('../src/constants')),
		...require('../src/api'),
		...require('../src/actions'),
		...require('../src/feedbacks'),
		...require('../src/variables'),
		config: { password: '1234', polling: false },
		DATA: {},
		log() {},
		updateStatus() {},
		checkFeedbacks() {},
		setVariableValues(values) {
			this.values = { ...this.values, ...values }
		},
		setActionDefinitions(definitions) {
			this.actions = definitions
		},
		setFeedbackDefinitions(definitions) {
			this.feedbacks = definitions
		},
	}
	self.initActions()
	self.initFeedbacks()
	return self
}

test('polling and all manual camera fields publish expression visibility', () => {
	const fields = require('../src/config').getConfigFields.call({})
	assert.equal(fields.find((field) => field.id === 'pollingrate').isVisibleExpression, '$(options:polling) == true')
	const self = instance()
	const cameras = Object.values(self.actions).flatMap((action) =>
		action.options.filter((option) => option.id === 'camera' && action.options.some((o) => o.id === 'useSelected')),
	)
	assert.equal(cameras.length, 18)
	for (const field of cameras) {
		assert.equal(field.isVisible, undefined)
		assert.equal(field.isVisibleExpression, '$(options:useSelected) == false')
	}
})

test('variable definitions have valid unique IDs, including freeze', () => {
	const self = instance()
	self.setVariableDefinitions = (definitions) => {
		const ids = definitions.map((definition) => definition.variableId)
		assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0))
		assert.equal(new Set(ids).size, ids.length)
		assert.ok(ids.includes('freeze'))
	}
	self.initVariables()
})
