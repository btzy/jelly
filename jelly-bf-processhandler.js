var wait_for_message=function(worker,type,callback){
    var message_handler=function(e){
        switch(e.data.type){
            case type:
                worker.removeEventListener("message",message_handler);
                callback(e.data);
                break;
        }
    };
    worker.addEventListener("message",message_handler);
};

var JellyBFProcessHandler=function(){
    
};

JellyBFProcessHandler.prototype.initialize=function(callback){
    this.worker=new Worker("jelly-bf-worker.max.js");
    wait_for_message(this.worker,"ready",function(message){
        callback();
    });
};

JellyBFProcessHandler.prototype.compile=function(sourcecode,options,callback){
    if(options.debug){
        callback({success:true});
    }
    else{
        this.worker.postMessage({type:"compile",sourcecode:sourcecode,options:options});
        wait_for_message(this.worker,"compiled",function(message){
            callback({success:true});
        });
        wait_for_message(this.worker,"compileerror",function(message){
            callback({success:false});
        });
    }
};

JellyBFProcessHandler.prototype.execute=function(inputstr,options,callback){
    if(options.debug){
        
    }
    else{
        var encodedinput=new TextEncoder().encode(inputstr);
        this.worker.postMessage({type:"execute",inputuint8array:encodedinput,options:options},[encodedinput.buffer]);
        wait_for_message(this.worker,"executed",function(message){
            callback({success:true,output:new TextDecoder().decode(message.outputuint8array)});
        });
        wait_for_message(this.worker,"executeerror",function(message){
            callback({success:false});
        });
    }
};

