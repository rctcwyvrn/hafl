import * as vscode from 'vscode';
import * as hafl from './hafl';
import { TextEncoder } from 'util';
import { getConfigSettings, State} from './utils/multiStepInput';

export function activate(context: vscode.ExtensionContext) {
	console.log('Starting hafl');

	let d1 = vscode.commands.registerCommand('hafl.createFolder', async () => {
		await createFolder();
	});

	let d2 = vscode.commands.registerCommand('hafl.runFuzzer', async () => {
		await runFuzzer();
	});

	let d3 = vscode.commands.registerCommand('hafl.buildAndRunFuzzer', async () => {
		await buildAndRunFuzzer();
	});

	context.subscriptions.push(d1);
	context.subscriptions.push(d2);
	context.subscriptions.push(d3);
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function createFolder() {
    // Note: try filepicker api
    // bothering with configs was a mistake, just hardcode everything for now
    let state = await getConfigSettings();
    vscode.window.showInformationMessage(`Creating configuration files at '${state.path}`);
    let base = vscode.workspace.workspaceFolders![0].uri;
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(base, state.path));
	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(base, state.path, "corpus"));
    let enc = new TextEncoder();
    let contents = enc.encode(JSON.stringify(state));
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(base, state.path, "config.json"), contents);
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(base, state.path, "build.sh"), new Uint8Array());

    console.log("done");
}

async function buildAndRunFuzzer() {
	// wohoo hard code everything
    let base = vscode.workspace.workspaceFolders![0].uri;
	let haflPath = vscode.Uri.joinPath(base, "/.hafl");
    let buildScript = vscode.Uri.joinPath(haflPath, "/build.sh");

	try {
		await hafl.buildTarget(base, buildScript);
		await runFuzzer();
	} catch {
		vscode.window.showErrorMessage("Fuzzer failed to start");
	};
}

async function runFuzzer () {
	// wohoo hard code everything
    let base = vscode.workspace.workspaceFolders![0].uri;
	let haflPath = vscode.Uri.joinPath(base, "/.hafl");

    let binaryPath = vscode.Uri.joinPath(haflPath, "fuzz-target"); // could be whatever, probably read binary-name from config
	let type = "libFuzzer";

	try {
		if (type === "libFuzzer") {
			await hafl.startLibFuzzerTarget(haflPath, binaryPath);
		} else {
			await hafl.startAFLTarget(binaryPath);
		} 
	} catch {
		vscode.window.showErrorMessage("Fuzzer failed to start");
	};
}