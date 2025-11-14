const vscode = require('vscode')
const os = require('os')
const moment = require('moment-timezone')

const { isRepoClean, isLastCommitByCurrentUser, getRepoInfo } = require('../services/git')
const { validateVersion } = require('../services/version')
const { addSpentTime } = require('../services/tracking')
const { getWebviewContent } = require('../ui/webview')
const { hasTrackedCommit, markCommitTracked } = require('../services/state')

function getExtensionVersion(extensionId) {
	const ext = vscode.extensions.getExtension(extensionId)
	return ext ? ext.packageJSON.version : 'unknown'
}

function formatCommitDateToCET(commitTimestampRaw) {
	const ts = (commitTimestampRaw || '').replace(/\+.*/, '')
	return moment(ts.trim(), 'ddd MMM DD HH:mm:ss Z YYYY').tz('CET').format('ddd MMM DD HH:mm:ss [CET] YYYY')
}

function openWebview(context, author, commitMessage, repoBranch, commitId, formattedDate, url, projects, version) {
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
				case 'validate': {
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

					if (isNaN(hours) || hours <= 0) {
						vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
						return
					}
					if (!/^\w+-\d+.*/.test(workItem) || workItem.length > 60) {
						vscode.window.showErrorMessage(
							'Invalid input. Please enter a valid task that does not exceed 60 characters. ie (JIRA-000...)'
						)
						return
					}

					try {
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: 'Logging time to Azure…',
							},
							async progress => {
								progress.report({ increment: 20 })
								await addSpentTime({
								commitId,
								author,
								commitTimestamp,
								task: workItem,
								timeSpent: hours,
								commitMessage,
								repoBranch,
								repoUrl,
								rating,
								pluginVersion: version,
								})
								progress.report({ increment: 100 })
							}
						)
						await markCommitTracked(context, repoUrl, commitId, {
							workItem,
							hours,
							repoBranch,
							rating,
						})
						vscode.window.showInformationMessage('Time spent successfully logged!')
						panel.dispose()
					} catch (e) {
						vscode.window.showErrorMessage(String(e))
					}
					break
				}
				case 'projectChanged':
					if (projectPath) {
						try {
							const info = await getRepoInfo(projectPath)
							const formatted = formatCommitDateToCET(info.commitTimestamp)
							panel.webview.postMessage({
								command: 'updateProjectInfo',
								repoBranch: info.branch,
								commitMessage: info.commitMessage,
								commitId: info.commitId,
								formattedDate: formatted,
								url: info.url,
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

function registerOpenBox(context) {
	const disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		const pluginName = 'spenttime'
		const version = getExtensionVersion('bartolomeo-amico.spenttime')

		const check = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Checking SpentTime version…',
			},
			async progress => {
				progress.report({ increment: 10 })
				const res = await validateVersion(pluginName, version)
				progress.report({ increment: 100 })
				return res
			}
		)
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
					// Ignore errors when opening external links
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
						// Ignore errors when opening external links
					}
				}
			} else {
				vscode.window.showWarningMessage(check.message)
			}
		}

		const workspaceFolders = [
			{
				name: 'portalShell',
				uri: { fsPath: '/home/bamico/DevLabs/Reply/Nets/DACH/isv-partnerportal-fe-merchant' },
			},
		] //vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No git project found. Please be sure to be in a git project folder first.')
			return
		}
		const OS = os.platform()
		const projects = workspaceFolders.map(f => ({
			name: f.name,
			path: OS === 'win32' ? f.uri.fsPath.replace(/\//g, '\\') : f.uri.fsPath,
		}))

		// Pre-checks before opening the webview
		const selectedPath = projects[0] && projects[0].path
		if (!selectedPath) {
			vscode.window.showErrorMessage('No project selected. Cannot validate repository state.')
			return
		}
		const clean = await isRepoClean(selectedPath)
		if (!clean) {
			vscode.window.showWarningMessage('Uncommitted changes detected. Please commit your work before tracking time.')
			return
		}
		const authoredByUser = await isLastCommitByCurrentUser(selectedPath)
		if (!authoredByUser) {
			vscode.window.showWarningMessage(
				"The last commit wasn't authored by your current Git user. Please commit with your identity before tracking."
			)
			return
		}

		const info = await getRepoInfo(selectedPath)
		// Check if this commit was already tracked (local cache)
		if (hasTrackedCommit(context, info.url, info.commitId)) {
			const action = await vscode.window.showWarningMessage(
				'This commit looks already tracked. Do you want to track again?',
				'Track again',
				'Cancel'
			)
			if (action !== 'Track again') return
		}
		const formattedDate = formatCommitDateToCET(info.commitTimestamp)

		openWebview(
			context,
			info.author,
			info.commitMessage,
			info.branch,
			info.commitId,
			formattedDate,
			info.url,
			projects,
			version
		)
	})
	return disposable
}

module.exports = { registerOpenBox }
