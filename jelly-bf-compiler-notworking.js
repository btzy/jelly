var JellyBFCompiler={};

// returns wasm bytecode as uintarray
JellyBFCompiler.compile=function(str,options){
    if(options.wraparound===undefined)options.wraparound=true; // guarantee two's compliment wraparound will work
    if(options.infiniteloops===undefined)options.infiniteloops=true; // guarantee infinite loops won't be undefined behaviour
    if(options.bitwidth===undefined)options.bitwidth=8; // number of bits per cell, default = 8
    if(options.bitwidth!==8&&options.bitwidth!==16&&options.bitwidth!==32)return; // only 8,16,32 bits allowed
    
    
    var codeChunks=[]; // JellyBFData or string
    // to consider making JellyBFData support "undefined deltas" - to represent undefined values from input or previous loops
    // to keep a "current state" in order to do JellyBF_CloseAndAttemptUnrollLoop effectively
    for(var i=0;i<str.length;++i){
        switch(str[i]){
            case '+':
                var newDelta=new JellyBFRangeDelta();
                newDelta.addDelta(0,1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '-':
                var newDelta=new JellyBFRangeDelta();
                newDelta.addDelta(0,-1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '>':
                var newDelta=new JellyBFRangeDelta();
                newDelta.addExitDelta(1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '<':
                var newDelta=new JellyBFRangeDelta();
                newDelta.addExitDelta(-1);
                JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,newDelta);
                break;
            case '[':
                codeChunks.push('[');
                break;
            case ']':
                JellyBF_CloseAndAttemptUnrollLoop(codeChunks,options);
                break;
            case ',':
                codeChunks.push(',');
                break;
            case '.':
                codeChunks.push('.');
                break;
        }
    }
    var resolvedCodeChunks=[];
    var currentState=new JellyBFPossibleState(true);
    for(var i=0;i<codeChunks.length;++i){
        // TODO.
        // TODO: find a way to store the chunks without any state or input refs, so that they can be encoded into instructions
    }
    return JellyBF_WriteCodeChunksToModule(codeChunks);
};


var JellyBF_WriteCodeChunksToModule=function(codeChunks){
    var moduleWriter=new Wasm32ModuleWriter();
        
    var memoryWriter=new Wasm32MemoryWriter(16,16);
    moduleWriter.setMemory(memoryWriter);
    
    var codeWriter=new Wasm32CodeWriter([Wasm32VarType.i32]); // local0:ptr
    
        
    // offset the pointer
    codeWriter.i32_const(524288);
    codeWriter.set_local(0);
    
    var maxlocals=1;
    for(var i=0;i<codeChunks.length;++i){
        if(codeChunks[i] instanceof JellyBFRangeDelta){
            /*if(codeChunks[i]._data.length>0){
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
            }*/
            var jellyBFrangedelta=codeChunks[i];
            if(jellyBFrangedelta._data.length>0){
                var stateRefsLocalOffset=1;
                var stateRefs=[]; // list of stored offsets required
                // TODO: if this is a don't enter, don't enter if zero.  Also check nested subloops
                jellyBFrangedelta._data.forEach(function(entry){
                    if(entry._combination.isZero())debugger;
                    entry._combination._terms.forEach(function(term){
                        term._parts.forEach(function(part){
                            if(part instanceof JellyBFLinearStateRef){
                                var stateRefIndex=stateRefs.findIndex(function(arg){return arg>=part._index});
                                if(stateRefIndex===-1)stateRefs.push(part._index);
                                else if(stateRefs[stateRefIndex]!==part._index)stateRefs.splice(stateRefIndex,0,part._index);
                            }
                            else debugger;
                        });
                    });
                });
                var offset=Math.min(jellyBFrangedelta._data[0]._index,jellyBFrangedelta._exitindex);
                if(stateRefs.length>0)offset=Math.min(offset,stateRefs[0]);
                if(offset!==0){
                    codeWriter.get_local(0);
                    codeWriter.i32_const(offset);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
                stateRefs.forEach(function(ref,localidx){
                    var effectiveLocalIdx=stateRefsLocalOffset+localidx;
                    var effectiveOffset=ref-offset;
                    // load ref to local
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(effectiveOffset);
                    codeWriter.set_local(effectiveLocalIdx);
                });
                jellyBFrangedelta._data.forEach(function(entry){
                    if(entry._combination.isZero())debugger;
                    var effectiveOffset=entry._index-offset;
                    codeWriter.get_local(0);
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(effectiveOffset);
                    // the forEach loop below should not have any net change in items on stack
                    // it will add to the item currently on top of the stack.
                    entry._combination._terms.forEach(function(term,termindex){
                        if(term._coefficient===0)debugger;
                        if(term._parts.length===1&&term._coefficient===1){
                            var part=term._parts[0];
                            if(part instanceof JellyBFLinearStateRef){
                                var stateRefIndex=stateRefs.findIndex(function(arg){return arg>=part._index});
                                var effectiveLocalIdx=stateRefsLocalOffset+stateRefIndex;
                                codeWriter.get_local(effectiveLocalIdx);
                            }
                            else debugger;
                        }
                        else{
                            codeWriter.i32_const(term._coefficient);
                            term._parts.forEach(function(part){
                                if(part instanceof JellyBFLinearStateRef){
                                    var stateRefIndex=stateRefs.findIndex(function(arg){return arg>=part._index});
                                    var effectiveLocalIdx=stateRefsLocalOffset+stateRefIndex;
                                    codeWriter.get_local(effectiveLocalIdx);
                                    codeWriter.i32_mul();
                                }
                                else debugger;
                            });
                        }
                        codeWriter.i32_add(); // add to the value
                    });
                    codeWriter.i32_store8(effectiveOffset);
                });
                if(jellyBFrangedelta._exitindex-offset!==0){
                    codeWriter.get_local(0);
                    codeWriter.i32_const(jellyBFrangedelta._exitindex-offset);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
                maxlocals=Math.max(maxlocals,stateRefsLocalOffset+stateRefs.length);
            }
            else{
                if(jellyBFrangedelta._exitindex!==0){
                    codeWriter.get_local(0);
                    codeWriter.i32_const(codeChunks[i]._exitindex);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
            }
            //debugger;
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
    
    var localTypesParam=[];
    for(var i=0;i<maxlocals;++i){
        localTypesParam.push(Wasm32VarType.i32);
    }
    codeWriter.setLocalTypes(localTypesParam);
    
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







/*var JellyBFLinearConstant=function(value){
    this._value=value;
};
JellyBFLinearConstant.Comparer=function(a,b){
    return a._value-b._value;
};*/

// params must be positive integers
var find_gcd=function(a,b){
    if(a<b){
        var tmp=a;
        a=b;
        b=tmp;
    }
    if(b===0)return a;
    return find_gcd(b,a%b);
};
// num might be negative, den must be positive
var RationalNumber=function(num,den){
    this._sgn=(num<0); // sgn is true if negative
    this._num=Math.abs(num);
    this._den=den;
};
RationalNumber.prototype.reduce=function(){
    var gcd=find_gcd(this._num,this._den);
    this._num/=gcd;
    this._den/=gcd;
};
RationalNumber.prototype.multiplyWith=function(val){
    if(val instanceof RationalNumber){
        this._sgn=(this._sgn!==val._sgn); // this is a logical xor
        this._num*=val._num;
        this._den*=val._den;
        this.reduce();
    }
    else{
        this._sgn=(this.sgn!==(val<0));
        this.num*=Math.abs(val);
        this.reduce();
    }
};
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
JellyBFLinearStateRef.prototype.clone=function(){
    return new JellyBFLinearStateRef(this._index);
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
JellyBFLinearInputRef.prototype.clone=function(){
    return new JellyBFLinearInputRef(this._index);
};
var JellyBFLinearTermParts={};
JellyBFLinearTermParts.Comparer=function(a,b){
    var aconstructor=a.constructor;
    var bconstructor=b.constructor;
    if(aconstructor!==bconstructor){
        return aconstructor.sortOrder-bconstructor.sortOrder;
    }
    return aconstructor.Comparer(a,b);
};
JellyBFLinearTermParts.FinderLow=function(a){
    return function(arg){
        return JellyBFLinearTermParts.Comparer(arg,a)>=0;
    };
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
JellyBFLinearTerm.makeFromPart=function(part){
    var ret=new JellyBFLinearTerm(1);
    ret._parts=[part];
    return ret;
}
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
JellyBFLinearTerm.prototype.multiplyWith=function(linearterm){
    if(linearterm.isZero())debugger;
    var this_parts=this._parts;
    linearterm._parts.forEach(function(part){
        var index=this_parts.findIndex(JellyBFLinearTermParts.FinderLow(part));
        if(index===-1){
            this_parts.push(part);
        }
        else{
            this_parts.splice(index,0,part);
        }
    });
    this._coefficient*=linearterm._coefficient;
};
JellyBFLinearTerm.prototype.isZero=function(){
    return this._coefficient===0;
};
JellyBFLinearTerm.prototype.clone=function(){
    var ret=new JellyBFLinearTerm(this._coefficient);
    this._parts.forEach(function(part){
        ret._parts.push(part.clone());
    });
    return ret;
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
JellyBFLinear.prototype.multiplyTerm=function(linearterm){
    if(linearterm.isZero())debugger;
    this._terms.forEach(function(term){
        term.multiplyWith(linearterm.clone());
    });
};
JellyBFLinear.prototype.multiplyLinear=function(linearcombination){
    var old_terms=this._terms;
    var new_terms=[];
    linearcombination._terms.forEach(function(ins_term){
        old_terms.forEach(function(old_term){
            var cl=old_term.clone();
            cl.multiplyWith(ins_term.clone());
            new_terms.push(cl);
        });
    });
    new_terms.sort(JellyBFLinearTerm.Comparer);
    this._terms=new_terms;
};
JellyBFLinear.prototype.isZero=function(){
    return this._terms.length===0;
};
JellyBFLinear.prototype.clone=function(){
    var ret=new JellyBFLinear();
    this._terms.forEach(function(term){
        ret._terms.push(term.clone());
    });
    return ret;
};
JellyBFLinear.prototype.coalesceWith=function(jellyBFlinear){
    var that=this;
    jellyBFlinear._terms.forEach(function(term){
        that.addTerm(term);
    });
};
JellyBFLinear.prototype.expandState=function(jellyBFrangedelta){
    if(!(jellyBFrangedelta instanceof JellyBFRangeDelta))debugger;
    var new_terms=[];
    this._terms.forEach(function(term){
        var part_indices_for_expansion=[];
        var new_term=new JellyBFLinearTerm(term._coefficient);
        term._parts.forEach(function(part){
            if(part instanceof JellyBFLinearStateRef){
                part_indices_for_expansion.push(part._index);
            }
            else if(part instanceof JellyBFLinearOutputRef){
                new_term.push(part);
            }
            else debugger;
        });
        var lincombin=new JellyBFLinear();
        lincombin.addTerm(JellyBFLinearTerm.makeConstant(1));
        part_indices_for_expansion.forEach(function(index){
            var applyIndex=jellyBFrangedelta._data.findIndex(JellyBFRangeEntry.FinderEqualIndex(index));
            var applyCombination=new JellyBFLinear();
            applyCombination.addTerm(JellyBFLinearTerm.makeFromPart(new JellyBFLinearStateRef(index)));
            if(applyIndex!==-1){
                applyCombination.coalesceWith(jellyBFrangedelta._data[applyIndex]._combination.clone());
            }
            lincombin.multiplyLinear(applyCombination);
        });
        lincombin.multiplyTerm(new_term);
        lincombin._terms.forEach(function(term){
            new_terms.push(term);
        });
    });
    this._terms=[];
    var that=this;
    new_terms.forEach(function(term){
        that.addTerm(term);
    });
};
JellyBFLinear.IsExactSame=function(a,b){
    if(a._terms.length!==b._terms.length)return false;
    var maxlen=a._terms.length;
    for(var i=0;i<maxlen;++i){
        if(!JellyBFLinearTerm.IsEqual(a._terms[i],b._terms[i]))return false;
        if(a._terms[i]._coefficient!==b._terms[i]._coefficient)return false;
    }
    return true;
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
JellyBFRangeEntry.FinderEqual=function(a){
    return function(arg){
        return arg._index===a._index;
    };
};
JellyBFRangeEntry.FinderEqualIndex=function(index){
    return function(arg){
        return arg._index===index;
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
JellyBFRangeEntry.prototype.multiplyTerm=function(linearterm){
    this._combination.multiplyTerm(linearterm);
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
    var entries_to_add=[];
    jellyBFrangedelta._data.forEach(function(entry){
        entry._combination.expandState(that);
        entries_to_add.push(entry);
    });
    jellyBFrangedelta._outputs.forEach(function(linearcombination){
        linearcombination.expandState(that);
        that._outputs.push(linearcombination);
    });
    entries_to_add.forEach(function(entry){
        that.addEntry(entry);
    });
    for(var i=this._data.length-1;i>=0;--i){
        if(this._data[i].isZero())this._data.splice(i,1);
    }
    this._exitindex+=jellyBFrangedelta._exitindex;
    this._inputcount+=jellyBFrangedelta._inputcount;
};

JellyBFRangeDelta.prototype.wrapWithLoop=function(options){
    if(this._exitindex===0){ // non-shifting loop
        var dataIndex=this._data.findIndex(JellyBFRangeEntry.FinderEqualIndex(0));
        if(dataIndex===-1){ // zero! loop will be infinite or no-op
            return false; // don't need to wrap, program execution will get stuck here
            // TODO: some way to signal that it is an infinite loop
        }
        else if(JellyBFLinear.IsExactSame(this._data[dataIndex]._combination,JellyBFRangeEntry.makeFromTerm(0,JellyBFLinearTerm.makeConstant(-1))._combination)){  // is -1
            // for now, we can only expand loop when all parameters are constants
            // TODO: improve this
            /*var is_all_constant=true;
            this._data.forEach(function(jellybfentry){
                jellybfentry._combination._terms.forEach(function(term){
                    if(term._parts.length!==0)is_all_constant=false;
                });
            });
            if(!is_all_constant)return false;*/
            
            this._data.forEach(function(jellybfentry){
                var newTerm=new JellyBFLinearTerm(1);
                newTerm._parts.push(new JellyBFLinearStateRef(0));
                jellybfentry.multiplyTerm(newTerm);
            });
            return true;
        }
        /*else if(JellyBFLinear.IsExactSame(this._data[dataIndex]._combination,JellyBFRangeEntry.makeFromTerm(0,JellyBFLinearTerm.makeConstant(1))._combination)){  // is 1
            this._data.forEach(function(jellybfentry){
                var newTerm=new JellyBFLinearTerm(1);
                newTerm._parts.push(new JellyBFLinearStateRef(0));
                jellybfentry.addTerm(newTerm);
            });
            if(this._data.findIndex(JellyBFRangeEntry.FinderEqualIndex(0))!==-1)debugger; // index 0 should have been set to zero
            return true;
        }*/
        // TODO.
        return false;
    }
    return false; // cannot optimize if loop is shifting
};

JellyBFRangeDelta.prototype.writeCode=function(codeWriter){ // write code. local[0] is the current ptr
    
};


var JellyBFPossibleStateEntry=function(index,value){
    this._index=index;
    this._value=value;
};
JellyBFPossibleStateEntry.FinderLowIndex=function(index){
    return function(arg){
        return arg._index>=index;
    };
};

var JellyBFPossibleState=function(emptyIsZero){
    if(emptyIsZero!==true&&emptyIsZero!==false)debugger;
    this.emptyIsZero=emptyIsZero;
    this._data=[];
};
// states can either be an integer or undefined
JellyBFPossibleState.prototype.getState=function(index){
    var dataIndex=this._data.findIndex(JellyBFPossibleStateEntry.FinderLowIndex(index));
    if(dataIndex===-1){
        if(this.emptyIsZero){
            return 0;
        }
        else{
            return undefined;
        }
    }
    return this._data[dataIndex]._value;
};
JellyBFPossibleState.prototype.setState=function(index,value){
    var dataIndex=this._data.findIndex(JellyBFPossibleStateEntry.FinderLowIndex(index));
    if(dataIndex===-1){
        if((this.emptyIsZero&&value!==0)||(!this.emptyIsZero&&value!==undefined)){
            this._data.splice(dataIndex,0,new JellyBFPossibleStateEntry(index,value));
        }
    }
    else{
        if((this.emptyIsZero&&value===0)||(!this.emptyIsZero&&value===undefined)){
            this._data.splice(dataIndex,1);
        }
        else{
            this._data[dataIndex]._value=value;
        }
    }
};



var JellyBF_InsertAndAttemptCoalesceDeltas=function(codeChunks,newDelta){
    if(codeChunks.length>0&&(codeChunks[codeChunks.length-1] instanceof JellyBFRangeDelta)){
        codeChunks[codeChunks.length-1].coalesceWith(newDelta);
    }
    else{
        codeChunks.push(newDelta);
    }
};

var JellyBF_CloseAndAttemptUnrollLoop=function(codeChunks,options){
    if(codeChunks.length>0&&(codeChunks[codeChunks.length-1]==='[')){ // empty loop
        if(options.infiniteloops){
            codeChunks.push(']'); // no sane programmer would do this
        }
        else{
            codeChunks.pop(); // pop the '['; "[]" is a no-op if infinite loops are not allowed.
        }
    }
    else if(codeChunks.length>1&&(codeChunks[codeChunks.length-1] instanceof JellyBFRangeDelta)&&(codeChunks[codeChunks.length-2]==='[')){ // loop with one RangeDelta inside
        var chunk=codeChunks.pop();
        if(chunk.wrapWithLoop(options)){
            // remove '[' and push wrapped chunk
            codeChunks.pop();
            JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks,chunk);
        }
        else{
            codeChunks.push(chunk);
            codeChunks.push(']');
        }
    }
    else{
        codeChunks.push(']');
    }
}