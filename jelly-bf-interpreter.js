JellyBFInterpreter=function(codeString,get_input,put_output,breakpointuint8array,globalpauseuint8array){
    this.code=codeString;
    this.get_input=get_input;
    this.put_output=put_output;
    this.breakpointuint8array=breakpointuint8array;
    this.globalpauseuint8array=globalpauseuint8array;
    this.memory_cells=30000;
    this.memory=new Uint8Array(this.memory_cells);
    this.memory_ptr=0;
    this.next_instruction_index=[];
    this.loop_pair=[];
    var loop_stack=[];
    var last_instruction_index=Number.MIN_SAFE_INTEGER;
    this.entry_point=Number.MIN_SAFE_INTEGER;
    for(var i=0;i<this.code.length;++i){
        if(this.code[i]==="["){
            loop_stack.push(i);
        }
        else if(this.code[i]==="]"){
            if(loop_stack.length===0)throw JellyBFInterpreter.CompileError.LOOPS_IMBALANCED;
            var openingindex=loop_stack.pop();
            this.loop_pair[openingindex]=i;
            this.loop_pair[i]=openingindex;
        }
        if("<>+-[],.".indexOf(this.code[i])!==-1){
            if(last_instruction_index!==Number.MIN_SAFE_INTEGER)this.next_instruction_index[last_instruction_index]=i;
            else this.entry_point=i;
            last_instruction_index=i;
        }
    }
    if(loop_stack.length!==0)throw JellyBFInterpreter.CompileError.LOOPS_IMBALANCED;
    this.next_instruction_index[last_instruction_index]=Number.MAX_SAFE_INTEGER;
    this.instruction_ptr=this.entry_point;
};
JellyBFInterpreter.CompileError={
    LOOPS_IMBALANCED:1
};
JellyBFInterpreter.RuntimeError={
    INVALID_MEMORY_ACCESS:1,
    INTEGER_OVERFLOW:2
};
JellyBFInterpreter.RunResult={
    PROGRAM_TERMINATED:1,
    PAUSED_AT_BREAKPOINT:2,
    PAUSED_WITHOUT_BREAKPOINT:3
};
// all runtime errors are checked *before* executing the instruction
JellyBFInterpreter.prototype.run=function(){
    while(this.instruction_ptr!=Number.MAX_SAFE_INTEGER){
        if(this.code[this.instruction_ptr]==="<"){
            if(this.memory_ptr===0)throw JellyBFInterpreter.RuntimeError.INVALID_MEMORY_ACCESS;
            --this.memory_ptr;
        }
        else if(this.code[this.instruction_ptr]===">"){
            if(this.memory_ptr+1===this.memory_cells)throw JellyBFInterpreter.RuntimeError.INVALID_MEMORY_ACCESS;
            ++this.memory_ptr;
        }
        else if(this.code[this.instruction_ptr]==="+"){
            this.memory[this.memory_ptr]=(this.memory[this.memory_ptr]+1)&255;
        }
        else if(this.code[this.instruction_ptr]==="-"){
            this.memory[this.memory_ptr]=(this.memory[this.memory_ptr]-1)&255;
        }
        else if(this.code[this.instruction_ptr]==="["){
            if(this.memory[this.memory_ptr]===0){
                this.instruction_ptr=this.loop_pair[this.instruction_ptr];
            }
        }
        else if(this.code[this.instruction_ptr]==="]"){
            if(this.memory[this.memory_ptr]!==0){
                this.instruction_ptr=this.loop_pair[this.instruction_ptr];
            }
        }
        else if(this.code[this.instruction_ptr]===","){
            this.memory[this.memory_ptr]=this.get_input();
        }
        else if(this.code[this.instruction_ptr]==="."){
            this.put_output(this.memory[this.memory_ptr]);
        }
        else{
            throw "Internal error!";
        }
        this.instruction_ptr=this.next_instruction_index[this.instruction_ptr];
        if(Atomics.load(this.breakpointuint8array,this.instruction_ptr)!==0&&this.instruction_ptr!=Number.MAX_SAFE_INTEGER)return {type:JellyBFInterpreter.RunResult.PAUSED_AT_BREAKPOINT,index:this.instruction_ptr};
        if(Atomics.load(this.globalpauseuint8array,0)!==0&&this.instruction_ptr!=Number.MAX_SAFE_INTEGER)return {type:JellyBFInterpreter.RunResult.PAUSED_WITHOUT_BREAKPOINT};
    }
    return {type:JellyBFInterpreter.RunResult.PROGRAM_TERMINATED};
};