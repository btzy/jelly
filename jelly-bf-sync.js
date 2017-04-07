var JellyBFSync={
    compile:function(str,options){
        return new WebAssembly.Module(JellyBFCompiler.compile(str,options));
    },
    execute:function(module,inputuint8array,options){
        options.eof_value=options.eof_value||0;
        var inputindex=0;
        var outputdata=new ResizableUint8Array();
        var get_input=function(){
            if(inputindex<inputuint8array.length){
                return inputuint8array[inputindex++];
            }
            else{
                return options.eof_value;
            }
        };
        var put_output=function(byte){
            outputdata.push(byte);
        };
        var instance=new WebAssembly.Instance(module,{
            interaction:{
                input:get_input,
                output:put_output
            }
        });
        instance.exports.main();
        return outputdata.toUint8Array();
    },
    executeInteractive:function(module,inputuint8array,outputuint8array,inputwaitint32array,outputwaitint32array,options,updatedOutputCallback,requestInputCallback){
        var WaitArrayId={
            READ_HEAD:0,
            WRITE_HEAD:1,
            TERMINATED_FLAG:2
        };
        options.bufferlength=options.bufferlength||1024; // 1024 element buffer by default
        options.eof_value=options.eof_value||0;
        // two elements - next read index, next write index
        // TODO: loading & storing from the data arrays may not need to be done atomically, due to the barriers issued by the wait array.
        var input_read_head=0,input_write_head=0,input_terminated=false; // cache values
        var get_input=function(){
            if(input_read_head===input_write_head){
                requestInputCallback(input_read_head);
                console.log(Atomics.wait(inputwaitint32array,WaitArrayId.WRITE_HEAD,input_write_head));
                input_write_head=Atomics.load(inputwaitint32array,WaitArrayId.WRITE_HEAD);
                if(!input_terminated){
                    input_terminated=(Atomics.load(inputwaitint32array,WaitArrayId.TERMINATED_FLAG)!==0);
                }
            }
            if(!input_terminated||input_read_head+1<input_write_head){
                var val=Atomics.load(inputuint8array,(input_read_head++)%options.bufferlength);
                Atomics.store(inputwaitint32array,WaitArrayId.READ_HEAD,input_read_head);
                return val;
            }
            else{
                return options.eof_value;
            }
        };
        var output_read_head=0,output_write_head=0,output_terminated=false; // cache values
        var put_output=function(byte){
            if(output_read_head+options.bufferlength===output_write_head){
                Atomics.wait(outputwaitint32array,WaitArrayId.READ_HEAD,output_read_head);
                output_read_head=Atomics.load(outputwaitint32array,WaitArrayId.READ_HEAD);
            }
            Atomics.store(outputuint8array,(output_write_head++)%options.bufferlength,byte);
            Atomics.store(outputwaitint32array,WaitArrayId.WRITE_HEAD,output_write_head);
            updatedOutputCallback();
        };
        var terminate_output=function(){
            if(output_read_head+options.bufferlength===output_write_head){
                Atomics.wait(outputwaitint32array,WaitArrayId.READ_HEAD,output_read_head);
                output_read_head=Atomics.load(outputwaitint32array,WaitArrayId.READ_HEAD);
            }
            Atomics.store(outputwaitint32array,WaitArrayId.TERMINATED_FLAG,1);
            Atomics.store(outputwaitint32array,WaitArrayId.WRITE_HEAD,output_write_head+1);
            updatedOutputCallback();
        };
        var instance=new WebAssembly.Instance(module,{
            interaction:{
                input:get_input,
                output:put_output
            }
        });
        instance.exports.main();
        terminate_output();
        return true;
    }
};