'use strict'

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { mock } = require('node:test')
const { CommandQueue, PRIORITY } = require('../src/commandQueue')

// All tests in this file use fake timers so that rate-limiting delays can be
// exercised without real wall-clock waits.  Each test enables the mocks in its
// own beforeEach and resets them in afterEach to keep tests independent.
//
// When 'Date' is mocked, Date.now() starts at 0 and advances with each
// tick() call.  _lastHighSentAt is also 0 initially, so the first HIGH
// command always has delay = max(0, 20 - 0) = 20 ms.  LOW commands use a
// 1 ms minimum delay (no 20 ms rate limit) and can be drained with tick(1).
//
// Arriving HIGH commands cancel any pending LOW timer and reschedule using
// the HIGH rate-limit timing, so a user command always jumps the poll queue.
//
// mock.timers.tick(N) fires timers whose scheduled time is <= current + N
// but does NOT recursively fire timers set inside those callbacks — use
// successive tick() calls to drain multiple commands one at a time.

describe('Priority ordering', () => {
	let sent

	beforeEach(() => {
		mock.timers.enable(['setTimeout', 'Date'])
		sent = []
	})

	afterEach(() => {
		mock.timers.reset()
	})

	test('high-priority command is sent before a queued low-priority command', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('low\n', PRIORITY.LOW)
		q.enqueue('high\n', PRIORITY.HIGH)

		mock.timers.tick(20) // first drain — HIGH wins
		assert.equal(sent.length, 1)
		assert.equal(sent[0], 'high\n')

		mock.timers.tick(20) // second drain — LOW
		assert.equal(sent.length, 2)
		assert.equal(sent[1], 'low\n')
	})

	test('high-priority commands preserve FIFO order among themselves', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('h1\n', PRIORITY.HIGH)
		q.enqueue('h2\n', PRIORITY.HIGH)
		q.enqueue('h3\n', PRIORITY.HIGH)

		mock.timers.tick(20) // h1
		mock.timers.tick(20) // h2
		mock.timers.tick(20) // h3
		assert.deepEqual(sent, ['h1\n', 'h2\n', 'h3\n'])
	})

	test('low-priority commands preserve FIFO order among themselves', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('l1\n', PRIORITY.LOW)
		q.enqueue('l2\n', PRIORITY.LOW)
		q.enqueue('l3\n', PRIORITY.LOW)

		mock.timers.tick(20) // l1
		mock.timers.tick(20) // l2
		mock.timers.tick(20) // l3
		assert.deepEqual(sent, ['l1\n', 'l2\n', 'l3\n'])
	})

	test('all high-priority commands drain before any low-priority command', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('l1\n', PRIORITY.LOW)
		q.enqueue('l2\n', PRIORITY.LOW)
		q.enqueue('h1\n', PRIORITY.HIGH)
		q.enqueue('h2\n', PRIORITY.HIGH)

		mock.timers.tick(20) // h1
		mock.timers.tick(20) // h2
		mock.timers.tick(20) // l1
		mock.timers.tick(20) // l2
		assert.deepEqual(sent, ['h1\n', 'h2\n', 'l1\n', 'l2\n'])
	})

	test('user command arriving while poll queue is pending gets priority', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		// Enqueue three poll commands
		q.enqueue('poll1\n', PRIORITY.LOW)
		q.enqueue('poll2\n', PRIORITY.LOW)
		q.enqueue('poll3\n', PRIORITY.LOW)

		// First drain sends poll1
		mock.timers.tick(20)
		assert.equal(sent[0], 'poll1\n')

		// User command arrives while the timer for poll2 is already pending
		q.enqueue('user\n', PRIORITY.HIGH)

		// Next drain should pick the user command, not poll2
		mock.timers.tick(20)
		assert.equal(sent[1], 'user\n')

		// Polls then continue in order
		mock.timers.tick(20)
		assert.equal(sent[2], 'poll2\n')
		mock.timers.tick(20)
		assert.equal(sent[3], 'poll3\n')
	})
})

