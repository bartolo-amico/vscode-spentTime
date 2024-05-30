const vscode = require('vscode')
const exec = require('child_process').exec

let task,
value,
timeSpent

const projectPath = vscode.workspace.workspaceFolders[0].uri.path

module.exports = {
	activate,
}

const execShell = cmd =>
	new Promise(resolve => {
		exec(cmd, (err, out) => {
			if (err) {
				return resolve(err + ' error!')
			}
			return resolve(out)
		})
	})

let fsWait = false

function debounceFsWatch() {
	if (fsWait) return true
	setTimeout(() => {
		fsWait = false
	}, 300)
}

const addJiraTask = async () => {
	task = await vscode.window.showInputBox({ prompt: 'Enter the jira task you have completed' })
}

const addTime = async () => {
	if (!isNaN(timeSpent) || timeSpent > 0) return
	value = await vscode.window.showInputBox({ prompt: 'Enter the time spent on the task in hours' })
	timeSpent = parseFloat(value)
}

const addSpentTime = async (commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl) => {
	const branch = repoBranch.split('>')[1].trim()
	await addTime()
	if (isNaN(timeSpent) || timeSpent <= 0) {
		vscode.window.showErrorMessage('Invalid input. Please enter a positive number.')
		addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
	} else {
		await addJiraTask()
		if(/\w+-\d+/g.test(task) === false) {
			vscode.window.showErrorMessage('Invalid input. Please enter a valid task. ie (JIRA-000)')
			addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
		} else {
 			try {
	 			await execShell(`curl --location 'https://prod-13.westeurope.logic.azure.com/workflows/15ffb8208ba64e39910e5e363b6971b7/triggers/manual/paths/invoke/track?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YW2B2i2RRO3tAt3VARU6kFOoNCi8uj0bnIFaZzMOU0o' \
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
				vscode.window.showInformationMessage('Time spent successfully logged!')
			} catch (error) {
				vscode.window.showErrorMessage(error)
			}
			return true
		}
	}
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('spentTime.openBox', async () => {
		const output = await execShell(`cd ${projectPath} && git log -1 --pretty=format:"%H,%an,%cd,%s,%D"`)
		let [commitId, author, commitTimestamp, commitMessage, repoBranch] = output.split(',')
		let repoUrl = await execShell(`cd ${projectPath} && git config --get remote.origin.url`)
		addSpentTime(commitId, author, commitTimestamp, commitMessage, repoBranch, repoUrl)
	})
	context.subscriptions.push(disposable)
}
