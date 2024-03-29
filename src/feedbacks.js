const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks: function () {
		let self = this;
		let feedbacks = {};

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
					choices: self.TALLYDATA
				},
				{
					type: 'dropdown',
					label: 'Indicate in X State',
					id: 'state',
					default: 'program',
					choices: [
						{ id: 'preview', label: 'Preview' },
						{ id: 'program', label: 'Program' }
					]
				}
			],
			callback: function (feedback, bank) {
				let opt = feedback.options;

				let tallyObj = self.TALLYDATA.find((obj) => obj.id == opt.input);

				if (tallyObj) {
					if ((tallyObj.status == 1 || tallyObj.status == 3) && opt.state == 'program') {
						return true;
					}

					if (tallyObj.status == 2 && opt.state == 'preview') {
						return true;
					}
				}

				return false
			}
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
					]
				},
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: '00',
					choices: [
						{ id: '00', label: 'Program (PGM)' },
						{ id: '01', label: 'Preview (PVW)' },
					]
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					default: '01',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					]
				}
			],
			callback: function (feedback, bank) {
				let opt = feedback.options;

				let obj = self.DATA.find((obj) => obj.id == `data${opt.key}${opt.bus}`);

				if (obj) {
					if (obj.value == opt.onoff) {
						return true;
					}
				}

				return false
			}
		}


		self.setFeedbackDefinitions(feedbacks)
	}
}
