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
	{ id: 15, label: 'SDI 8', shortlabel: 'sdi8',  status: 0},
	{ id: 16, label: 'STILL 1', shortlabel: 'still1',  status: 0},
	{ id: 17, label: 'STILL 2', shortlabel: 'still2',  status: 0},
	{ id: 18, label: 'STILL 3', shortlabel: 'still3',  status: 0},
	{ id: 19, label: 'STILL 4', shortlabel: 'still4',  status: 0},
	{ id: 20, label: 'STILL 5', shortlabel: 'still5',  status: 0},
	{ id: 21, label: 'STILL 6', shortlabel: 'still6',  status: 0},
	{ id: 22, label: 'STILL 7', shortlabel: 'still7',  status: 0},
	{ id: 23, label: 'STILL 8', shortlabel: 'still8',  status: 0},
	{ id: 24, label: 'STILL 9', shortlabel: 'still9',  status: 0},
	{ id: 25, label: 'STILL 10', shortlabel: 'still10',  status: 0},
	{ id: 26, label: 'STILL 11', shortlabel: 'still11',  status: 0},
	{ id: 27, label: 'STILL 12', shortlabel: 'still12',  status: 0},
	{ id: 28, label: 'STILL 13', shortlabel: 'still13',  status: 0},
	{ id: 29, label: 'STILL 14', shortlabel: 'still14',  status: 0},
	{ id: 30, label: 'STILL 15', shortlabel: 'still15',  status: 0},
	{ id: 31, label: 'STILL 16', shortlabel: 'still16',  status: 0},
	{ id: 32, label: 'XPT 1', shortlabel: 'xpt1',  status: 0},
	{ id: 33, label: 'XPT 2', shortlabel: 'xpt2',  status: 0},
	{ id: 34, label: 'XPT 3', shortlabel: 'xpt3',  status: 0},
	{ id: 35, label: 'XPT 4', shortlabel: 'xpt4',  status: 0},
	{ id: 36, label: 'XPT 5', shortlabel: 'xpt5',  status: 0},
	{ id: 37, label: 'XPT 6', shortlabel: 'xpt6',  status: 0},
	{ id: 38, label: 'XPT 7', shortlabel: 'xpt7',  status: 0},
	{ id: 39, label: 'XPT 8', shortlabel: 'xpt8',  status: 0},
	{ id: 40, label: 'XPT 9', shortlabel: 'xpt9',  status: 0},
	{ id: 41, label: 'XPT 10', shortlabel: 'xpt10',  status: 0}
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

instance.prototype.CHOICES_PINPDSK = [
	{ id: 18, label: 'Program Layer PinP & Key 1' },
	{ id: 19, label: 'Program Layer PinP & Key 2' },
	{ id: 20, label: 'Program Layer PinP & Key 3' },
	{ id: 21, label: 'Program Layer PinP & Key 4' },
	{ id: 22, label: 'Program Layer DSK 1' },
	{ id: 23, label: 'Program Layer DSK 2' },
	{ id: 24, label: 'Sub Program Layer PinP & Key 1' },
	{ id: 25, label: 'Sub Program Layer PinP & Key 2' },
	{ id: 26, label: 'Sub Program Layer PinP & Key 3' },
	{ id: 27, label: 'Sub Program Layer PinP & Key 4' },
	{ id: 28, label: 'Sub Program Layer DSK 1' },
	{ id: 29, label: 'Sub Program Layer DSK 2' }
];

