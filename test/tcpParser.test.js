'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { extractMessages } = require('../src/tcpParser')

// Helper: feed an array of TCP chunks one at a time and collect all messages.
function simulate(chunks) {
	let buffer = ''
	const received = []
	for (const chunk of chunks) {
		buffer += chunk
		const { messages, remaining } = extractMessages(buffer)
		received.push(...messages)
		buffer = remaining
	}
	return { received, leftover: buffer }
}

describe('Semicolon-terminated protocol messages', () => {
	test('single complete message in one chunk', () => {
		const { received, leftover } = simulate(['DTH:002100,01;'])
		assert.deepEqual(received, ['DTH:002100,01'])
		assert.equal(leftover, '')
	})

	test('two messages merged in one TCP chunk', () => {
		const { received } = simulate(['DTH:002100,01;DTH:002101,02;'])
		assert.deepEqual(received, ['DTH:002100,01', 'DTH:002101,02'])
	})

	test('message split across two TCP chunks', () => {
		const { received, leftover } = simulate(['DTH:001B', '02,01;'])
		assert.deepEqual(received, ['DTH:001B02,01'])
		assert.equal(leftover, '')
	})

	test('complete message followed by partial tail in same chunk', () => {
		const { received, leftover } = simulate(['DTH:002100,01;DTH:001B'])
		assert.deepEqual(received, ['DTH:002100,01'])
		assert.equal(leftover, 'DTH:001B')
	})

	test('tail completed in next chunk', () => {
		const { received } = simulate(['DTH:002100,01;DTH:001B', '02,01;'])
		assert.deepEqual(received, ['DTH:002100,01', 'DTH:001B02,01'])
	})

	test('three messages in one chunk dispatched in order', () => {
		const { received } = simulate(['DTH:002100,01;DTH:002101,02;DTH:000011,03;'])
		assert.deepEqual(received, ['DTH:002100,01', 'DTH:002101,02', 'DTH:000011,03'])
	})

	test('each message dispatched exactly once', () => {
		const { received } = simulate(['DTH:002100,01;DTH:002101,02;'])
		assert.equal(received.length, 2)
	})
})

describe('Auth prompts (no terminator)', () => {
	test('Enter password: in one chunk', () => {
		const { received } = simulate(['Enter password:'])
		assert.deepEqual(received, ['Enter password:'])
	})

	test('Enter password: split across two chunks', () => {
		const { received } = simulate(['Enter pass', 'word:'])
		assert.deepEqual(received, ['Enter password:'])
	})

	test('Welcome to V-160HD. split across two chunks', () => {
		const { received } = simulate(['Welcome to V', '-160HD.'])
		assert.deepEqual(received, ['Welcome to V-160HD.'])
	})

	test('auth prompt arrives after a complete protocol message', () => {
		const { received } = simulate(['DTH:002100,01;Enter password:'])
		assert.deepEqual(received, ['DTH:002100,01', 'Enter password:'])
	})

	test('protocol message before prompt is not discarded', () => {
		const { received } = simulate(['DTH:002100,01;DTH:002101,02;Welcome to V-160HD.'])
		assert.deepEqual(received, ['DTH:002100,01', 'DTH:002101,02', 'Welcome to V-160HD.'])
	})

	test('auth prompt split + protocol message after', () => {
		const { received } = simulate(['Enter pass', 'word:DTH:002100,01;'])
		assert.deepEqual(received, ['Enter password:', 'DTH:002100,01'])
	})
})

describe('Newline-terminated lines (VER response)', () => {
	test('VER line in one chunk', () => {
		const { received } = simulate(['VER:V-160HD,1.04\n'])
		assert.deepEqual(received, ['VER:V-160HD,1.04'])
	})

	test('VER line split across chunks', () => {
		const { received } = simulate(['VER:V-160', 'HD,1.04\n'])
		assert.deepEqual(received, ['VER:V-160HD,1.04'])
	})

	test('VER line followed by DTH message', () => {
		const { received } = simulate(['VER:V-160HD,1.04\nDTH:002100,01;'])
		assert.deepEqual(received, ['VER:V-160HD,1.04', 'DTH:002100,01'])
	})
})

describe('Delimiter occurrence order (regression tests)', () => {
	test('DTH messages followed by newline: each dispatched separately', () => {
		// Previously the newline handler ran before semicolons and swallowed both DTH messages.
		const { received } = simulate(['DTH:002100,01;DTH:002101,02;\n'])
		assert.deepEqual(received, ['DTH:002100,01', 'DTH:002101,02'])
	})

	test('VER line before auth prompt: VER not lost', () => {
		// Previously auth prompts were scanned first and the VER line was discarded.
		const { received } = simulate(['VER:V-160HD,1.04\nEnter password:'])
		assert.deepEqual(received, ['VER:V-160HD,1.04', 'Enter password:'])
	})

	test('DTH then auth prompt then DTH: correct order', () => {
		const { received } = simulate(['DTH:002100,01;Enter password:DTH:002101,02;'])
		assert.deepEqual(received, ['DTH:002100,01', 'Enter password:', 'DTH:002101,02'])
	})
})

describe('Message content (no delimiter leakage)', () => {
	test('returned messages contain no trailing semicolon', () => {
		const { received } = simulate(['DTH:002100,01;DTH:002101,02;DTH:000011,03;'])
		for (const msg of received) {
			assert.ok(!msg.endsWith(';'), `unexpected trailing semicolon in: ${msg}`)
		}
	})

	test('empty buffer after all complete messages consumed', () => {
		const { leftover } = simulate(['DTH:002100,01;DTH:002101,02;'])
		assert.equal(leftover, '')
	})

	test('incomplete message kept in buffer, not dispatched', () => {
		const { received, leftover } = simulate(['DTH:002100,01;DTH:002101'])
		assert.equal(received.length, 1)
		assert.equal(received[0], 'DTH:002100,01')
		assert.equal(leftover, 'DTH:002101')
	})

	test('auth prompt message has no semicolon', () => {
		const { received } = simulate(['Enter password:'])
		assert.equal(received.length, 1)
		assert.ok(!received[0].includes(';'))
	})
})
