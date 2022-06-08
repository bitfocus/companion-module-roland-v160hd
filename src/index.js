// Roland-xs84h

var instance_skel = require('../../../instance_skel');

var tcp = require('../../../tcp');

var actions = require('./actions.js')
var feedbacks = require('./feedbacks.js')
var variables = require('./variables.js')
var presets = require('./presets.js')

var debug;
var log;

function instance(system, id, config) {
	let self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	return self;
}

instance.prototype.INTERVAL = null; //used for polling device for feedbacks
instance.prototype.RATE = 1000; //polling rate

instance.prototype.MODEL = 'V-160HD';
instance.prototype.VERSION = '';

instance.prototype.TALLYDATA = [
	{ id: 0, label: 'HDMI 1', shortlabel: 'hdmi1', status: 0},
	{ id: 1, label: 'HDMI 2', shortlabel: 'hdmi2', status: 0},
	{ id: 2, label: 'HDMI 3', shortlabel: 'hdmi3', status: 0},
	{ id: 3, label: 'HDMI 4', shortlabel: 'hdmi4', status: 0},
	{ id: 4, label: 'HDMI 5', shortlabel: 'hdmi5', status: 0},
	{ id: 5, label: 'HDMI 6', shortlabel: 'hdmi6', status: 0},
	{ id: 6, label: 'HDMI 7', shortlabel: 'hdmi7', status: 0},
	{ id: 7, label: 'HDMI 8', shortlabel: 'hdmi8', status: 0},
	{ id: 8, label: 'SDI 1',  shortlabel: 'sdi1',  status: 0},
	{ id: 9, label: 'SDI 2',  shortlabel: 'sdi2',  status: 0},
	{ id: 10, label: 'SDI 3', shortlabel: 'sdi3',  status: 0},
	{ id: 11, label: 'SDI 4', shortlabel: 'sdi4',  status: 0},
	{ id: 12, label: 'SDI 5', shortlabel: 'sdi5',  status: 0},
	{ id: 13, label: 'SDI 6', shortlabel: 'sdi6',  status: 0},
	{ id: 14, label: 'SDI 7', shortlabel: 'sdi7',  status: 0},
	{ id: 15, label: 'SDI 8', shortlabel: 'sdi8',  status: 0}
];

instance.prototype.CHOICES_INPUTS = [
	{ id: 0, label: 'Input 1' },
	{ id: 1, label: 'Input 2' },
	{ id: 2, label: 'Input 3' },
	{ id: 3, label: 'Input 4' },
	{ id: 4, label: 'Input 5' },
	{ id: 5, label: 'Input 6' },
	{ id: 6, label: 'Input 7' },
	{ id: 7, label: 'Input 8' },
	{ id: 8, label: 'Input 9' },
	{ id: 9, label: 'Input 10' }
];

instance.prototype.CHOICES_INPUTSASSIGN = [
	{ id: 0, label: 'HDMI 1' },
	{ id: 1, label: 'HDMI 2' },
	{ id: 2, label: 'HDMI 3' },
	{ id: 3, label: 'HDMI 4' },
	{ id: 4, label: 'HDMI 5' },
	{ id: 5, label: 'HDMI 6' },
	{ id: 6, label: 'HDMI 7' },
	{ id: 7, label: 'HDMI 8' },
	{ id: 8, label: 'SDI 1' },
	{ id: 9, label: 'SDI 2' },
	{ id: 10, label: 'SDI 3' },
	{ id: 11, label: 'SDI 4' },
	{ id: 12, label: 'SDI 5' },
	{ id: 13, label: 'SDI 6' },
	{ id: 14, label: 'SDI 7' },
	{ id: 15, label: 'SDI 8' },
	{ id: 16, label: 'Still 1' },
	{ id: 17, label: 'Still 2' },
	{ id: 18, label: 'Still 3' },
	{ id: 19, label: 'Still 4' },
	{ id: 20, label: 'Still 5' },
	{ id: 21, label: 'Still 6' },
	{ id: 22, label: 'Still 7' },
	{ id: 23, label: 'Still 8' },
	{ id: 24, label: 'Still 9' },
	{ id: 25, label: 'Still 10' },
	{ id: 26, label: 'Still 11' },
	{ id: 27, label: 'Still 12' },
	{ id: 28, label: 'Still 13' },
	{ id: 29, label: 'Still 14' },
	{ id: 30, label: 'Still 15' },
	{ id: 31, label: 'Still 16' }
];