describe('Rate limiting', () => {
	let sent

	beforeEach(() => {
		mock.timers.enable(['setTimeout', 'Date'])
		sent = []
	})

	afterEach(() => {
		mock.timers.reset()
	})

	test('second command is not sent before the minimum interval has elapsed', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		// First command: delay = 20 ms (lastSentAt=0, Date.now()=0, elapsed=0)
		q.enqueue('cmd1\n', PRIORITY.HIGH)
		mock.timers.tick(20) // cmd1 sent at t=20, lastSentAt=20
		assert.equal(sent.length, 1)

		// Second command: elapsed = 0, delay = 20, timer at t=40
		q.enqueue('cmd2\n', PRIORITY.HIGH)
		mock.timers.tick(19) // t=39 — timer at 40 has not fired
		assert.equal(sent.length, 1, 'must not send before 20 ms have elapsed')

		mock.timers.tick(1) // t=40 — fires
		assert.equal(sent.length, 2)
		assert.equal(sent[1], 'cmd2\n')
	})

	test('minimum interval is enforced between each successive command', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('a\n', PRIORITY.HIGH)
		q.enqueue('b\n', PRIORITY.HIGH)
		q.enqueue('c\n', PRIORITY.HIGH)

		mock.timers.tick(20) // a sent
		assert.equal(sent.length, 1)

		mock.timers.tick(20) // b sent (20 ms later)
		assert.equal(sent.length, 2)

		mock.timers.tick(20) // c sent
		assert.equal(sent.length, 3)
	})

	test('queue drains correctly when a timer fires after its scheduled time', () => {
		// Simulates a delayed event-loop callback: the timer fires at t=50
		// instead of t=20.  The next command must be scheduled from the actual
		// send time (t=50), not from the expected fire time (t=20).
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('cmd1\n', PRIORITY.HIGH)
		mock.timers.tick(50) // timer at 20 fires; Date.now() inside callback = 50
		assert.equal(sent.length, 1)
		assert.equal(sent[0], 'cmd1\n')

		// From the queue's perspective, _lastHighSentAt = 50, elapsed = 0,
		// delay = 20.  The next HIGH command must wait a full 20 ms.
		q.enqueue('cmd2\n', PRIORITY.HIGH)
		mock.timers.tick(19) // t=69 — still waiting
		assert.equal(sent.length, 1)

		mock.timers.tick(1) // t=70 — fires
		assert.equal(sent.length, 2)
		assert.equal(sent[1], 'cmd2\n')
	})

	test('low-priority commands drain without the HIGH rate-limit delay', () => {
		// LOW/RQH reads are not subject to the 20 ms DTH interval.
		// Each LOW command uses only a 1 ms delay, so tick(1) drains one.
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('l1\n', PRIORITY.LOW)
		q.enqueue('l2\n', PRIORITY.LOW)

		mock.timers.tick(1) // l1 sent (delay = 1 ms, far below the 20 ms HIGH limit)
		assert.equal(sent.length, 1)
		assert.equal(sent[0], 'l1\n')

		mock.timers.tick(1) // l2 sent — no 20 ms wait required
		assert.equal(sent.length, 2)
		assert.equal(sent[1], 'l2\n')
	})

	test('sending a LOW command does not reset the HIGH rate-limit timestamp', () => {
		// A LOW/RQH send must not update _lastHighSentAt, so the next HIGH/DTH
		// command still waits the full interval from the previous HIGH send.
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		// First HIGH: delay = 20 ms from _lastHighSentAt = 0
		q.enqueue('h1\n', PRIORITY.HIGH)
		mock.timers.tick(20) // t=20: h1 sent, _lastHighSentAt = 20
		assert.equal(sent.length, 1)

		// Interleave a LOW: must not touch _lastHighSentAt
		q.enqueue('l1\n', PRIORITY.LOW)
		mock.timers.tick(1) // t=21: l1 sent immediately
		assert.equal(sent.length, 2)
		assert.equal(sent[1], 'l1\n')

		// Second HIGH: elapsed since last HIGH = 1 ms, so delay = 19 ms
		q.enqueue('h2\n', PRIORITY.HIGH)
		mock.timers.tick(18) // t=39: 19 ms not yet elapsed
		assert.equal(sent.length, 2, 'h2 must not fire before 20 ms since last HIGH')

		mock.timers.tick(1) // t=40: h2 sent
		assert.equal(sent.length, 3)
		assert.equal(sent[2], 'h2\n')
	})
})

describe('No duplication or loss', () => {
	let sent

	beforeEach(() => {
		mock.timers.enable(['setTimeout', 'Date'])
		sent = []
	})

	afterEach(() => {
		mock.timers.reset()
	})

	test('every enqueued command is sent exactly once', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })
		const commands = ['a\n', 'b\n', 'c\n', 'd\n', 'e\n']

		for (const cmd of commands) q.enqueue(cmd, PRIORITY.HIGH)

		for (let i = 0; i < commands.length; i++) mock.timers.tick(20)

		assert.equal(sent.length, commands.length)
		assert.deepEqual(sent, commands)
	})

	test('mixed priorities: every command sent exactly once, high before low', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('h1\n', PRIORITY.HIGH)
		q.enqueue('l1\n', PRIORITY.LOW)
		q.enqueue('h2\n', PRIORITY.HIGH)
		q.enqueue('l2\n', PRIORITY.LOW)

		mock.timers.tick(20) // h1
		mock.timers.tick(20) // h2
		mock.timers.tick(20) // l1
		mock.timers.tick(20) // l2

		assert.equal(sent.length, 4)
		assert.deepEqual(sent, ['h1\n', 'h2\n', 'l1\n', 'l2\n'])
	})
})

describe('clear()', () => {
	let sent

	beforeEach(() => {
		mock.timers.enable(['setTimeout', 'Date'])
		sent = []
	})

	afterEach(() => {
		mock.timers.reset()
	})

	test('clear() discards all queued commands', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('h1\n', PRIORITY.HIGH)
		q.enqueue('l1\n', PRIORITY.LOW)
		q.clear()

		mock.timers.tick(100)
		assert.equal(sent.length, 0)
	})

	test('queue accepts new commands normally after clear()', () => {
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('stale\n', PRIORITY.HIGH)
		q.clear()

		q.enqueue('fresh\n', PRIORITY.HIGH)
		mock.timers.tick(20)
		assert.equal(sent.length, 1)
		assert.equal(sent[0], 'fresh\n')
	})

	test('clear() resets the HIGH rate-limit timestamp', () => {
		// A HIGH command sent just before clear() must not force the first
		// command after clear() to wait for the remainder of its interval.
		const q = new CommandQueue((cmd) => sent.push(cmd), { minIntervalMs: 20 })

		q.enqueue('h1\n', PRIORITY.HIGH)
		mock.timers.tick(20) // h1 sent at t=20; _lastHighSentAt=20
		assert.equal(sent.length, 1)

		q.clear() // must reset _lastHighSentAt to 0

		// With a clean timestamp the first HIGH after clear() should need only
		// the standard initial delay of 20 ms, not any leftover from before.
		q.enqueue('h2\n', PRIORITY.HIGH)
		mock.timers.tick(20) // h2 sent — full 20 ms delay, no residue from h1
		assert.equal(sent.length, 2)
		assert.equal(sent[1], 'h2\n')
	})
})
