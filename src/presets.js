'use strict'

module.exports = {
	initPresets: function () {
		let self = this
		const { combineRgb } = require('@companion-module/base')
		let presets = {}

		const white = combineRgb(255, 255, 255)
		const navy = combineRgb(0, 0, 128)

		const pipKeys = [
			{ id: '1B', n: 1 },
			{ id: '1C', n: 2 },
			{ id: '1D', n: 3 },
			{ id: '1E', n: 4 },
		]

		for (const key of pipKeys) {
			for (const src of self.CHOICES_PNPKEY_SOURCES) {
				presets[`pip${key.n}_source_${src.id}`] = {
					type: 'button',
					category: `PnP/Key ${key.n} Source`,
					name: `PnP/Key ${key.n}: ${src.label}`,
					style: {
						text: src.label,
						size: 'auto',
						color: white,
						bgcolor: navy,
					},
					steps: [
						{
							down: [
								{
									actionId: 'pnpkey_setsource',
									options: {
										pinp: key.id,
										source: src.id,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [],
				}
			}
		}

		self.setPresetDefinitions(presets)
	},
}
