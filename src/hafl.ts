import { TextEncoder } from 'util';
import { window, workspace, Uri } from 'vscode';
import { getConfigSettings, State} from './utils/multiStepInput';
// import * as fs from 'fs/promises';

export async function createFolder() {
    // Note: try filepicker api
    let state = await getConfigSettings();
    window.showInformationMessage(`Creating configuration files at '${state.path}`);
    console.log(state);
    let base = workspace.workspaceFolders![0].uri;
    await workspace.fs.createDirectory(Uri.joinPath(base, state.path));
    let enc = new TextEncoder();
    let contents = enc.encode(JSON.stringify(state));
    console.log(contents);
    await workspace.fs.writeFile(Uri.joinPath(base, state.path, "config.json"), contents);
    // await fs.mkdir(state.path);
    // await fs.writeFile(state.path + "/config.json", JSON.stringify(state));

    console.log("done");
}

export function runFuzzer() {

}