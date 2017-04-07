var InteractiveConsole=function(el){
    this.wrappingElement=el;
    this.flushEveryChar=false;
    this.newLineChar='\n';
    this.wrappingElement.setAttribute("tabindex","0");
    this.lineDivs=[];
    this.inputBuffer="";
    var that=this;
    this.wrappingElement.addEventListener("keydown",function(e){
        if(e.key.length===1){
            e.preventDefault();
            that.inputBuffer+=e.key;
            that.notifyReader();
        }
        else if(e.key==="Enter"&&that.newLineChar==='\n'){
            e.preventDefault();
            that.inputBuffer+='\n';
            that.notifyReader();
        }
        else if(e.key==="Backspace"){
            e.preventDefault();
            if(that.inputBuffer.length>0){
                that.inputBuffer=that.inputBuffer.slice(0,-1);
            }
            else{
                that.attemptBackspace();
            }
        }
    });
    
    this.clear();
    
};

InteractiveConsole.prototype.makeNewLine=function(){
    var lineDiv=document.createElement("div");
    lineDiv.classList.add("interactive-console-line");
    lineDiv.appendChild(document.createTextNode(""));
    return lineDiv;
}

InteractiveConsole.prototype.makeInputSpan=function(){
    var lineDiv=document.createElement("span");
    lineDiv.classList.add("interactive-console-input");
    lineDiv.appendChild(document.createTextNode(""));
    return lineDiv;
}

InteractiveConsole.prototype.read=function(callback){
    var lastLineDiv=this.lineDivs[this.lineDivs.length-1];
    this.inputSpan=this.makeInputSpan();
    this.inputCallback=callback;
    lastLineDiv.appendChild(this.inputSpan);
    this.notifyReader();
};
    
InteractiveConsole.prototype.notifyReader=function(){
    while(this.inputSpan&&this.inputBuffer.length>0){
        var newChar=this.inputBuffer[0];
        this.inputBuffer=this.inputBuffer.substr(1);
        if(this.flushEveryChar||newChar===this.newLineChar){
            var callbackText=this.inputSpan.firstChild.nodeValue+newChar;
            this.inputSpan.parentNode.removeChild(this.inputSpan);
            this.inputSpan===undefined;
            this.write(callbackText);
            this.inputCallback(callbackText);
        }
        else{
            this.inputSpan.firstChild.nodeValue+=newChar;
        }
    }
};

InteractiveConsole.prototype.attemptBackspace=function(){
    if(this.inputSpan&&this.inputSpan.firstChild.nodeValue.length>0){
        this.inputSpan.firstChild.nodeValue=this.inputSpan.firstChild.nodeValue.slice(0,-1);
    }
}

InteractiveConsole.prototype.write=function(text){
    var lines=text.split(this.newLineChar);
    for(var i=0;i<lines.length;++i){
        if(i>0){
            var lineDiv=this.makeNewLine();
            this.lineDivs.push(lineDiv);
            this.wrappingElement.appendChild(lineDiv);
        }
        var lastLineDiv=this.lineDivs[this.lineDivs.length-1];
        lastLineDiv.firstChild.nodeValue+=lines[i];
    }
};

InteractiveConsole.prototype.clear=function(){
    this.lineDivs=[];
    this.inputBuffer="";
    this.inputSpan=undefined;
    this.inputCallback=undefined;
    while(this.wrappingElement.firstChild)this.wrappingElement.removeChild(this.wrappingElement.firstChild);
    var lineDiv=this.makeNewLine();
    this.lineDivs.push(lineDiv);
    this.wrappingElement.appendChild(lineDiv);
}