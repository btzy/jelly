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
    
    var interactiveConsole=new InteractiveConsole(document.getElementById("ioblock").getElementsByClassName("combined")[0].getElementsByClassName("terminal")[0]);
    /*interactiveConsole.write("Test 1");
    interactiveConsole.write("Test 2\n");
    interactiveConsole.read(function(e){
        alert(e);
    });*/
    
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
    
    var compilationSpan=document.getElementById("compilationspan");
    var executionSpan=document.getElementById("executionspan");
    
    while(compilationSpan.firstChild)compilationSpan.removeChild(compilationSpan.firstChild);
    compilationSpan.appendChild(document.createTextNode(""));
    while(executionSpan.firstChild)executionSpan.removeChild(executionSpan.firstChild);
    executionSpan.appendChild(document.createTextNode(""));
    
    codeEditor.on("change",function(){
        codeCompiled=false;
    });
    
    var compilemodes_changed=function(){
        executemodes_changed();
        if(processHandlerTerminator){
            processHandlerTerminator();
            processHandlerTerminator=undefined;
        }
        compilationSpan.firstChild.nodeValue="";
        codeCompiled=false;
        isCompiling=false;
    };
    
    var executemodes_changed=function(){
        if(runTerminator){
            runTerminator();
            runTerminator=undefined;
            compilemodes_changed();
            return;
        }
        executionSpan.firstChild.nodeValue="";
        if(interactive){
            interactiveConsole.clear();
        }
        else{
            outputEditor.setValue("");
        }
    }
    
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
                executionSpan.firstChild.nodeValue="";
                compilationSpan.firstChild.nodeValue="";
                if(compilemode!=="debug")compilationSpan.firstChild.nodeValue="Compiling…";
                var start_time=Date.now();
                processHandler.compile(codeEditor.getValue(),{debug:(compilemode==="debug")},function(message){
                    if(!to_terminate){
                        isCompiling=false;
                        processHandlerTerminator=undefined;
                        if(message.success){
                            codeCompiled=true;
                            var end_time=Date.now();
                            console.log("Compiled in "+Math.round(end_time-start_time)+" ms.");
                            if(compilemode!=="debug")compilationSpan.firstChild.nodeValue="Compiled in "+Math.round(end_time-start_time)+" ms.";
                            if(toRunAfterCompiling){
                                toRunAfterCompiling=false;
                                runbutton.click();
                            }
                        }
                        else{
                            compilationSpan.firstChild.nodeValue="Compilation failed.";
                        }
                    }
                });
            }
        });
    });
    
    var breakpointBuffer=undefined;
    var globalPauseBuffer=undefined;
    
    runbutton.addEventListener("click",function(){
        if(!codeCompiled){
            toRunAfterCompiling=true;
            if(!isCompiling){
                compilebutton.click();
            }
        }
        else if(runTerminator){ // this is here because i don't know any way to kill execution without terminating the worker
            runTerminator();
            runTerminator=undefined;
            toRunAfterCompiling=true;
            compilebutton.click();
        }
        else{
            if(runTerminator){
                runTerminator();
            }
            var to_terminate=false;
            runTerminator=function(){
                to_terminate=true;
            };
            executionSpan.firstChild.nodeValue="Executing…";
            var start_time=Date.now();
            if(!interactive){
                processHandler.execute(inputEditor.getValue(),{debug:(compilemode==="debug")},function(message){
                    if(!to_terminate){
                        runTerminator=undefined;
                        if(message.success){
                            var end_time=Date.now();
                            outputEditor.setValue(message.output,1);
                            console.log("Executed in "+Math.round(end_time-start_time)+" ms.");
                            executionSpan.firstChild.nodeValue="Executed in "+Math.round(end_time-start_time)+" ms.";
                        }
                        else{
                            executionSpan.firstChild.nodeValue="Execution failed.";
                        }
                    }
                });
            }
            else{
                if(compilemode!=="debug"){
                    interactiveConsole.clear();
                    interactiveConsole.focus();
                    var interactiveObj=processHandler.executeInteractive({debug:(compilemode==="debug")},function(){
                        if(!to_terminate){
                            interactiveConsole.read(function(text){
                                interactiveObj.inputAddedCallback(text);
                            });
                        }
                    },function(outputText){
                        if(!to_terminate){
                            interactiveConsole.write(outputText);
                        }
                    },function(message){
                        if(!to_terminate){
                            runTerminator=undefined;
                            if(message.success){
                                var end_time=Date.now();
                                outputEditor.setValue(message.output,1);
                                console.log("Executed in "+Math.round(end_time-start_time)+" ms.");
                                executionSpan.firstChild.nodeValue="Executed in "+Math.round(end_time-start_time)+" ms.";
                            }
                            else{
                                executionSpan.firstChild.nodeValue="Execution failed.";
                            }
                        }
                    });
                }
                else{
                    interactiveConsole.clear();
                    interactiveConsole.focus();
                    breakpointBuffer=new SharedArrayBuffer(codeEditor.getValue().length);
                    globalPauseBuffer=new SharedArrayBuffer(1);
                    var interactiveObj=processHandler.executeInteractive({debug:(compilemode==="debug"),sourcecode:codeEditor.getValue(),breakpointBuffer:breakpointBuffer,globalPauseBuffer:globalPauseBuffer},function(){
                        if(!to_terminate){
                            interactiveConsole.read(function(text){
                                interactiveObj.inputAddedCallback(text);
                            });
                        }
                    },function(outputText){
                        if(!to_terminate){
                            interactiveConsole.write(outputText);
                        }
                    },function(message){
                        if(!to_terminate){
                            runTerminator=undefined;
                            if(message.success){
                                var end_time=Date.now();
                                outputEditor.setValue(message.output,1);
                                console.log("Executed in "+Math.round(end_time-start_time)+" ms.");
                                executionSpan.firstChild.nodeValue="Executed in "+Math.round(end_time-start_time)+" ms.";
                            }
                            else{
                                executionSpan.firstChild.nodeValue="Execution failed.";
                            }
                        }
                    },function(options){
                        if(options.breakpoint){
                            alert("breakpoint hit");
                        }
                        else{
                            alert("paused");
                        }
                    });
                }
            }
        }
    });
    
    // options
    var radio_interactive_yes=document.getElementById("radio-interactive-yes");
    var radio_interactive_no=document.getElementById("radio-interactive-no");
    
    var ioblock=document.getElementById("ioblock");
    var separate_ioblock=ioblock.getElementsByClassName("separate")[0];
    var combined_ioblock=ioblock.getElementsByClassName("combined")[0];
    
    radio_interactive_yes.addEventListener("change",function(){
        separate_ioblock.classList.remove("selected");
        combined_ioblock.classList.add("selected");
        interactive="yes";
        localStorage.setItem("option-interactive",interactive);
        executemodes_changed();
    });
    radio_interactive_no.addEventListener("change",function(){
        combined_ioblock.classList.remove("selected");
        separate_ioblock.classList.add("selected");
        interactive="no";
        localStorage.setItem("option-interactive",interactive);
        executemodes_changed();
    });
    
    var interactive=localStorage.getItem("option-interactive");
    if(interactive==="no"||!window.SharedArrayBuffer){
        radio_interactive_no.checked=true;
        radio_interactive_no.dispatchEvent(new Event("change"));
    }
    else{
        radio_interactive_yes.checked=true;
        radio_interactive_yes.dispatchEvent(new Event("change"));
    }
    
    if(!window.SharedArrayBuffer){
        radio_interactive_yes.disabled=true;
    }
    
    var radio_compilemode_debug=document.getElementById("radio-compilemode-debug");
    var radio_compilemode_release=document.getElementById("radio-compilemode-release");
    
    radio_compilemode_debug.addEventListener("change",function(){
        compilemode="debug";
        localStorage.setItem("option-compilemode",compilemode);
        compilemodes_changed();
    });
    radio_compilemode_release.addEventListener("change",function(){
        compilemode="release";
        localStorage.setItem("option-compilemode",compilemode);
        compilemodes_changed();
    });
    
    var compilemode=localStorage.getItem("option-compilemode");
    if(compilemode==="debug"){
        radio_compilemode_debug.checked=true;
        radio_compilemode_debug.dispatchEvent(new Event("change"));
    }
    else{
        radio_compilemode_release.checked=true;
        radio_compilemode_release.dispatchEvent(new Event("change"));
    }
    
    
    // splitters
    Array.prototype.forEach.call(document.getElementById("ioblock").getElementsByClassName("vertical-spacer"),function(el){
        var splitter=new FlexSplitter(el,el.getElementsByClassName("actual-spacer")[0],0.1,0.1);
        splitter.onadjust=function(){
            inputEditor.resize();
            outputEditor.resize();
        };
    });
    Array.prototype.forEach.call(document.getElementsByClassName("horizontal-spacer"),function(el){
        var splitter=new FlexSplitter(el,el.getElementsByClassName("actual-spacer")[0],0.1,0.1);
        splitter.onadjust=function(){
            codeEditor.resize();
            inputEditor.resize();
            outputEditor.resize();
        };
    });
    
    
});