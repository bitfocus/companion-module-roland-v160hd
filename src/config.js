const { Regex } = require('@companion-module/base')

module.exports = {
	getConfigFields() {
		let self = this

		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module will connect to a Roland V-160HD.',
			},
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: ' ',
				value: `<strong>PLEASE READ:</strong>
						<br />
						To configure this module, you need to:
						<ul>
							<li>Enter the Target IP of the Roland Device</li>
							<li>Configure a Password/Passcode on the Roland Device, otherwise certain actions may not work.</li>
							<li>Click "Save" to save the module config.</li>
						</ul>
				`,
			},
			{
				type: 'static-text',
				id: 'hr1',
				width: 12,
				label: ' ',
				value: '<hr />',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'IP Address',
				width: 6,
				default: '192.168.0.1',
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6,
				default: '0000',
			},
			{
				type: 'static-text',
				id: 'info2',
				label: 'Polling',
				width: 12,
				value: `
						Enabling polling unlocks these features:
						<br><br>
						<ul>
							<li>Current Tally State(s)</li>
							<li>Current PnP/Key On Air State(s)</li>
						</ul>
						Enabling polling will send a request to the Device at a continuous interval.
						<br>
						<strong>This could have an undesired performance effect on your Device, depending on the polling rate.</strong>
						<br>
				`,
			},
			{
				type: 'checkbox',
				id: 'polling',
				label: 'Enable Polling (necessary for feedbacks and variables)',
				default: false,
				width: 3,
			},
			{
				type: 'textinput',
				id: 'pollingrate',
				label: 'Polling Rate (in ms)',
				default: 1000,
				width: 3,
				isVisible: (configValues) => configValues.polling === true,
			},
			{
				type: 'static-text',
				id: 'hr1',
				width: 12,
				label: ' ',
				value: '<hr />',
			},
			{
				type: 'checkbox',
				id: 'verbose',
				label: 'Enable Verbose Logging',
				default: false,
				width: 3,
			},
			{
				type: 'static-text',
				id: 'info3',
				width: 9,
				label: ' ',
				value: `Enabling Verbose Logging will push all incoming and outgoing data to the log, which is helpful for debugging.`,
			},
		]
	},
}
