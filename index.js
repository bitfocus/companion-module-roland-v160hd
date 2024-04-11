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
		this.RECONNECT_INTERVAL = 30000 //used for reconnecting to device

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
	}

	async init(config) {
		this.configUpdated(config)
	}
	// When module gets deleted
	async destroy() {
		try {
			if (this.socket !== undefined) {
				this.socket.destroy()
			}

			clearInterval(this.INTERVAL)
			clearInterval(this.RECONNECT_INTERVAL)

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
