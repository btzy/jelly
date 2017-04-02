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





/*var JellyBFLinearConstant=function(value){
    this._value=value;
};
JellyBFLinearConstant.Comparer=function(a,b){
    return a._value-b._value;
};*/
var JellyBFLinearStateRef=function(index){
    this._index=index;
}
JellyBFLinearStateRef.sortOrder=1;
JellyBFLinearStateRef.Comparer=function(a,b){
    return a._index-b._index;
};
JellyBFLinearStateRef.prototype.addShift=function(index_shift,input_shift){
    this._index+=index_shift;
};
var JellyBFLinearInputRef=function(index){
    this._index=index;
}
JellyBFLinearInputRef.sortOrder=2;
JellyBFLinearInputRef.Comparer=function(a,b){
    return a._index-b._index;
};
JellyBFLinearInputRef.prototype.addShift=function(index_shift,input_shift){
    this._index+=input_shift;
};
var JellyBFLinearTermParts={};
JellyBFLinearTermParts.Comparer=function(a,b){
    var aproto=Object.getPrototypeOf(a);
    var bproto=Object.getPrototypeOf(b);
    if(aproto!==bproto){
        return aproto.sortOrder-bproto.sortOrder;
    }
    return aproto.Comparer(a,b);
};
var JellyBFLinearTerm=function(coefficient){
    this._parts=[]; // JellyBFLinearStateRef/JellyBFLinearInputRef, kept sorted
    this._coefficient=coefficient;
};
JellyBFLinearTerm.makeConstant=function(value){
    var ret=new JellyBFLinearTerm();
    ret._coefficient=value;
    return ret;
};
JellyBFLinearTerm.Comparer=function(a,b){
    var maxlen=Math.max(a._parts.length,b._parts.length);
    for(var i=0;i<maxlen;++i){
        if(a._parts.length<=i)return -1;
        if(b._parts.length<=i)return 1;
        var ret=JellyBFLinearTermParts.Comparer(a._parts[i],b._parts[i]);
        if(ret!==0)return ret;
    }
    return 0;
};
JellyBFLinearTerm.FinderLow=function(a){
    return function(arg){
        return JellyBFLinearTerm.Comparer(arg,a)>=0;
    };
};
JellyBFLinearTerm.IsEqual=function(a,b){
    if(a._parts.length!==b._parts.length)return false;
    var len=a._parts.length;
    for(var i=0;i<len;++i){
        var ret=JellyBFLinearTermParts.Comparer(a._parts[i],b._parts[i]);
        if(ret!==0)return false;
    }
    return true;
};
JellyBFLinearTerm.prototype.addWith=function(linearterm){ // assumes _parts are matching
    this._coefficient+=linearterm._coefficient;
};
JellyBFLinearTerm.prototype.isZero=function(){
    return this._coefficient===0;
};
/*JellyBFLinearTerm.type={
    STATE:0,
    INPUT:1
};*/
var JellyBFLinear=function(){
    this._terms=[]; // JellyBFLinearTerm, sorted by term type
};
JellyBFLinear.prototype.addTerm=function(linearterm){
    if(linearterm.isZero())debugger;
    var dataIndex=this._terms.findIndex(JellyBFLinearTerm.FinderLow(linearterm));
    if(dataIndex===-1){ // all elements smaller than new one
        this._terms.push(linearterm);
    }
    else if(JellyBFLinearTerm.IsEqual(this._terms[dataIndex],linearterm)){ // found an element
        this._terms[dataIndex].addWith(linearterm);
        if(this._terms[dataIndex].isZero())this._terms.splice(dataIndex,1); // destroy term if resulting coefficient is zero.
    }
    else{ // insert at current location (before current element)
        this._terms.splice(dataIndex,0,linearterm);
    }
};
JellyBFLinear.prototype.isZero=function(){
    return this._terms.length===0;
};
JellyBFLinear.prototype.coalesceWith=function(jellyBFlinear){
    var that=this;
    jellyBFlinear._terms.forEach(function(term){
        that.addTerm(term);
    });
};


