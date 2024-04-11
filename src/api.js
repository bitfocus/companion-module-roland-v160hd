const { InstanceStatus, TCPHelper } = require('@companion-module/base')

module.exports = {
	initConnection: function () {
		let self = this

		if (self.socket !== undefined) {
			self.socket.destroy()
			delete self.socket
		}

		if (self.config.port === undefined) {
			self.config.port = 8023
		}

		if (self.config.host) {
			self.log('info', `Opening connection to ${self.config.host}:${self.config.port}`)

			self.socket = new TCPHelper(self.config.host, self.config.port)

			self.socket.on('error', function (err) {
				if (self.config.verbose) {
					self.log('warn', 'Error: ' + err)
				}

				clearInterval(self.INTERVAL)
				self.handleError(err)
			})

			self.socket.on('connect', function () {
				self.log('info', 'Connected')
				self.updateStatus(InstanceStatus.Ok)
			})

			self.socket.on('data', function (buffer) {
				let indata = buffer.toString('utf8')

				//update feedbacks and variables
				self.updateData(indata)
			})
		}
	},

	handleError: function (err) {
		let self = this

		try {
			let error = err.toString()
			let printedError = false

			Object.keys(err).forEach(function (key) {
				if (key === 'code') {
					if (err[key] === 'ECONNREFUSED') {
						error =
							'Unable to communicate with Device. Connection refused. Is this the right IP address? Is it still online?'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Refused')
						printedError = true
						if (self.socket !== undefined) {
							self.socket.destroy()
						}
						self.startReconnectInterval()
					} else if (err[key] === 'ETIMEDOUT') {
						error =
							'Unable to communicate with Device. Connection timed out. Is this the right IP address? Is it still online?'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Timed Out')
						printedError = true
						if (self.socket !== undefined) {
							self.socket.destroy()
						}
						self.startReconnectInterval()
					} else if (err[key] === 'ECONNRESET') {
						error = 'The connection was reset. Check the log for more error information.'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Reset')
						printedError = true
						if (self.socket !== undefined) {
							self.socket.destroy()
						}
						self.startReconnectInterval()
					}
				}
			})

			if (!printedError) {
				self.log('error', `Error: ${error}`)
			}
		} catch (error) {
			self.log('error', 'Error handling error: ' + error)
			self.log('error', 'Error: ' + String(err))
		}
	},

	startReconnectInterval: function () {
		let self = this

		self.updateStatus(InstanceStatus.ConnectionFailure, 'Reconnecting')

		if (self.RECONNECT_INTERVAL !== undefined) {
			clearInterval(self.RECONNECT_INTERVAL)
			self.RECONNECT_INTERVAL = undefined
		}

		self.log('info', 'Attempting to reconnect in 30 seconds...')

		self.RECONNECT_INTERVAL = setTimeout(self.initConnection.bind(this), 30000)
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
	},

	getPinpKeyData: function () {
		let self = this

		self.sendRawCommand('RQH:001B00,000001;') //PnP/Key 1 on PGM
		self.sendRawCommand('RQH:001B01,000001;') //PnP/Key 1 on PVW
		self.sendRawCommand('RQH:001C00,000001;') //PnP/Key 2 on PGM
		self.sendRawCommand('RQH:001C01,000001;') //PnP/Key 2 on PVW
		self.sendRawCommand('RQH:001D00,000001;') //PnP/Key 3 on PGM
		self.sendRawCommand('RQH:001D01,000001;') //PnP/Key 3 on PVW
		self.sendRawCommand('RQH:001E00,000001;') //PnP/Key 4 on PGM
		self.sendRawCommand('RQH:001E01,000001;') //PnP/Key 4 on PVW
	},

	getAuxData: function () {
		let self = this

		self.sendRawCommand('RQH:000011,000001;') //Aux 1 current source
		self.sendRawCommand('RQH:00002E,000001;') //Aux 2 current source
		self.sendRawCommand('RQH:00002F,000001;') //Aux 3 current source

		self.sendRawCommand('RQH:012203,000001;') //Aux 1 mute
		self.sendRawCommand('RQH:012503,000001;') //Aux 2 mute
		self.sendRawCommand('RQH:012603,000001;') //Aux 3 mute
	},

	getFreezeData: function () {
		let self = this

		self.sendRawCommand('RQH:020500,000001;') //Freeze on/off
	},

	/*getTallyData: function() {
		let self = this;

		for (let i = 0; i < 16; i++) {
			let hex = i.toString(16).padStart(2, '0').toUpperCase();
			let command = '0C' + '00' + hex + ',000001;';

			self.sendRawCommand('RQH:' + command);
		}
	},*/

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
			self.log('info', 'Sending passcode: ' + self.config.password)
			self.socket.send(self.config.password + '\n')
		} else if (data.trim() == 'Welcome to V-160HD.') {
			self.updateStatus(InstanceStatus.Ok)
			self.log('info', 'Authenticated.')
			self.sendRawCommand('VER') //request version info
			self.startInterval() //request some states
			self.subscribeToTally() //request tally changes
		} else if (data.trim() == 'ERR:0;') {
			//an error with something that it received
		} else {
			//do stuff with the data
			try {
				if (data.indexOf(';')) {
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
														self.DATA.aux1source = value
													} else if (param2 == '00' && param3 == '2E') {
														//aux 2 source
														self.DATA.aux2source = value
													} else if (param2 == '00' && param3 == '2F') {
														//aux 3 source
														self.DATA.aux3source = value
													} else {
														self.DATA[`data_${param2}${param3}`] = value //this should take care of all requested data
													}
												}

												if (param1 == '02' && param2 == '05' && param3 == '00') {
													//freeze state
													self.DATA.freeze = value
												}

												if (param1 == '01' && param2 == '22' && param3 == '03') {
													//aux 1 mute
													self.DATA.aux1mute = value
												}

												if (param1 == '01' && param2 == '25' && param3 == '03') {
													//aux 2 mute
													self.DATA.aux2mute = value
												}

												if (param1 == '01' && param2 == '26' && param3 == '03') {
													//aux 3 mute
													self.DATA.aux3mute = value
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

		if (!command.indexOf(';')) {
			command = command + ';'
		}

		let cmd = command + '\n'

		if (self.socket !== undefined && self.socket.isConnected) {
			if (self.config.verbose) {
				self.log('debug', 'Sending: ' + cmd)
			}

			self.socket.send(cmd)
		} else {
			if (self.config.verbose) {
				self.log('warn', 'Unable to send: Socket not connected.')
			}
		}
	},

	calculateBytes: function (value) {
		/*
		From Roland:
		Due to MIDI protocol restrictions, 8-bit data must be separated into 7-bit sections.
		The MIDI protocol uses the MSB bit to identify such messages as Note on messages.
		Two 7-bit byte data contains 14-bit data.
		Then mask the data with a 14-bit pattern.
		*/

		//Shift the decimal point one place to the right
		let decimalValue = value * 10

		// Convert decimal to hexadecimal
		let hexadecimalValue = decimalValue.toString(16).toUpperCase()

		// Convert hexadecimal string to a 32-bit signed integer
		let signedInt32 = parseInt(hexadecimalValue, 16) | 0

		// Extract lower 16 bits
		let lower16Bits = signedInt32 & 0xffff

		// Convert back to hexadecimal
		let truncatedHex = lower16Bits.toString(16).toUpperCase()

		//Apply the 14-bit mask
		let maskedValue = lower16Bits & 0x3fff

		// Convert back to hexadecimal string and make sure it is 4 characters long
		let maskedHex = maskedValue.toString(16).padStart(4, '0').toUpperCase()

		let value1 = maskedHex.substring(0, 2)
		let value2 = maskedHex.substring(2, 4)

		return [value1, value2]
	},
}
