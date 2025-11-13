const { registerOpenBox } = require('./commands/openBox')

function activate(context) {
	const disposable = registerOpenBox(context)
	context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = { activate, deactivate }
