const vscode = require('vscode')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const os = require('os')
const axios = require('axios')
const OS = os.platform()

let task, value, timeSpent

let projectPath = vscode.workspace.workspaceFolders[0].uri.path
if (OS === 'win32') {
	projectPath = projectPath.replace(/\//g, '\\').substring(1)
}

const addJiraTask = async () => {
	task = await vscode.window.showInputBox({ prompt: 'Enter the jira task you have completed' })
}

const addTime = async () => {
	if (!isNaN(timeSpent) || timeSpent > 0) return
	value = await vscode.window.showInputBox({ prompt: 'Enter the time spent on the task in hours' })
	const integerRegex = /^\d+$/
	if (!integerRegex.test(value)) {
		vscode.window.showErrorMessage('Invalid input. Please enter a whole number without decimals.')
		return
	}
	timeSpent = parseInt(value, 10)
}

const addSpentTime = async (commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl) => {
	const branch = repoBranch.trim()
	await addTime()
	if (isNaN(timeSpent) || timeSpent <= 0) {
		vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
		if (value === undefined) {
			return
		}
		addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
	} else {
		await addJiraTask()
		if (/\w+-\d+/g.test(task) === false) {
			vscode.window.showErrorMessage('Invalid input. Please enter a valid task. ie (JIRA-000)')
			if (task === undefined) {
				return
			}
			addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
		} else {
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
								"spent-hours": "${timeSpent}",
								"commit-message": "${commitMessage}",
								"repo-branch": "${branch}"
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
				console.log(error)
				vscode.window.showErrorMessage(error)
			}
			return true
		}
	}
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash'
		const repoBranch = await exec(`cd ${projectPath} && git branch --show-current`, { shell })
		const { stdout } = await exec(
			`cd ${projectPath} && git log -1 --pretty=format:"%H,%an,%cd,%s" --date=format-local:'%a %b %d %H:%M:%S %Z %Y'`,
			{ shell }
		)
		let [commitId, author, commitTimestamp, commitMessage] = stdout.split(',')
		let repoUrl = await exec(`cd ${projectPath} && git config --get remote.origin.url`, { shell })
		// Check and remove username from repoUrl
		const regex = /https:\/\/[^@]+@/
		let url = ''
		if (regex.test(repoUrl.stdout)) {
			url = repoUrl.stdout.replace(/https:\/\/[^@]+@/, 'https://')
		} else {
			url = repoUrl.stdout
		}

		await addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch.stdout, url.trim())
	})
	context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
