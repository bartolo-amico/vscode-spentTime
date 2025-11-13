const util = require('util')
const exec = util.promisify(require('child_process').exec)
const os = require('os')
const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash'

async function execGit(projectPath, args) {
	return exec(`cd "${projectPath}" && git ${args}`, { shell })
}

async function isRepoClean(projectPath) {
	try {
		const { stdout } = await execGit(projectPath, 'status --porcelain')
		return stdout.trim().length === 0
	} catch (_) {
		return false
	}
}

async function isLastCommitByCurrentUser(projectPath) {
	try {
		const { stdout: last } = await execGit(projectPath, 'log -1 --pretty=format:"%an|%ae"')
		const [lastNameRaw, lastEmailRaw] = last.split('|')
		const lastName = (lastNameRaw || '').trim()
		const lastEmail = (lastEmailRaw || '').trim().toLowerCase()

		const { stdout: cfgNameStdout } = await execGit(projectPath, 'config user.name')
		const { stdout: cfgEmailStdout } = await execGit(projectPath, 'config user.email')
		const cfgName = (cfgNameStdout || '').trim()
		const cfgEmail = (cfgEmailStdout || '').trim().toLowerCase()

		if (lastEmail && cfgEmail) return lastEmail === cfgEmail
		if (lastName && cfgName) return lastName === cfgName
		return false
	} catch (_) {
		return false
	}
}

function sanitizeUrl(raw) {
	const regex = /https:\/\/[^@]+@/
	if (regex.test(raw)) return raw.replace(/https:\/\/[^@]+@/, 'https://')
	return raw
}

async function getRepoInfo(projectPath) {
	const { stdout: branchStd } = await execGit(projectPath, 'branch --show-current')
	const { stdout: logStd } = await execGit(projectPath, 'log -1 --pretty=format:"%H,%an,%cd,%s"')
	let [commitId, author, commitTimestamp, commitMessage] = logStd.split(',')
	const { stdout: urlStd } = await execGit(projectPath, 'config --get remote.origin.url')
	const url = sanitizeUrl(urlStd).trim()
	return {
		branch: branchStd,
		commitId,
		author,
		commitTimestamp,
		commitMessage,
		url,
	}
}

module.exports = {
	execGit,
	isRepoClean,
	isLastCommitByCurrentUser,
	getRepoInfo,
}
