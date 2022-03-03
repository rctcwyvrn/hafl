import { Uri, window, workspace } from "vscode";
import { spawn } from "child_process";
import { stdout } from "process";
import * as util from "util";
import * as fs from "fs";

export async function buildTarget(basePath: Uri, buildPath: Uri): Promise<boolean> {
    let execFile = util.promisify(require('child_process').execFile);
    try {
        let out = await execFile(buildPath.fsPath, {cwd: basePath.fsPath});
        console.log(`Build log: ${out.stdout} ${out.stderr}`);
        return true;
    } catch (e) {
        window.showInformationMessage(`Failed to build: ${e}`);
        return false;
    }
}

export function startAFLTarget(targetPath: Uri) {

}

async function createWorkingDirectory(haflPath: Uri, binaryPath: Uri): Promise<[Uri, Uri, fs.WriteStream, fs.WriteStream]> {
    let date = new Date();
    let folderName = date.getFullYear() + 
        "-" + ("0" + (date.getMonth() + 1)).slice(-2) + 
        "-" + ("0" + date.getDate()).slice(-2) + 
        "-" + date.getHours() + 
        "_" + date.getMinutes() + 
        "_" + date.getSeconds();

    window.showInformationMessage(`Spawning fuzzer thread with output folder (${folderName})`);

    let workDir = Uri.joinPath(haflPath, folderName);
    await workspace.fs.createDirectory(workDir);
    let movedBinary = Uri.joinPath(workDir, "fuzz-target");
    await workspace.fs.rename(binaryPath, movedBinary);
    
    let soutPath = Uri.joinPath(workDir, "fuzzer.log");
    await workspace.fs.writeFile(soutPath, new Uint8Array);
    let serrPath = Uri.joinPath(workDir, "error.log");
    await workspace.fs.writeFile(serrPath, new Uint8Array);

    let soutLog = fs.createWriteStream(soutPath.fsPath);
    let serrLog = fs.createWriteStream(Uri.joinPath(workDir, "error.log").fsPath);

    soutLog.on('error',  (err) => {
        console.log(err);
    });
    serrLog.on('error',  (err) => {
        console.log(err);
    });

    soutLog.write("Fuzzer stdout log\n");
    serrLog.write("Fuzzer stderr log\n");

    return [workDir, movedBinary, soutLog, serrLog];
}

export async function startLibFuzzerTarget(haflPath: Uri, _binaryPath: Uri) {
    let [workDir, binaryPath, soutLog, serrLog] = await createWorkingDirectory(haflPath, _binaryPath);

    // Libfuzzer targets are started by just executing them
    const proc = spawn(binaryPath.fsPath, { cwd: workDir.fsPath });

    proc.stdout.on('data', (data) => {
        soutLog.write(data);
    });

    proc.stderr.on('data', (data) => {
        serrLog.write(data);
    });

    proc.on('close', (code) => {
        window.showInformationMessage(`libFuzzer process closed with code ${code}`);
        soutLog.on('finish', () => {
            soutLog.end();
        });

        serrLog.on('finish', () => {
            serrLog.end();
        });
        
    });
}