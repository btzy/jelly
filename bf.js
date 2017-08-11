window.addEventListener("load",function(){
    if(!window.WebAssembly){
        alert("This browser does not support WebAssembly, which is required to use this compiler.  Chrome 57+, Firefox 52+ and Opera 44+ are great browsers that do support WebAssembly, and they're free!");
        return;
    }
    if(!window.SharedArrayBuffer){
        alert("This browser does not support experimental Atomics & SharedArrayBuffer.  They are required for all combinations of modes other than release non-interactive mode.  Experimental support is available in Chrome, Firefox and Opera, and can be enabled in the browser settings.");
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
    var continuebutton=document.getElementById("continuebutton");
    var stepbutton=document.getElementById("stepbutton");
    
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
        else if(e.key==="F8"){ // F8
            e.preventDefault();
            continuebutton.click();
        }
        else if(e.key==="F10"){ // F10
            e.preventDefault();
            stepbutton.click();
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
        executemodes_changed(true);
        if(processHandlerTerminator){
            processHandlerTerminator();
            processHandlerTerminator=undefined;
        }
        compilationSpan.firstChild.nodeValue="";
        codeCompiled=false;
        isCompiling=false;
    };
    
    var executemodes_changed=function(from_compilemode_changed){
        if(runTerminator){
            runTerminator();
            runTerminator=undefined;
            if(!from_compilemode_changed){
                compilemodes_changed();
                return;
            }
        }
        executionSpan.firstChild.nodeValue="";
        if(interactive){
            interactiveConsole.clear();
        }
        else{
            outputEditor.setValue("");
        }
        if(compilemode==="debug"&&interactive==="no"){
            alert("Non-interactive I/O not supported in debug mode.");
            radio_interactive_yes.checked=true;
            radio_interactive_yes.dispatchEvent(new Event("change"));
        }
    }
    
    compilebutton.addEventListener("click",function(){
        codeEditor.setReadOnly(true);
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
                        codeEditor.setReadOnly(false);
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
    var breakpoints=[];
    
    runbutton.addEventListener("click",function(){
        codeEditor.setReadOnly(true);
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
            if(interactive==="no"){
                processHandler.execute(inputEditor.getValue(),{debug:(compilemode==="debug")},function(message){
                    if(!to_terminate){
                        runTerminator=undefined;
                        if(message.success){
                            var end_time=Date.now();
                            codeEditor.setReadOnly(false);
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
                            codeEditor.setReadOnly(false);
                            if(message.success){
                                var end_time=Date.now();
                                //outputEditor.setValue(message.output,1);
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
                    // populate the breakpoints:
                    var bp_arr=new Uint8Array(breakpointBuffer);
                    var codeEditorDocument=codeEditor.getSession().getDocument();
                    breakpoints.forEach(function(bp){
                        Atomics.store(bp_arr,codeEditorDocument.positionToIndex(bp.anchor.getPosition()),1);
                    });
                    
                    
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
                            breakpointBuffer=undefined;
                            globalPauseBuffer=undefined;
                            hide_execution_only_buttons();
                            codeEditor.setReadOnly(false);
                            if(message.success){
                                var end_time=Date.now();
                                //outputEditor.setValue(message.output,1);
                                console.log("Executed in "+Math.round(end_time-start_time)+" ms.");
                                executionSpan.firstChild.nodeValue="Executed in "+Math.round(end_time-start_time)+" ms.";
                            }
                            else if(message.data.type==="parseerror"){
                                executionSpan.firstChild.nodeValue="";
                                compilationSpan.firstChild.nodeValue="Parsing failed, there may be unmatched brackets.";
                            }
                            else if(message.data.type==="runtimeerror"){
                                executionSpan.firstChild.nodeValue="Runtime error.";
                            }
                            else{
                                executionSpan.firstChild.nodeValue="Execution failed.";
                            }
                        }
                    },function(options){
                        if(options.breakpoint){
                            console.log("Breakpoint hit.");
                        }
                        else{
                            console.log("Execution paused.");
                        }
                        draw_execution_paused(options.index);
                        continuehandler=options.resume;
                        
                    });
                    show_execution_only_buttons();
                }
            }
        }
    });
    var continuehandler=undefined;
    var stephandler=undefined;
    
    
    continuebutton.addEventListener("click",function(){
        undraw_execution_paused();
        if(continuehandler&&globalPauseBuffer){
            var arr=new Uint8Array(globalPauseBuffer);
            Atomics.store(arr,0,0);
            continuehandler();
        }
    });
    stepbutton.addEventListener("click",function(){
        undraw_execution_paused();
        if(continuehandler&&globalPauseBuffer){
            var arr=new Uint8Array(globalPauseBuffer);
            Atomics.store(arr,0,1);
            continuehandler();
        }
    });
    
    
    // breakpoints
    codeEditor.on("mousedown",function(e){
        if(e.getButton()===1){
            window.setTimeout(function(){
                var pos=codeEditor.getCursorPosition();
                var session=codeEditor.getSession();
                var document=session.getDocument();
                var Range=ace.require('ace/range').Range;
                var range=new Range();
                range.start=document.createAnchor(pos.row,pos.column);
                range.end=document.createAnchor(pos.row,pos.column+1);
                var fix_valid_range=function(r){
                    var endpos=r.end.getPosition();
                    var startpos=r.start.getPosition();
                    if(endpos.row!==startpos.row)return false;
                    if(endpos.column<=startpos.column)return false;
                    if(startpos.column+1!==endpos.column){
                        r.end.setPosition(startpos.row,startpos.column+1);
                        codeEditor.updateSelectionMarkers();
                    }
                    return true;
                };
                var oldbp_index=breakpoints.findIndex(function(x){
                    var x_pos=x.anchor.getPosition();
                    return x_pos.row===pos.row&&x_pos.column===pos.column;
                });
                var remove_bp=function(oldbp){
                    session.removeMarker(oldbp.id);
                    breakpoints.splice(oldbp_index,1);
                    if(breakpointBuffer){
                        var arr=new Uint8Array(breakpointBuffer);
                        Atomics.store(arr,document.positionToIndex(oldbp.anchor.getPosition()),0);
                    }
                };
                if(oldbp_index!==-1){
                    var oldbp=breakpoints[oldbp_index];
                    remove_bp(oldbp);
                }
                else{
                    if(fix_valid_range(range)){
                        var id=session.addMarker(range,"breakpoint","text",false);
                        var oldbp={anchor:range.start,id:id};
                        breakpoints.push(oldbp);
                        if(breakpointBuffer){
                            var arr=new Uint8Array(breakpointBuffer);
                            Atomics.store(arr,document.positionToIndex(pos),1);
                        }
                        var anchor_changed=function(){
                            window.setTimeout(function(){
                                if(!fix_valid_range(range)){
                                    remove_bp(oldbp);
                                }
                            },0);
                        };
                        range.start.on("change",anchor_changed);
                        range.end.on("change",anchor_changed);
                    }
                }
            },0);
        }
    });
    var execution_location_marker_id=undefined,execution_location_line_id=undefined;
    var draw_execution_paused=function(index){
        undraw_execution_paused();
        var Range=ace.require('ace/range').Range;
        var pos=codeEditor.getSession().getDocument().indexToPosition(index);
        var range=new Range(pos.row,pos.column,pos.row,pos.column+1);
        execution_location_marker_id=codeEditor.getSession().addMarker(range,"execution-position","text",false);
        var range=new Range(pos.row,0,pos.row,Number.POSITIVE_INFINITY);
        execution_location_line_id=codeEditor.getSession().addMarker(range,"execution-line","fullLine",false);
        codeEditor.scrollToLine(pos.row,true,false,function(){});
    };
    var undraw_execution_paused=function(){
        if(execution_location_marker_id!==undefined)codeEditor.getSession().removeMarker(execution_location_marker_id);
        if(execution_location_line_id!==undefined)codeEditor.getSession().removeMarker(execution_location_line_id);
    };
    
    
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
    
    
    
    // buttons
    var show_execution_only_buttons=function(){
        Array.prototype.forEach.call(document.getElementsByClassName("execution-only"),function(el){el.classList.remove("displaynone");});
    };
    var hide_execution_only_buttons=function(){
        Array.prototype.forEach.call(document.getElementsByClassName("execution-only"),function(el){el.classList.add("displaynone");});
    };
});