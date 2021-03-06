# hafl 

A vscode extension for managing and interacting with fuzz sessions

## Current features
### Launching a libfuzzer session

![image](./docs/images/command_palette.png)

Requires a build script that will build and produce an executable with libfuzzer instrumentation and a libfuzzer entrypoint. 

Running the vscode command will start the fuzzer and create a folder under `.hafl` where the logs for that fuzzer run will be stored  

Note: Currently the paths and filenames are hardcoded, this will change in the future. It currently expects the build at `.hafl/build.sh`

### Viewing the current coverage of the fuzz corpus

![image](./docs/images/coverage.png)

Requires a second build script that will instrument with llvm source coverage instead of libfuzzer instrumentation, also uses another vscode extension (code gutters) to display the coverage

Note: Again a hardcoded path, `.hafl/build_w_cov.sh`

### Collecting inputs that reach certain lines or branches (in progress)

![image](./docs/images/branch_flipping.png)

Collects the inputs in the fuzz corpus that reach the selected line or branch. Currently this is only displayed in the debug terminal, ideally this will pop open a new window or something like that

## Planned features
- Symbolic analysis to flip branches
  - See `docs/symbolic_exec_and_human_input.md`

- A summary component/webview that displays the stats from the fuzzer as well as other relevant information on the fuzzer's progress
  - Examples: Code coverage, current frontiers, fuzzer warnings

- An actual working configuration file (variable paths for build scripts and binary names instead of hardcoded ones)
- Incorporate a code coverage displaying project into hafl instead of having it be a seperate extension
- Automatic generation of build scripts/Providing automated scripts to create build scripts for `cmake` or `meson` projects