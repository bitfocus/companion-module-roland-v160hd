// Roland V-160HD
const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const upgrades = require('./src/upgrades')

const config = require('./src/config')

const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

const api = require('./src/api')

const constants = require('./src/constants')

class v160Instance extends InstanceBase {
	constructor(internal) {
		super(internal)

		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...config,

			...actions,
			...feedbacks,
			...variables,
			...presets,

			...api,

			...constants,
		})

		this.INTERVAL = null //used for polling device for feedbacks
		// Reconnection is owned entirely by TCPHelper's own reconnect/
		// reconnect_interval option (see src/api.js initConnection) — no
		// separate module-owned reconnect timer/field is needed.

		this.MODEL = 'V-160HD'
		this.VERSION = ''

		this.DATA = {
			data_1B00: '00',
			data_1B01: '00',
			data_1C00: '00',
			data_1C01: '00',
			data_1D00: '00',
			data_1D01: '00',
			data_1E00: '00',
			data_1E01: '00',
		}

		this.selectedCamera = '01' //camera 1
	}

	async init(config) {
		this.configUpdated(config)
	}
	// When module gets deleted
	async destroy() {
		try {
			clearInterval(this.INTERVAL)
			this.INTERVAL = undefined

			// Discard queued commands and cancel the queue's own drain timer
			// before tearing down the socket, so nothing still pending tries
			// to send through the socket being destroyed below.
			if (this._queue) {
				this._queue.clear()
			}

			if (this.socket !== undefined) {
				this.socket.destroy()
				delete this.socket
			}

			this.log('debug', 'destroy')
		} catch (error) {
			this.log('error', 'destroy error:' + error)
		}
	}

	async configUpdated(config) {
		this.config = config

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.checkFeedbacks()
		this.checkVariables()

		this.initConnection()
	}
}

runEntrypoint(v160Instance, upgrades)
