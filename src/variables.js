module.exports = {
	initVariables: function () {
		let self = this
		let variables = []

		variables.push({ variableId: 'model', name: 'Model' })
		variables.push({ variableId: 'version', name: 'Version' })

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			variables.push({ variableId: 'tally_' + self.TALLYDATA[i].shortlabel, name: self.TALLYDATA[i].label + ' Tally' })
		}

		variables.push({ variableId: 'pnpkey1_pgm', name: 'PnP/Key 1 on PGM' })
		variables.push({ variableId: 'pnpkey1_pvw', name: 'PnP/Key 1 on PVW' })
		variables.push({ variableId: 'pnpkey2_pgm', name: 'PnP/Key 2 on PGM' })
		variables.push({ variableId: 'pnpkey2_pvw', name: 'PnP/Key 2 on PVW' })
		variables.push({ variableId: 'pnpkey3_pgm', name: 'PnP/Key 3 on PGM' })
		variables.push({ variableId: 'pnpkey3_pvw', name: 'PnP/Key 3 on PVW' })
		variables.push({ variableId: 'pnpkey4_pgm', name: 'PnP/Key 4 on PGM' })
		variables.push({ variableId: 'pnpkey4_pvw', name: 'PnP/Key 4 on PVW' })

		//pnp/key sources
		variables.push({ variableId: 'pnpkey1_source', name: 'PnP/Key 1 Source' })
		variables.push({ variableId: 'pnpkey2_source', name: 'PnP/Key 2 Source' })
		variables.push({ variableId: 'pnpkey3_source', name: 'PnP/Key 3 Source' })
		variables.push({ variableId: 'pnpkey4_source', name: 'PnP/Key 4 Source' })

		//Output Assigns
		variables.push({ variableId: 'hdmi1', name: 'HDMI Output 1 Source' })
		variables.push({ variableId: 'hdmi2', name: 'HDMI Output 2 Source' })
		variables.push({ variableId: 'hdmi3', name: 'HDMI Output 3 Source' })
		variables.push({ variableId: 'sdi1', name: 'SDI Output 1 Source' })
		variables.push({ variableId: 'sdi2', name: 'SDI Output 2 Source' })
		variables.push({ variableId: 'sdi3', name: 'SDI Output 3 Source' })
		variables.push({ variableId: 'usb', name: 'USB Output Source' })

		//Aux Assigns
		variables.push({ variableId: 'aux1', name: 'Aux 1 Source' })
		variables.push({ variableId: 'aux2', name: 'Aux 2 Source' })
		variables.push({ variableId: 'aux3', name: 'Aux 3 Source' })

		variables.push({ variableId: 'aux1_mute', name: 'Aux 1 Mute' })
		variables.push({ variableId: 'aux2_mute', name: 'Aux 2 Mute' })
		variables.push({ variableId: 'aux3_mute', name: 'Aux 3 Mute' })

		variables.push({ variableId: 'auxlink_mode', name: 'Aux Link Mode' })
		variables.push({ variableId: 'aux1link', name: 'Aux Link' })
		variables.push({ variableId: 'aux2link', name: 'Aux Link' })
		variables.push({ variableId: 'aux3link', name: 'Aux Link' })

		variables.push({ variableI: 'freeze', name: 'Freeze On/Off' })

		//memory names
		for (let i = 1; i <= 30; i++) {
			variables.push({ variableId: 'memoryname_' + i, name: 'Memory Name' + i })
		}

		//last memory loaded, number and name
		variables.push({ variableId: 'lastmemorynumber', name: 'Last Memory Number Loaded' })
		variables.push({ variableId: 'lastmemoryname', name: 'Last Memory Name Loaded' })

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
			variableObj.pnpkey1_pgm = self.DATA.data_1B00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey1_pvw = self.DATA.data_1B01 == '01' ? 'On' : 'Off'
			variableObj.pnpkey2_pgm = self.DATA.data_1C00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey2_pvw = self.DATA.data_1C01 == '01' ? 'On' : 'Off'
			variableObj.pnpkey3_pgm = self.DATA.data_1D00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey3_pvw = self.DATA.data_1D01 == '01' ? 'On' : 'Off'
			variableObj.pnpkey4_pgm = self.DATA.data_1E00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey4_pvw = self.DATA.data_1E01 == '01' ? 'On' : 'Off'

			//pnpkey sources
			variableObj['pnpkey1_source'] = self.DATA.pnpkey1sourcename;
			variableObj['pnpkey2_source'] = self.DATA.pnpkey2sourcename;
			variableObj['pnpkey3_source'] = self.DATA.pnpkey3sourcename;
			variableObj['pnpkey4_source'] = self.DATA.pnpkey4sourcename;

			//Output Assigns
			let hdmi1assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.hdmi1assign
			})
			let hdmi2assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.hdmi2assign
			})
			let hdmi3assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.hdmi3assign
			})
			let sdi1assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.sdi1assign
			})
			let sdi2assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.sdi2assign
			})
			let sdi3assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.sdi3assign
			})
			let usbassign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.usbassign
			})

			if (hdmi1assign !== undefined) {
				variableObj.hdmi1 = hdmi1assign.label
			} else {
				variableObj.hdmi1 = self.DATA.hdmi1assign
			}

			if (hdmi2assign !== undefined) {
				variableObj.hdmi2 = hdmi2assign.label
			} else {
				variableObj.hdmi2 = self.DATA.hdmi2assign
			}

			if (hdmi3assign !== undefined) {
				variableObj.hdmi3 = hdmi3assign.label
			} else {
				variableObj.hdmi3 = self.DATA.hdmi3assign
			}

			if (sdi1assign !== undefined) {
				variableObj.sdi1 = sdi1assign.label
			} else {
				variableObj.sdi1 = self.DATA.sdi1assign
			}

			if (sdi2assign !== undefined) {
				variableObj.sdi2 = sdi2assign.label
			} else {
				variableObj.sdi2 = self.DATA.sdi2assign
			}

			if (sdi3assign !== undefined) {
				variableObj.sdi3 = sdi3assign.label
			} else {
				variableObj.sdi3 = self.DATA.sdi3assign
			}

			if (usbassign !== undefined) {
				variableObj.usb = usbassign.label
			} else {
				variableObj.usb = self.DATA.usbassign
			}

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

			//Aux Links
			variableObj.auxlink_mode =
				self.DATA.auxlinkmode == '00' ? 'Off' : self.DATA.auxlinkmode == '01' ? 'Auto Link' : 'Manual Link'
			variableObj.aux1link = self.DATA.aux1link == '01' ? 'On' : 'Off'
			variableObj.aux2link = self.DATA.aux2link == '01' ? 'On' : 'Off'
			variableObj.aux3link = self.DATA.aux3link == '01' ? 'On' : 'Off'

			//Freeze
			variableObj.freeze = self.DATA.freeze == '01' ? 'On' : 'Off'

			self.setVariableValues(variableObj)
		} catch (error) {
			self.log('error', 'Error setting Variables from Device: ' + String(error))
		}
	},
}
