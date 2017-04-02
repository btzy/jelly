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
    codeButton.addEventListener("click",function(){
        var codestr=codeTextbox.value;
        var instr=inputTextbox.value;
        outputTextbox.value="";
        var startTime=Date.now();
        JellyBF.compileOptimized(codestr,{infiniteloops:false},function(compiledModule){
            var compiledTime=Date.now();
            console.log("Compiled in "+Math.round(compiledTime-startTime)+" ms.");
            compiledTime=Date.now();
            JellyBF.execute(compiledModule,instr,function(outstr){
                var executedTime=Date.now();
                console.log("Executed in "+Math.round(executedTime-compiledTime)+" ms.");
                outputTextbox.value=outstr;
            });
        });
    });
    clearOutputButton.addEventListener("click",function(){
        outputTextbox.value="";
    });
});