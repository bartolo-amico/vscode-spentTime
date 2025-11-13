const vscode = require('vscode')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const os = require('os')
const axios = require('axios')
const OS = os.platform()
const moment = require('moment-timezone')
const path = require('path')
const fs = require('fs')
const ejs = require('ejs')

let version
const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash'

// Returns true if the working tree is clean (no staged/unstaged/untracked changes)
async function isRepoClean(projectPath) {
	try {
		const { stdout } = await exec(`cd "${projectPath}" && git status --porcelain`, { shell })
		return stdout.trim().length === 0
	} catch (err) {
		// If anything goes wrong (not a git repo, etc.), treat as not clean
		return false
	}
}

// Returns true if the last commit author matches the repo's configured Git user
async function isLastCommitByCurrentUser(projectPath) {
	try {
		const logCmd = `cd "${projectPath}" && git log -1 --pretty=format:"%an|%ae"`
		const { stdout: last } = await exec(logCmd, { shell })
		const [lastNameRaw, lastEmailRaw] = last.split('|')
		const lastName = (lastNameRaw || '').trim()
		const lastEmail = (lastEmailRaw || '').trim().toLowerCase()

		const { stdout: cfgNameStdout } = await exec(`cd "${projectPath}" && git config user.name`, { shell })
		const { stdout: cfgEmailStdout } = await exec(`cd "${projectPath}" && git config user.email`, { shell })
		const cfgName = (cfgNameStdout || '').trim()
		const cfgEmail = (cfgEmailStdout || '').trim().toLowerCase()

		// Prefer strict email match when available, otherwise fallback to name
		if (lastEmail && cfgEmail) {
			return lastEmail === cfgEmail
		}
		if (lastName && cfgName) {
			return lastName === cfgName
		}
		return false
	} catch (err) {
		return false
	}
}

function getExtensionVersion(extensionId) {
	const ext = vscode.extensions.getExtension(extensionId)
	if (ext) {
		return ext.packageJSON.version
	} else {
		return 'Estensione non trovata'
	}
}

// ---------- Version validation helpers ----------
const VERSION_ENDPOINT =
	'https://defaultb00367e2193a4f4894de7245d45c09.47.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/3116bd782d8c42f3b7516e8037545d38/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6A4yDQsZr9CWXc7g9i6a3TyxnzonHOPJjNtHD-nI4E4'

function parseSemver(v) {
	const m = String(v)
		.trim()
		.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
	if (!m) return null
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		pre: m[4] || null,
	}
}

