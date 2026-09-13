const { InstanceStatus, TCPHelper } = require('@companion-module/base')
const { extractMessages } = require('./tcpParser')
const { CommandQueue, PRIORITY } = require('./commandQueue')

module.exports = {
	initConnection: function () {
		let self = this

		// Clear any pending commands from the previous connection before creating
		// a new queue, so stale commands cannot be sent on the new connection.
		if (self._queue) {
			self._queue.clear()
		}
		self._queue = new CommandQueue(
			function (cmd) {
				if (self.socket !== undefined && self.socket.isConnected) {
					if (self.config.verbose) self.log('debug', 'Sending: ' + cmd.trimEnd())
					self.socket.send(cmd)
				} else {
					if (self.config.verbose) self.log('warn', 'Unable to send: Socket not connected.')
				}
			},
			{ minIntervalMs: 20 },
		)

		if (self.socket !== undefined) {
			self.socket.destroy()
			delete self.socket
		}

		if (self.config.port === undefined) {
			self.config.port = 8023
		}

		if (self.config.host) {
			self.log('info', `Opening connection to ${self.config.host}:${self.config.port}`)

			self.tcpBuffer = ''

			self.socket = new TCPHelper(self.config.host, self.config.port, {
				reconnect: true,
				reconnect_interval: 30000,
			})

			self.socket.on('error', function (err) {
				if (self.config.verbose) {
					self.log('warn', 'Error: ' + err)
				}

				clearInterval(self.INTERVAL)
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection error')
			})

			self.socket.on('connect', function () {
				self.tcpBuffer = ''
				self._queue.clear()
				self.log('info', 'Connected')
				self.updateStatus(InstanceStatus.Ok)
			})

			self.socket.on('data', function (buffer) {
				self.tcpBuffer += buffer.toString('utf8')
				const { messages, remaining } = extractMessages(self.tcpBuffer)
				self.tcpBuffer = remaining
				for (const msg of messages) {
					self.updateData(msg)
				}
			})
		}
	},

	startInterval: function () {
		let self = this

		if (self.config.polling) {
			self.log('info', `Starting Update Interval: Fetching new data from Device every ${self.config.pollingrate}ms.`)
			if (self.config.pollingrate === undefined) {
				self.config.pollingrate = 1000
			}

			self.INTERVAL = setInterval(self.getData.bind(this), parseInt(self.config.pollingrate))
		} else {
			self.log('info', 'Polling is disabled. Module will not request new data at a regular rate.')
		}
	},

	getData: function () {
		let self = this

		//self.getTallyData();
		self.getPinpKeyData()
		self.getAuxData()
		self.getFreezeData()
		self.getOutputData()
		self.getAuxLinkData()

		self.getMemoryNames()
		self.getLastMemoryLoaded()
	},

	_parseHexBlock: function (value, expectedBytes) {
		if (value.length !== expectedBytes * 2) return null
		if (!/^[0-9A-Fa-f]+$/.test(value)) return null
		const out = []
		for (let i = 0; i < expectedBytes; i++) {
			out.push(value.slice(i * 2, i * 2 + 2).toUpperCase())
		}
		return out
	},

	getPinpKeyData: function () {
		let self = this

		self.sendRawCommand('RQH:001B00,000002;') //PnP/Key 1 PGM + PVW
		self.sendRawCommand('RQH:001C00,000002;') //PnP/Key 2 PGM + PVW
		self.sendRawCommand('RQH:001D00,000002;') //PnP/Key 3 PGM + PVW
		self.sendRawCommand('RQH:001E00,000002;') //PnP/Key 4 PGM + PVW

		//get sources for pnp/keys
		self.sendRawCommand('RQH:001B02,000001;') //PnP/Key 1 source
		self.sendRawCommand('RQH:001C02,000001;') //PnP/Key 2 source
		self.sendRawCommand('RQH:001D02,000001;') //PnP/Key 3 source
		self.sendRawCommand('RQH:001E02,000001;') //PnP/Key 4 source
	},

	getAuxData: function () {
		let self = this

		self.sendRawCommand('RQH:000011,000001;') //Aux 1 current source
		self.sendRawCommand('RQH:00002E,000002;') //Aux 2 + 3 current source

		self.sendRawCommand('RQH:012203,000001;') //Aux 1 mute
		self.sendRawCommand('RQH:012503,000001;') //Aux 2 mute
		self.sendRawCommand('RQH:012603,000001;') //Aux 3 mute
	},

	getFreezeData: function () {
		let self = this

		self.sendRawCommand('RQH:020500,000001;') //Freeze on/off
	},

	getOutputData: function () {
		let self = this

		self.sendRawCommand('RQH:00000A,000006;') //HDMI 1-3 + SDI 1-3 output assign
		self.sendRawCommand('RQH:000010,000001;') //USB output assign
	},

	getAuxLinkData: function () {
		let self = this

		self.sendRawCommand('RQH:02010D,000001;') //Aux Link Mode Off/Auto/Manual
		self.sendRawCommand('RQH:020154,000003;') //Aux 1-3 link on/off
	},

	/*getTallyData: function() {
		let self = this;

		for (let i = 0; i < 16; i++) {
			let hex = i.toString(16).padStart(2, '0').toUpperCase();
			let command = '0C' + '00' + hex + ',000001;';

			self.sendRawCommand('RQH:' + command);
		}
	},*/

	getMemoryNames: function () {
		let self = this

		for (let i = 0; i < 30; i++) {
			let hexMemory = i.toString(16).padStart(2, '0').toUpperCase()
			for (let j = 0; j < 8; j++) {
				let hex = j.toString(16).padStart(2, '0').toUpperCase()
				let command = '60' + hexMemory + hex + ',000001;'
				self.sendRawCommand('RQH:' + command)
			}
		}
	},

	getLastMemoryLoaded: function () {
		let self = this

		self.sendRawCommand('RQH:0A0003,000001;')
	},

	subscribeToTally: function () {
		let self = this

		self.sendRawCommand('DTH:0C0100,01;') //TALLY SEND ACTIVE
	},

	updateData: function (data) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', data)
		}

		if (data.trim() == 'Enter password:') {
			self.updateStatus(InstanceStatus.Connecting, 'Authenticating')
			self.log('info', 'Sending passcode')
			self.socket.send(self.config.password + '\n')
		} else if (data.trim() == 'Welcome to V-160HD.') {
			self.updateStatus(InstanceStatus.Ok)
			self.log('info', 'Authenticated.')
			self.sendRawCommand('VER') //request version info
			self.startInterval() //request some states
			self.subscribeToTally() //request tally changes
		} else if (data.trim() == 'ERR:0') {
			//an error with something that it received
		} else {
			//do stuff with the data
			try {
				if (data.trim() !== '') {
					let dataGroups = data.trim().split(';')

					for (let j = 0; j < dataGroups.length; j++) {
						dataGroups[j] = dataGroups[j].trim()
						if (dataGroups[j] !== 'ACK' && dataGroups[j] !== '') {
							let dataSet = dataGroups[j].trim().split(':')
							if (Array.isArray(dataSet)) {
								let dataPrefix = ''

								if (dataSet[0] !== undefined) {
									dataPrefix = dataSet[0].toString().trim()
								}

								let dataSuffix = ''

								if (dataSet.length > 1) {
									if (dataSet[1].toString().indexOf(',')) {
										dataSuffix = dataSet[1].toString().split(',')

										if (dataPrefix.indexOf('VER') > -1) {
											self.MODEL = dataSuffix[0].toString()
											self.VERSION = dataSuffix[1].toString()
										}

										if (dataPrefix.indexOf('DTH') > -1) {
											if (dataSuffix[0].length === 6) {
												let params = dataSuffix[0]
												let param1 = params[0] + params[1]
												let param2 = params[2] + params[3]
												let param3 = params[4] + params[5]

												let value = dataSuffix[1]

												/*if (param1 == '0C' && param2 == '00') { //tally message
													self.updateTally(param3, value);
												}*/

												if (param1 == '0C' && param2 == '00' && param3 == '00') {
													//subscribe tally message
													self.logVerbose('Received Subscribe Tally Message')
													let index = 0
													let halfLength = value.length / 2
													for (let t = 0; t < halfLength; t++) {
														let input = halfLength - (halfLength - t)
														input = input.toString(16).padStart(2, '0').toUpperCase()

														let tallyState = value[index] + value[index + 1]
														tallyState = tallyState.toString(16).padStart(2, '0').toUpperCase()

														self.updateTally(input, tallyState)

														index = index + 2
													}
												}

												if (param1 == '00') {
													if (param2 == '00' && param3 == '11') {
														//aux 1 source
														self.logVerbose('Received Aux 1 Source: ' + value)
														self.DATA.aux1source = value
													} else if (param2 == '00' && param3 == '2E') {
														//aux 2 source (+ aux 3 when responding to 2-byte block query)
														const block2E = self._parseHexBlock(value, 2)
														if (block2E) {
															self.DATA.aux2source = block2E[0]
															self.DATA.aux3source = block2E[1]
															self.logVerbose('Received Aux 2+3 Source: ' + value)
														} else if (self._parseHexBlock(value, 1)) {
															self.DATA.aux2source = value
															self.logVerbose('Received Aux 2 Source: ' + value)
														} else {
															self.log('warn', 'Unexpected DTH value at 00002E: ' + value)
														}
													} else if (param2 == '00' && param3 == '2F') {
														//aux 3 source (single-byte device notification)
														self.logVerbose('Received Aux 3 Source: ' + value)
														self.DATA.aux3source = value
													} else if (param2 == '1B' && param3 == '00') {
														//pnp/key 1 PGM + PVW (2-byte block) or single-byte PGM
														const block1B = self._parseHexBlock(value, 2)
														if (block1B) {
															self.DATA['data_1B00'] = block1B[0]
															self.DATA['data_1B01'] = block1B[1]
															self.logVerbose('Received PnP/Key 1 PGM+PVW: ' + value)
														} else if (self._parseHexBlock(value, 1)) {
															self.DATA['data_1B00'] = value
														} else {
															self.log('warn', 'Unexpected DTH value at 001B00: ' + value)
														}
													} else if (param2 == '1C' && param3 == '00') {
														//pnp/key 2 PGM + PVW (2-byte block) or single-byte PGM
														const block1C = self._parseHexBlock(value, 2)
														if (block1C) {
															self.DATA['data_1C00'] = block1C[0]
															self.DATA['data_1C01'] = block1C[1]
															self.logVerbose('Received PnP/Key 2 PGM+PVW: ' + value)
														} else if (self._parseHexBlock(value, 1)) {
															self.DATA['data_1C00'] = value
														} else {
															self.log('warn', 'Unexpected DTH value at 001C00: ' + value)
														}
													} else if (param2 == '1D' && param3 == '00') {
														//pnp/key 3 PGM + PVW (2-byte block) or single-byte PGM
														const block1D = self._parseHexBlock(value, 2)
														if (block1D) {
															self.DATA['data_1D00'] = block1D[0]
															self.DATA['data_1D01'] = block1D[1]
															self.logVerbose('Received PnP/Key 3 PGM+PVW: ' + value)
														} else if (self._parseHexBlock(value, 1)) {
															self.DATA['data_1D00'] = value
														} else {
															self.log('warn', 'Unexpected DTH value at 001D00: ' + value)
														}
													} else if (param2 == '1E' && param3 == '00') {
														//pnp/key 4 PGM + PVW (2-byte block) or single-byte PGM
														const block1E = self._parseHexBlock(value, 2)
														if (block1E) {
															self.DATA['data_1E00'] = block1E[0]
															self.DATA['data_1E01'] = block1E[1]
															self.logVerbose('Received PnP/Key 4 PGM+PVW: ' + value)
														} else if (self._parseHexBlock(value, 1)) {
															self.DATA['data_1E00'] = value
														} else {
															self.log('warn', 'Unexpected DTH value at 001E00: ' + value)
														}
													} else if (param2 == '1B' && param3 == '02') {
														//pnp key 1 source
														let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
															return item.id == value
														})
														self.DATA.pnpkey1source = value
														self.logVerbose('Received PnP/Key 1 Source: ' + value)
														if (lookup) {
															self.DATA.pnpkey1sourcename = lookup.label
															self.logVerbose('PnP/Key 1 Source Name: ' + lookup.label)
														}
													} else if (param2 == '1C' && param3 == '02') {
														//pnp key 2 source
														let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
															return item.id == value
														})
														self.DATA.pnpkey2source = value
														self.logVerbose('Received PnP/Key 2 Source: ' + value)
														if (lookup) {
															self.DATA.pnpkey2sourcename = lookup.label
															self.logVerbose('PnP/Key 2 Source Name: ' + lookup.label)
														}
													} else if (param2 == '1D' && param3 == '02') {
														//pnp key 3 source
														let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
															return item.id == value
														})
														self.DATA.pnpkey3source = value
														self.logVerbose('Received PnP/Key 3 Source: ' + value)
														if (lookup) {
															self.DATA.pnpkey3sourcename = lookup.label
															self.logVerbose('PnP/Key 3 Source Name: ' + lookup.label)
														}
													} else if (param2 == '1E' && param3 == '02') {
														//pnp key 4 source
														let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
															return item.id == value
														})
														self.DATA.pnpkey4source = value
														self.logVerbose('Received PnP/Key 4 Source: ' + value)
														if (lookup) {
															self.DATA.pnpkey4sourcename = lookup.label
															self.logVerbose('PnP/Key 4 Source Name: ' + lookup.label)
														}
													} else {
														//other data
														self.DATA[`data_${param1}${param2}${param3}`] = value //this should take care of all requested data
														self.DATA[`data_${param2}${param3}`] = value //this should take care of all requested data
													}
												}

												if (param1 == '02' && param2 == '05' && param3 == '00') {
													//freeze state
													self.DATA.freeze = value
													self.logVerbose('Received Freeze State: ' + value)
												}

												if (param1 == '01' && param2 == '22' && param3 == '03') {
													//aux 1 mute
													self.DATA.aux1mute = value
													self.logVerbose('Received Aux 1 Mute: ' + value)
												}

												if (param1 == '01' && param2 == '25' && param3 == '03') {
													//aux 2 mute
													self.DATA.aux2mute = value
													self.logVerbose('Received Aux 2 Mute: ' + value)
												}

												if (param1 == '01' && param2 == '26' && param3 == '03') {
													//aux 3 mute
													self.DATA.aux3mute = value
													self.logVerbose('Received Aux 3 Mute: ' + value)
												}

												if (param1 == '00' && param2 == '00' && param3 == '0A') {
													//hdmi 1-3 + sdi 1-3 output assign (6-byte block) or single-byte hdmi 1
													const blockOA = self._parseHexBlock(value, 6)
													if (blockOA) {
														self.DATA.hdmi1assign = blockOA[0]
														self.DATA.hdmi2assign = blockOA[1]
														self.DATA.hdmi3assign = blockOA[2]
														self.DATA.sdi1assign = blockOA[3]
														self.DATA.sdi2assign = blockOA[4]
														self.DATA.sdi3assign = blockOA[5]
														self.logVerbose('Received HDMI1-3+SDI1-3 Output Assign: ' + value)
													} else if (self._parseHexBlock(value, 1)) {
														self.DATA.hdmi1assign = value
														self.logVerbose('Received HDMI 1 Output Assign: ' + value)
													} else {
														self.log('warn', 'Unexpected DTH value at 00000A: ' + value)
													}
												}

												if (param1 == '00' && param2 == '00' && param3 == '0B') {
													//hdmi 2 output assign
													self.DATA.hdmi2assign = value
													self.logVerbose('Received HDMI 2 Output Assign: ' + value)
												}

												if (param1 == '00' && param2 == '00' && param3 == '0C') {
													//hdmi 3 output assign
													self.DATA.hdmi3assign = value
													self.logVerbose('Received HDMI 3 Output Assign: ' + value)
												}

												if (param1 == '00' && param2 == '00' && param3 == '0D') {
													//sdi 1 output assign
													self.DATA.sdi1assign = value
													self.logVerbose('Received SDI 1 Output Assign: ' + value)
												}

												if (param1 == '00' && param2 == '00' && param3 == '0E') {
													//sdi 2 output assign
													self.DATA.sdi2assign = value
													self.logVerbose('Received SDI 2 Output Assign: ' + value)
												}

												if (param1 == '00' && param2 == '00' && param3 == '0F') {
													//sdi 3 output assign
													self.DATA.sdi3assign = value
													self.logVerbose('Received SDI 3 Output Assign: ' + value)
												}

												if (param1 == '00' && param2 == '00' && param3 == '10') {
													//usb output assign
													self.DATA.usbassign = value
													self.logVerbose('Received USB Output Assign: ' + value)
												}

												if (param1 == '02' && param2 == '01' && param3 == '0D') {
													//aux link mode
													self.DATA.auxlinkmode = value
													self.logVerbose('Received Aux Link Mode: ' + value)
												}

												if (param1 == '02' && param2 == '01' && param3 == '54') {
													//aux 1-3 link on/off (3-byte block) or single-byte aux 1
													const block54 = self._parseHexBlock(value, 3)
													if (block54) {
														self.DATA.aux1link = block54[0]
														self.DATA.aux2link = block54[1]
														self.DATA.aux3link = block54[2]
														self.logVerbose('Received Aux 1-3 Link: ' + value)
													} else if (self._parseHexBlock(value, 1)) {
														self.DATA.aux1link = value
														self.logVerbose('Received Aux 1 Link: ' + value)
													} else {
														self.log('warn', 'Unexpected DTH value at 020154: ' + value)
													}
												}

												if (param1 == '02' && param2 == '01' && param3 == '55') {
													//aux 2 link
													self.DATA.aux2link = value
													self.logVerbose('Received Aux 2 Link: ' + value)
												}

												if (param1 == '02' && param2 == '01' && param3 == '56') {
													//aux 3 link
													self.DATA.aux3link = value
													self.logVerbose('Received Aux 3 Link: ' + value)
												}

												if (param1 == '60') {
													//memory names
													let memoryNumber = parseInt(param2, 16)
													let memoryCharIndex = parseInt(param3, 16)

													//there are 8 characters in each memory name and they will all come in as individual messages
													//and not necessarily in order
													let memoryName = self.DATA[`memory${memoryNumber}`]
													if (memoryName === undefined) {
														memoryName = ''
													}

													//value is the character, put it in the correct spot in the memory name based on the memoryCharIndex
													memoryName =
														memoryName.substring(0, memoryCharIndex * 2) +
														value +
														memoryName.substring(memoryCharIndex * 2 + 1) //replace the character at the index

													self.DATA[`memory${memoryNumber}`] = memoryName
													let variableObj = {}
													variableObj[`memoryname_${memoryNumber + 1}`] = memoryName
													self.setVariableValues(variableObj)
												}

												if (param1 == '0A') {
													//memory functions
													if (param2 == '00' && param3 == '03') {
														//last memory loaded
														self.DATA.lastMemory = parseInt(value, 16)

														//get the memory name based on the last memory loaded
														let memoryName = self.DATA[`memory${self.DATA.lastMemory}`]

														//update variables
														let variableObj = {}
														variableObj['lastmemorynumber'] = self.DATA.lastMemory
														variableObj['lastmemoryname'] = memoryName
														self.setVariableValues(variableObj)
													}
												}
											}
										}
									}
								} else {
									//likely just ERR:0;
								}
							}
						}
					}

					//now update feedbacks and variables
					self.checkFeedbacks()
					self.checkVariables()
				}
			} catch (error) {
				self.log('error', 'Error parsing incoming data: ' + error)
				self.log('error', 'Data: ' + data)
			}
		}
	},

	updateTally: function (input, value) {
		let self = this

		let tallyId = parseInt(input, 16)

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			if (self.TALLYDATA[i].id == tallyId) {
				self.TALLYDATA[i].status = parseInt(value, 16)
			}
		}
	},

	sendCommand: function (address, value) {
		let self = this

		let cmd = 'DTH:' + address + ',' + value + ';\n'
		self.sendRawCommand(cmd)
	},

	requestData: function (command) {
		let self = this

		let cmd = 'RQH:' + command + ';\n'
		self.sendRawCommand(cmd)
	},

	sendRawCommand: function (command) {
		let self = this

		if (!self._queue) return

		if (!command.indexOf(';')) {
			command = command + ';'
		}

		const cmd = command + '\n'
		const priority = command.trimStart().startsWith('DTH:') ? PRIORITY.HIGH : PRIORITY.LOW
		self._queue.enqueue(cmd, priority)
	},

	logVerbose: function (message) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', message)
		}
	},

	calculateBytes: function (value, scale = 10) {
		/*
		From Roland:
		Due to MIDI protocol restrictions, 8-bit data must be separated into 7-bit sections.
		The MIDI protocol uses the MSB bit to identify such messages as Note on messages.
		Two 7-bit byte data contains 14-bit data.
		Then mask the data with a 14-bit pattern.
		*/

		const scaled = Math.round(value * scale) & 0x3fff
		const lsb = scaled & 0x7f
		const msb = (scaled >> 7) & 0x7f
		return [msb, lsb]
	},
}
