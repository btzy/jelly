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
        JellyBF.compileOptimized(codestr,{},function(compiledModule){
            JellyBF.execute(compiledModule,instr,function(outstr){
                outputTextbox.value=outstr;
            });
        });
    });
    clearOutputButton.addEventListener("click",function(){
        outputTextbox.value="";
    });
});