function compareVersions(a, b) {
	if (a === b) return 0
	const pa = parseSemver(a)
	const pb = parseSemver(b)
	if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0
	if (pa.major !== pb.major) return pa.major - pb.major
	if (pa.minor !== pb.minor) return pa.minor - pb.minor
	if (pa.patch !== pb.patch) return pa.patch - pb.patch
	// Pre-release is lower than release
	if (pa.pre && !pb.pre) return -1
	if (!pa.pre && pb.pre) return 1
	if (!pa.pre && !pb.pre) return 0
	// Both pre-release: lexical compare as fallback
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

async function validateVersion(installedVersion) {
	try {
		const data = await fetchPluginMatrix()
		const plugins = (data && data.plugins) || []
		const plugin = plugins.find(p => p && p.name === 'spenttime')
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

		// Cases
		if (installedActive) {
			if (higherActive.length === 0) {
				return { decision: 'ok' }
			}
			// Warn about newer active version; grace period around a month
			const activeFrom = highestActive && highestActive['active-from-date']
			const activeFromDate = activeFrom ? new Date(activeFrom) : null
			const graceUntil = activeFromDate ? new Date(activeFromDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null
			const graceInfo = graceUntil
				? ` Please update within ~30 days (by ${graceUntil.toISOString().slice(0, 10)}).`
				: ''
			const warn = `A newer active version (${highestActive.version}) is available.${graceInfo}`
			return { decision: 'warn', message: warn, link: highestActive['download-link'] }
		}

		// Not active (including unknown) cases
		if (installedExpired && higherActive.length > 0) {
			const msg = `Your version (${installedVersion}) has expired. Update to ${highestActive.version} to continue.`
			return { decision: 'block', message: msg, link: highestActive['download-link'] }
		}

		// Expired but no higher active -> allow
		return { decision: 'ok' }
	} catch (err) {
		return {
			decision: 'error',
			message: 'Version check failed. Please check your connection; tracking will not work if Azure is unreachable.',
		}
	}
}

function getLastTag(gitRemoteUrl) {
	// Use --refs to avoid peeled tags (^{}) entirely; then strip prefix and leading 'v'
	const cmd = `git ls-remote --tags --refs ${gitRemoteUrl} \
		| awk '{print $2}' \
		| sed -E 's#^refs/tags/##' \
		| sed -E 's/^v//' \
		| sort -V \
		| tail -n1`
	return exec(cmd, { shell })
}

const addSpentTime = async (
	commitId,
	author,
	commitTimestamp,
	task,
	timeSpent,
	commitMessage,
	repoBranch,
	repoUrl,
	rating,
	version
) => {
	const branch = repoBranch.trim()
	try {
		if (OS !== `win32`) {
			await exec(`curl --location 'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o' \
						--header 'Content-Type: application/json' \
						--data '{
								"commit-id": "${commitId}",
								"author-name": "${author}",
								"commit-timestamp": "${commitTimestamp}",
								"work-item-id": "${task}",
								"repository-url": "${repoUrl}",
								"spent-hours": "${Number(timeSpent)}",
								"commit-message": "${commitMessage}",
								"repo-branch": "${branch}",
								"ai-tools-rating": "${rating}",
										"metadata": {
									"tracking-method": "ide-plugin",
									"plugin-name": "spenttime",
									"plugin-version": "${version}"
								}
						}'`)
		} else {
			await axios.post(
				'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track',
				{
					'commit-id': `${commitId}`,
					'author-name': `${author}`,
					'commit-timestamp': `${commitTimestamp}`,
					'work-item-id': `${task}`,
					'repository-url': `${repoUrl}`,
					'spent-hours': `${Number(timeSpent)}`,
					'commit-message': `${commitMessage}`,
					'repo-branch': `${branch}`,
					'ai-tools-rating': `${rating}`,
					metadata: {
						'tracking-method': 'ide-plugin',
						'plugin-name': 'spenttime',
						'plugin-version': `${version}`,
					},
				},
				{
					params: {
						'api-version': '2016-06-01',
						sp: '/triggers/manual/run',
						sv: '1.0',
						sig: 'YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o',
					},
					headers: {
						'Content-Type': 'application/json',
					},
				}
			)
		}
		vscode.window.showInformationMessage('Time spent successfully logged!')
	} catch (error) {
		vscode.window.showErrorMessage(error)
	}
	return true
}

const openWebview = (context, author, commitMessage, repoBranch, commitId, formattedDate, url, projects, version) => {
	const panel = vscode.window.createWebviewPanel('formWebview', 'Spent Time Box', vscode.ViewColumn.One, {
		enableScripts: true,
	})

	panel.webview.html = getWebviewContent(
		author,
		commitMessage,
		repoBranch,
		panel,
		commitId,
		formattedDate,
		url,
		projects
	)

	panel.webview.onDidReceiveMessage(
		async message => {
			const { hours, workItem, commitId, commitTimestamp, repoUrl, rating, projectPath, commitMessage, repoBranch } =
				message.data || {}
			switch (message.command) {
				case 'cancel':
					vscode.window.showInformationMessage('Tracking cancelled.')
					panel.dispose()
					return
				case 'validate':
					// Ensure user has committed their work before tracking
					{
						const selectedPath = projectPath || (projects && projects[0] && projects[0].path)
						if (!selectedPath) {
							vscode.window.showErrorMessage('No project selected. Cannot validate repository state.')
							return
						}
						const clean = await isRepoClean(selectedPath)
						if (!clean) {
							vscode.window.showWarningMessage(
								'Uncommitted changes detected. Please commit your work before tracking time.'
							)
							return
						}

						const authoredByUser = await isLastCommitByCurrentUser(selectedPath)
						if (!authoredByUser) {
							vscode.window.showWarningMessage(
								"The last commit wasn't authored by your current Git user. Please commit with your identity before tracking."
							)
							return
						}
					}
					if (isNaN(hours) || hours <= 0) {
						vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
					} else if (!/^\w+-\d+.*/.test(workItem) || workItem.length > 30) {
						vscode.window.showErrorMessage(
							'Invalid input. Please enter a valid task that does not exceed 15 characters. ie (JIRA-000...)'
						)
					} else {
						addSpentTime(
							commitId,
							author,
							commitTimestamp,
							workItem,
							hours,
							commitMessage,
							repoBranch,
							repoUrl,
							rating,
							version
						)
						panel.dispose()
					}
					break
				case 'projectChanged':
					if (projectPath) {
						try {
							const repoBranch = await exec(`cd "${projectPath}" && git branch --show-current`, { shell })
							const { stdout } = await exec(`cd "${projectPath}" && git log -1 --pretty=format:"%H,%an,%cd,%s"`, {
								shell,
							})
							let [commitId, author, commitTimestamp, commitMessage] = stdout.split(',')
							commitTimestamp = commitTimestamp.replace(/\+.*/, '')
							let formattedDate = moment(commitTimestamp.trim(), 'ddd MMM DD HH:mm:ss Z YYYY')
								.tz('CET')
								.format('ddd MMM DD HH:mm:ss [CET] YYYY')
							let repoUrl = await exec(`cd "${projectPath}" && git config --get remote.origin.url`, { shell })
							const regex = /https:\/\/[^@]+@/
							let url = ''
							if (regex.test(repoUrl.stdout)) {
								url = repoUrl.stdout.replace(/https:\/\/[^@]+@/, 'https://')
							} else {
								url = repoUrl.stdout
							}
							panel.webview.postMessage({
								command: 'updateProjectInfo',
								repoBranch: repoBranch.stdout,
								commitMessage,
								commitId,
								formattedDate,
								url: url.trim(),
							})
						} catch (err) {
							vscode.window.showErrorMessage('Failed to get project info: ' + err)
						}
					}
					break
			}
		},
		undefined,
		context.subscriptions
	)
}

const getWebviewContent = (author, commitMessage, repoBranch, panel, commitId, formattedDate, url, projects) => {
	const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview-script.js')))
	const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview-style.css')))
	const templatePath = path.join(__dirname, 'webview-template.ejs')
	const template = fs.readFileSync(templatePath, 'utf8')
	return ejs.render(template, {
		author,
		commitMessage,
		repoBranch,
		commitId,
		formattedDate,
		url,
		scriptUri,
		styleUri,
		projects,
	})
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		version = getExtensionVersion('bartolomeo-amico.spenttime')

		// New version validation against Azure endpoint
		const check = await validateVersion(version)
		if (check.decision === 'error') {
			vscode.window.showErrorMessage(check.message)
			return
		}
		if (check.decision === 'block') {
			const action = check.link
				? await vscode.window.showErrorMessage(check.message, 'Open download link')
				: (await vscode.window.showErrorMessage(check.message)) && null
			if (action === 'Open download link' && check.link) {
				try {
					await vscode.env.openExternal(vscode.Uri.parse(check.link))
				} catch (_) {
					console.error('Failed to open link:', check.link)
				}
			}
			return
		}
		if (check.decision === 'warn') {
			if (check.link) {
				const action = await vscode.window.showWarningMessage(check.message, 'Open download link')
				if (action === 'Open download link') {
					try {
						await vscode.env.openExternal(vscode.Uri.parse(check.link))
					} catch (_) {
						console.error('Failed to open link:', check.link)
					}
				}
			} else {
				vscode.window.showWarningMessage(check.message)
			}
			// Continue despite warning (grace period)
		}

		// Get all workspace folders
		const workspaceFolders = ['/home/bamico/DevLabs/Reply/NexiDigital/vscode-spentTime'] //vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No git project found. Please be sure to be in a git project folder first.')
			return
		}
		const projects = workspaceFolders.map(f => ({
			name: f.name,
			path: OS === 'win32' ? f.uri.fsPath.replace(/\//g, '\\') : f.uri.fsPath,
		}))
		const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash'
		const repoBranch = await exec(`cd ${projects[0].path} && git branch --show-current`, { shell })
		const { stdout } = await exec(`cd ${projects[0].path} && git log -1 --pretty=format:"%H,%an,%cd,%s"`, { shell })
		let [commitId, author, commitTimestamp, commitMessage] = stdout.split(',')
		commitTimestamp = commitTimestamp.replace(/\+.*/, '')
		let formattedDate = moment(commitTimestamp.trim(), 'ddd MMM DD HH:mm:ss Z YYYY')
			.tz('CET')
			.format('ddd MMM DD HH:mm:ss [CET] YYYY')
		let repoUrl = await exec(`cd ${projects[0].path} && git config --get remote.origin.url`, { shell })
		const regex = /https:\/\/[^@]+@/
		let url = ''
		if (regex.test(repoUrl.stdout)) {
			url = repoUrl.stdout.replace(/https:\/\/[^@]+@/, 'https://')
		} else {
			url = repoUrl.stdout
		}

		openWebview(
			context,
			author,
			commitMessage,
			repoBranch.stdout,
			commitId,
			formattedDate,
			url.trim(),
			projects,
			version
		)
	})
	context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
