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
    this.worker.postMessage({type:"compile",sourcecode:sourcecode,options:options});
    wait_for_message(this.worker,"compiled",function(message){
        callback();
    });
};

JellyBFProcessHandler.prototype.execute=function(inputstr,options,callback){
    var encodedinput=new TextEncoder().encode(inputstr);
    this.worker.postMessage({type:"execute",inputuint8array:encodedinput,options:options},[encodedinput.buffer]);
    wait_for_message(this.worker,"executed",function(message){
        callback(new TextDecoder().decode(message.outputuint8array));
    });
};

JellyBFProcessHandler.prototype.terminate=function(){
    this.worker.terminate();
};
// TODO: some way to terminate execution but not need to recompile.