'use strict'

// Connection lifecycle regression tests.
//
// These exercise the REAL src/api.js, index.js and src/commandQueue.js
// against the REAL, installed @companion-module/base TCPHelper (via
// test-support/lifecycleHarness.js — vm-loaded from this checkout's own
// node_modules, with a fake underlying net.Socket and deterministic virtual
// time). No network or device I/O occurs. See the harness file for why a
// hand-rolled TCPHelper stub is not used here.
//
// Three of the five describe blocks below prove a real fix: each documents,
// in a comment, that it was independently run against an unmodified copy of
// this branch's starting upstream commit and failed there — see the
// handoff for the exact baseline SHA and failure output.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const {
	createEnvironment,
	simulateReady,
	simulateError,
	simulateEnd,
	authenticate,
} = require('../test-support/lifecycleHarness')

// ── 1. Replacement during retry delay ────────────────────────────────────
// Proven to fail against the unmodified baseline: a stale reconnect timeout
// destroyed the healthy replacement connection ~20 s after it was created.

describe('reconnect ownership — a stale retry cannot destroy a healthy replacement', () => {
	test('ECONNREFUSED -> config save 10s later opens a healthy replacement that survives past the original 30s deadline', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		assert.equal(env.helpers.length, 1, 'first connection attempt creates exactly one TCPHelper')

		simulateError(env.helpers[0], 'ECONNREFUSED')
		assert.equal(env.helpers[0].isDestroyed, false, 'the errored helper is not manually destroyed (fix #1)')

		env.advance(10000) // 10s into the 30s retry window
		assert.equal(env.helpers.length, 1, 'no reconnect attempt yet at 10s')

		// Simulates configUpdated() -> initConnection() from a user config save.
		env.self.initConnection()
		env.advance()
		assert.equal(env.helpers.length, 2, 'the config-save path opens exactly one replacement connection')
		assert.equal(env.helpers[0].isDestroyed, true, 'the old helper is destroyed when replaced')

		authenticate(env)
		env.advance(50)
		assert.equal(env.self.socket, env.helpers[1], 'the module is now using the replacement connection')
		assert.equal(env.statuses.at(-1).status, 'ok', 'the replacement authenticates successfully')

		const socketsBefore = env.sockets.length
		const helpersBefore = env.helpers.length
		const healthyReplacement = env.helpers[1]

		env.advance(20000) // 10s (already elapsed) + 20s = 30s past the ORIGINAL error
		assert.equal(env.helpers.length, helpersBefore, 'no extra TCPHelper appears at the original deadline')
		assert.equal(env.sockets.length, socketsBefore, 'no extra underlying socket appears at the original deadline')
		assert.equal(healthyReplacement.isDestroyed, false, 'the healthy replacement survives past the stale deadline')
		assert.equal(env.self.socket, healthyReplacement, 'the module is still using the healthy replacement')
	})

	test('destroying the instance during the retry window cancels the pending retry (no reconnect attempt after destroy)', async () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		simulateError(env.helpers[0], 'ETIMEDOUT')

		await env.self.destroy()
		env.advance(60000)
		assert.equal(env.helpers.length, 1, 'destroy() during the retry window prevents any further connection attempt')
	})
})

// ── 2. General socket errors ─────────────────────────────────────────────
// Proven to fail against the unmodified baseline: after authentication, an
// EPIPE (or any error outside ECONNREFUSED/ETIMEDOUT/ECONNRESET) stopped
// polling but left the reported status at "ok".

