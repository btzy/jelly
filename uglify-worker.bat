call uglifyjs wasm32codegen.max.js jelly-bf-compiler.js jelly-bf-sync.js jelly-bf-worker.js --mangle toplevel --compress sequences,unsafe,comparisons,unsafe_comps,pure_getters,collapse_vars,reduce_vars,keep_fargs=false,passes=5 --screw-ie8 --output jelly-bf-worker.min.js