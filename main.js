window.addEventListener("load",function(){
    var codeTextbox=document.getElementById("codetextbox");
    var inputTextbox=document.getElementById("inputtextbox");
    var outputTextbox=document.getElementById("outputtextbox");
    var codeButton=document.getElementById("codebutton");
    var clearOutputButton=document.getElementById("clearoutputbutton");
    codeButton.addEventListener("click",function(){
        var codestr=codeTextbox.value;
        var instr=inputTextbox.value;
        JellyBF.compile(codestr,{},function(compiledModule){
            JellyBF.execute(compiledModule,instr,function(outstr){
                outputTextbox.value=outstr;
            });
        });
    });
    clearOutputButton.addEventListener("click",function(){
        outputTextbox.value="";
    });
});