const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeCommand, buildMemoryNameRequests } = require('../src/protocol')
const api = require('../src/api')

test('normalizeCommand adds one terminator and newline', () => {
	assert.equal(normalizeCommand('VER'), 'VER;\n')
	assert.equal(normalizeCommand('VER;'), 'VER;\n')
	assert.equal(normalizeCommand('  RQH:001B00,000001;\n'), 'RQH:001B00,000001;\n')
	assert.equal(normalizeCommand(''), '')
})

test('buildMemoryNameRequests covers 30 eight-character names exactly once', () => {
	const commands = buildMemoryNameRequests()

	assert.equal(commands.length, 240)
	assert.equal(new Set(commands).size, 240)
	assert.equal(commands[0], 'RQH:600000,000001;')
	assert.equal(commands[7], 'RQH:600007,000001;')
	assert.equal(commands.at(-1), 'RQH:601D07,000001;')
})

test('continuous polling excludes the 240 static memory-name requests', () => {
	const commands = []
	const instance = {
		...api,
		sendRawCommand(command) {
			commands.push(normalizeCommand(command).trim())
		},
	}

	api.getData.call(instance)

	assert.equal(commands.length, 31)
	assert.ok(commands.includes('RQH:0A0003,000001;'))
	assert.equal(
		commands.some((command) => command.startsWith('RQH:60')),
		false,
	)
})

test('sendRawCommand never duplicates the protocol terminator', () => {
	const sent = []
	const instance = {
		config: { verbose: false },
		socket: {
			isConnected: true,
			send(command) {
				sent.push(command)
			},
		},
	}

	api.sendRawCommand.call(instance, 'VER')
	api.sendRawCommand.call(instance, 'RQH:001B00,000001;\n')

	assert.deepEqual(sent, ['VER;\n', 'RQH:001B00,000001;\n'])
})