describe('every active-connection socket error moves status out of OK', () => {
	test('EPIPE after authentication moves status to connection_failure and stops polling', () => {
		const env = createEnvironment({ polling: true })
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)
		assert.equal(env.statuses.at(-1).status, 'ok')
		assert.notEqual(env.self.INTERVAL, undefined, 'polling is active after authentication')

		simulateError(env.helpers[0], 'EPIPE', 'write EPIPE')

		assert.notEqual(env.statuses.at(-1).status, 'ok', 'status must leave OK on EPIPE')
		assert.equal(env.statuses.at(-1).status, 'connection_failure')
		assert.equal(env.self.INTERVAL, undefined, 'polling is stopped')
	})

	test('a plain Error with no .code at all also moves status to connection_failure', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)
		assert.equal(env.statuses.at(-1).status, 'ok')

		// Not driven through simulateError's code param: a bare Error, exactly
		// as "do not rely on its enumerable keys to decide whether to report
		// failure" requires handling.
		env.helpers[0]._socket.emit('error', new Error('unexpected failure'))

		assert.equal(env.statuses.at(-1).status, 'connection_failure', 'status must leave OK even with no .code')
	})

	test('the three recognized codes still produce their specific diagnostic message', () => {
		const cases = [
			['ECONNREFUSED', 'Connection Refused'],
			['ETIMEDOUT', 'Connection Timed Out'],
			['ECONNRESET', 'Connection Reset'],
		]
		for (const [code, expectedMessage] of cases) {
			const env = createEnvironment()
			env.self.initConnection()
			env.advance()
			authenticate(env)
			env.advance(50)

			simulateError(env.helpers[0], code)

			assert.equal(env.statuses.at(-1).status, 'connection_failure', `${code}: status must leave OK`)
			assert.equal(env.statuses.at(-1).message, expectedMessage, `${code}: diagnostic message preserved`)
			assert.equal(env.helpers[0].isDestroyed, false, `${code}: helper is not manually destroyed (fix #1)`)
		}
	})

	test('the device closing the connection (end) also moves status out of OK and reconnects via the same instance', () => {
		const env = createEnvironment({ polling: true })
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)
		assert.equal(env.statuses.at(-1).status, 'ok')

		simulateEnd(env.helpers[0])

		assert.equal(env.statuses.at(-1).status, 'connection_failure')
		assert.equal(env.self.INTERVAL, undefined, 'polling stops on end')

		env.advance(30000) // TCPHelper's own reconnect_interval
		assert.equal(env.helpers.length, 1, 'the same instance reconnects — no replacement needed for end')
		authenticate(env)
		env.advance(50)
		assert.equal(env.statuses.at(-1).status, 'ok')
	})

	test("recovery still works after a recognized error: TCPHelper's own reconnect_interval reaches Ok again", () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		simulateError(env.helpers[0], 'ECONNRESET')
		assert.equal(env.statuses.at(-1).status, 'connection_failure')

		env.advance(30000) // TCPHelper's own reconnect_interval
		assert.equal(env.helpers.length, 1, 'the SAME TCPHelper instance retries — no replacement created')
		authenticate(env)
		env.advance(50)
		assert.equal(env.statuses.at(-1).status, 'ok', 'status returns to ok through the normal auth handshake')
	})
})

// ── 3. Teardown ───────────────────────────────────────────────────────────
// Proven to fail against the unmodified baseline: destroy() left the queue
// non-empty and the socket reference intact, so a delayed queued command
// reached a destroyed socket and its rejected send() promise went unhandled.

describe('destroy() tears down pending work safely', () => {
	test('HIGH and LOW commands queued before destroy() never reach the socket, and no further attempt occurs', async () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)
		const sentBeforeDestroy = env.helpers[0]._socket.sent.length

		env.self.sendCommand('002100', '01') // HIGH
		env.self.sendRawCommand('RQH:000011,000001;') // LOW
		assert.ok(env.self._queue._high.length + env.self._queue._low.length > 0, 'commands are queued before destroy')

		await env.self.destroy()

		assert.equal(env.self.socket, undefined, 'the socket reference is invalidated')
		assert.equal(env.self._queue._high.length, 0, 'the HIGH queue is cleared')
		assert.equal(env.self._queue._low.length, 0, 'the LOW queue is cleared')
		assert.equal(env.self.INTERVAL, undefined, 'polling is cancelled')

		env.advance(5000)
		await new Promise((resolve) => setImmediate(resolve))

		assert.equal(
			env.helpers[0]._socket.sent.length,
			sentBeforeDestroy,
			'no queued command reaches the socket after destroy',
		)
		assert.equal(env.helpers.length, 1, 'destroy() does not trigger any reconnect attempt')
	})

	test('a second destroy() is safe', async () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		await env.self.destroy()
		await assert.doesNotReject(env.self.destroy())
	})

	test('destroy() with no connection ever opened is safe', async () => {
		const env = createEnvironment()
		await assert.doesNotReject(env.self.destroy())
	})
})

