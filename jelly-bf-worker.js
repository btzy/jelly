(function(){
    var module=undefined;
    self.addEventListener("message",function(e){
        var message=e.data;
        switch(message.type){
            case "compile":
                var sourcecode=message.sourcecode;
                var options=message.options;
                module=JellyBFSync.compile(sourcecode,options);
                self.postMessage({type:"compiled"});
                break;
            case "execute-interactive":
                var inputbuffer=message.inputbuffer; // circular buffer
                var outputbuffer=message.outputbuffer;
                var inputwaitbuffer=message.inputwaitbuffer; // three elements - next read index, next write index, terminated (1-yes) - these are never decreasing
                // write index must be increased by 1 when stream is terminated
                var outputwaitbuffer=message.outputwaitbuffer;
                // all wait buffers expected to be zeroed
                var options=message.options;
                JellyBFSync.executeInteractive(module,UInt8Array(inputbuffer),UInt8Array(outputbuffer),Int32Array(inputwaitbuffer),Int32Array(outputwaitbuffer),options);
                self.postMessage({type:"executed"});
                break;
            case "execute":
                var inputuint8array=message.inputuint8array;
                var options=message.options;
                var outputuint8array=JellyBFSync.execute(module,inputuint8array,options);
                self.postMessage({type:"executed",outputuint8array:outputuint8array},[outputuint8array.buffer]);
                break;
        }
    });
    
    self.postMessage({type:"ready"});
})();