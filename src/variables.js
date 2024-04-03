module.exports = {
	initVariables: function () {
		let self = this;
		let variables = [];

		variables.push({ variableId: 'model', name: 'Model' });
		variables.push({ variableId: 'version', name: 'Version' });

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			variables.push({ variableId: 'tally_' + self.TALLYDATA[i].shortlabel, name: self.TALLYDATA[i].label + ' Tally' });
		}

		/*
		{ id: '1B', label: 'PnP/Key 1' },
						{ id: '1C', label: 'PnP/Key 2' },
						{ id: '1D', label: 'PnP/Key 3' },
						{ id: '1E', label: 'PnP/Key 4' },
						*/

		variables.push({ variableId: 'data_1B00', name: 'PnP/Key 1 on PGM' });
		variables.push({ variableId: 'data_1B01', name: 'PnP/Key 1 on PVW' });
		variables.push({ variableId: 'data_1C00', name: 'PnP/Key 2 on PGM' });
		variables.push({ variableId: 'data_1C01', name: 'PnP/Key 2 on PVW' });
		variables.push({ variableId: 'data_1D00', name: 'PnP/Key 3 on PGM' });
		variables.push({ variableId: 'data_1D01', name: 'PnP/Key 3 on PVW' });
		variables.push({ variableId: 'data_1E00', name: 'PnP/Key 4 on PGM' });
		variables.push({ variableId: 'data_1E01', name: 'PnP/Key 4 on PVW' });

		self.setVariableDefinitions(variables);
	},

	checkVariables: function () {
		let self = this;

		try {
			let variableObj = {};

			variableObj.model = self.MODEL;
			variableObj.version = self.VERSION;

			for (let i = 0; i < self.TALLYDATA.length; i++) {
				let state = 'Off';

				if (self.TALLYDATA[i].status == 1 || self.TALLYDATA[i].status == 3) {
					state = 'Program';
				}
				else if (self.TALLYDATA[i].status == 2) {
					state = 'Preview';
				}

				variableObj['tally_' + self.TALLYDATA[i].shortlabel] = state;
			}

			//PnP/Keys
			variableObj.data_1B00 = self.DATA.data_1B00 == '01' ? 'On' : 'Off';
			variableObj.data_1B01 = self.DATA.data_1B01 == '01' ? 'On' : 'Off';
			variableObj.data_1C00 = self.DATA.data_1C00 == '01' ? 'On' : 'Off';
			variableObj.data_1C01 = self.DATA.data_1C01 == '01' ? 'On' : 'Off';
			variableObj.data_1D00 = self.DATA.data_1D00 == '01' ? 'On' : 'Off';
			variableObj.data_1D01 = self.DATA.data_1D01 == '01' ? 'On' : 'Off';
			variableObj.data_1E00 = self.DATA.data_1E00 == '01' ? 'On' : 'Off';
			variableObj.data_1E01 = self.DATA.data_1E01 == '01' ? 'On' : 'Off';

			self.setVariableValues(variableObj);
		}
		catch(error) {
			self.log('error', 'Error setting Variables from Device: ' + String(error));
		}
	}
}