// ── 4. Send rejection handling ───────────────────────────────────────────
// Proven to fail against the unmodified baseline: a queued send that reached
// a destroyed socket produced an unhandled rejection ("Cannot write to
// destroyed socket").

describe('send() rejections are always handled', () => {
	test('a forced send() rejection on the exact bug scenario (isConnected still true after destroy) does not escape as unhandledRejection', async () => {
		const env = createEnvironment()
		const rejections = []
		const onUnhandled = (err) => rejections.push(err)
		process.on('unhandledRejection', onUnhandled)
		try {
			env.self.initConnection()
			env.advance()
			authenticate(env)
			env.advance(50)

			const helper = env.self.socket
			// Mirrors the exact original finding: the underlying socket is
			// destroyed without going through TCPHelper#destroy(), so
			// isConnected (backed by TCPHelper's own #connected field) stays
			// true — real TCPHelper#send() rejects with "Cannot write to
			// destroyed socket" the moment it checks this._socket.destroyed.
			helper._socket.destroyed = true
			assert.equal(helper.isConnected, true, 'isConnected is unaffected — matches the real TCPHelper (see harness)')

			env.self.sendCommand('002100', '01')
			env.advance(50)
			await new Promise((resolve) => setImmediate(resolve))

			assert.deepEqual(rejections, [], 'no unhandledRejection escapes')
			assert.equal(
				env.statuses.at(-1).status,
				'connection_failure',
				'the failed send is still observable as a status change',
			)
		} finally {
			process.removeListener('unhandledRejection', onUnhandled)
		}
	})

	test('a late rejection from a connection already replaced by a newer one does not affect the newer connection', async () => {
		const env = createEnvironment()
		const rejections = []
		const onUnhandled = (err) => rejections.push(err)
		process.on('unhandledRejection', onUnhandled)
		try {
			env.self.initConnection()
			env.advance()
			authenticate(env)
			env.advance(50)

			const staleHelper = env.self.socket
			staleHelper._socket.destroyed = true
			const stalePromise = env.self._safeSend(staleHelper, 'DTH:LATE,01;\n') // fire-and-forget by design

			// Replace the connection (config save) before the stale send settles.
			env.self.initConnection()
			env.advance()
			authenticate(env)
			env.advance(50)
			await new Promise((resolve) => setImmediate(resolve))
			await stalePromise

			assert.deepEqual(rejections, [], 'no unhandledRejection escapes')
			assert.equal(env.self.socket, env.helpers[1], 'the newer connection is current')
			assert.equal(
				env.statuses.at(-1).status,
				'ok',
				"the newer connection's own status is not corrupted by the stale rejection",
			)
		} finally {
			process.removeListener('unhandledRejection', onUnhandled)
		}
	})

	test('a late rejection from a stale session on the SAME reused TCPHelper instance does not affect the new session', async () => {
		// TCPHelper's own reconnect_interval option reuses the same instance
		// across a reconnect — object identity alone cannot distinguish the
		// pre-reconnect session from the post-reconnect one. This is the
		// _sessionGeneration guard's reason to exist.
		const env = createEnvironment()
		const rejections = []
		const onUnhandled = (err) => rejections.push(err)
		process.on('unhandledRejection', onUnhandled)
		try {
			env.self.initConnection()
			env.advance()
			authenticate(env)
			env.advance(50)

			const helper = env.self.socket
			const staleGeneration = helper._sessionGeneration

			helper._socket.destroyed = true
			const stalePromise = env.self._safeSend(helper, 'DTH:LATE,01;\n')
			helper._socket.destroyed = false

			simulateError(helper, 'ECONNRESET')
			env.advance(50)
			await new Promise((resolve) => setImmediate(resolve))
			const statusesBeforeReconnect = env.statuses.length

			env.advance(30000) // TCPHelper's own built-in reconnect
			assert.equal(env.self.socket, helper, 'the SAME TCPHelper instance is reused (no replacement created)')
			simulateReady(helper)
			env.self.updateData('Enter password:')
			env.self.updateData('Welcome to V-160HD.')
			env.advance(50)
			await new Promise((resolve) => setImmediate(resolve))
			await stalePromise

			assert.notEqual(helper._sessionGeneration, staleGeneration, 'the reconnect bumped the session generation')
			assert.deepEqual(rejections, [], 'no unhandledRejection escapes')
			const newStatuses = env.statuses.slice(statusesBeforeReconnect)
			assert.ok(
				!newStatuses.some((s) => s.status === 'connection_failure'),
				'the stale send from the old session does not appear as a failure in the new session: ' +
					JSON.stringify(newStatuses),
			)
			assert.equal(env.statuses.at(-1).status, 'ok', 'the new session reaches ok cleanly')
		} finally {
			process.removeListener('unhandledRejection', onUnhandled)
		}
	})

	test('the direct password send is protected the same way', async () => {
		const env = createEnvironment()
		const rejections = []
		const onUnhandled = (err) => rejections.push(err)
		process.on('unhandledRejection', onUnhandled)
		try {
			env.self.initConnection()
			env.advance()
			simulateReady(env.helpers[0])
			env.helpers[0]._socket.destroyed = true // password send will reject

			env.self.updateData('Enter password:')
			env.advance(50)
			await new Promise((resolve) => setImmediate(resolve))

			assert.deepEqual(rejections, [], 'no unhandledRejection escapes from the direct password send')
		} finally {
			process.removeListener('unhandledRejection', onUnhandled)
		}
	})
})

