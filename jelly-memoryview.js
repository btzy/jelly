var MemoryView=function(root_el,uint8_array,min_index,max_index,memory_ptr){
    this.root=root_el;
    this.minIndex=min_index;
    this.maxIndex=max_index;
    this.currentIndex=this.minIndex;
    this.viewLength=1;
    this.data=uint8_array;
    this.ptr=memory_ptr;
    this.redraw();
    var that=this;
    window.addEventListener("resize",function(){
        that.redraw();
    });
};

MemoryView.prototype.refresh=function(){
    var cells=this.root.getElementsByClassName("cellwrapper")[0].getElementsByClassName("cell");
    var labels=this.root.getElementsByClassName("labelwrapper")[0].getElementsByClassName("label");
    for(var i=0;i<this.viewLength;++i){
        labels[i].firstChild.nodeValue=(this.currentIndex+i).toString();
        cells[i].firstChild.nodeValue=Atomics.load(this.data,this.currentIndex+i).toString();
        if(this.currentIndex+i===this.ptr){
            cells[i].classList.add("memory-ptr");
            labels[i].classList.add("memory-ptr");
        }
        else{
            cells[i].classList.remove("memory-ptr");
            labels[i].classList.remove("memory-ptr");
        }
    }
};

MemoryView.prototype.clear=function(){
    while(this.root.firstChild)this.root.removeChild(this.root.firstChild);
};

MemoryView.prototype.redraw=function(){
    this.clear();
    var root_width=this.root.offsetWidth;
    this.viewLength=Math.floor((root_width-6-1)/29);
    if(this.viewLength>this.maxIndex-this.minIndex+1)this.viewLength=this.maxIndex-this.minIndex+1;
    var cellwrapper=document.createElement("div");
    cellwrapper.classList.add("cellwrapper");
    var labelwrapper=document.createElement("div");
    labelwrapper.classList.add("labelwrapper");
    for(var i=0;i<this.viewLength;++i){
        var tdiv=document.createElement("div");
        tdiv.classList.add("cell");
        tdiv.appendChild(document.createTextNode(""));
        cellwrapper.appendChild(tdiv);
        var tdiv=document.createElement("div");
        tdiv.classList.add("label");
        tdiv.appendChild(document.createTextNode(""));
        labelwrapper.appendChild(tdiv);
    }
    this.root.appendChild(cellwrapper);
    this.root.appendChild(labelwrapper);
    this.refresh();
};

MemoryView.prototype.centerAtIndex=function(index){
    if(index<this.minIndex||index>this.maxIndex)return false;
    index-=(this.viewLength-1)/2;
    if(index<0)index=0;
    if(index+this.viewLength>this.maxIndex+1)index=this.maxIndex+1-this.viewLength;
    this.currentIndex=index;
    this.refresh();
    return true;
};

MemoryView.prototype.goToIndex=function(index){
    if(index<this.minIndex||index>this.maxIndex)return false;
    if(index<this.currentIndex){
        this.currentIndex=index;
        this.refresh();
    }
    else if(index>=this.currentIndex+this.viewLength){
        this.currentIndex=index+1-this.viewLength;
        this.refresh();
    }
    return true;
};

MemoryView.prototype.goSmaller=function(){
    if(this.currenIndex<=this.minIndex)return false;
    --this.currentIndex;
    this.refresh();
    return true;
}

MemoryView.prototype.goLarger=function(){
    if(this.currenIndex+this.viewLength>this.maxIndex)return false;
    ++this.currentIndex;
    this.refresh();
    return true;
}