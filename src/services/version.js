const axios = require('axios')

const VERSION_ENDPOINT =
	'https://defaultb00367e2193a4f4894de7245d45c09.47.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/3116bd782d8c42f3b7516e8037545d38/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6A4yDQsZr9CWXc7g9i6a3TyxnzonHOPJjNtHD-nI4E4'

const GRACE_DAYS = 120

function parseSemver(v) {
	const m = String(v)
		.trim()
		.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
	if (!m) return null
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] || null }
}

function compareVersions(a, b) {
	if (a === b) return 0
	const pa = parseSemver(a)
	const pb = parseSemver(b)
	if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0
	if (pa.major !== pb.major) return pa.major - pb.major
	if (pa.minor !== pb.minor) return pa.minor - pb.minor
	if (pa.patch !== pb.patch) return pa.patch - pb.patch
	if (pa.pre && !pb.pre) return -1
	if (!pa.pre && pb.pre) return 1
	if (!pa.pre && !pb.pre) return 0
	return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
}

function isActiveVersion(range) {
	try {
		const now = new Date()
		const from = new Date(range['active-from-date'])
		const to = new Date(range['expiration-date'])
		return from <= now && now < to
	} catch (_) {
		return false
	}
}

async function fetchPluginMatrix() {
	const resp = await axios.get(VERSION_ENDPOINT, { timeout: 8000 })
	return resp.data
}

async function validateVersion(pluginName, installedVersion) {
	try {
		const data = await fetchPluginMatrix()
		const plugins = (data && data.plugins) || []
		const plugin = plugins.find(p => p && p.name === pluginName)
		if (!plugin) {
			return {
				decision: 'error',
				message: 'Version check failed: missing plugin data. Check your connection; tracking requires Azure.',
			}
		}
		const list = Array.isArray(plugin['active-versions']) ? plugin['active-versions'] : []
		const now = new Date()

		const installedEntry = list.find(v => v.version === installedVersion)
		const installedActive = installedEntry ? isActiveVersion(installedEntry) : false
		const installedExpired = installedEntry ? now >= new Date(installedEntry['expiration-date']) : true

		const activeVersions = list.filter(v => isActiveVersion(v))
		const higherActive = activeVersions
			.filter(v => compareVersions(v.version, installedVersion) > 0)
			.sort((a, b) => compareVersions(a.version, b.version))
		const highestActive = higherActive[higherActive.length - 1]

		if (installedActive) {
			if (higherActive.length === 0) {
				return { decision: 'ok' }
			}
			const activeFrom = highestActive && highestActive['active-from-date']
			const activeFromDate = activeFrom ? new Date(activeFrom) : null
			const graceUntil = activeFromDate ? new Date(activeFromDate.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000) : null
			const graceInfo = graceUntil
				? ` Please update within ~${GRACE_DAYS} days (by ${graceUntil.toISOString().slice(0, 10)}).`
				: ''
			const warn = `A newer active version (${highestActive.version}) is available.${graceInfo}`
			return { decision: 'warn', message: warn, link: highestActive['download-link'] }
		}

		if (installedExpired && higherActive.length > 0) {
			const msg = `Your version (${installedVersion}) has expired. Update to ${highestActive.version} to continue.`
			return { decision: 'block', message: msg, link: highestActive['download-link'] }
		}

		return { decision: 'ok' }
	} catch (err) {
		return {
			decision: 'error',
			message: 'Version check failed. Please check your connection; tracking will not work if Azure is unreachable.',
		}
	}
}

module.exports = {
	validateVersion,
	compareVersions,
}
