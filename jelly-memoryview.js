var MemoryView=function(root_el,uint8_array,min_index,max_index){
    this.root=root_el;
    this.minIndex=min_index;
    this.maxIndex=max_index;
    this.currentIndex=this.minIndex;
    this.viewLength=1;
    this.data=uint8_array;
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
        cells[i].firstChild.nodeValue=(this.data[this.currentIndex+i]).toString();
    }
};

MemoryView.prototype.redraw=function(){
    while(this.root.firstChild)this.root.removeChild(this.root.firstChild);
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