instance.prototype.CHOICES_OUTPUTS = [
	{ id: 10, label: 'HDMI Output 1' },
	{ id: 11, label: 'HDMI Output 2' },
	{ id: 12, label: 'HDMI Output 3' },
	{ id: 13, label: 'SDI Output 1' },
	{ id: 14, label: 'SDI Output 2' },
	{ id: 15, label: 'SDI Output 3' },
	{ id: 16, label: 'USB Output' },
];

instance.prototype.CHOICES_OUTPUTSASSIGN = [
	{ id: 0, label: 'Program' },
	{ id: 1, label: 'Sub Program' },
	{ id: 2, label: 'Preview' },
	{ id: 3, label: 'Aux' },
	{ id: 4, label: 'Multi-View' },
	{ id: 5, label: '16 Input-View' },
	{ id: 6, label: '16 Still-View' },
];

instance.prototype.CHOICES_PINP = [
	{ id: 18, label: 'Program Layer PinP & Key 1' },
	{ id: 19, label: 'Program Layer PinP & Key 2' },
	{ id: 20, label: 'Program Layer PinP & Key 3' },
	{ id: 21, label: 'Program Layer PinP & Key 4' }
];

instance.prototype.CHOICES_DSK = [
	{ id: 22, label: 'Program Layer DSK 1' },
	{ id: 23, label: 'Program Layer DSK 2' },
]

instance.prototype.CHOICES_SUBPINP = [
	{ id: 24, label: 'Sub Program Layer PinP & Key 1' },
	{ id: 25, label: 'Sub Program Layer PinP & Key 2' },
	{ id: 26, label: 'Sub Program Layer PinP & Key 3' },
	{ id: 27, label: 'Sub Program Layer PinP & Key 4' }
];

instance.prototype.CHOICES_SUBDSK = [
	{ id: 28, label: 'Sub Program Layer DSK 1' },
	{ id: 29, label: 'Sub Program Layer DSK 2' },
];

instance.prototype.CHOICES_TRANSITION_TYPES = [
	{ id: 0, label: 'Mix' },
	{ id: 1, label: 'Wipe' }
];

instance.prototype.CHOICES_MIX_TYPES = [
	{ id: 0, label: 'Mix' },
	{ id: 1, label: 'Fam' },
	{ id: 2, label: 'Nam' }
];

instance.prototype.CHOICES_WIPE_TYPES = [
	{ id: 0, label: 'Horizontal' },
	{ id: 1, label: 'Vertical' },
	{ id: 2, label: 'Upper Left' },
	{ id: 3, label: 'Upper Right' },
	{ id: 4, label: 'Lower Left' },
	{ id: 5, label: 'Lower Right' },
	{ id: 6, label: 'H-Center' },
	{ id: 7, label: 'V-Center' }
];

instance.prototype.CHOICES_WIPE_DIRECTIONS = [
	{ id: 0, label: 'Normal' },
	{ id: 1, label: 'Reverse' },
	{ id: 2, label: 'Round Trip' }
];

instance.prototype.CHOICES_PINP_KEYS = [
	{ id: 27, label: 'PinP & Key 1' },
	{ id: 28, label: 'PinP & Key 2' },
	{ id: 29, label: 'PinP & Key 3' },
	{ id: 30, label: 'PinP & Key 4' }
];

instance.prototype.CHOICES_PINP_TYPES = [
	{ id: 0, label: 'PinP' },
	{ id: 1, label: 'Luminance-White Key' },
	{ id: 2, label: 'Luminance-Black Key' },
	{ id: 3, label: 'Chroma Key' },
];

