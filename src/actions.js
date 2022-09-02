module.exports = {
	// ##########################
	// #### Instance Actions ####
	// ##########################
	setActions: function () {
		let self = this;
		let actions = {};

		actions.run_macro = {
			label: 'Run Macro',
			options:
			[
				{
					type: 'number',
					label: 'Macro',
					id: 'macro',
					tooltip: '(1-100)',
					min: 1,
					max: 100,
					default: 1,
					step: 1,
					required: true,
					range: false
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let macro = options.macro;
				let macroZero = macro - 1;
				let value = macroZero.toString(16).padStart(2, '0').toUpperCase();

				let address = '500504';
				self.sendCommand(address, value);
			}
		}

		actions.input_assign = {
			label: 'Assign Input',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input Channel',
					id: 'input',
					default: self.CHOICES_INPUTS[0].id,
					choices: self.CHOICES_INPUTS
				},
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_INPUTSASSIGN[0].id,
					choices: self.CHOICES_INPUTSASSIGN
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '00' + options.input.toString(16).padStart(2, '0').toUpperCase();
				let value = options.assign.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.output_assign = {
			label: 'Assign Output',
			options:
			[
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: self.CHOICES_OUTPUTS[0].id,
					choices: self.CHOICES_OUTPUTS
				},
				{
					type: 'dropdown',
					label: 'Type',
					id: 'assign',
					default: self.CHOICES_OUTPUTSASSIGN[0].id,
					choices: self.CHOICES_OUTPUTSASSIGN
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00';
				
				if (options.output === 16) { //USB OUTPUT
					address += '01' + options.output.toString(16).padStart(2, '0').toUpperCase();
				}
				else {
					address += '00' + options.output.toString(16).padStart(2, '0').toUpperCase();
				}

				let value = options.assign.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.aux_assign = {
			label: 'Assign Aux',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_INPUTSASSIGN[0].id,
					choices: self.CHOICES_INPUTSASSIGN
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '00' + '11';

				let value = options.assign.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.pnpkey_enable = {
			label: 'PnP & Key Enable/Disable',
			options:
			[
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: self.CHOICES_PINPDSK[0].id,
					choices: self.CHOICES_PINPDSK
				},
				{
					type: 'dropdown',
					label: 'Enable/Disable',
					id: 'enable',
					default: 1,
					choices: [
						{ id: 0, label: 'Disable'},
						{ id: 1, label: 'Enable'}
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '00' + options.pinp.toString(16).padStart(2, '0').toUpperCase();

				let value = options.enable.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_transition_time = {
			label: 'Set Transition Time',
			options:
			[
				{
					type: 'dropdown',
					label: 'Transition Type',
					id: 'type',
					default: self.CHOICES_TRANSITION_TIME_TYPES[0].id,
					choices: self.CHOICES_TRANSITION_TIME_TYPES
				},
				{
					type: 'number',
					label: 'Transition Time',
					id: 'time',
					tooltip: '(0.0-4.0)',
					min: 0.0,
					max: 4.0,
					default: 1.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = options.type;

				let time = options.time * 10;

				let value = time.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_transition_type = {
			label: 'Set Transition Type',
			options:
			[
				{
					type: 'dropdown',
					label: 'Transition Type',
					id: 'type',
					default: self.CHOICES_TRANSITION_TYPES[0].id,
					choices: self.CHOICES_TRANSITION_TYPES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '18' + '00';

				let value = options.type.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_mix_type = {
			label: 'Set Mix Type',
			options:
			[
				{
					type: 'dropdown',
					label: 'Mix Type',
					id: 'type',
					default: self.CHOICES_MIX_TYPES[0].id,
					choices: self.CHOICES_MIX_TYPES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '18' + '01';

				let value = options.type.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_wipe_type = {
			label: 'Set Wipe Type',
			options:
			[
				{
					type: 'dropdown',
					label: 'Wipe Type',
					id: 'type',
					default: self.CHOICES_WIPE_TYPES[0].id,
					choices: self.CHOICES_WIPE_TYPES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '18' + '02';

				let value = options.type.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_wipe_direction = {
			label: 'Set Wipe Direction',
			options:
			[
				{
					type: 'dropdown',
					label: 'Wipe Direction',
					id: 'direction',
					default: self.CHOICES_WIPE_DIRECTIONS[0].id,
					choices: self.CHOICES_WIPE_DIRECTIONS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '18' + '03';

				let value = options.type.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.press_and_release_switch = {
			label: 'Press and Release Panel Switch',
			options:
			[
				{
					type: 'dropdown',
					label: 'Switch',
					id: 'switch',
					default: self.CHOICES_SWITCHES[0].id,
					choices: self.CHOICES_SWITCHES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				self.sendCommand(options.switch, '01');
				setTimeout(function() {
					self.sendCommand(options.switch, '00');
				}, 200);
			}
		};

		actions.press_switch = {
			label: 'Press Panel Switch (Don\'t Release)',
			options:
			[
				{
					type: 'dropdown',
					label: 'Switch',
					id: 'switch',
					default: self.CHOICES_SWITCHES[0].id,
					choices: self.CHOICES_SWITCHES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				self.sendCommand(options.switch, '01');
			}
		};

		actions.release_switch = {
			label: 'Release Panel Switch',
			options:
			[
				{
					type: 'dropdown',
					label: 'Switch',
					id: 'switch',
					default: self.CHOICES_SWITCHES[0].id,
					choices: self.CHOICES_SWITCHES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				self.sendCommand(options.switch, '00');
			}
		};

		actions.set_pinp_source = {
			label: 'Set PnP & Key Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: self.CHOICES_PINP_KEYS[0].id,
					choices: self.CHOICES_PINP_KEYS
				},
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_INPUTSASSIGN[0].id,
					choices: self.CHOICES_INPUTSASSIGN
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + options.pinp.toString(16).padStart(2, '0').toUpperCase() + '02';
				let value = options.assign.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_pinp_type = {
			label: 'Set PnP & Key Type',
			options:
			[
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: self.CHOICES_PINP_KEYS[0].id,
					choices: self.CHOICES_PINP_KEYS
				},
				{
					type: 'dropdown',
					label: 'Key Type',
					id: 'key',
					default: self.CHOICES_PINP_TYPES[0].id,
					choices: self.CHOICES_PINP_TYPES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + options.pinp.toString(16).padStart(2, '0').toUpperCase() + '03';
				let value = options.key.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_dsk_key_source = {
			label: 'Set DSK Key Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'DSK',
					id: 'dsk',
					default: self.CHOICES_DSK[0].id,
					choices: self.CHOICES_DSK
				},
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_INPUTSASSIGN[0].id,
					choices: self.CHOICES_INPUTSASSIGN
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + options.dsk.toString(16).padStart(2, '0').toUpperCase() + '03';
				let value = options.assign.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_dsk_fill_source = {
			label: 'Set DSK Fill Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'DSK',
					id: 'dsk',
					default: self.CHOICES_DSK[0].id,
					choices: self.CHOICES_DSK
				},
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_INPUTSASSIGN[0].id,
					choices: self.CHOICES_INPUTSASSIGN
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + options.dsk.toString(16).padStart(2, '0').toUpperCase() + '04';
				let value = options.assign.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.set_dsk_type = {
			label: 'Set DSK Key Type',
			options:
			[
				{
					type: 'dropdown',
					label: 'DSK',
					id: 'dsk',
					default: self.CHOICES_DSK[0].id,
					choices: self.CHOICES_DSK
				},
				{
					type: 'dropdown',
					label: 'Key Type',
					id: 'key',
					default: self.CHOICES_DSK_TYPES[0].id,
					choices: self.CHOICES_DSK_TYPES
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + options.dsk.toString(16).padStart(2, '0').toUpperCase() + '05';
				let value = options.key.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.select_pgm = {
			label: 'Select PGM Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: self.CHOICES_INPUTS[0].id,
					choices: self.CHOICES_INPUTS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '21' + '00';
				let value = options.input.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.select_pvw = {
			label: 'Select PVW Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: self.CHOICES_INPUTS[0].id,
					choices: self.CHOICES_INPUTS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '21' + '01';
				let value = options.input.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.load_memory_trigger = {
			label: 'Load Memory Trigger',
			options:
			[
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'memory',
					default: self.CHOICES_MEMORY[0].id,
					choices: self.CHOICES_MEMORY
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '0A' + '00' + '00';
				let value = options.memory.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.save_memory_trigger = {
			label: 'Save Memory Trigger',
			options:
			[
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'memory',
					default: self.CHOICES_MEMORY[0].id,
					choices: self.CHOICES_MEMORY
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '0A' + '00' + '01';
				let value = options.memory.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.initialize_memory_trigger = {
			label: 'Initialize Memory Trigger',
			options:
			[
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'memory',
					default: self.CHOICES_MEMORY[0].id,
					choices: self.CHOICES_MEMORY
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '0A' + '00' + '02';
				let value = options.memory.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		return actions
	}
}