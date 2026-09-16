'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const actionMethods = require('../src/actions')
const constants = require('../src/constants')
const apiMethods = require('../src/api')
const { PRIORITY } = require('../src/commandQueue')

// Verify we loaded the real production implementations, not stubs
assert.equal(typeof apiMethods.formatBytes, 'function', 'production formatBytes must be present')
assert.equal(typeof apiMethods.calculateBytes, 'function', 'production calculateBytes must be present')

// Run real action callbacks and API formatting/framing. Capture at the queue
// boundary so no socket or connection is created.
function makeStub() {
	const sent = []

	const stub = Object.assign(
		{
			config: {},
			log: () => {},
			DATA: {},
			setActionDefinitions: () => {},
			selectedCamera: '41',
			_sent: sent,
			_queue: {
				enqueue(command, priority) {
					assert.equal(priority, PRIORITY.HIGH)
					sent.push(command.trimEnd())
				},
			},
		},
		constants,
		apiMethods,
	)

	return stub
}

// Build action definitions and return them
function getActions(stub) {
	const actions = {}
	const origSet = stub.setActionDefinitions
	stub.setActionDefinitions = (defs) => Object.assign(actions, defs)
	actionMethods.initActions.call(stub)
	stub.setActionDefinitions = origSet
	return actions
}

// Invoke a single action callback and return captured DTH commands
function invoke(stub, actions, actionId, options) {
	stub._sent.length = 0
	const action = actions[actionId]
	if (!action) throw new Error(`Unknown action: ${actionId}`)
	action.callback({ options }, {})
	return stub._sent.slice()
}

// ── Production formatBytes / calculateBytes unit tests ────────────────────────

