module.exports = {
	initVariables: function () {
		let self = this
		let variables = []

		variables.push({ variableId: 'model', name: 'Model' })
		variables.push({ variableId: 'version', name: 'Version' })

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			variables.push({ variableId: 'tally_' + self.TALLYDATA[i].shortlabel, name: self.TALLYDATA[i].label + ' Tally' })
		}

		/*
		{ id: '1B', label: 'PnP/Key 1' },
						{ id: '1C', label: 'PnP/Key 2' },
						{ id: '1D', label: 'PnP/Key 3' },
						{ id: '1E', label: 'PnP/Key 4' },
						*/

		variables.push({ variableId: 'data_1B00', name: 'PnP/Key 1 on PGM' })
		variables.push({ variableId: 'data_1B01', name: 'PnP/Key 1 on PVW' })
		variables.push({ variableId: 'data_1C00', name: 'PnP/Key 2 on PGM' })
		variables.push({ variableId: 'data_1C01', name: 'PnP/Key 2 on PVW' })
		variables.push({ variableId: 'data_1D00', name: 'PnP/Key 3 on PGM' })
		variables.push({ variableId: 'data_1D01', name: 'PnP/Key 3 on PVW' })
		variables.push({ variableId: 'data_1E00', name: 'PnP/Key 4 on PGM' })
		variables.push({ variableId: 'data_1E01', name: 'PnP/Key 4 on PVW' })

		variables.push({ variableId: 'aux1', name: 'Aux 1 Source' })
		variables.push({ variableId: 'aux2', name: 'Aux 2 Source' })
		variables.push({ variableId: 'aux3', name: 'Aux 3 Source' })

		variables.push({ variableId: 'aux1_mute', name: 'Aux 1 Mute' })
		variables.push({ variableId: 'aux2_mute', name: 'Aux 2 Mute' })
		variables.push({ variableId: 'aux3_mute', name: 'Aux 3 Mute' })

		variables.push({ variableI: 'freeze', name: 'Freeze On/Off' })

		self.setVariableDefinitions(variables)
	},

	checkVariables: function () {
		let self = this

		try {
			let variableObj = {}

			variableObj.model = self.MODEL
			variableObj.version = self.VERSION

			for (let i = 0; i < self.TALLYDATA.length; i++) {
				let state = 'Off'

				if (self.TALLYDATA[i].status == 1 || self.TALLYDATA[i].status == 3) {
					state = 'Program'
				} else if (self.TALLYDATA[i].status == 2) {
					state = 'Preview'
				}

				variableObj['tally_' + self.TALLYDATA[i].shortlabel] = state
			}

			//PnP/Keys
			variableObj.data_1B00 = self.DATA.data_1B00 == '01' ? 'On' : 'Off'
			variableObj.data_1B01 = self.DATA.data_1B01 == '01' ? 'On' : 'Off'
			variableObj.data_1C00 = self.DATA.data_1C00 == '01' ? 'On' : 'Off'
			variableObj.data_1C01 = self.DATA.data_1C01 == '01' ? 'On' : 'Off'
			variableObj.data_1D00 = self.DATA.data_1D00 == '01' ? 'On' : 'Off'
			variableObj.data_1D01 = self.DATA.data_1D01 == '01' ? 'On' : 'Off'
			variableObj.data_1E00 = self.DATA.data_1E00 == '01' ? 'On' : 'Off'
			variableObj.data_1E01 = self.DATA.data_1E01 == '01' ? 'On' : 'Off'

			//Aux Sources
			let aux1source = self.CHOICES_PGMPVW_SELECT.find((item) => {
				return item.id == self.DATA.aux1source
			})
			let aux2source = self.CHOICES_PGMPVW_SELECT.find((item) => {
				return item.id == self.DATA.aux2source
			})
			let aux3source = self.CHOICES_PGMPVW_SELECT.find((item) => {
				return item.id == self.DATA.aux3source
			})

			if (aux1source !== undefined) {
				variableObj.aux1 = aux1source.label
			} else {
				variableObj.aux1 = self.DATA.aux1source
			}

			if (aux2source !== undefined) {
				variableObj.aux2 = aux2source.label
			} else {
				variableObj.aux2 = self.DATA.aux2source
			}

			if (aux3source !== undefined) {
				variableObj.aux3 = aux3source.label
			} else {
				variableObj.aux3 = self.DATA.aux3source
			}

			//Aux Mutes
			variableObj.aux1_mute = self.DATA.aux1mute == '01' ? 'On' : 'Off'
			variableObj.aux2_mute = self.DATA.aux2mute == '01' ? 'On' : 'Off'
			variableObj.aux3_mute = self.DATA.aux3mute == '01' ? 'On' : 'Off'

			//Freeze
			variableObj.freeze = self.DATA.freeze == '01' ? 'On' : 'Off'

			self.setVariableValues(variableObj)
		} catch (error) {
			self.log('error', 'Error setting Variables from Device: ' + String(error))
		}
	},
}
