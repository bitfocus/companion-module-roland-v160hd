module.exports = {
	// ##########################
	// #### Define Variables ####
	// ##########################
	setVariables: function () {
		let self = this;
		let variables = [];

		variables.push({ name: 'model', label: 'Model' });
		variables.push({ name: 'version', label: 'Version' });

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			variables.push({ name: 'tally_' + self.TALLYDATA[i].shortlabel, label: self.TALLYDATA[i].label + ' Tally' });
		}

		return variables
	},

	// #########################
	// #### Check Variables ####
	// #########################
	checkVariables: function () {
		let self = this;

		try {
			self.setVariable('model', self.MODEL);
			self.setVariable('version', self.VERSION);

			for (let i = 0; i < self.TALLYDATA.length; i++) {
				let state = 'Off';

				if (self.TALLYDATA[i].status == 1 || self.TALLYDATA[i].status == 3) {
					state = 'Program';
				}
				else if (self.TALLYDATA[i].status == 2) {
					state = 'Preview';
				}

				self.setVariable('tally_' + self.TALLYDATA[i].shortlabel, state);
			}
		}
		catch(error) {
			self.log('error', 'Error setting Variables from Device: ' + String(error));
		}
	}
}