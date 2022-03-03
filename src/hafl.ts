import { Uri, window, workspace } from "vscode";
import { spawn } from "child_process";
import * as fs from "fs";

// currently relies on build.sh resulting in a binary called fuzz-target in ./.hafl
export async function buildTarget(basePath: Uri, buildPath: Uri): Promise<void> {
    return new Promise((resolve, reject) => {
        window.showInformationMessage("Building fuzz target (via build.sh)");
        console.log("Starting build");
        let build = spawn(buildPath.fsPath, {cwd: basePath.fsPath});
        build.on('error', (err) => {
            window.showInformationMessage(`Failed to build: ${err}`);
            reject();
        });

        build.stdout.on('data', (data) => {
            console.log(`${data}`);
        });

        build.stderr.on('data', (data) => {
            console.log(`${data}`);
        });

        build.on('close', (code) => { resolve(); });
    });
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
    await workspace.fs.copy(binaryPath, movedBinary);
    
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
    console.log("Starting libfuzzer target");
    let [workDir, binaryPath, soutLog, serrLog] = await createWorkingDirectory(haflPath, _binaryPath);

    // Libfuzzer targets are started by just executing them
    let seedPaths = [Uri.joinPath(haflPath, "fuzz-corpus").fsPath, Uri.joinPath(haflPath, "seeds").fsPath];
    let proc = spawn(binaryPath.fsPath, seedPaths, { cwd: workDir.fsPath });

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