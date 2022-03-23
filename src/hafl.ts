import { Uri, window, workspace, RelativePattern } from "vscode";
import { ChildProcessWithoutNullStreams, spawn, execSync } from "child_process";
import * as fs from "fs";
import EventEmitter = require("events");
import internal = require("stream");
import { TextEncoder } from "util";

// currently relies on build.sh resulting in a binary called fuzz-target in ./.hafl
export async function buildTarget(basePath: Uri, buildPath: Uri, targetName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        window.showInformationMessage(`Building ${targetName}`);
        console.log("Starting build");
        let build = spawn(buildPath.fsPath, { cwd: basePath.fsPath });
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

    soutLog.on('error', (err) => {
        console.log(err);
    });
    serrLog.on('error', (err) => {
        console.log(err);
    });

    soutLog.write("Fuzzer stdout log\n");
    serrLog.write("Fuzzer stderr log\n");

    return [workDir, movedBinary, soutLog, serrLog];
}

async function logOutput(proc: ChildProcessWithoutNullStreams, soutLog: fs.WriteStream, serrLog: fs.WriteStream) {
    proc.stdout.on('data', (data) => {
        soutLog.write(data);
    });

    proc.stderr.on('data', (data) => {
        serrLog.write(data);
    });

    proc.on('close', async (code) => {
        await window.showInformationMessage(`libFuzzer process closed with code ${code}`);
        soutLog.on('finish', () => {
            soutLog.end();
        });

        serrLog.on('finish', () => {
            serrLog.end();
        });

    });
}

export function stopLibFuzzerTarget() {
    console.log("Killing fuzzer");
    execSync("killall -SIGUSR1 fuzz-target");
}

export async function startLibFuzzerTarget(haflPath: Uri, _binaryPath: Uri) {
    console.log("Starting libfuzzer target");
    let [workDir, binaryPath, soutLog, serrLog] = await createWorkingDirectory(haflPath, _binaryPath);

    // Libfuzzer targets are started by just executing them
    let seedPaths = [Uri.joinPath(haflPath, "fuzz-corpus").fsPath, Uri.joinPath(haflPath, "seeds").fsPath];
    let proc = spawn(binaryPath.fsPath, seedPaths, { cwd: workDir.fsPath });
    await logOutput(proc, soutLog, serrLog);

    await startLibFuzzerCov(workDir, haflPath, Uri.joinPath(haflPath, "coverage-target"));
}

declare interface CoverageMaker {
    on(event: 'new_cov', listener: (this: CoverageMaker) => void): this;
    on(event: string, listener: Function): this;
}

class CoverageMaker extends EventEmitter {
    i: number = 80;
    emitCov(): void {
        this.emit('new_cov', this);
    }
}

export async function startLibFuzzerCov(workDir: Uri, haflPath: Uri, _covPath: Uri) {
    let movedCov = Uri.joinPath(workDir, "coverage-target");
    await workspace.fs.copy(_covPath, movedCov);

    let covFolder = Uri.joinPath(workDir, "cov/");
    let profDataFile = Uri.joinPath(workDir, "cov.profdata");
    let lcovFile = Uri.joinPath(workDir, "lcov.info");

    // start a timer that creates coverage files occasionally
    let covMaker = new CoverageMaker();
    covMaker.on('new_cov', (self: CoverageMaker) => {
        self.i += 1;
        if (self.i >= 100) {
            self.i = 0;
            console.log(`Merging coverage`);
            try {
                execSync(`llvm-profdata merge -sparse ${covFolder.fsPath}/* -o ${profDataFile.fsPath}`);
                console.log(`Exporting`);
                let stdout = execSync(`llvm-cov export --format=lcov ${movedCov.fsPath} -instr-profile=${profDataFile.fsPath}`);
                if (typeof stdout === "string") {
                    let enc = new TextEncoder();
                    workspace.fs.writeFile(lcovFile, enc.encode(stdout));
                } else {
                    workspace.fs.writeFile(lcovFile, stdout);
                }
                
                console.log(`Summary`);
                let summary = execSync(`llvm-cov report ${movedCov.fsPath} -instr-profile=${profDataFile.fsPath}`)
                let lines = summary.toString().split("\n");
                console.log(lines[lines.length - 2]);
            } catch (e) {
                console.log(`Failed to generate coverage: ${e}`);
            }
        }
    });

    // spawn a watcher that watches Uri.joinPath(haflPath, "fuzz-corpus").fsPath
    let path = Uri.joinPath(haflPath, "fuzz-corpus/").fsPath;
    let watcher = workspace.createFileSystemWatcher(new RelativePattern(path, "*"));
    // watcher.onDidChange(uri => { console.log (`Change: ${uri.fsPath}`); });
    // watcher.onDidDelete(uri => { console.log (`Delete: ${uri.fsPath}`); });
    watcher.onDidCreate(uri => {
        let parts = uri.toString().split("/");
        let filename = parts[parts.length - 1];
        let profFilePath = Uri.joinPath(covFolder, filename + ".profraw");
        // console.log (`Create: ${uri.fsPath} | Making cov file ${profFilePath.fsPath}`); 
        let proc = spawn(movedCov.fsPath, [uri.fsPath], { env: { LLVM_PROFILE_FILE: profFilePath.fsPath } });
        proc.on('close', async (code) => {
            // console.log(`Done generating ${profFilePath.fsPath}`);
            covMaker.emitCov();
        });
    });
}