JellyBFProcessHandler.prototype.executeInteractive=function(options,inputRequestCallback,outputCallback,doneCallback,pausedCallback){
    var WaitArrayId={
        READ_HEAD:0,
        WRITE_HEAD:1,
        TERMINATED_FLAG:2
    };
    
    options.bufferlength=options.bufferlength||1024;
    
    
    var inputBuffer=new SharedArrayBuffer(1024);
    var outputBuffer=new SharedArrayBuffer(1024);
    var inputWaitBuffer=new SharedArrayBuffer(3*Int32Array.BYTES_PER_ELEMENT);
    var outputWaitBuffer=new SharedArrayBuffer(3*Int32Array.BYTES_PER_ELEMENT);
    
    var pendingInputData=[];//{data:typedarray,ptrdone:integer}
    var inputTimeout=undefined;
    
    var inputuint8array=new Uint8Array(inputBuffer);
    var outputuint8array=new Uint8Array(outputBuffer);
    var inputwaitint32array=new Int32Array(inputWaitBuffer);
    var outputwaitint32array=new Int32Array(outputWaitBuffer);
    
    
    var output_read_head=0,output_write_head=0,output_terminated=false; // cache values
    
    var outputUpdated=function(){
        output_write_head=Atomics.load(outputwaitint32array,WaitArrayId.WRITE_HEAD);
        output_terminated=(Atomics.load(outputwaitint32array,WaitArrayId.TERMINATED_FLAG)!==0);
        if(output_terminated){
            output_write_head=Atomics.load(outputwaitint32array,WaitArrayId.WRITE_HEAD);
        }
        var newData;
        if(output_terminated){
            newData=new Uint8Array(output_write_head-1-output_read_head);
            for(var i=output_read_head;i<output_write_head-1;++i){
                newData[i-output_read_head]=Atomics.load(outputuint8array,i%options.bufferlength);
            }
            output_read_head=output_write_head-1;
        }
        else{
            newData=new Uint8Array(output_write_head-output_read_head);
            for(var i=output_read_head;i<output_write_head;++i){
                newData[i-output_read_head]=Atomics.load(outputuint8array,i%options.bufferlength);
            }
            output_read_head=output_write_head;
        }
        Atomics.store(outputwaitint32array,WaitArrayId.READ_HEAD,output_read_head);
        Atomics.notify(outputwaitint32array,WaitArrayId.READ_HEAD,1);
        var newText=new TextDecoder().decode(newData);
        outputCallback(newText);
    };
    
    
    var input_read_head=0,input_write_head=0,input_terminated=false; // cache values
    
    var inputAdded=function(text){
        var newData=new TextEncoder().encode(text);
        pendingInputData.push({data:newData,ptrdone:0});
        
        
        if(!inputTimeout)do_input();
    };
    
    var do_input=function(){
        inputTimeout=undefined;
        
        if(pendingInputData.length===0)return;
        
        input_read_head=Atomics.load(inputwaitint32array,WaitArrayId.READ_HEAD);
        while(pendingInputData[0].ptrdone<pendingInputData[0].data.length&&input_read_head+options.bufferlength>input_write_head){
            Atomics.store(inputuint8array,(input_write_head++)%options.bufferlength,pendingInputData[0].data[pendingInputData[0].ptrdone++]);
        }
        if(pendingInputData[0].ptrdone===pendingInputData[0].data.length){
            pendingInputData.shift();
        }
        Atomics.store(inputwaitint32array,WaitArrayId.WRITE_HEAD,input_write_head);
        console.log(Atomics.notify(inputwaitint32array,WaitArrayId.WRITE_HEAD,1));
        
        if(pendingInputData.length>0){
            inputTimeout=setTimeout(do_input,40);
        }
    };
    
    var inputRequested=function(read_head){
        do_input();
        if(input_write_head===read_head){
            inputRequestCallback();
        }
    };
    
    
    var outputUpdatedHandler=function(e){
        if(e.data.type==="output-updated"){
            outputUpdated();
        }
        else if(e.data.type==="input-requested"){
            inputRequested(e.data.readhead);
        }
    };
    
    this.worker.addEventListener("message",outputUpdatedHandler);
    
    if(options.debug){
        var that=this;
        var sourcecode=options.sourcecode;
        var breakpointBuffer=options.breakpointBuffer;
        var globalpauseBuffer=options.globalPauseBuffer;
        delete options.sourcecode;
        delete options.breakpointBuffer;
        delete options.globalPauseBuffer;
        
        var memoryBuffer=new SharedArrayBuffer(30000);
        
        var resumer=function(){
            that.worker.postMessage({type:"interpret-continue"});
        };
        
        var interpretHandler=function(e){
            if(e.data.type==="interpret-breakpoint"){
                pausedCallback({breakpoint:true,resume:resumer,index:e.data.index,memoryuint8array:new Uint8Array(memoryBuffer),memory_ptr:e.data.memory_ptr});
            }
            else if(e.data.type==="interpret-paused"){
                pausedCallback({breakpoint:false,resume:resumer,index:e.data.index,memoryuint8array:new Uint8Array(memoryBuffer),memory_ptr:e.data.memory_ptr});
            }
        };
        
        this.worker.addEventListener("message",interpretHandler);
        
        wait_for_message(this.worker,"parsecomplete",function(message){
            resumer();
        });
        
        wait_for_message(this.worker,"parseerror",function(message){
            that.worker.removeEventListener("message",interpretHandler);
            that.worker.removeEventListener("message",outputUpdatedHandler);
            doneCallback({success:false,data:message});
        });
        wait_for_message(this.worker,"runtimeerror",function(message){
            that.worker.removeEventListener("message",interpretHandler);
            that.worker.removeEventListener("message",outputUpdatedHandler);
            doneCallback({success:false,data:message});
        });
        
        wait_for_message(this.worker,"interpreted",function(message){
            that.worker.removeEventListener("message",interpretHandler);
            that.worker.removeEventListener("message",outputUpdatedHandler);
            doneCallback({success:true});
        });
        wait_for_message(this.worker,"interpreterror",function(message){
            that.worker.removeEventListener("message",interpretHandler);
            that.worker.removeEventListener("message",outputUpdatedHandler);
            doneCallback({success:false});
        });
        
        this.worker.postMessage({type:"interpret-interactive",sourcecode:sourcecode,inputbuffer:inputBuffer,outputbuffer:outputBuffer,inputwaitbuffer:inputWaitBuffer,outputwaitbuffer:outputWaitBuffer,breakpointbuffer:breakpointBuffer,globalpausebuffer:globalpauseBuffer,memorybuffer:memoryBuffer,options:options});
    }
    else{
        var that=this;
        wait_for_message(this.worker,"executed",function(message){
            that.worker.removeEventListener("message",outputUpdatedHandler);
            doneCallback({success:true});
        });
        wait_for_message(this.worker,"executeerror",function(message){
            that.worker.removeEventListener("message",outputUpdatedHandler);
            doneCallback({success:false});
        });

        this.worker.postMessage({type:"execute-interactive",inputbuffer:inputBuffer,outputbuffer:outputBuffer,inputwaitbuffer:inputWaitBuffer,outputwaitbuffer:outputWaitBuffer,options:options});
    }
    
    return {inputAddedCallback:inputAdded};
};

JellyBFProcessHandler.prototype.terminate=function(){
    this.worker.terminate();
};
// TODO: some way to terminate execution but not need to recompile.