instance.prototype.CHOICES_DSK = [
	{ id: 31, label: 'DSK 1' },
	{ id: 32, label: 'DSK 2' }
];

instance.prototype.CHOICES_DSK_TYPES = [
	{ id: 0, label: 'Luminance-White Key' },
	{ id: 1, label: 'Luminance-Black Key' },
	{ id: 2, label: 'Chroma Key' },
];

instance.prototype.CHOICES_MEMORY = [
	{ id: 0, label: 'Memory 1' },
	{ id: 1, label: 'Memory 2' },
	{ id: 2, label: 'Memory 3' },
	{ id: 3, label: 'Memory 4' },
	{ id: 4, label: 'Memory 5' },
	{ id: 5, label: 'Memory 6' },
	{ id: 6, label: 'Memory 7' },
	{ id: 7, label: 'Memory 8' },
	{ id: 8, label: 'Memory 9' },
	{ id: 9, label: 'Memory 10' },
	{ id: 10, label: 'Memory 11' },
	{ id: 11, label: 'Memory 12' },
	{ id: 12, label: 'Memory 13' },
	{ id: 13, label: 'Memory 14' },
	{ id: 14, label: 'Memory 15' },
	{ id: 15, label: 'Memory 16' },
	{ id: 16, label: 'Memory 17' },
	{ id: 17, label: 'Memory 18' },
	{ id: 18, label: 'Memory 19' },
	{ id: 19, label: 'Memory 20' },
	{ id: 20, label: 'Memory 21' },
	{ id: 21, label: 'Memory 22' },
	{ id: 22, label: 'Memory 23' },
	{ id: 23, label: 'Memory 24' },
	{ id: 24, label: 'Memory 25' },
	{ id: 25, label: 'Memory 26' },
	{ id: 26, label: 'Memory 27' },
	{ id: 27, label: 'Memory 28' },
	{ id: 28, label: 'Memory 29' },
	{ id: 29, label: 'Memory 30' }
];

instance.prototype.init = function() {
	let self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();

	self.init_actions();
	self.init_feedbacks();
	self.init_variables();
	self.init_presets();

	self.checkFeedbacks();
	self.checkVariables();
}

instance.prototype.updateConfig = function(config) {
	let self = this;

	self.config = config;
	self.init_tcp();

	self.init_actions();
	self.init_feedbacks();
	self.init_variables();
	self.init_presets();

	self.checkFeedbacks();
	self.checkVariables();
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	let self = this;

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will connect to a Roland V-160HD.'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 6,
			default: '192.168.0.1',
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	let self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	clearInterval(self.INTERVAL);

	debug('destroy', self.id);
}

instance.prototype.init_tcp = function() {
	let self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.port === undefined) {
		self.config.port = 8023;
	}

	if (self.config.host) {
		self.log('info', `Opening connection to ${self.config.host}:${self.config.port}`);

		self.socket = new tcp(self.config.host, self.config.port);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug('Network error', err);
			clearInterval(self.INTERVAL);
			self.handleError(err);
		});

		self.socket.on('connect', function () {
			debug('Connected');
			self.status(self.STATUS_OK);
			self.requestData('VER');
			self.startInterval();
		});

		self.socket.on('data', function(buffer) {
			let indata = buffer.toString('utf8');
			//update feedbacks and variables
			self.updateData(indata);
		});

	}
};

instance.prototype.handleError = function(err) {
	let self = this;

	let error = err.toString();
	let printedError = false;

	Object.keys(err).forEach(function(key) {
		if (key === 'code') {
			if (err[key] === 'ECONNREFUSED') {
				error = 'Unable to communicate with Device. Connection refused. Is this the right IP address? Is it still online?';
				self.log('error', error);
				self.status(self.STATUS_ERROR);
				printedError = true;
				if (self.socket !== undefined) {
					self.socket.destroy();
				}
			}
			else if (err[key] === 'ETIMEDOUT') {
				error = 'Unable to communicate with Device. Connection timed out. Is this the right IP address? Is it still online?';
				self.log('error', error);
				self.status(self.STATUS_ERROR);
				printedError = true;
				if (self.socket !== undefined) {
					self.socket.destroy();
				}
			}
		}
	});

	if (!printedError) {
		self.log('error', `Error: ${error}`);
	}
};

