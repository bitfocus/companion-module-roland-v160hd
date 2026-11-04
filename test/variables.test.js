const assert = require('node:assert/strict')
const { test } = require('node:test')

test('freeze has a valid unique variable ID', () => {
	require('../src/variables').initVariables.call({
		TALLYDATA: require('../src/constants').TALLYDATA,
		setVariableDefinitions(definitions) {
			const ids = definitions.map((definition) => definition.variableId)
			assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0))
			assert.equal(new Set(ids).size, ids.length)
			assert.ok(ids.includes('freeze'))
		},
	})
})
