module.exports = {
	initActions: function () {
		let self = this;
		let actions = {};

		actions.run_macro = {
			name: 'Run Macro',
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
			name: 'Assign Input',
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
			name: 'Assign Output',
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
			name: 'Assign Aux',
			options:
			[
				{
					type: 'dropdown',
					label: 'Aux',
					id: 'aux',
					default: '000011',
					choices: [
						{ id: '000011', label: 'Aux 1' },
						{ id: '00002E', label: 'Aux 2' },
						{ id: '00002F', label: 'Aux 3' },
					]
				},
				{
					type: 'dropdown',
					label: 'Input Type',
					id: 'assign',
					default: self.CHOICES_PGMPVW_SELECT[0].id,
					choices: self.CHOICES_PGMPVW_SELECT
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = options.aux

				let value = options.assign;
				self.sendCommand(address, value);
			}
		};

		actions.pnpkey_enable = {
			name: 'PnP & Key Enable/Disable',
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

		actions.pnpkey_busselect = {
			name: 'PnP & Key Bus Select',
			options:
			[
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
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}${options.bus}`;
				let value = options.onoff
				self.sendCommand(address, value);
			}
		};

		actions.pnpkey_setsource = {
			name: 'PnP & Key Set Source',
			options:
			[
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
					label: 'Source',
					id: 'source',
					default: self.CHOICES_PGMPVW_SELECT[0].id,
					choices: self.CHOICES_PGMPVW_SELECT
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}02`;
				let value = options.source
				self.sendCommand(address, value);
			}
		};

		actions.pnpkey_settype = {
			name: 'PnP & Key Set Type',
			options:
			[
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
					label: 'Type',
					id: 'type',
					default: '00',
					choices: [
						//PinP, LUMINANCE-WHITE KEY, LUMINANCE-BLACK KEY, CHROMA KEY
						{ id: '00', label: 'PinP' },
						{ id: '01', label: 'Luminance-White Key' },
						{ id: '02', label: 'Luminance-Black Key' },
						{ id: '03', label: 'Chroma Key' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}03`;
				let value = options.type
				self.sendCommand(address, value);
			}
		};

		actions.pnpkey_positionH = {
			name: 'PnP & Key Position Horizontal',
			options:
			[
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
					type: 'number',
					label: 'Position',
					id: 'position',
					tooltip: '(-100.0 - 0.0 - 100.0)',
					min: -100,
					max: 100,
					default: 50.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				//split the number into two bytes and send two commands
				
				// Decimal value
				let decimalValue = options.position * 10; // shift the decimal point one place to the right
				// Convert decimal to hexadecimal
				let hexadecimalValue = decimalValue.toString(16).toUpperCase();

				// Convert hexadecimal string to a 32-bit signed integer
				let signedInt32 = parseInt(hexadecimalValue, 16) | 0;

				// Extract lower 16 bits
				let lower16Bits = signedInt32 & 0xFFFF;

				// Convert back to hexadecimal
				let truncatedHex = lower16Bits.toString(16).toUpperCase();

				console.log(truncatedHex);



				
				self.sendCommand(address + '04', value1);
				self.sendCommand(address + '05', value2);
			}
		};

		actions.pnpkey_positionV = {
			name: 'PnP & Key Position Vertical',
			options:
			[
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
					type: 'number',
					label: 'Position',
					id: 'position',
					tooltip: '(-100.0 - 0.0 - 100.0)',
					min: -100,
					max: 100,
					default: 50.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				//split the number into two bytes and send two commands
				//the range is: -100.0 to 0.0
				//-100.0 is 0x78 0x18
				//0.0 is 0x00 0x00

				self.sendCommand(address + '06', value1);
				self.sendCommand(address + '07', value2);
			}
		};

		actions.pnpkey_size = {
			name: 'PnP & Key Size',
			options:
			[
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
					type: 'number',
					label: 'Size',
					id: 'size',
					tooltip: '(10.0 - 100.0)',
					min: 10.0,
					max: 100.0,
					default: 50.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				
				
				self.sendCommand(address + '08', value1);
				self.sendCommand(address + '09', value2);
			}
		};

		actions.pnpkey_croppingH = {
			name: 'PnP & Key Cropping Horizontal',
			options:
			[
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
					type: 'number',
					label: 'Cropping',
					id: 'cropping',
					tooltip: '(0.0 - 100.0)',
					min: 0.0,
					max: 100.0,
					default: 0.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				//split the number into two bytes and send two commands
				self.sendCommand(address + '0A', value1);
				self.sendCommand(address + '0B', value2);
			}
		};

		actions.pnpkey_croppingV = {
			name: 'PnP & Key Cropping Vertical',
			options:
			[
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
					type: 'number',
					label: 'Cropping',
					id: 'cropping',
					tooltip: '(0.0 - 100.0)',
					min: 0.0,
					max: 100.0,
					default: 0.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				//split the number into two bytes and send two commands
				self.sendCommand(address + '0C', value1);
				self.sendCommand(address + '0D', value2);
			}
		};

		actions.pnpkey_shape = {
			name: 'PnP & Key Shape',
			options:
			[
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
					label: 'Shape',
					id: 'shape',
					default: '00',
					choices: [
						{ id: '00', label: 'Rectangle' },
						{ id: '01', label: 'Circle' },
						{ id: '02', label: 'Diamond' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.shape
				self.sendCommand(address + '0E', value);
			}
		};

		actions.pnpkey_borderColor = {
			name: 'PnP & Key Border Color',
			options:
			[
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
					label: 'Border Color',
					id: 'color',
					default: '00',
					choices: [
						{ id: '00', label: 'White' },
						{ id: '01', label: 'Yellow' },
						{ id: '02', label: 'Cyan' },
						{ id: '03', label: 'Green' },
						{ id: '04', label: 'Magenta' },
						{ id: '05', label: 'Red' },
						{ id: '06', label: 'Blue' },
						{ id: '07', label: 'Black' },
						{ id: '08', label: 'Custom' },
						{ id: '09', label: 'Soft Edge' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.color
				self.sendCommand(address + '0F', value);
			}
		};

		actions.pnpkey_borderWidth = {
			name: 'PnP & Key Border Width',
			options:
			[
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
					type: 'number',
					label: 'Border Width',
					id: 'width',
					tooltip: '0-14',
					min: 0,
					max: 14,
					default: 5,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				let value = options.width.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address + '10', value);
			}
		};

		actions.pnpkey_viewPositionH = {
			name: 'PnP & Key View Position Horizontal',
			options:
			[
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
					type: 'number',
					label: 'Position',
					id: 'position',
					tooltip: '(-50.0 - 0.0 - 50.0)',
					min: -50.0,
					max: 50,
					default: 0.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				//split the number into two bytes and send two commands
				self.sendCommand(address + '11', value1);
				self.sendCommand(address + '12', value2);
			}
		};

		actions.pnpkey_viewPositionV = {
			name: 'PnP & Key View Position Vertical',
			options:
			[
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
					type: 'number',
					label: 'Position',
					id: 'position',
					tooltip: '(-50.0 - 0.0 - 50.0)',
					min: -50.0,
					max: 50,
					default: 0.0,
					step: 0.1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				//split the number into two bytes and send two commands
				self.sendCommand(address + '13', value1);
				self.sendCommand(address + '14', value2);
			}
		};

		actions.pnpkey_viewZoom = {
			name: 'PnP & Key View Zoom',
			options:
			[
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
					type: 'number',
					label: 'Zoom',
					id: 'zoom',
					tooltip: '(100%- 400%)',
					min: 100,
					max: 400,
					default: 100,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				self.sendCommand(address + '15', value1);
				self.sendCommand(address + '16', value2);
			}
		};

		actions.pnpkey_keyLevel = {
			name: 'PnP & Key Key Level',
			options:
			[
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
					type: 'number',
					label: 'Level',
					id: 'level',
					tooltip: '(0-255)',
					min: 0,
					max: 255,
					default: 50,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				self.sendCommand(address + '17', value1);
				self.sendCommand(address + '18', value2);
			}
		};

		actions.pnpkey_keyGain = {
			name: 'PnP & Key Key Gain',
			options:
			[
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
					type: 'number',
					label: 'Gain',
					id: 'gain',
					tooltip: '(0-255)',
					min: 0,
					max: 255,
					default: 50,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				self.sendCommand(address + '19', value1);
				self.sendCommand(address + '1A', value2);
			}
		};

		actions.pnpkey_mixLevel = {
			name: 'PnP & Key Mix Level',
			options:
			[
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
					type: 'number',
					label: 'Level',
					id: 'level',
					tooltip: '(0-255)',
					min: 0,
					max: 255,
					default: 50,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;

				self.sendCommand(address + '1B', value1);
				self.sendCommand(address + '1C', value2);
			}
		};

		actions.pnpkey_chromaColor = {
			name: 'PnP & Key Chroma Color',
			options:
			[
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
					label: 'Color',
					id: 'color',
					default: '00',
					choices: [
						{ id: '00', label: 'Green' },
						{ id: '01', label: 'Blue' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.color
				self.sendCommand(address + '1D', value);
			}
		};

		actions.pnpkey_hueWidth = {
			name: 'PnP & Key Hue Width',
			options:
			[
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
					type: 'number',
					label: 'Width',
					id: 'width',
					tooltip: '(-30 - 0 - +30)',
					min: -30,
					max: 30,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.width
				self.sendCommand(address + '1E', value);
			}
		};

		actions.pnpkey_hueFine = {
			name: 'PnP & Key Hue Fine',
			options:
			[
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
					type: 'number',
					label: 'Fine',
					id: 'fine',
					tooltip: '(0 - 360)',
					min: 0,
					max: 360,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.fine
				self.sendCommand(address + '1F', value1);
				self.sendCommand(address + '20', value2);
			}
		};

		actions.pnpkey_saturationWidth = {
			name: 'PnP & Key Saturation Width',
			options:
			[
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
					type: 'number',
					label: 'Width',
					id: 'width',
					tooltip: '(-127 - 0 - +127)',
					min: -127,
					max: 127,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.width
				self.sendCommand(address + '21', value1);
				self.sendCommand(address + '22', value2);
			}
		};

		actions.pnpkey_saturationFine = {
			name: 'PnP & Key Saturation Fine',
			options:
			[
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
					type: 'number',
					label: 'Fine',
					id: 'fine',
					tooltip: '(0 - 255)',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.fine
				self.sendCommand(address + '23', value1);
				self.sendCommand(address + '24', value2);
			}
		};

		actions.pnpkey_borderColorRed = {
			name: 'PnP & Key Border Color Red',
			options:
			[
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
					type: 'number',
					label: 'Red',
					id: 'red',
					tooltip: '(0 - 255)',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.red
				self.sendCommand(address + '25', value1);
				self.sendCommand(address + '26', value2);
			}
		};

		actions.pnpkey_borderColorGreen = {
			name: 'PnP & Key Border Color Green',
			options:
			[
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
					type: 'number',
					label: 'Green',
					id: 'green',
					tooltip: '(0 - 255)',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.green
				self.sendCommand(address + '27', value1);
				self.sendCommand(address + '28', value2);
			}
		};

		actions.pnpkey_borderColorBlue = {
			name: 'PnP & Key Border Color Blue',
			options:
			[
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
					type: 'number',
					label: 'Blue',
					id: 'blue',
					tooltip: '(0 - 255)',
					min: 0,
					max: 255,
					default: 0,
					step: 1,
					required: true,
					range: true
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.pinp}`;
				let value = options.blue
				self.sendCommand(address + '29', value1);
				self.sendCommand(address + '2A', value2);
			}
		};

		actions.dsk_busselect = {
			name: 'DSK Bus Select',
			options:
			[
				{
					type: 'dropdown',
					label: 'DSK',
					id: 'dsk',
					default: '1F',
					choices: [
						{ id: '1F', label: 'DSK 1' },
						{ id: '20', label: 'DSK 2' },
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
			callback: function(action, bank) {
				let options = action.options;
				let address = `00${options.dsk}${options.bus}`;
				let value = options.onoff
				self.sendCommand(address, value);
			}
		};


		actions.set_transition_time = {
			name: 'Set Transition Time',
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
			name: 'Set Transition Type',
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
			name: 'Set Mix Type',
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
			name: 'Set Wipe Type',
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
			name: 'Set Wipe Direction',
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
			name: 'Press and Release Panel Switch',
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
			name: 'Press Panel Switch (Don\'t Release)',
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
			name: 'Release Panel Switch',
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
			name: 'Set PnP & Key Source',
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
			name: 'Set PnP & Key Type',
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
			name: 'Set DSK Key Source',
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
			name: 'Set DSK Fill Source',
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
			name: 'Set DSK Key Type',
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
			name: 'Select PGM Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: self.CHOICES_PGMPVW_SELECT[0].id,
					choices: self.CHOICES_PGMPVW_SELECT
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '21' + '00';
				let value = options.input;
				self.sendCommand(address, value);
			}
		};

		actions.select_pvw = {
			name: 'Select PVW Source',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: self.CHOICES_PGMPVW_SELECT[0].id,
					choices: self.CHOICES_PGMPVW_SELECT
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '00' + '21' + '01';
				let value = options.input;
				self.sendCommand(address, value);
			}
		};

		actions.load_memory_trigger = {
			name: 'Load Memory Trigger',
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
			name: 'Save Memory Trigger',
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
			name: 'Initialize Memory Trigger',
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

		actions.freezeSwitchOn = {
			name: 'Freeze Switch On',
			options:
			[],
			callback: function(action, bank) {
				let address = '020500'
				self.sendCommand(address, '01');
			}
		};

		actions.freezeSwitchOff = {
			name: 'Freeze Switch Off',
			options:
			[],
			callback: function(action, bank) {
				let address = '020500'
				self.sendCommand(address, '00');
			}
		};

		actions.freezeSwitchType = {
			name: 'Freeze Switch Type',
			options:
			[
				{
					type: 'dropdown',
					label: 'Type',
					id: 'type',
					default: '00',
					choices: [
						{ id: '00', label: 'All' },
						{ id: '01', label: 'Select' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '020501';
				let value = options.type;
				self.sendCommand(address, value);
			}
		};

		actions.freezeSwitchSelectEnableDisable = {
			name: 'Freeze Switch Select Enable/Disable',
			options:
			[
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: '02',
					choices: [
						{ id: '02', label: 'HDMI IN 1'},
						{ id: '03', label: 'HDMI IN 2'},
						{ id: '04', label: 'HDMI IN 3'},
						{ id: '05', label: 'HDMI IN 4'},
						{ id: '06', label: 'HDMI IN 5'},
						{ id: '07', label: 'HDMI IN 6'},
						{ id: '08', label: 'HDMI IN 7'},
						{ id: '09', label: 'HDMI IN 8'},
						{ id: '0A', label: 'SDI IN 1'},
						{ id: '0B', label: 'SDI IN 2'},
						{ id: '0C', label: 'SDI IN 3'},
						{ id: '0D', label: 'SDI IN 4'},
						{ id: '0E', label: 'SDI IN 5'},
						{ id: '0F', label: 'SDI IN 6'},
						{ id: '10', label: 'SDI IN 7'},
						{ id: '11', label: 'SDI IN 8'},
					]
				},
				{
					type: 'dropdown',
					label: 'Enable/Disable',
					id: 'enable',
					default: 1,
					choices: [
						{ id: '00', label: 'Disable'},
						{ id: '01', label: 'Enable'}
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = '0205' + options.input;
				let value = options.enable;
				self.sendCommand(address, value);
			}
		};

		//Camera Control

		actions.cameraCurrentPreset = {
			name: 'Camera Current Preset',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				},
				{
					type: 'dropdown',
					label: 'Preset',
					id: 'preset',
					default: '00',
					choices: [
						{ id: '7F', label: 'None' },
						{ id: '00', label: '1' },
						{ id: '01', label: '2' },
						{ id: '02', label: '3' },
						{ id: '03', label: '4' },
						{ id: '04', label: '5' },
						{ id: '05', label: '6' },
						{ id: '06', label: '7' },
						{ id: '07', label: '8' },
						{ id: '08', label: '9' },
						{ id: '09', label: '10' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}21`;
				let value = options.preset;
				self.sendCommand(address, value);
			}
		};

		actions.cameraPanLeft = {
			name: 'Camera Pan Left',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}22`;
				self.sendCommand(address, '7F');
			}
		};

		actions.cameraPanRight = {
			name: 'Camera Pan Right',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}22`;
				self.sendCommand(address, '01');
			}
		};

		actions.cameraPanStop = {
			name: 'Camera Pan Stop',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}22`;
				self.sendCommand(address, '00');
			}
		};

		actions.cameraTiltUp = {
			name: 'Camera Tilt Up',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}23`;
				self.sendCommand(address, '01');
			}
		};

		actions.cameraTiltDown = {
			name: 'Camera Tilt Down',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}23`;
				self.sendCommand(address, '7F');
			}
		};

		actions.cameraTiltStop = {
			name: 'Camera Tilt Stop',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}23`;
				self.sendCommand(address, '00');
			}
		};

		actions.cameraPTSpeed = {
			name: 'Camera Pan/Tilt Speed',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				},
				{
					type: 'number',
					label: 'Speed',
					id: 'speed',
					tooltip: '(0-24)',
					min: 0,
					max: 24,
					default: 10,
					step: 1,
					required: true,
					range: false
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}24`;
				let value = options.speed.toString(16).padStart(2, '0').toUpperCase();
				self.sendCommand(address, value);
			}
		};

		actions.cameraZoomInFast = {
			name: 'Camera Zoom In Fast',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}25`;
				self.sendCommand(address, '02');
			}
		};

		actions.cameraZoomInSlow = {
			name: 'Camera Zoom In Slow',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}25`;
				self.sendCommand(address, '01');
			}
		};

		actions.cameraZoomOutFast = {
			name: 'Camera Zoom Out Fast',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}25`;
				self.sendCommand(address, '7E');
			}
		};

		actions.cameraZoomOutSlow = {
			name: 'Camera Zoom Out Slow',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}25`;
				self.sendCommand(address, '7F');
			}
		};

		actions.cameraZoomStop = {
			name: 'Camera Zoom Stop',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}25`;
				self.sendCommand(address, '00');
			}
		};

		actions.focus = {
			name: 'Camera Focus',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				},
				{
					type: 'dropdown',
					label: 'Focus',
					id: 'focus',
					default: '7F',
					choices: [
						{ id: '7F', label: 'Near' },
						{ id: '00', label: 'Stop' },
						{ id: '01', label: 'Far' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}26`;
				let value = options.focus;
				self.sendCommand(address, value);
			}
		};

		actions.autoFocusOn = {
			name: 'Camera Auto Focus - On',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}27`;
				self.sendCommand(address, '01');
			}
		};

		actions.autoFocusOff = {
			name: 'Camera Auto Focus - Off',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}27`;
				self.sendCommand(address, '00');
			}
		};

		actions.cameraExposure = {
			name: 'Camera Exposure',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				},
				{
					type: 'dropdown',
					label: 'Exposure',
					id: 'exposure',
					default: '00',
					choices: [
						{ id: '00', label: 'Manual' },
						{ id: '01', label: 'Auto' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}28`;
				let value = options.exposure;
				self.sendCommand(address, value);
			}
		};

		actions.cameraSetTallyChannel = {
			name: 'Camera Set Tally Channel',
			options:
			[
				{
					type: 'dropdown',
					label: 'Camera',
					id: 'camera',
					default: self.CHOICES_CAMERAS[0].id,
					choices: self.CHOICES_CAMERAS
				},
				{
					type: 'dropdown',
					label: 'Input for Tally',
					id: 'channel',
					default: '00',
					choices: [ //HDMI 1-8, SDI 1-8
						{ id: '00', label: 'HDMI 1' },
						{ id: '01', label: 'HDMI 2' },
						{ id: '02', label: 'HDMI 3' },
						{ id: '03', label: 'HDMI 4' },
						{ id: '04', label: 'HDMI 5' },
						{ id: '05', label: 'HDMI 6' },
						{ id: '06', label: 'HDMI 7' },
						{ id: '07', label: 'HDMI 8' },
						{ id: '08', label: 'SDI 1' },
						{ id: '09', label: 'SDI 2' },
						{ id: '0A', label: 'SDI 3' },
						{ id: '0B', label: 'SDI 4' },
						{ id: '0C', label: 'SDI 5' },
						{ id: '0D', label: 'SDI 6' },
						{ id: '0E', label: 'SDI 7' },
						{ id: '0F', label: 'SDI 8' },
					]
				}
			],
			callback: function(action, bank) {
				let options = action.options;
				let address = `02${options.camera}29`;
				let value = options.channel;
				self.sendCommand(address, value);
			}
		};

		self.setActionDefinitions(actions);
	}
}