// Expected values are literal examples from the documented 7-bit representation,
// independent of calculateBytes/formatBytes. Exercise every channel and the
// supported boundaries, including signed values and the 127→128 byte boundary.
describe('PiP/Key parameter boundaries on all four channels', () => {
	const cases = [
		[
			'pnpkey_positionH',
			'position',
			'04',
			[
				[-100, '7818'],
				[0.1, '0001'],
				[100, '0768'],
			],
		],
		[
			'pnpkey_positionV',
			'position',
			'06',
			[
				[-100, '7818'],
				[0.1, '0001'],
				[100, '0768'],
			],
		],
		[
			'pnpkey_size',
			'size',
			'08',
			[
				[0, '0000'],
				[0.1, '0001'],
				[100, '0768'],
			],
		],
		[
			'pnpkey_croppingH',
			'cropping',
			'0A',
			[
				[0, '0000'],
				[0.1, '0001'],
				[100, '0768'],
			],
		],
		[
			'pnpkey_croppingV',
			'cropping',
			'0C',
			[
				[0, '0000'],
				[0.1, '0001'],
				[100, '0768'],
			],
		],
		[
			'pnpkey_viewPositionH',
			'position',
			'11',
			[
				[-50, '7C0C'],
				[-0.1, '7F7F'],
				[50, '0374'],
			],
		],
		[
			'pnpkey_viewPositionV',
			'position',
			'13',
			[
				[-50, '7C0C'],
				[-0.1, '7F7F'],
				[50, '0374'],
			],
		],
		[
			'pnpkey_viewZoom',
			'zoom',
			'15',
			[
				[100, '0064'],
				[400, '0310'],
			],
		],
		[
			'pnpkey_keyLevel',
			'level',
			'17',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
		[
			'pnpkey_keyGain',
			'gain',
			'19',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
		[
			'pnpkey_mixLevel',
			'level',
			'1B',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
		[
			'pnpkey_hueFine',
			'fine',
			'1F',
			[
				[0, '0000'],
				[360, '0268'],
			],
		],
		[
			'pnpkey_saturationWidth',
			'width',
			'21',
			[
				[-127, '7F01'],
				[127, '007F'],
			],
		],
		[
			'pnpkey_saturationFine',
			'fine',
			'23',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
		[
			'pnpkey_borderColorRed',
			'red',
			'25',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
		[
			'pnpkey_borderColorGreen',
			'green',
			'27',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
		[
			'pnpkey_borderColorBlue',
			'blue',
			'29',
			[
				[0, '0000'],
				[127, '007F'],
				[128, '0100'],
				[255, '017F'],
			],
		],
	]
	for (const [id, option, offset, values] of cases) {
		test(id, () => {
			const stub = makeStub()
			const actions = getActions(stub)
			for (const pinp of ['1B', '1C', '1D', '1E']) {
				for (const [value, encoded] of values) {
					assert.deepEqual(
						invoke(stub, actions, id, { pinp, [option]: value }),
						[`DTH:00${pinp}${offset},${encoded};`],
						`${id} channel=${pinp} value=${value}`,
					)
				}
			}
		})
	}
})

describe('production formatBytes (from api.js)', () => {
	const stub = makeStub()

	test('formatBytes([0, 0]) === 0000', () => {
		assert.equal(stub.formatBytes([0, 0]), '0000')
	})

	test('formatBytes([3, 116]) === 0374', () => {
		assert.equal(stub.formatBytes([3, 116]), '0374')
	})

	test('formatBytes([127, 127]) === 7F7F', () => {
		assert.equal(stub.formatBytes([127, 127]), '7F7F')
	})

	test('formatBytes(calculateBytes(50.0, 10)) === 0374', () => {
		// 50.0 * 10 = 500; msb=3 (0x03), lsb=116 (0x74)
		assert.equal(stub.formatBytes(stub.calculateBytes(50.0, 10)), '0374')
	})

	test('formatBytes(calculateBytes(-50.0, 10)) === 7C0C', () => {
		// -500 & 0x3fff = 0x3E0C; msb=0x7C, lsb=0x0C
		assert.equal(stub.formatBytes(stub.calculateBytes(-50.0, 10)), '7C0C')
	})

	test('formatBytes(calculateBytes(0.0, 10)) === 0000', () => {
		assert.equal(stub.formatBytes(stub.calculateBytes(0.0, 10)), '0000')
	})
})

// ── pnpkey_positionH ─────────────────────────────────────────────────────────
// Roland V-160HD_Control_eng06_W.pdf: PinP & KEY address/value table (p.7),
// 7-bit byte representation (p.35), and hexadecimal DTH writes (p.38).
// These are command-generation tests, not device validation.

describe('pnpkey_positionH — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('position 50.0 → single command DTH:001B04,0374;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_positionH', { pinp: '1B', position: 50.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B04,0374;')
	})

	test('position 0.0 → DTH:001B04,0000;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_positionH', { pinp: '1B', position: 0.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B04,0000;')
	})

	test('position -100.0 → single DTH with negative 14-bit encoding', () => {
		const cmds = invoke(stub, actions, 'pnpkey_positionH', { pinp: '1B', position: -100.0 })
		assert.equal(cmds.length, 1)
		// -1000 & 0x3fff = 0x3C18; msb=0x78, lsb=0x18
		assert.equal(cmds[0], 'DTH:001B04,7818;')
	})

	test('PnP/Key 2 uses address prefix 001C', () => {
		const cmds = invoke(stub, actions, 'pnpkey_positionH', { pinp: '1C', position: 50.0 })
		assert.equal(cmds[0], 'DTH:001C04,0374;')
	})

	test('PnP/Key 4 uses address prefix 001E', () => {
		const cmds = invoke(stub, actions, 'pnpkey_positionH', { pinp: '1E', position: 50.0 })
		assert.equal(cmds[0], 'DTH:001E04,0374;')
	})
})

describe('pnpkey_positionV — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('position 50.0 → DTH:001B06,0374;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_positionV', { pinp: '1B', position: 50.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B06,0374;')
	})
})

describe('pnpkey_size — single DTH write, min=0.0', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('size 50.0 → DTH:001B08,0374;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_size', { pinp: '1B', size: 50.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B08,0374;')
	})

	test('size 0.0 (min) → DTH:001B08,0000;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_size', { pinp: '1B', size: 0.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B08,0000;')
	})

	test('size 100.0 (max) → DTH:001B08,0768;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_size', { pinp: '1B', size: 100.0 })
		assert.equal(cmds.length, 1)
		// 100.0 * 10 = 1000; msb=7, lsb=104 (0x68)
		assert.equal(cmds[0], 'DTH:001B08,0768;')
	})

	test('size option min is 0.0 not 10.0 (Roland Control Guide: 0.0-100.0%)', () => {
		const sizeOpt = actions.pnpkey_size.options.find((o) => o.id === 'size')
		assert.equal(sizeOpt.min, 0.0)
	})
})