var JellyBFRangeEntry=function(index){
    this._index=index;
    this._combination=new JellyBFLinear(); // JellyBFLinear
};
JellyBFRangeEntry.Comparer=function(a,b){
    return a._index-b._index;
};
// returns true if arg>=a
JellyBFRangeEntry.FinderLow=function(a){
    return function(arg){
        return arg._index>=a._index;
    };
};
JellyBFRangeEntry.FinderLowIndex=function(index){
    return function(arg){
        return arg._index>=index;
    };
};
JellyBFRangeEntry.IsEqual=function(a,b){
    return a._index===b._index;
};
JellyBFRangeEntry.IsEqualIndex=function(a,index){
    return a._index===index;
};
JellyBFRangeEntry.prototype.addTerm=function(linearterm){
    this._combination.addTerm(linearterm);
};
JellyBFRangeEntry.prototype.isZero=function(){
    return this._combination.isZero();
};
JellyBFRangeEntry.prototype.coalesceWith=function(jellyBFrangeentry){ // jellyBFrangeentry._index must match
    this._combination.coalesceWith(jellyBFrangeentry._combination);
};
JellyBFRangeEntry.makeFromTerm=function(index,term){
    if(!(term instanceof JellyBFLinearTerm))debugger;
    var ret=new JellyBFRangeEntry(index);
    ret.addTerm(term);
    return ret;
};


var JellyBFRangeDelta=function(){
    this._data=[]; // sorted by entry._index
    this._outputs=[]; // in order of output
    this._exitindex=0;
    this._inputcount=0;
    // both _data and _outputs contain JellyBFRangeEntrys
};
JellyBFRangeDelta.prototype.addEntry=function(jellyBFrangeentry){
    var dataIndex=this._data.findIndex(JellyBFRangeEntry.FinderLow(jellyBFrangeentry));
    if(dataIndex===-1){ // all elements smaller than new one
        this._data.push(jellyBFrangeentry);
    }
    else if(JellyBFRangeEntry.IsEqual(this._data[dataIndex],jellyBFrangeentry)){ // found an element
        this._data[dataIndex].coalesceWith(jellyBFrangeentry);
        if(this._data[dataIndex].isZero())this._data.splice(dataIndex,1);
    }
    else{ // insert at current location (before current element)
        this._data.splice(dataIndex,0,jellyBFrangeentry);
    }
};
JellyBFRangeDelta.prototype.addDelta=function(index,delta){
    var dataIndex=this._data.findIndex(JellyBFRangeEntry.FinderLowIndex(index));
    if(dataIndex===-1){ // all elements smaller than new one
        if(delta!==0)this._data.push(JellyBFRangeEntry.makeFromTerm(index,JellyBFLinearTerm.makeConstant(delta)));
    }
    else if(JellyBFRangeEntry.IsEqualIndex(this._data[dataIndex],index)){ // found an element
        this._data[dataIndex].addTerm(JellyBFLinearTerm.makeConstant(delta));
        if(this._data[dataIndex].isZero())this._data.splice(dataIndex,1);
    }
    else{ // insert at current location (before current element)
        if(delta!==0)this._data.splice(dataIndex,0,JellyBFRangeEntry.makeFromTerm(index,JellyBFLinearTerm.makeConstant(delta)));
    }
};
JellyBFRangeDelta.prototype.addExitDelta=function(delta){
    this._exitindex+=delta;
};

JellyBFRangeDelta.prototype.coalesceWith=function(jellyBFrangedelta){
    var that=this;
    // amend the argument
    var exitindex_offset=this._exitindex;
    var inputindex_offset=this._inputcount;
    jellyBFrangedelta._data.forEach(function(rangeentry){
        rangeentry._index+=exitindex_offset;
        rangeentry._combination._terms.forEach(function(linearterm){
            linearterm._parts.forEach(function(linearpart){
                linearpart.addShift(exitindex_offset,inputindex_offset);
            });
        });
    });
    jellyBFrangedelta._outputs.forEach(function(linearcombination){
        linearcombination._terms.forEach(function(linearterm){
            linearterm._parts.forEach(function(linearpart){
                linearpart.addShift(exitindex_offset,inputindex_offset);
            });
        });
    });
    // add argument to myself
    jellyBFrangedelta._data.forEach(function(entry){
        that.addEntry(entry);
    });
    jellyBFrangedelta._outputs.forEach(function(linearcombination){
        that._outputs.push(linearcombination);
    });
    this._exitindex+=jellyBFrangedelta._exitindex;
    this._inputcount+=jellyBFrangedelta._inputcount;
};


