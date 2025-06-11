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

let projectPath = vscode.workspace.workspaceFolders[0].uri.path
let version
function getExtensionVersion(extensionId) {
	const ext = vscode.extensions.getExtension(extensionId)
	if (ext) {
		return ext.packageJSON.version
	} else {
		return 'Estensione non trovata'
	}
}

if (OS === 'win32') {
	projectPath = projectPath.replace(/\//g, '\\').substring(1)
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
	rating
) => {
	const branch = repoBranch.trim()
	try {
		version = getExtensionVersion('bartolomeo amico.spenttime')
		if (OS !== `win32`) {
			await exec(`curl --location 'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o' \
						--header 'Content-Type: application/json' \
						--data '{
								"commit-id": "${commitId}",
								"author-name": "${author}",
								"commit-timestamp": "${commitTimestamp}",
								"work-item-id": "${task}",
								"repository-url": "${repoUrl}",
								"spent-hours": "${timeSpent}",
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
					'spent-hours': `${timeSpent}`,
					'commit-message': `${commitMessage}`,
					'repo-branch': `${branch}`,
					'ai-tools-rating': `${rating}`,
					metadata: {
						'tracking-method': 'ide-plugin',
						'plugin-name': 'spenttime',
						'plugin-version': '${version}',
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
		timeSpent = undefined
	} catch (error) {
		vscode.window.showErrorMessage(error)
	}
	return true
}

const openWebview = (context, author, commitMessage, repoBranch, projectName, commitId, formattedDate, url) => {
	const panel = vscode.window.createWebviewPanel(
		'formWebview', // Identifies the type of the webview. Used internally
		'Spent Time Box', // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		{
			enableScripts: true, // Enable scripts in the webview
		}
	)

	panel.webview.html = getWebviewContent(
		author,
		commitMessage,
		repoBranch,
		projectName,
		panel,
		commitId,
		formattedDate,
		url
	)

	panel.webview.onDidReceiveMessage(
		message => {
			const { hours, workItem, commitId, commitTimestamp, repoUrl, rating } = message.data
			switch (message.command) {
				case 'cancel':
					vscode.window.showInformationMessage('Form submission cancelled.')
					panel.dispose()
					return
				case 'validate':
					if (isNaN(hours) || hours <= 0) {
						vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
					} else if (/\w+-\d+/g.test(workItem) === false) {
						vscode.window.showErrorMessage('Invalid input. Please enter a valid task. ie (JIRA-000)')
					} else {
						addSpentTime(commitId, author, commitTimestamp, workItem, hours, commitMessage, repoBranch, repoUrl, rating)
						//vscode.window.showInformationMessage(`Form submitted with data: ${JSON.stringify(message.data)}`)
						panel.dispose()
					}
			}
		},
		undefined,
		context.subscriptions
	)
}

const getWebviewContent = (author, commitMessage, repoBranch, projectName, panel, commitId, formattedDate, url) => {
	const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview-script.js')))
	const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview-style.css')))
	const templatePath = path.join(__dirname, 'webview-template.ejs')
	const template = fs.readFileSync(templatePath, 'utf8')
	return ejs.render(template, {
		author,
		commitMessage,
		repoBranch,
		projectName,
		commitId,
		formattedDate,
		url,
		scriptUri,
		styleUri,
	})
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash'
		const repoBranch = await exec(`cd ${projectPath} && git branch --show-current`, { shell })
		const { stdout } = await exec(`cd ${projectPath} && git log -1 --pretty=format:"%H,%an,%cd,%s"`, { shell })
		let [commitId, author, commitTimestamp, commitMessage] = stdout.split(',')
		// Remove part after the character + if it exists
		commitTimestamp = commitTimestamp.replace(/\+.*/, '')
		let formattedDate = moment(commitTimestamp.trim(), 'ddd MMM DD HH:mm:ss Z YYYY')
			.tz('CET')
			.format('ddd MMM DD HH:mm:ss [CET] YYYY')
		let repoUrl = await exec(`cd ${projectPath} && git config --get remote.origin.url`, { shell })
		// Check and remove username from repoUrl
		const regex = /https:\/\/[^@]+@/
		let url = ''
		if (regex.test(repoUrl.stdout)) {
			url = repoUrl.stdout.replace(/https:\/\/[^@]+@/, 'https://')
		} else {
			url = repoUrl.stdout
		}
		const projectName = repoUrl.stdout.split('/').slice(-1)[0].replace('.git', '')
		openWebview(context, author, commitMessage, repoBranch.stdout, projectName, commitId, formattedDate, url.trim())
	})
	context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
