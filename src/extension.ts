import * as vscode from 'vscode';
import * as hafl from './hafl';

export function activate(context: vscode.ExtensionContext) {
	console.log('Starting hafl');

	let d1 = vscode.commands.registerCommand('hafl.createFolder', () => {
		hafl.createFolder();
	});

	let d2 = vscode.commands.registerCommand('hafl.runFuzzer', () => {
		hafl.runFuzzer();
	});

	context.subscriptions.push(d1);
	context.subscriptions.push(d2);
}

// this method is called when your extension is deactivated
export function deactivate() {}