instance.prototype.CHOICES_TRANSITION_TIME_TYPES = [
	{ id: '001700', label: 'Mix/Wipe Time' },
	{ id: '001701', label: 'PinP 1 Time' },
	{ id: '001702', label: 'PinP 2 Time' },
	{ id: '001703', label: 'PinP 3 Time' },
	{ id: '001704', label: 'PinP 4 Time' },
	{ id: '001705', label: 'DSK 1 Time' },
	{ id: '001706', label: 'DSK 2 Time' },
	{ id: '001707', label: 'Output Fade Time' }
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

instance.prototype.CHOICES_SWITCHES = [
	{ id: '0B0000', label: 'PGM/A 1 SW'},
	{ id: '0B0001', label: 'PGM/A 2 SW'},
	{ id: '0B0002', label: 'PGM/A 3 SW'},
	{ id: '0B0003', label: 'PGM/A 4 SW'},
	{ id: '0B0004', label: 'PGM/A 5 SW'},
	{ id: '0B0005', label: 'PGM/A 6 SW'},
	{ id: '0B0006', label: 'PGM/A 7 SW'},
	{ id: '0B0007', label: 'PGM/A 8 SW'},
	{ id: '0B0008', label: 'PGM/A 9 SW'},
	{ id: '0B0009', label: 'PGM/A 10 SW'},
	{ id: '0B000A', label: 'PST/B 1 SW'},
	{ id: '0B000B', label: 'PST/B 2 SW'},
	{ id: '0B000C', label: 'PST/B 3 SW'},
	{ id: '0B000D', label: 'PST/B 4 SW'},
	{ id: '0B000E', label: 'PST/B 5 SW'},
	{ id: '0B000F', label: 'PST/B 6 SW'},
	{ id: '0B0010', label: 'PST/B 7 SW'},
	{ id: '0B0011', label: 'PST/B 8 SW'},
	{ id: '0B0012', label: 'PST/B 9 SW'},
	{ id: '0B0013', label: 'PST/B 10 SW'},
	{ id: '0B0014', label: 'AUX 1 SW'},
	{ id: '0B0015', label: 'AUX 2 SW'},
	{ id: '0B0016', label: 'AUX 3 SW'},
	{ id: '0B0017', label: 'AUX 4 SW'},
	{ id: '0B0018', label: 'AUX 5 SW'},
	{ id: '0B0019', label: 'AUX 6 SW'},
	{ id: '0B001A', label: 'AUX 7 SW'},
	{ id: '0B001B', label: 'AUX 8 SW'},
	{ id: '0B001C', label: 'AUX 9 SW'},
	{ id: '0B001D', label: 'AUX 10 SW'},
	{ id: '0B001E', label: 'CUT SW'},
	{ id: '0B001F', label: 'AUTO SW'},
	{ id: '0B0020', label: 'TRANSITION SW'},
	{ id: '0B0021', label: 'MODE SW'},
	{ id: '0B0022', label: 'INPUT ASSIGN SW'},
	{ id: '0B0023', label: 'PGM-CENTER ENCODER'},
	{ id: '0B0024', label: 'PST-CENTER ENCODER'},
	{ id: '0B0025', label: 'SPLIT A SW'},
	{ id: '0B0026', label: 'SPLIT B SW'},
	{ id: '0B0027', label: 'AUTO MIXING'},
	{ id: '0B0028', label: 'CAPTURE SW'},
	{ id: '0B0029', label: 'USER 1 SW'},
	{ id: '0B002A', label: 'USER 2 SW'},
	{ id: '0B002B', label: 'USER 3 SW'},
	{ id: '0B002C', label: 'USER 4 SW'},
	{ id: '0B002D', label: 'PinP 1 POSITION H'},
	{ id: '0B002E', label: 'PinP 1 POSITION V'},
	{ id: '0B002F', label: 'PinP 1 SOURCE SW'},
	{ id: '0B0030', label: 'PinP 1 PVW SW'},
	{ id: '0B0031', label: 'PinP 1 PGM SW'},
	{ id: '0B0032', label: 'PinP 2 POSITION H'},
	{ id: '0B0033', label: 'PinP 2 POSITION V'},
	{ id: '0B0034', label: 'PinP 2 SOURCE SW'},
	{ id: '0B0035', label: 'PinP 2 PVW SW'},
	{ id: '0B0036', label: 'PinP 2 PGM SW'},
	{ id: '0B0037', label: 'PinP 3 POSITION H'},
	{ id: '0B0038', label: 'PinP 3 POSITION V'},
	{ id: '0B0039', label: 'PinP 3 SOURCE SW'},
	{ id: '0B003A', label: 'PinP 3 PVW SW'},
	{ id: '0B003B', label: 'PinP 3 PGM SW'},
	{ id: '0B003C', label: 'PinP 4 POSITION H'},
	{ id: '0B003D', label: 'PinP 4 POSITION V'},
	{ id: '0B003E', label: 'PinP 4 SOURCE SW'},
	{ id: '0B003F', label: 'PinP 4 PVW SW'},
	{ id: '0B0040', label: 'PinP 4 PGM SW'},
	{ id: '0B0041', label: 'DSK 1 SOURCE SW'},
	{ id: '0B0042', label: 'DSK 1 PVW SW'},
	{ id: '0B0043', label: 'DSK 1 PGM SW'},
	{ id: '0B0044', label: 'DSK 2 SOURCE SW'},
	{ id: '0B0045', label: 'DSK 2 PVW SW'},
	{ id: '0B0046', label: 'DSK 2 PGM SW'},
	{ id: '0B0047', label: 'MONITOR 1 SW'},
	{ id: '0B0048', label: 'MONITOR 2 SW'},
	{ id: '0B0049', label: 'MONITOR 3 SW'},
	{ id: '0B004A', label: 'MONITOR 4 SW'},
	{ id: '0B004B', label: 'MENU SW'},
	{ id: '0B004C', label: 'EXIT SW'},
	{ id: '0B004D', label: 'ENTER SW'},
	{ id: '0B004E', label: 'OUTPUT FADE SW'},
	{ id: '0B004F', label: 'SEQUENCER ON SW'},
	{ id: '0B0050', label: 'SEQUENCER AUTO SW'},
	{ id: '0B0051', label: 'SEQUENCER PREV SW'},
	{ id: '0B0052', label: 'SEQUENCER NEXT SW'},
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
			type: 'text',
			id: 'info',
			width: 12,
			label: ' ',
			value: `
			<div class="alert alert-info">
				<div>
					<strong>PLEASE READ:</strong>
					<br />
					To configure this module, you need to:
					<ul>
						<li>Enter the Target IP of the Roland Device</li>
						<li>Configure a Password/Passcode on the Roland Device, otherwise certain actions may not work.</li>
						<li>Click "Save" to save the module config.</li>
					</ul>
				</div>
			</div>
			`,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 6,
			default: '192.168.0.1',
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			width: 6,
			default: '0000'
		},
		/*{
			type: 'text',
			id: 'info2',
			label: 'Polling',
			width: 12,
			value: `
				<div class="alert alert-warning">
					<strong>Please read:</strong>
					<br>
					Enabling polling unlocks these features:
					<br><br>
					<ul>
						<li>Current Tally State(s)</li>
					</ul>
					Enabling polling will send a request to the Device at a continuous interval.
					<br>
					<strong>This could have an undesired performance effect on your Device, depending on the polling rate.</strong>
					<br>
				</div>
			`
		},
		{
			type: 'checkbox',
			id: 'polling',
			label: 'Enable Polling (necessary for feedbacks and variables)',
			default: false,
			width: 3
		},
		{
			type: 'textinput',
			id: 'pollingrate',
			label: 'Polling Rate (in ms)',
			default: 1000,
			width: 3,
			isVisible: (configValues) => configValues.polling === true,
		},*/
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Enable Verbose Logging',
			default: false
		},
		{
			type: 'text',
			id: 'info3',
			width: 12,
			label: ' ',
			value: `
			<div class="alert alert-info">
				<div>
					Enabling Verbose Logging will push all incoming and outgoing data to the log, which is helpful for debugging.
				</div>
			</div>
			`,
			isVisible: (configValues) => configValues.verbose === true,
		},
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
			if (self.config.verbose) {
				self.log('debug', 'Status change: ' + message);
			}

			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			if (self.config.verbose) {
				self.log('warn', 'Error: ' + err);
			}

			debug('Network error', err);
			clearInterval(self.INTERVAL);
			self.handleError(err);
		});

		self.socket.on('connect', function () {
			debug('Connected');
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
			else if (err[key] === 'ECONNRESET') {
				error = 'The connection was reset. Check the log for more error information.';
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

/*instance.prototype.startInterval = function() {
	let self = this;

	if (self.config.polling) {
		self.log('info', `Starting Update Interval: Fetching new data from Device every ${self.config.pollingrate}ms.`);
		self.INTERVAL = setInterval(self.getData.bind(this), parseInt(self.config.pollingrate));
	}
	else {
		self.log('info', 'Polling is disabled. Module will not request new data at a regular rate.');
	}
}

instance.prototype.getData = function() {
	let self = this;

	self.getTallyData();
}

instance.prototype.getTallyData = function() {
	let self = this;

	for (let i = 0; i < 16; i++) {
		let hex = i.toString(16).padStart(2, '0').toUpperCase();
		let command = '0C' + '00' + hex + ',000001;';

		self.sendRawCommand('RQH:' + command);
	}
}*/

instance.prototype.subscribeToTally = function() {
	let self = this;

	self.sendRawCommand('DTH:0C0100,01;'); //TALLY SEND ACTIVE
};

instance.prototype.updateData = function(data) {
	let self = this;

	debug('Got this data:');
	debug(data);

	if (self.config.verbose) {
		self.log('debug', data);
	}

	if(data.trim() =='Enter password:') {
		self.status(self.STATUS_WARNING, 'Authenticating');
		self.log('info', 'Sending passcode: ' + self.config.password);
		self.socket.send(self.config.password + '\n');
	}
	else if (data.trim() == 'Welcome to V-160HD.') {
		self.status(self.STATUS_OK);
		self.log('info', 'Authenticated.');
		self.sendRawCommand('VER'); //request version info
		//self.startInterval(); //request tally states
		self.subscribeToTally(); //request tally changes
	}
	else if (data.trim() == 'ERR:0;') {
		//an error with something that it received
	}
	else {
		//do stuff with the data
		try {
			if (data.indexOf(';')) {
				let dataGroups = data.trim().split(';');

				for (let j = 0; j < dataGroups.length; j++) {
					dataGroups[j] = dataGroups[j].trim();
					if (dataGroups[j] !== 'ACK' && dataGroups[j] !== '') {
						let dataSet = dataGroups[j].trim().split(':');
						if (Array.isArray(dataSet)) {
							let dataPrefix = '';
							
							if (dataSet[0] !== undefined) {
								dataPrefix = dataSet[0].toString().trim();
							}

							let dataSuffix = '';
							
							if (dataSet.length > 1) {
								if (dataSet[1].toString().indexOf(',')) {
									dataSuffix = dataSet[1].toString().split(',');

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
					
											/*if (param1 == '0C' && param2 == '00') { //tally message
												self.updateTally(param3, value);
											}*/

											if (param1 == '0C' && param2 == '00' && param3 == '00') { //subscribe tally message
												let index = 0;
												let halfLength = value.length / 2;
												for (let t = 0; t < halfLength; t++) {
													let input = halfLength - (halfLength - t)
      												input = input.toString(16).padStart(2, '0').toUpperCase();

													let tallyState = value[index] + value[index + 1];
													tallyState = tallyState.toString(16).padStart(2, '0').toUpperCase();

													self.updateTally(input, tallyState);

													index = index + 2;
												}
											}
										}
									}
								}
							}
							else {
								//likely just ERR:0;
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
			self.log('error', 'Data: ' + data);
		}
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


// ##########################
// ####### Functions ########
// ##########################
instance.prototype.sendCommand = function(address, value) {
	let self = this;

	let cmd = 'DTH:' + address + ',' + value + ';\n';
	self.sendRawCommand(cmd);
};

instance.prototype.requestData = function(command) {
	let self = this;

	let cmd = 'RQH:' + command + ';\n';
	self.sendRawCommand(cmd);
}

instance.prototype.sendRawCommand = function(command) {
	let self = this;

	if (!command.indexOf(';')) {
		command = command + ';';
	}

	let cmd = command + '\n';

	debug('Sending:');
	debug(cmd);

	if (self.socket !== undefined && self.socket.connected) {
		if (self.config.verbose) {
			self.log('debug', 'Sending: ' + cmd);
		}

		self.socket.send(cmd);
	}
	else {
		if (self.config.verbose) {
			self.log('warn', 'Unable to send: Socket not connected.');
		}

		debug('Socket not connected :(');
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;