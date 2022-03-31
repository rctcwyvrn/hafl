import * as vscode from 'vscode';
import * as hafl from './hafl';
import { execSync } from 'child_process';

export async function flipBranch() {
    let editor = vscode.window.activeTextEditor!;
    let selection = editor.selection;
    let position = selection.active;
    let doc = editor?.document;

    let lineNum = position.line + 1;
    console.log(`File: ${doc.fileName} | line #: ${lineNum}`);

    // let covDir = vscode.Uri.joinPath(hafl.currentWorkDir, "cov-tmp");
    let covDir = vscode.Uri.parse("/home/lily/tmp/fuzzer-test-suite/woff2-2016-05-06/.hafl/2022-03-30-12_8_52/cov-tmp");

    // look for test cases where one branch is taken but not the other
    // if the user wants to flip this branch, only one of the two will match, but just use one generic regex so we don't need to ask the user if they
    // want to flip true to false or vice versa
    let regexp = `SF:.*${doc.fileName}\\n((FN|FNDA|FNF|FNH|DA|BRDA|BRF|BFH|LF|LH):.*\\n)+(BRDA:${lineNum},.,0,0\nBRDA:${lineNum},.,1,[^0-]|BRDA:${lineNum},.,0,[^0-]\\nBRDA:${lineNum},.,1,0)`;
    console.log(`regex: ${regexp}`);
    // let results = await rg(covDir.fsPath, {string: regexp, multiline: true});
    // const [first] = results;
    // console.log(`Result: ${first}`);

    let args = ["--colors=path:none", "--multiline", "-c", "-e", `\"${regexp}\"`, covDir.fsPath];
    console.log(args);
    console.log("rg " + args.join(" "));

    try {
        let result = execSync("rg " + args.join(" "));
        let matches = result.toString().split("\n").filter((s) => s.length > 0).map((match) => match.split("/n").pop()!.split(":")[0]);
        console.log(matches);
        let cases = matches.map((path) => path.split("/").pop()!)
            .map((lcovFile) => {
                let split = lcovFile.split(".");
                return split[split.length - 2];
            });
        console.log(cases);
    } catch (e) {
        console.log("No match");
    }

    // docker run -v $(pwd)/.hafl:/hafl -e PYTHONUNBUFFERED=1 driller:latest /hafl/driller-target /hafl/fuzz-corpus/ffa3147a5aecb88977af2805c6a2da67fb8dcae1 
} 