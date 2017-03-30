var JellyBFCompiler={};

// returns wasm bytecode as uintarray
JellyBFCompiler.compile=function(str,options){
    var codeChunks=[]; // JellyBFData or string
    // to consider making JellyBFData support "undefined deltas" - to represent undefined values from input or previous loops
    // to keep a "current state" in order to do JellyBF_CloseAndAttemptUnrollLoop effectively
    for(var i=0;i<str.length;++i){
        switch(str[i]){
            case '+':
                var newDelta=new JellyBFDelta();
                newDelta.applyDelta(0,1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '-':
                var newDelta=new JellyBFDelta();
                newDelta.applyDelta(0,-1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '>':
                var newDelta=new JellyBFDelta();
                newDelta.applyExitDelta(1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '<':
                var newDelta=new JellyBFDelta();
                newDelta.applyExitDelta(-1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '[':
                codeChunks.push('[');
                break;
            case ']':
                JellyBF_CloseAndAttemptUnrollLoop(codeChunks);
                break;
            case ',':
                codeChunks.push(',');
                break;
            case '.':
                codeChunks.push('.');
                break;
        }
    }
    return JellyBF_WriteCodeChunksToModule(codeChunks);
};


var JellyBF_WriteCodeChunksToModule=function(codeChunks){
    var moduleWriter=new Wasm32ModuleWriter();
        
    var memoryWriter=new Wasm32MemoryWriter(16,16);
    moduleWriter.setMemory(memoryWriter);
    
    var codeWriter=new Wasm32CodeWriter([Wasm32VarType.i32]); // local0:ptr
    for(var i=0;i<codeChunks.length;++i){
        if(codeChunks[i] instanceof JellyBFDelta){
            if(codeChunks[i]._data.length>0){
                var offset=codeChunks[i]._data[0]._index;
                if(offset>0)offset=0;
                if(offset<0){
                    if(codeChunks[i]._exitindex<offset){
                        offset=codeChunks[i]._exitindex;
                    }
                    codeWriter.get_local(0);
                    codeWriter.i32_const(offset);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
                codeChunks[i]._data.forEach(function(entry){
                    codeWriter.get_local(0);
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(entry._index-offset);
                    codeWriter.i32_const(entry._delta);
                    codeWriter.i32_add();
                    codeWriter.i32_store8(entry._index-offset);
                });
                if(codeChunks[i]._exitindex-offset!==0){
                    codeWriter.get_local(0);
                    codeWriter.i32_const(codeChunks[i]._exitindex-offset);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
            }
            else{
                if(codeChunks[i]._exitindex!==0){
                    codeWriter.get_local(0);
                    codeWriter.i32_const(codeChunks[i]._exitindex);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
            }
        }
        else{
            switch(codeChunks[i]){
                case '[':
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.if(Wasm32VarType.none);
                    codeWriter.loop(Wasm32VarType.none);
                    break;
                case ']':
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.br_if(0);
                    codeWriter.end();
                    codeWriter.end();
                    break;
                case ',':
                    codeWriter.get_local(0);
                    codeWriter.call("input"); // input: [] => [i32]
                    codeWriter.i32_store8(0);
                    break;
                case '.':
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.call("output"); // output: [i32] => []
                    break;
            }
        }
    }
    codeWriter.end();
    
    var type=new Wasm32TypeWriter([],[]).toUint8Array();
    moduleWriter.addFunction("main",type,codeWriter);

    moduleWriter.exportFunction("main","main");
    moduleWriter.importFunction("input",new Wasm32TypeWriter([],[Wasm32VarType.i32]).toUint8Array(),"interaction","input");
    moduleWriter.importFunction("output",new Wasm32TypeWriter([Wasm32VarType.i32],[]).toUint8Array(),"interaction","output");

    var byteCode=moduleWriter.generateModule();
    
    return byteCode;
};


var JellyBFEntry=function(index,delta){
    this._index=index;
    this._delta=delta;
};
var JellyBFDelta=function(){
    this._data=[];
    this._exitindex=0;
};
JellyBFDelta.prototype.applyDelta=function(index,delta){
    var dataIndex=this._data.findIndex(function(el){
        return el._index>=index;
    });
    if(dataIndex===-1){ // all elements smaller than new one
        if(delta!==0)this._data.push(new JellyBFEntry(index,delta));
    }
    else if(this._data[dataIndex]._index===index){ // found an element
        this._data[dataIndex]._delta+=delta;
        if(this._data[dataIndex]._delta===0)this._data.splice(dataIndex,1);
    }
    else{ // insert at current location (before current element)
        if(delta!==0)this._data.splice(dataIndex,0,new JellyBFEntry(index,delta));
    }
};
JellyBFDelta.prototype.applyExitDelta=function(delta){
    this._exitindex+=delta;
};
JellyBFDelta.prototype.coalesceWith=function(jellyBFdelta){
    var that=this;
    jellyBFdelta._data.forEach(function(entry){
        that.applyDelta(that._exitindex+entry._index,entry._delta);
    });
    this._exitindex+=jellyBFdelta._exitindex;
};
// [{index:number,delta:number}] sorted from smallest to largest index


var JellyBF_InsertAndAttemptCoalesceDeltas=function(codeChunks,newDelta){
    if(codeChunks.length>0&&(codeChunks[codeChunks.length-1] instanceof JellyBFDelta)){
        codeChunks[codeChunks.length-1].coalesceWith(newDelta);
    }
    else{
        codeChunks.push(newDelta);
    }
};

var JellyBF_CloseAndAttemptUnrollLoop=function(codeChunks){
    if(codeChunks.length>1&&(codeChunks[codeChunks.length-1] instanceof JellyBFDelta)&&(codeChunks[codeChunks.length-2]==='[')){ // empty loop
        // TODO.
    }
    codeChunks.push(']');
}