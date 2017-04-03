window.addEventListener("load",function(){
    if(!window.WebAssembly){
        alert("This browser does not support WebAssembly.  Chrome 57+, Firefox 52+ and Opera 44+ are great browsers that do support WebAssembly, and they're free!");
        return;
    }
    
    var codeEditor=ace.edit(document.getElementById("codeblock").getElementsByClassName("editor")[0]);
    codeEditor.setTheme("ace/theme/chrome");
    codeEditor.setFontSize(16);
    codeEditor.setShowPrintMargin(false);
    
    var inputEditor=ace.edit(document.getElementById("inputblock").getElementsByClassName("editor")[0]);
    inputEditor.setTheme("ace/theme/chrome");
    inputEditor.setFontSize(16);
    inputEditor.setShowPrintMargin(false);
    inputEditor.setHighlightActiveLine(false);
    inputEditor.renderer.setShowGutter(false);
    inputEditor.getSession().setUseWorker(false);
    
    var outputEditor=ace.edit(document.getElementById("outputblock").getElementsByClassName("editor")[0]);
    outputEditor.setTheme("ace/theme/chrome");
    outputEditor.setFontSize(16);
    outputEditor.setShowPrintMargin(false);
    outputEditor.setHighlightActiveLine(false);
    outputEditor.renderer.setShowGutter(false);
    outputEditor.setReadOnly(true);
    outputEditor.getSession().setUseWorker(false);
    
    // buttons
    var openbutton=document.getElementById("openbutton");
    var downloadbutton=document.getElementById("downloadbutton");
    var compilebutton=document.getElementById("compilebutton");
    var runbutton=document.getElementById("runbutton");
    
    var openbuttonfilepicker=document.getElementById("openbuttonfilepicker");
    
    // shortcuts
    window.addEventListener("keydown",function(e){
        if(e.ctrlKey&&e.key==="o"){ // Ctrl+O
            e.preventDefault();
            openbutton.click();
        }
        else if(e.ctrlKey&&e.key==="s"){ // Ctrl+S
            e.preventDefault();
            downloadbutton.click();
        }
        else if(e.key==="F6"){ // F6
            e.preventDefault();
            compilebutton.click();
        }
        else if(e.key==="F5"){ // F5
            e.preventDefault();
            runbutton.click();
        }
    });
    
    openbutton.addEventListener("click",function(){
        openbuttonfilepicker.click();
    });
    
    openbuttonfilepicker.addEventListener("change",function(){
        if(openbuttonfilepicker.files.length===0){
            return;
        }
        var file=openbuttonfilepicker.files[0];
        var filereader=new FileReader();
        filereader.addEventListener("load",function(){
            var codestr=filereader.result;
            codeEditor.setValue(codestr,-1);
            codeEditor.focus();
        });
        filereader.readAsText(file);
    });
    
    downloadbutton.addEventListener("click",function(){
        var el=document.createElement('a');
        el.setAttribute("href","data:text/plain;charset=utf-8,"+encodeURIComponent(codeEditor.getValue()));
        el.setAttribute("download","download.b");
        el.style.display="none";
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
    });
    
    var processHandler=undefined;
    var processHandlerTerminator=undefined; // called when user presses compile or run
    var runTerminator=undefined;
    var codeCompiled=false;
    var isCompiling=false;
    var toRunAfterCompiling=false;
    
    codeEditor.on("change",function(){
        codeCompiled=false;
    });
    
    compilebutton.addEventListener("click",function(){
        if(processHandlerTerminator){
            processHandlerTerminator();
        }
        var to_terminate=false;
        processHandlerTerminator=function(){
            to_terminate=true;
            processHandler.terminate();
            processHandler=undefined;
        };
        isCompiling=true;
        processHandler=new JellyBFProcessHandler();
        processHandler.initialize(function(){
            if(!to_terminate){
                var start_time=Date.now();
                processHandler.compile(codeEditor.getValue(),{},function(){
                    if(!to_terminate){
                        codeCompiled=true;
                        isCompiling=false;
                        var end_time=Date.now();
                        console.log("Compiled in "+Math.round(end_time-start_time)+" ms.");
                        processHandlerTerminator=undefined;
                        if(toRunAfterCompiling){
                            toRunAfterCompiling=false;
                            runbutton.click();
                        }
                    }
                });
            }
        });
    });
    
    runbutton.addEventListener("click",function(){
        if(!codeCompiled){
            toRunAfterCompiling=true;
            if(!isCompiling){
                compilebutton.click();
            }
        }
        else{
            if(runTerminator){
                runTerminator();
            }
            var to_terminate=false;
            runTerminator=function(){
                to_terminate=true;
            };
            var start_time=Date.now();
            processHandler.execute(inputEditor.getValue(),{},function(outputstr){
                if(!to_terminate){
                    var end_time=Date.now();
                    console.log("Executed in "+Math.round(end_time-start_time)+" ms.");
                    outputEditor.setValue(outputstr,1);
                    runTerminator=undefined;
                }
            });
        }
    });
});