instance.prototype.startInterval = function() {
	let self = this;

	self.log('info', `Starting Update Interval: Fetching new data from Device every ${self.RATE}ms.`);
	self.INTERVAL = setInterval(self.getData.bind(this), self.RATE);
}

instance.prototype.getData = function() {
	let self = this;

	self.getTallyData();
}

instance.prototype.getTallyData = function() {
	let self = this;

	for (let i = 0; i < 16; i++) {
		let command = '0C' + '00' + i.toString(16);
		self.requestData(command);
	}
}

instance.prototype.updateData = function(data) {
	let self = this;

	//do stuff with the data
	try {
		if (data.indexOf(';')) {
			let dataGroups = data.trim().split(';');
			for (let j = 0; j < dataGroups.length; j++) {
				dataGroups[j] = dataGroups[j].trim();
				if (dataGroups[j] !== 'ACK' && dataGroups[j] !== '') {
					let dataSet = dataGroups[j].trim().split(':');
					let dataPrefix = dataSet[0].toString().trim();
					let dataSuffix = dataSet[1].toString().split(',');

					if (dataPrefix.indexOf('VER') > -1) {
						self.MODEL = dataSuffix[0].toString();
						self.VERSION = dataSuffix[1].toString();
					}
	
					if (dataPrefix.indexOf('DTH') > -1) {
						if (dataSuffix[0].length === 6) {
							let params = dataSuffix[0];
							let param1 = params[0] + params[1];
							let param2 = params[2] + params[3];
							let param3 = params[4] + params[5];
	
							let value = dataSuffix[1];
	
							if (param1 == 'OC' && param2 == '00') { //tally message
								self.updateTally(param3, value);
							}
						}
					}
				}			
			}
		
			//now update feedbacks and variables
			self.checkFeedbacks();
			self.checkVariables();
		}
	}
	catch(error) {
		self.log('error', 'Error parsing incoming data: ' + error);
	}
};

instance.prototype.updateTally = function(input, value) {
	let self = this;

	let tallyId = parseInt(input, 16);

	for (let i = 0; i < self.TALLYDATA.length; i++) {
		if (self.TALLYDATA[i].id == tallyId) {
			self.TALLYDATA[i].status = parseInt(value, 16);
		}
	}
}

// ##########################
// #### Instance Actions ####
// ##########################
instance.prototype.init_actions = function (system) {
	this.setActions(actions.setActions.bind(this)());
};

// ############################
// #### Instance Feedbacks ####
// ############################
instance.prototype.init_feedbacks = function (system) {
	this.setFeedbackDefinitions(feedbacks.setFeedbacks.bind(this)());
};

// ############################
// #### Instance Variables ####
// ############################
instance.prototype.init_variables = function () {
	this.setVariableDefinitions(variables.setVariables.bind(this)());
};

// Setup Initial Values
instance.prototype.checkVariables = function () {
	variables.checkVariables.bind(this)();
};

// ##########################
// #### Instance Presets ####
// ##########################
instance.prototype.init_presets = function () {
	this.setPresetDefinitions(presets.setPresets.bind(this)());
};

instance.prototype.sendCommand = function(address, value) {
	let self = this;

	let cmd = 'DTH:' + address + ',' + value + ';'

	debug('Sending:');
	debug(cmd);

	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(cmd);
	}
	else {
		debug('Socket not connected :(');
	}
};

instance.prototype.requestData = function(command) {
	let self = this;

	let cmd = 'RQH:' + command + ';'

	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(cmd);
	}
	else {
		debug('Socket not connected :(');
	}
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;