describe('pnpkey_croppingH — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('cropping 50.0 → DTH:001B0A,0374;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_croppingH', { pinp: '1B', cropping: 50.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B0A,0374;')
	})
})

describe('pnpkey_croppingV — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('cropping 50.0 → DTH:001B0C,0374;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_croppingV', { pinp: '1B', cropping: 50.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B0C,0374;')
	})
})

describe('pnpkey_viewPositionH — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('position 25.0 → DTH:001B11,017A;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_viewPositionH', { pinp: '1B', position: 25.0 })
		assert.equal(cmds.length, 1)
		// 25.0 * 10 = 250; msb=1, lsb=0x7A=122
		assert.equal(cmds[0], 'DTH:001B11,017A;')
	})
})

describe('pnpkey_viewPositionV — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('position 25.0 → DTH:001B13,017A;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_viewPositionV', { pinp: '1B', position: 25.0 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B13,017A;')
	})
})

describe('pnpkey_viewZoom — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('zoom 200 → DTH:001B15,0148;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_viewZoom', { pinp: '1B', zoom: 200 })
		assert.equal(cmds.length, 1)
		// 200 * 1 = 200; msb=1, lsb=0x48=72
		assert.equal(cmds[0], 'DTH:001B15,0148;')
	})
})

describe('pnpkey_keyLevel — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('level 128 → DTH:001B17,0100;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_keyLevel', { pinp: '1B', level: 128 })
		assert.equal(cmds.length, 1)
		// 128 * 1 = 128; msb=1, lsb=0
		assert.equal(cmds[0], 'DTH:001B17,0100;')
	})
})

describe('pnpkey_keyGain — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('gain 255 → DTH:001B19,017F;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_keyGain', { pinp: '1B', gain: 255 })
		assert.equal(cmds.length, 1)
		// 255 * 1 = 255; msb=1, lsb=0x7F=127
		assert.equal(cmds[0], 'DTH:001B19,017F;')
	})
})

describe('pnpkey_mixLevel — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('level 64 → DTH:001B1B,0040;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_mixLevel', { pinp: '1B', level: 64 })
		assert.equal(cmds.length, 1)
		// 64 * 1 = 64; msb=0, lsb=0x40=64
		assert.equal(cmds[0], 'DTH:001B1B,0040;')
	})
})

describe('pnpkey_hueFine — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('fine 180 → DTH:001B1F,0134;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_hueFine', { pinp: '1B', fine: 180 })
		assert.equal(cmds.length, 1)
		// 180 * 1 = 180; msb=1, lsb=0x34=52
		assert.equal(cmds[0], 'DTH:001B1F,0134;')
	})
})

describe('pnpkey_saturationWidth — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('width 64 → DTH:001B21,0040;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_saturationWidth', { pinp: '1B', width: 64 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B21,0040;')
	})
})

describe('pnpkey_saturationFine — single DTH write', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('fine 200 → DTH:001B23,0148;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_saturationFine', { pinp: '1B', fine: 200 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B23,0148;')
	})
})

describe('border color actions — single DTH writes', () => {
	const stub = makeStub()
	const actions = getActions(stub)

	test('borderColorRed 128 → DTH:001B25,0100;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_borderColorRed', { pinp: '1B', red: 128 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B25,0100;')
	})

	test('borderColorGreen 128 → DTH:001B27,0100;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_borderColorGreen', { pinp: '1B', green: 128 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B27,0100;')
	})

	test('borderColorBlue 128 → DTH:001B29,0100;', () => {
		const cmds = invoke(stub, actions, 'pnpkey_borderColorBlue', { pinp: '1B', blue: 128 })
		assert.equal(cmds.length, 1)
		assert.equal(cmds[0], 'DTH:001B29,0100;')
	})
})
