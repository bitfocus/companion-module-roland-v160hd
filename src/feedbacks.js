const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks: function () {
		let self = this
		let feedbacks = {}

		const foregroundColor = combineRgb(255, 255, 255) // White
		const backgroundColorRed = combineRgb(255, 0, 0) // Red

		feedbacks.tally = {
			type: 'boolean',
			name: 'Tally State',
			description: 'Indicate if Input Channel is in Preview or Program',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Input Channel',
					id: 'input',
					default: self.TALLYDATA[0].id,
					choices: self.TALLYDATA,
				},
				{
					type: 'dropdown',
					label: 'Indicate in X State',
					id: 'state',
					default: 'program',
					choices: [
						{ id: 'program', label: 'Program (A)' },
						{ id: 'preview', label: 'Preview (B)' },
						{ id: 'both', label: 'Both' },
					],
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				let tallyObj = self.TALLYDATA.find((obj) => obj.id == opt.input)

				if (tallyObj) {
					if (tallyObj.status == 1 && opt.state == 'program') {
						return true
					}

					if (tallyObj.status == 2 && opt.state == 'preview') {
						return true
					}

					if (tallyObj.status == 3 && opt.state == 'both') {
						return true
					}
				}

				return false
			},
		}

		feedbacks.auxTally = {
			type: 'boolean',
			name: 'Aux Tally State',
			description: 'Indicate if Input Channel is in an Auxiliary Channel',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Aux',
					id: 'aux',
					default: '11',
					choices: [
						{ id: 'aux1', label: 'Aux 1' },
						{ id: 'aux2', label: 'Aux 2' },
						{ id: 'aux3', label: 'Aux 3' },
					],
				},
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_PGMPVW_SELECT[0].id,
					choices: self.CHOICES_PGMPVW_SELECT,
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				//implement
				if (opt.aux == 'aux1') {
					if (self.DATA.aux1source == opt.assign) {
						return true
					}
				}

				if (opt.aux == 'aux2') {
					if (self.DATA.aux2source == opt.assign) {
						return true
					}
				}

				if (opt.aux == 'aux3') {
					if (self.DATA.aux3source == opt.assign) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.auxMute = {
			type: 'boolean',
			name: 'Aux Mute State',
			description: 'Indicate if Aux Channel is Muted',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Aux',
					id: 'aux',
					default: '11',
					choices: [
						{ id: 'aux1', label: 'Aux 1' },
						{ id: 'aux2', label: 'Aux 2' },
						{ id: 'aux3', label: 'Aux 3' },
					],
				},
				{
					type: 'dropdown',
					label: 'Mute State',
					id: 'mute',
					default: '00',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					],
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				if (opt.aux == 'aux1') {
					if (self.DATA.aux1mute == opt.mute) {
						return true
					}
				}

				if (opt.aux == 'aux2') {
					if (self.DATA.aux2mute == opt.mute) {
						return true
					}
				}

				if (opt.aux == 'aux3') {
					if (self.DATA.aux3mute == opt.mute) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.outputAssign = {
			type: 'boolean',
			name: 'Output Assign State',
			description: 'Indicate if Output is Assigned to a specific Source',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: self.CHOICES_OUTPUTS[0].id,
					choices: self.CHOICES_OUTPUTS,
				},
				{
					type: 'dropdown',
					label: 'Type',
					id: 'assign',
					default: self.CHOICES_OUTPUTSASSIGN[0].id,
					choices: self.CHOICES_OUTPUTSASSIGN,
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				if (opt.output == '00000A') {
					//hdmi 1 output
					if (self.DATA.hdmi1source == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000B') {
					//hdmi 2 output
					if (self.DATA.hdmi2source == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000C') {
					//hdmi 3 output
					if (self.DATA.hdmi3source == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000D') {
					//sdi 1 output
					if (self.DATA.sdi1source == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000E') {
					//sdi 2 output
					if (self.DATA.sdi2source == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000F') {
					//sdi 3 output
					if (self.DATA.sdi3source == opt.assign) {
						return true
					}
				}

				if (opt.output == '000010') {
					//usb output
					if (self.DATA.usbsource == opt.assign) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.auxLinkMode = {
			type: 'boolean',
			name: 'Aux Link Mode',
			description: 'Indicate if Aux Link Mode is Off, Auto Link, or Manual Link',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: '00',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'Auto Link' },
						{ id: '02', label: 'Manual Link' },
					],
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				if (self.DATA.auxlinkmode == opt.mode) {
					return true
				}

				return false
			},
		}

		feedbacks.auxLink = {
			type: 'boolean',
			name: 'Aux Link State',
			description: 'Indicate if Aux Channel is Linked to PGM',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Aux',
					id: 'aux',
					default: '11',
					choices: [
						{ id: 'aux1', label: 'Aux 1' },
						{ id: 'aux2', label: 'Aux 2' },
						{ id: 'aux3', label: 'Aux 3' },
					],
				},
				{
					type: 'dropdown',
					label: 'Link Mode',
					id: 'link',
					default: '00',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					],
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				if (opt.aux == 'aux1') {
					if (self.DATA.aux1link == opt.link) {
						return true
					}
				}

				if (opt.aux == 'aux2') {
					if (self.DATA.aux2link == opt.link) {
						return true
					}
				}

				if (opt.aux == 'aux3') {
					if (self.DATA.aux3link == opt.link) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.keyOnAir = {
			type: 'boolean',
			name: 'Key is Selected on Bus',
			description: 'Indicate if Key is Selected on Bus',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: '1B',
					choices: [
						{ id: '1B', label: 'PnP/Key 1' },
						{ id: '1C', label: 'PnP/Key 2' },
						{ id: '1D', label: 'PnP/Key 3' },
						{ id: '1E', label: 'PnP/Key 4' },
					],
				},
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: '00',
					choices: [
						{ id: '00', label: 'Program (PGM)' },
						{ id: '01', label: 'Preview (PVW)' },
					],
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					default: '01',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					],
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				let obj = self.DATA.find((obj) => obj.id == `data_${opt.key}${opt.bus}`)

				if (obj) {
					if (obj.value == opt.onoff) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.freeze = {
			type: 'boolean',
			name: 'Freeze State',
			description: 'Indicate if Freeze is On or Off',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [],
			callback: function (feedback, bank) {
				let opt = feedback.options

				if (self.DATA.freeze == '01') {
					return true
				}

				return false
			},
		}

		feedbacks.pnpKeySource = {
			type: 'boolean',
			name: 'PnP/Key Source State',
			description: 'Indicate if PnP/Key Source is Selected on PnP/Key',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: '1B',
					choices: [
						{ id: 'pnpkey1', label: 'PnP/Key 1' },
						{ id: 'pnpkey2', label: 'PnP/Key 2' },
						{ id: 'pnpkey3', label: 'PnP/Key 3' },
						{ id: 'pnpkey4', label: 'PnP/Key 4' },
					],
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.CHOICES_PNPKEY_SOURCES[0].id,
					choices: self.CHOICES_PNPKEY_SOURCES,
				},
			],
			callback: function (feedback, bank) {
				let opt = feedback.options

				let obj = self.DATA[opt.pinp + 'source'];

				if (obj == opt.source) {
					return true
				}

				return false
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}
