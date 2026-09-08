function normalizeCommand(command) {
	let normalized = String(command ?? '').trim()
	if (!normalized) return ''
	if (!normalized.endsWith(';')) normalized += ';'
	return normalized + '\n'
}

function buildMemoryNameRequests() {
	const commands = []

	for (let memory = 0; memory < 30; memory++) {
		const memoryHex = memory.toString(16).padStart(2, '0').toUpperCase()
		for (let character = 0; character < 8; character++) {
			const characterHex = character.toString(16).padStart(2, '0').toUpperCase()
			commands.push(`RQH:60${memoryHex}${characterHex},000001;`)
		}
	}

	return commands
}

module.exports = { normalizeCommand, buildMemoryNameRequests }
