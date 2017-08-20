(function(){
    var module=undefined;
    var interpretstate=undefined;
    self.addEventListener("message",function(e){
        var message=e.data;
        switch(message.type){
            case "compile":
                var sourcecode=message.sourcecode;
                var options=message.options;
                try{
                    module=JellyBFSync.compile(sourcecode,options);
                    self.postMessage({type:"compiled"});
                }
                catch(e){
                    console.log(e);
                    self.postMessage({type:"compileerror"});
                }
                break;
            case "execute-interactive":
                var inputbuffer=message.inputbuffer; // circular buffer
                var outputbuffer=message.outputbuffer;
                var inputwaitbuffer=message.inputwaitbuffer; // three elements - next read index, next write index, terminated (1-yes) - these are never decreasing
                // write index must be increased by 1 when stream is terminated
                var outputwaitbuffer=message.outputwaitbuffer;
                // all wait buffers expected to be zeroed
                var options=message.options;
                try{
                    JellyBFSync.executeInteractive(module, new Uint8Array(inputbuffer), new Uint8Array(outputbuffer), new Int32Array(inputwaitbuffer), new Int32Array(outputwaitbuffer),options,function(){
                        self.postMessage({type:"output-updated"});
                    },function(readhead){
                        self.postMessage({type:"input-requested",readhead:readhead});
                    });
                    self.postMessage({type:"executed"});
                }
                catch(e){
                    console.log(e);
                    self.postMessage({type:"executeerror"});
                }
                break;
            case "execute":
                var inputuint8array=message.inputuint8array;
                var options=message.options;
                try{
                    var outputuint8array=JellyBFSync.execute(module,inputuint8array,options);
                    self.postMessage({type:"executed",outputuint8array:outputuint8array},[outputuint8array.buffer]);
                }
                catch(e){
                    console.log(e);
                    self.postMessage({type:"executeerror"});
                }
                break;
            case "interpret-interactive":
                var sourcecode=message.sourcecode;
                var inputbuffer=message.inputbuffer; // circular buffer
                var outputbuffer=message.outputbuffer;
                var inputwaitbuffer=message.inputwaitbuffer; // three elements - next read index, next write index, terminated (1-yes) - these are never decreasing
                // write index must be increased by 1 when stream is terminated
                var outputwaitbuffer=message.outputwaitbuffer;
                // all wait buffers expected to be zeroed
                var options=message.options;
                var breakpointbuffer=message.breakpointbuffer;
                var globalpausebuffer=message.globalpausebuffer;
                var memorybuffer=message.memorybuffer;
                try{
                    interpretstate=JellyBFSync.interpretInteractive(sourcecode, new Uint8Array(inputbuffer), new Uint8Array(outputbuffer), new Int32Array(inputwaitbuffer), new Int32Array(outputwaitbuffer), new Uint8Array(breakpointbuffer), new Uint8Array(globalpausebuffer),memorybuffer?(new Uint8Array(memorybuffer)):undefined,options,function(){
                        self.postMessage({type:"output-updated"});
                    },function(readhead){
                        self.postMessage({type:"input-requested",readhead:readhead});
                    });
                    self.postMessage({type:"parsecomplete"});
                }
                catch(e){
                    console.log(e);
                    self.postMessage({type:"parseerror",kind:e});
                }
                break;
            case "interpret-continue":
                var ret;
                try{
                    ret=interpretstate.run();
                }
                catch(e){
                    console.log(e);
                    self.postMessage({type:"runtimeerror",kind:e});
                    break;
                }
                if(ret.type===JellyBFInterpreter.RunResult.PROGRAM_TERMINATED){
                    self.postMessage({type:"interpreted"});
                    interpretstate=undefined;
                }
                else if(ret.type===JellyBFInterpreter.RunResult.PAUSED_AT_BREAKPOINT){
                    self.postMessage({type:"interpret-breakpoint",index:ret.index,memory_ptr:ret.memory_ptr});
                }
                else if(ret.type===JellyBFInterpreter.RunResult.PAUSED_WITHOUT_BREAKPOINT){
                    self.postMessage({type:"interpret-paused",index:ret.index,memory_ptr:ret.memory_ptr});
                }
                else{
                    self.postMessage({type:"interpreterror"});
                }
                break;
        }
    });
    
    self.postMessage({type:"ready"});
})();