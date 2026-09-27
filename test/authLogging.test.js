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

const PASSWORD = 'S3cret-Passw0rd'

function makeSelf(overrides = {}) {
	const sent = []
	const logged = []
	const self = {
		config: { verbose: false, password: PASSWORD },
		DATA: {},
		_passwordSent: false,
		socket: { send: (d) => sent.push(d), _sessionGeneration: 1 },
		_safeSend: api._safeSend,
		log: (level, msg) => logged.push({ level, msg: String(msg) }),
		logVerbose: () => {},
		updateStatus: () => {},
		setVariableValues: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		sendRawCommand: () => {},
		startInterval: () => {},
		subscribeToTally: () => {},
		CHOICES_PNPKEY_SOURCES: [],
		...overrides,
	}
	return { self, sent, logged }
}

describe('authentication — password never reaches the logger', () => {
	test('password prompt sends the configured password to the socket', () => {
		const { self, sent } = makeSelf()
		api.updateData.call(self, 'Enter password:')
		assert.deepEqual(sent, [PASSWORD + '\n'])
	})

	test('password value is never passed to log()', () => {
		const { self, logged } = makeSelf()
		api.updateData.call(self, 'Enter password:')
		assert.ok(logged.length > 0, 'expected at least one log line during authentication')
		for (const entry of logged) {
			assert.ok(!entry.msg.includes(PASSWORD), `password leaked into log: ${JSON.stringify(entry)}`)
		}
	})

	test('logs the upstream-safe "Sending passcode" message at info level', () => {
		const { self, logged } = makeSelf()
		api.updateData.call(self, 'Enter password:')
		assert.deepEqual(logged, [{ level: 'info', msg: 'Sending passcode' }])
	})

	test('password is not logged even with verbose enabled', () => {
		const { self, logged } = makeSelf({ config: { verbose: true, password: PASSWORD } })
		api.updateData.call(self, 'Enter password:')
		for (const entry of logged) {
			assert.ok(!entry.msg.includes(PASSWORD), `password leaked into verbose log: ${JSON.stringify(entry)}`)
		}
	})

	test('_passwordSent guard: password is sent only once per connection', () => {
		const { self, sent, logged } = makeSelf()
		api.updateData.call(self, 'Enter password:')
		api.updateData.call(self, 'Enter password:')
		assert.equal(self._passwordSent, true)
		assert.deepEqual(sent, [PASSWORD + '\n'])
		assert.equal(logged.filter((e) => e.msg === 'Sending passcode').length, 1)
	})

	test('a prompt after _passwordSent is already true sends nothing and logs nothing', () => {
		const { self, sent, logged } = makeSelf({ _passwordSent: true })
		api.updateData.call(self, 'Enter password:')
		assert.deepEqual(sent, [])
		assert.deepEqual(logged, [])
	})
})
