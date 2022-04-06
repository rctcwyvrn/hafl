# Symbolic execution and human interaction

## Background
Fuzzers like AFL and libFuzzer are great at being fully automated systems for analyzing programs, you can let them run and analyze programs without having any interaction with them to great success (see OSS-Fuzz). However this is not the only potential use case for fuzzers, many security analysts use fuzzers in their workflow and run into the problem of not really knowing what is going on in the fuzzer. The fuzzer itself has a fairly clear idea of where it is in the program and what branches have been covered, but this information is opaque and simply shown as a "branches covered" number to the user. 

A nice clear interface for introspection into the fuzzer surprisingly doesn't exist for either afl or libfuzzer, leaving the analyst often confused about if the fuzzer is stuck or still making progress. Projects exist for collecting coverage of a fuzzer [aflcov] [jmpscare] but very little beyond that. The current best project for introspection into a fuzzer is https://github.com/ossf/fuzz-introspector, however that project is built for fuzz developers looking to improve their fuzzers and is tightly integrated with oss-fuzz, making it not idea for usage by an analyst.

On a totally different note, symbolic executors are another method for creating program analyzers, however they don't see the same level of success as fuzzers for a number of reasons, the most important of which is performance. Fuzzers are extremely fast and efficient, with the tradeoff being that they're imprecise and can get stuck. Symbolic executors are extremely slow and brittle but have the ability to systematically traverse the entire program. Their brittleness comes from the fact that a symbolic executor must emulate the entire state of the program, and thus the state of anything that the program might interact with, leading to having to implement syscalls, filesystems, and network connections. Not only that but a symbolic executor must also analyze every possible path of a program, resulting in even simple programs causing symbolic executors to crash due to resource constraints, this is called the 'path explosion' problem. [qsym]

Many attempts in recent years have been made to combine the two approaches, most notably in the DARPA Cyber Grand Challenge, where almost every system that particpated combined symbolic analysis and fuzzing to varying degrees. Of particular interest to me was Driller [driller], a tool that combined the pros and cons of fuzzing and symbolic executors by choosing to resort to the more heavy duty and slow symbolic executor when the fuzzer was stuck. They found that this reduced the usage of the much slower symbolic executor to the cases where it was most important, getting through complicated conditions that the fuzzer could not. However they still found that the symbolic executor could fail due to the aforementioned brittleness problems inherent to symbolic execution.

## Adding a human into the loop
For an automated system, a frozen or crashed symbolic executor is annoying to deal with. A system might see that the symbolic executor is often timing out or crashing, but it has very little it can do to reason about why that happened or how to fix it, so often times all it can do is just stop calling the symbolic executor and rely on fuzzing. Automated heuristics for when to call the fuzzer can also be inaccurate and make the wrong decision for when to call the symbolic executor.

Both of these problems can be alievated to an extent by having a human call the shots on when to use tools and how to recover from errors. 

The idea for this project is a program that allows for this example workflow
1. The analyst starts a fuzzer and lets it run on the target program
2. Seeing that the fuzzer is stuck on a certain condition that blocks it from reaching the rest of the program, the analyst decides to start a symbolic executor
3. The program finds inputs that reach that condition, displays these to the analyst, and sends them to the executor for conclic execution
4. If the conclic executor fails, the analyst is given the failure condition and information about what happened during the symbolic execution
  - Was there an unsupported syscall? -> List out the lines of source that resulted in the syscall and allow the analyst to patch them out
  - Was there an access to the environment (filesystem, network) -> Allow the analyst to hand craft an input instead of a symbolic one or one from the filesystem
  - Was the condition unsat? -> Provide an unsat core to the analyst 
  - Did the executor timeout or explode? -> Taint the inputs and provide the path that the input takes to the analyst to see if they can succeed in modifying the input manually

The capabilities of the program would include
- Introspection into the fuzzer, showing current coverage, reachable functions, and frontiers
- A concolic executor with the ability to provide information on its status, lines of the source that it executed, and why it failed
- Taint tracking for the input to see how the data flows through the program 

Other tools that this program could provide to the user are
- Quick patch abilities to remove if conditions or certain blocks of code (ie patching out a CRC check or something uninteresting)
- Introspection into how many fuzzer outputs make it to each line, and the ability to quickly view and modify these corpus files
- The option to taint track a given input to see how each part of the input flows through the program

The general idea is that automated systems are brittle and often fail in large real world programs, so instead of trying to make a system that is fully automated and able to run on its own, this system would focus on displaying relevant information to the analyst at all times, and defer to the analyst to make decisions on what to do and how to recover from failures. The other goal would be to create a simple solution for analysts wanting introspection into their fuzz sessions, getting a clear view of what functions have been reached and where the fuzzer is currently stuck at.

This system can be easily extended to include other analysis systems, including fully automated ones. For example the ability to freely switch between fuzzers when the analyst knows that one will perform better than another. Automated systems like Driller can also be added to the system, allowing for a mix between human and automated decision making.

## Other interesting ideas for human interaction
- There's a fun little issue in combining fuzzers and symbolic execution, which is that it is difficult for them to "share knowledge". The symbolic executor might know that this part of the input is a magic value that can't be touched, but the fuzzer doesn't know that. It's hard for the symbolic executor to know what is "important knowledge" that should be shared with the fuzzer, since getting that wrong might mean constraining the fuzzer to certain areas of the code. However this is something that an analyst could do with relative ease, ie label a certain part of an input as "do not touch" to the fuzzer, or even tell the fuzzer about relationships between parts of the input that must hold, ie input = magic | x | md5(x)