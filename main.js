window.addEventListener("load",function(){
    if(!window.WebAssembly){
        alert("This browser does not support WebAssembly.  Chrome 57+, Firefox 52+ and Opera 44+ are great browsers that do support WebAssembly, and they're free!");
        return;
    }
    var codeTextbox=document.getElementById("codetextbox");
    var inputTextbox=document.getElementById("inputtextbox");
    var outputTextbox=document.getElementById("outputtextbox");
    var codeButton=document.getElementById("codebutton");
    var clearOutputButton=document.getElementById("clearoutputbutton");
    
    
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
    
    
    var initworker=function(callback){
        var worker=new Worker("jelly-bf-worker.max.js");
        wait_for_message(worker,"ready",function(){
            callback(worker);
        });
    };
    
    var compile=function(worker,sourcecode,options,callback){
        worker.postMessage({type:"compile",sourcecode:sourcecode,options:options});
        wait_for_message(worker,"compiled",function(message){
            callback();
        });
    };
    
    var execute=function(worker,inputstr,options,callback){
        var encodedinput=new TextEncoder().encode(inputstr);
        worker.postMessage({type:"execute",inputuint8array:encodedinput,options:options},[encodedinput.buffer]);
        wait_for_message(worker,"executed",function(message){
            callback(new TextDecoder().decode(message.outputuint8array));
        });
    };
    
    codeButton.addEventListener("click",function(){
        var codestr=codeTextbox.value;
        var instr=inputTextbox.value;
        outputTextbox.value="";
        
        /*JellyBF.compileOptimized(codestr,{infiniteloops:false},function(compiledModule){
            var compiledTime=Date.now();
            console.log("Compiled in "+Math.round(compiledTime-startTime)+" ms.");
            compiledTime=Date.now();
            JellyBF.execute(compiledModule,instr,function(outstr){
                var executedTime=Date.now();
                console.log("Executed in "+Math.round(executedTime-compiledTime)+" ms.");
                outputTextbox.value=outstr;
            });
        });*/
        initworker(function(worker){
            var startTime=Date.now();
            compile(worker, codestr,{},function(){
                var compiledTime=Date.now();
                console.log("Compiled in "+Math.round(compiledTime-startTime)+" ms.");
                execute(worker,instr,{},function(outstr){
                    var executedTime=Date.now();
                    console.log("Executed in "+Math.round(executedTime-compiledTime)+" ms.");
                    outputTextbox.value=outstr;
                });
            });
        });
        
    });
    clearOutputButton.addEventListener("click",function(){
        outputTextbox.value="";
    });
});