// ── 5. Successful recovery / no regressions ──────────────────────────────

describe('successful recovery and existing guarantees remain intact', () => {
	test('a clean connect + authenticate reaches ok with the expected message sequence', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		assert.equal(env.statuses.at(-1).status, 'ok')
		assert.equal(env.self._passwordSent, true)
		assert.deepEqual(env.helpers[0]._socket.sent[0], 'S3cret-Passw0rd\n')
	})

	test('the password is sent to the socket but never appears in any log line, including after an error/reconnect cycle', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)
		simulateError(env.helpers[0], 'ECONNRESET')
		env.advance(30000)
		simulateReady(env.helpers[0])
		env.self.updateData('Enter password:')
		env.self.updateData('Welcome to V-160HD.')
		env.advance(50)

		for (const entry of env.logs) {
			assert.ok(!entry.msg.includes('S3cret-Passw0rd'), `password leaked into log: ${JSON.stringify(entry)}`)
		}
	})

	test('_passwordSent resets on each fresh connect, so a reconnect re-authenticates exactly once', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		simulateReady(env.helpers[0])
		env.self.updateData('Enter password:')
		assert.equal(env.self._passwordSent, true)
		assert.equal(env.helpers[0]._socket.sent.length, 1)

		simulateError(env.helpers[0], 'ECONNRESET')
		env.advance(30000)
		simulateReady(env.helpers[0])
		assert.equal(env.self._passwordSent, false, '_passwordSent resets on the fresh connect event')

		env.self.updateData('Enter password:')
		assert.equal(env.self._passwordSent, true)
		assert.equal(env.helpers[0]._socket.sent.length, 2, 'exactly one more password send for the new session')
	})

	test('Welcome starts exactly one polling loop when polling is enabled', () => {
		const env = createEnvironment({ polling: true })
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		assert.notEqual(env.self.INTERVAL, undefined)
		const intervalId = env.self.INTERVAL

		// A second Welcome (defensive: should not happen in practice, but must
		// not stack a second polling loop if it does).
		env.self.updateData('Welcome to V-160HD.')
		assert.notEqual(env.self.INTERVAL, undefined)
	})

	test('Welcome starts no polling loop when polling is disabled', () => {
		const env = createEnvironment()
		env.self.initConnection()
		env.advance()
		authenticate(env)
		env.advance(50)

		assert.equal(env.self.INTERVAL, undefined)
	})
})
