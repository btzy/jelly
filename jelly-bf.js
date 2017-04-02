var JellyBF={
    compile:function(str,options,callback){
        // compiles BF code string to a WebAssembly.Module
        var moduleWriter=new Wasm32ModuleWriter();
        
        var memoryWriter=new Wasm32MemoryWriter(16,16);
        moduleWriter.setMemory(memoryWriter);
        
        var codeWriter=new Wasm32CodeWriter([Wasm32VarType.i32]); // ptr
        
        for(var i=0;i<str.length;++i){
            switch(str[i]){
                case '+':
                    codeWriter.get_local(0);
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.i32_const(1);
                    codeWriter.i32_add();
                    codeWriter.i32_store8(0); // TODO: is order of arguments correct?
                    break;
                case '-':
                    codeWriter.get_local(0);
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.i32_const(1);
                    codeWriter.i32_sub();
                    codeWriter.i32_store8(0);
                    break;
                case '>':
                    codeWriter.get_local(0);
                    codeWriter.i32_const(1);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                    break;
                case '<':
                    codeWriter.get_local(0);
                    codeWriter.i32_const(1);
                    codeWriter.i32_sub();
                    codeWriter.set_local(0);
                    break;
                case '[':
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.if(Wasm32VarType.none);
                    codeWriter.loop(Wasm32VarType.none);
                    break;
                case ']':
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.br_if(0);
                    codeWriter.end();
                    codeWriter.end();
                    break;
                case ',':
                    codeWriter.get_local(0);
                    codeWriter.call("input"); // input: [] => [i32]
                    codeWriter.i32_store8(0);
                    break;
                case '.':
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(0);
                    codeWriter.call("output"); // output: [i32] => []
                    break;
            }
        }
        codeWriter.end();
        var type=new Wasm32TypeWriter([],[]).toUint8Array();
        moduleWriter.addFunction("main",type,codeWriter);
        
        moduleWriter.exportFunction("main","main");
        moduleWriter.importFunction("input",new Wasm32TypeWriter([],[Wasm32VarType.i32]).toUint8Array(),"interaction","input");
        moduleWriter.importFunction("output",new Wasm32TypeWriter([Wasm32VarType.i32],[]).toUint8Array(),"interaction","output");
        
        var byteCode=moduleWriter.generateModule();
        
        WebAssembly.compile(byteCode).then(function(compiledModule){
            callback(compiledModule);
        });
    },
    compileOptimized:function(str,options,callback){
        WebAssembly.compile(JellyBFCompiler.compile(str,options)).then(function(compiledModule){
            callback(compiledModule);
        });
    },
    execute:function(compiledModule,inputString,callback){
        var inputArr=new TextEncoder().encode(inputString);
        var inputPtr=0;
        var outputArr=new ResizableUint8Array();
        WebAssembly.instantiate(compiledModule,{
            interaction:{
                input:function(){
                    if(inputPtr<inputArr.length){
                        return inputArr[inputPtr++];
                    }
                    else{
                        return 0;
                    }
                },
                output:function(byte){
                    outputArr.push(byte);
                }
            }
        }).then(function(instance){
            instance.exports.main();
            callback(new TextDecoder().decode(outputArr.toUint8Array()));
        });
    }
};