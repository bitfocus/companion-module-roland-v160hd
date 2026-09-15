'use strict'

const PRIORITY = { HIGH: 0, LOW: 1 }

/**
 * Two-priority outbound command queue with a per-priority send interval.
 *
 * Commands at PRIORITY.HIGH (Roland Data Set / DTH writes) are always
 * dequeued before PRIORITY.LOW commands (RQH reads).  Within the same
 * priority, commands are dispatched in FIFO order.
 *
 * The minimum interval (`minIntervalMs`, default 20) applies only to
 * consecutive HIGH / DTH sends and is enforced using wall-clock timestamps
 * (Date.now()) so backpressure from a delayed event loop does not cause
 * bunched writes.
 *
 * LOW / RQH commands drain in batches of BATCH_LOW (4) with BATCH_LOW_DELAY
 * (5 ms) between batches to prevent device FIFO saturation.
 *
 * The generation counter on clear() invalidates all pending async drain
 * callbacks so stale callbacks from a previous connection cannot send
 * commands on the new connection.
 *
 * @param {function(string): void} sendFn  Called with the formatted command string when it is time to send.
 * @param {{ minIntervalMs?: number }} [opts]
 */
function CommandQueue(sendFn, opts) {
	const minIntervalMs = (opts && opts.minIntervalMs) !== undefined ? opts.minIntervalMs : 20

	this._high = []
	this._low = []
	this._sendFn = sendFn
	this._minIntervalMs = minIntervalMs
	this._lastHighSentAt = 0
	this._timer = null
	this._drainGeneration = 0
}

const BATCH_LOW = 4
const BATCH_LOW_DELAY = 5

/**
 * Add a command to the queue.
 *
 * @param {string}  cmd       Fully-formatted command string (including trailing '\n').
 * @param {number}  priority  PRIORITY.HIGH or PRIORITY.LOW.
 */
CommandQueue.prototype.enqueue = function (cmd, priority) {
	if (priority === PRIORITY.HIGH) {
		this._high.push(cmd)
		// A HIGH command may arrive while a LOW-only timer is pending.  Cancel
		// it and reschedule so the HIGH rate-limit delay is applied correctly.
		if (this._timer !== null) {
			clearTimeout(this._timer)
			this._timer = null
		}
	} else {
		this._low.push(cmd)
	}
	this._schedule()
}

/**
 * Discard all queued commands, cancel any pending drain timer, reset the
 * HIGH rate-limit timestamp, and advance the generation counter.
 *
 * Advancing the generation counter makes all pending async drain callbacks
 * stale so they discard silently — preventing stale commands from the
 * previous connection from being sent on a new connection.
 *
 * Call whenever a connection is replaced.
 */
CommandQueue.prototype.clear = function () {
	this._high = []
	this._low = []
	this._lastHighSentAt = 0
	this._drainGeneration++
	if (this._timer !== null) {
		clearTimeout(this._timer)
		this._timer = null
	}
}

CommandQueue.prototype._schedule = function () {
	if (this._timer !== null) return
	if (this._high.length === 0 && this._low.length === 0) return

	let delay
	if (this._high.length > 0) {
		const elapsed = Date.now() - this._lastHighSentAt
		delay = elapsed >= this._minIntervalMs ? 0 : this._minIntervalMs - elapsed
	} else {
		delay = 1
	}

	const gen = this._drainGeneration
	this._timer = setTimeout(() => {
		this._timer = null
		this._flush(gen)
	}, delay)
}

CommandQueue.prototype._flush = function (gen) {
	if (gen !== this._drainGeneration) return

	if (this._high.length > 0) {
		const cmd = this._high.shift()
		this._lastHighSentAt = Date.now()
		this._sendFn(cmd)
		this._schedule()
		return
	}

	for (let i = 0; i < BATCH_LOW && this._low.length > 0; i++) {
		this._sendFn(this._low.shift())
	}

	if (this._low.length > 0) {
		const batchGen = this._drainGeneration
		this._timer = setTimeout(() => {
			this._timer = null
			this._flush(batchGen)
		}, BATCH_LOW_DELAY)
	}
}

module.exports = { CommandQueue, PRIORITY }
