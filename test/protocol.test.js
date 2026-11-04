const assert = require('node:assert/strict')
const { test } = require('node:test')
const net = require('node:net')
const { once } = require('node:events')
const { setTimeout: delay } = require('node:timers/promises')

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

async function until(predicate) {
	for (let i = 0; i < 200; i++) {
		if (predicate()) return
		await delay(10)
	}
	assert.fail('Timed out waiting for protocol exchange')
}

test('TCP authentication, action bytes, response state and connection replacement', async (t) => {
	const peers = []
	const received = []
	const server = net.createServer((peer) => {
		peers.push(peer)
		peer.on('data', (data) => received.push(data.toString()))
	})
	const self = instance()
	t.after(async () => {
		self.socket?.destroy()
		clearInterval(self.INTERVAL)
		clearTimeout(self.RECONNECT_INTERVAL)
		for (const peer of peers) peer.destroy()
		await new Promise((resolve) => server.close(resolve))
	})
	server.listen(0, '127.0.0.1')
	await once(server, 'listening')
	self.config = { ...self.config, host: '127.0.0.1', port: server.address().port }
	self.initConnection()
	await until(() => self.socket.isConnected && peers.length === 1)
	peers[0].write('Enter password:')
	await until(() => received.join('').includes('1234\n'))
	peers[0].write('Welcome to V-160HD.')
	await until(() => received.join('').includes('DTH:0C0100,01;\n'))
	assert.match(received.join(''), /VER\n/)
	assert.equal(self.INTERVAL, undefined)
	self.actions.run_macro.callback({ options: { macro: 100 } })
	await until(() => received.join('').includes('DTH:500504,63;'))
	peers[0].write('VER:V-160HD,2.00;DTH:000011,02;DTH:020500,01;DTH:001B00,01;')
	await until(() => self.DATA.freeze === '01')
	assert.equal(self.VERSION, '2.00')
	assert.equal(self.DATA.aux1source, '02')
	assert.equal(self.values.pnpkey1_pgm, 'On')
	assert.equal(self.feedbacks.freeze.callback({ options: {} }), true)
	assert.equal(self.feedbacks.auxTally.callback({ options: { aux: 'aux1', assign: '02' } }), true)
	const previous = self.socket
	self.initConnection()
	await until(() => peers.length === 2 && self.socket.isConnected)
	assert.notEqual(self.socket, previous)
	self.actions.run_macro.callback({ options: { macro: 1 } })
	await until(() => received.join('').includes('DTH:500504,00;'))
})

test('selected and explicit camera actions retain their addresses', () => {
	const self = instance()
	const sent = []
	self.sendCommand = (...args) => sent.push(args)
	self.selectedCamera = '03'
	self.actions.cameraCurrentPreset.callback({ options: { useSelected: true, camera: '01', preset: '02' } })
	self.actions.cameraCurrentPreset.callback({ options: { useSelected: false, camera: '04', preset: '01' } })
	assert.deepEqual(sent, [
		['020321', '02'],
		['020421', '01'],
	])
})

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
