var FlexSplitter=function(flex_el,drag_el,minBefore,minAfter){
    var that=this;
    
    var splitterElement=flex_el;
    var containerElement=flex_el.parentElement;
    var beforeElement=flex_el;
    do{
        beforeElement=beforeElement.previousElementSibling;
    }while(parseFloat(window.getComputedStyle(beforeElement).getPropertyValue("flex-grow"))===0);
    var afterElement=flex_el;
    do{
        afterElement=afterElement.nextElementSibling;
    }while(parseFloat(window.getComputedStyle(afterElement).getPropertyValue("flex-grow"))===0);
    
    var containerflexdirection=window.getComputedStyle(containerElement).getPropertyValue("flex-direction");
    var isFlexVertical=(containerflexdirection.indexOf("column")!==-1);
    var isFlexReverse=(containerflexdirection.indexOf("reverse")!==-1);
    
    minBefore=minBefore||0.1;
    minAfter=minAfter||0.1;
    
    var mousedownLocation=undefined;
    var beforeElSize=undefined;
    var afterElSize=undefined;
    var beforeElRatio=undefined;
    var afterElRatio=undefined;
    
    var mouseup_handler=function(e){
        document.removeEventListener("mouseleave",mouseup_handler);
        document.removeEventListener("mouseup",mouseup_handler);
        document.removeEventListener("mousemove",mousemove_handler);
        mousedownLocation=undefined;
        beforeElSize=undefined;
        afterElSize=undefined;
        beforeElRatio=undefined;
        afterElRatio=undefined;
        if(that.onresize)that.onresize();
    };
    
    var mousemove_handler=function(e){
        var mouseCurrLocation=(isFlexVertical?e.clientY:e.clientX);
        var beforeElNewRatio=(beforeElSize+(isFlexReverse?(mousedownLocation-mouseCurrLocation):(mouseCurrLocation-mousedownLocation)))/beforeElSize*beforeElRatio;
        var afterElNewRatio=(afterElSize-(isFlexReverse?(mousedownLocation-mouseCurrLocation):(mouseCurrLocation-mousedownLocation)))/afterElSize*afterElRatio;
        var totalRatio=beforeElRatio+afterElRatio;
        if(beforeElNewRatio/totalRatio<minBefore){
            beforeElNewRatio=minBefore*totalRatio;
            afterElNewRatio=(1-minBefore)*totalRatio;
        }
        if(afterElNewRatio/totalRatio<minAfter){
            afterElNewRatio=minAfter*totalRatio;
            beforeElNewRatio=(1-minAfter)*totalRatio;
        }
        beforeElement.style.setProperty("flex-grow",beforeElNewRatio.toString());
        beforeElement.style.setProperty("flex-shrink",beforeElNewRatio.toString());
        afterElement.style.setProperty("flex-grow",afterElNewRatio.toString());
        afterElement.style.setProperty("flex-shrink",afterElNewRatio.toString());
        if(that.onadjust)that.onadjust();
    };
    
    drag_el.addEventListener("mousedown",function(e){
        mousedownLocation=(isFlexVertical?e.clientY:e.clientX);
        beforeElSize=(isFlexVertical?beforeElement.offsetHeight:beforeElement.offsetWidth);
        afterElSize=(isFlexVertical?afterElement.offsetHeight:afterElement.offsetWidth);
        beforeElRatio=parseFloat(window.getComputedStyle(beforeElement).getPropertyValue("flex-grow"));
        afterElRatio=parseFloat(window.getComputedStyle(afterElement).getPropertyValue("flex-grow"));
        document.addEventListener("mousemove",mousemove_handler);
        document.addEventListener("mouseup",mouseup_handler);
        document.addEventListener("mouseleave",mouseup_handler);
    });
};