#!/usr/local/bin/python

import driller
import sys 
import hashlib
import os 

DRILLER_OUTPUT_DIR = "/hafl/fuzz-corpus"
binary_path = sys.argv[1]
test_case_path = sys.argv[2]
print(f"Drilling {binary_path}, input: {test_case_path}")
d = driller.Driller(binary_path,  
                    open(test_case_path, "rb").read(), 
                    "\xff" * 65535, # AFL bitmap with no discovered transitions
                   )

new_seeds = d.drill()
print(f"Driller got {len(new_seeds)} new seeds")

for seed in new_seeds:
    filename = hashlib.sha1(input).hexdigest()
    with open(os.path.join(DRILLER_OUTPUT_DIR, filename), 'wb') as dest:
        dest.write(seed)