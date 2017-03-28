var ResizableUint8Array = function() {
    this._buffer = new ArrayBuffer(8);
    this._data = new Uint8Array(this._buffer);
    this._size = 0;
};

ResizableUint8Array.prototype.size = function() {
    return this._size;
};

ResizableUint8Array.prototype.get = function(index) {
    return this._data[index];
};

ResizableUint8Array.prototype.set = function(index, value) {
    this._data[index] = value;
};

ResizableUint8Array.prototype.reserve_extra = function(amount) {
    if (this._size + amount > this._data.length) {
        var new_buffer = new ArrayBuffer(Math.max(this._data.length * 2, this._size + amount));
        var new_data = new Uint8Array(new_buffer);
        for (var i = 0; i < this._size; ++i) {
            new_data[i] = this._data[i];
        }
        this._buffer = new_buffer;
        this._data = new_data;
    }
};

ResizableUint8Array.prototype.push = function(value) {
    this.reserve_extra(1);
    this._data[this._size++] = value;
};

ResizableUint8Array.prototype.append = function(value_uint8array) {
    this.reserve_extra(value_uint8array.length);
    for (var i = 0; i < value_uint8array.length; ++i) {
        this._data[this._size++] = value_uint8array[i];
    }
};

ResizableUint8Array.prototype.pop = function() {
    return this._data[--this._size];
};

ResizableUint8Array.prototype.insert_arr = function(index, value_uint8array) {
    this.reserve_extra(value_uint8array.length);
    for (var i = this._size - 1; i >= index; --i) {
        this._data[i + value_uint8array.length] = this._data[i];
    }
    for (var i = 0; i < value_uint8array.length; ++i) {
        this._data[index + i] = value_uint8array[i];
    }
    this._size += value_uint8array.length;
};

ResizableUint8Array.prototype.toUint8Array = function() {
    var ret_arr = new Uint8Array(this._size);
    for (var i = 0; i < this._size; ++i) {
        ret_arr[i] = this._data[i];
    }
    return ret_arr;
};

var encodeUIntString = function(str) {
    return new TextEncoder().encode(str);
};

var VLQEncoder = {};

VLQEncoder.encodeUInt = function(value) {
    var output = new ResizableUint8Array();
    while (true) {
        var next_val = value % 128;
        value = Math.floor(value / 128);
        if (value > 0) {
            output.push(128 + next_val);
        } else {
            output.push(next_val);
            break;
        }
    }
    return output.toUint8Array();
};

VLQEncoder.encodeInt = function(value) {
    var output = new ResizableUint8Array();
    var is_neg = value < 0;
    if (is_neg) value = -value - 1;
    while (true) {
        var next_val = value % 128;
        value = Math.floor(value / 128);
        if (value > 0 || next_val >= 64) {
            if (is_neg) output.push(~next_val & 255); else output.push(128 + next_val);
        } else {
            if (is_neg) output.push(~next_val & 127); else output.push(next_val);
            break;
        }
    }
    return output.toUint8Array();
};

var Wasm32VarType = {
    i32: 127,
    i64: 126,
    f32: 125,
    f64: 124,
    anyfunc: 112,
    func: 96,
    none: 64
};

var Wasm32ExternalKind = {
    function: 0,
    table: 1,
    memory: 2,
    global: 3
};

var Wasm32TypeWriter = function(param_types, result_types) {
    this._param_types = param_types ? param_types : [];
    this._result_types = result_types ? result_types : [];
};

Wasm32TypeWriter.prototype.toUint8Array = function() {
    var output = new ResizableUint8Array();
    output.push(Wasm32VarType.func);
    output.append(VLQEncoder.encodeUInt(this._param_types.length));
    for (var i = 0; i < this._param_types.length; ++i) {
        output.push(this._param_types[i]);
    }
    output.append(VLQEncoder.encodeUInt(this._result_types.length));
    for (var i = 0; i < this._result_types.length; ++i) {
        output.push(this._result_types[i]);
    }
    return output.toUint8Array();
};

var Wasm32FunctionWriter = function(type_index) {
    this._type = type_index;
};

Wasm32FunctionWriter.prototype.toUint8Array = function() {
    var output = new ResizableUint8Array();
    output.append(VLQEncoder.encodeUInt(this._type));
    return output.toUint8Array();
};

var Wasm32CodeWriter = function(local_types) {
    this._localTypes = local_types ? local_types : [];
    this._data = new ResizableUint8Array();
    this._functionlinks = [];
};

Wasm32CodeWriter.prototype.setName = function(name) {
    this._functionname = name;
};

Wasm32CodeWriter.prototype.setType = function(type) {
    this._functiontype = type;
};

Wasm32CodeWriter.instruction = {
    unreachable: 0,
    nop: 1,
    block: 2,
    loop: 3,
    if: 4,
    else: 5,
    end: 11,
    br: 12,
    br_if: 13,
    br_table: 14,
    return: 15,
    call: 16,
    call_indirect: 17,
    drop: 26,
    select: 27,
    get_local: 32,
    set_local: 33,
    tee_local: 34,
    get_global: 35,
    set_global: 36,
    i32_load: 40,
    i64_load: 41,
    f32_load: 42,
    f64_load: 43,
    i32_load8_s: 44,
    i32_load8_u: 45,
    i32_load16_s: 46,
    i32_load16_u: 47,
    i64_load8_s: 48,
    i64_load8_u: 49,
    i64_load16_s: 50,
    i64_load16_u: 51,
    i64_load32_s: 52,
    i64_load32_u: 53,
    i32_store: 54,
    i64_store: 55,
    f32_store: 56,
    f64_store: 57,
    i32_store8: 58,
    i32_store16: 59,
    i64_store8: 60,
    i64_store16: 61,
    i64_store32: 62,
    current_memory: 63,
    grow_memory: 64,
    i32_const: 65,
    i64_const: 66,
    f32_const: 67,
    f64_const: 68,
    i32_eqz: 69,
    i32_eq: 70,
    i32_ne: 71,
    i32_add: 106,
    i32_sub: 107,
    i32_mul: 108
};

Wasm32CodeWriter.prototype.writeRawBytes = function() {
    for (var i = 0; i < arguments.length; ++i) {
        this._data.push(arguments[i]);
    }
};

Wasm32CodeWriter.prototype.writeUint8Array = function(arr) {
    this._data.append(arr);
};

Wasm32CodeWriter.prototype.unreachable = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.unreachable);
};

Wasm32CodeWriter.prototype.nop = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.nop);
};

Wasm32CodeWriter.prototype.block = function(result_type) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.block, result_type);
};

Wasm32CodeWriter.prototype.loop = function(result_type) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.loop, result_type);
};

Wasm32CodeWriter.prototype.if = function(result_type) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.if, result_type);
};

Wasm32CodeWriter.prototype.else = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.else);
};

Wasm32CodeWriter.prototype.end = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.end);
};

Wasm32CodeWriter.prototype.br = function(relative_depth) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.br);
    this.writeUint8Array(VLQEncoder.encodeUInt(relative_depth));
};

Wasm32CodeWriter.prototype.br_if = function(relative_depth) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.br_if);
    this.writeUint8Array(VLQEncoder.encodeUInt(relative_depth));
};

Wasm32CodeWriter.prototype.return = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.return);
};

Wasm32CodeWriter.prototype.call = function(function_index_or_name) {
    if (typeof function_index_or_name === "number") {
        this.writeRawBytes(Wasm32CodeWriter.instruction.call);
        this.writeUint8Array(VLQEncoder.encodeUInt(function_index_or_name));
    } else {
        this.writeRawBytes(Wasm32CodeWriter.instruction.call);
        this._functionlinks.push({
            location: this._data.size(),
            name: function_index_or_name
        });
    }
};

Wasm32CodeWriter.prototype.drop = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.drop);
};

Wasm32CodeWriter.prototype.select = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.select);
};

Wasm32CodeWriter.prototype.get_local = function(localidx) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.get_local, localidx);
};

Wasm32CodeWriter.prototype.set_local = function(localidx) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.set_local, localidx);
};

Wasm32CodeWriter.prototype.tee_local = function(localidx) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.tee_local, localidx);
};

Wasm32CodeWriter.prototype.i32_load = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_load);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.f32_load = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.f32_load);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.f64_load = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.f64_load);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_load8_s = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_load8_s);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_load8_u = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_load8_u);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_load16_s = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_load16_s);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_load16_u = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_load16_u);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load8_s = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load8_s);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load8_u = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load8_u);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load16_s = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load16_s);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load16_u = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load16_u);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load32_s = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load32_s);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_load32_u = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_load32_u);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_store = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_store);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_store = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_store);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.f32_store = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.f32_store);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.f64_store = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.f64_store);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_store8 = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_store8);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i32_store16 = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_store16);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_store8 = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_store8);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_store16 = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_store16);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.i64_store32 = function(offset, log_align) {
    log_align = log_align || 0;
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_store32);
    this.writeUint8Array(VLQEncoder.encodeUInt(log_align));
    this.writeUint8Array(VLQEncoder.encodeUInt(offset));
};

Wasm32CodeWriter.prototype.current_memory = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.current_memory, 0);
};

Wasm32CodeWriter.prototype.grow_memory = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.grow_memory, 0);
};

Wasm32CodeWriter.prototype.i32_const = function(val_i32) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_const, VLQEncoder.encodeInt(val_i32));
};

Wasm32CodeWriter.prototype.i64_const = function(val_i64) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_const, VLQEncoder.encodeInt(val_i64));
};

Wasm32CodeWriter.prototype.i32_eqz = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_eqz);
};

Wasm32CodeWriter.prototype.i32_eq = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_eq);
};

Wasm32CodeWriter.prototype.i32_ne = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_ne);
};

Wasm32CodeWriter.prototype.i32_add = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_add);
};

Wasm32CodeWriter.prototype.i32_sub = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_sub);
};

Wasm32CodeWriter.prototype.i32_mul = function() {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_mul);
};

Wasm32CodeWriter.prototype.toUint8Array = function() {
    var output = new ResizableUint8Array();
    output.append(VLQEncoder.encodeUInt(this._localTypes.length));
    for (var i = 0; i < this._localTypes.length; ++i) {
        output.push(1);
        output.push(this._localTypes[i]);
    }
    output.append(this._data.toUint8Array());
    output.insert_arr(0, VLQEncoder.encodeUInt(output.size()));
    return output.toUint8Array();
};

var Wasm32ExportWriter = function(field, kind, index) {
    this._field = field;
    this._kind = kind;
    this._index = index;
};

Wasm32ExportWriter.prototype.setName = function(name) {
    this._functionname = name;
};

Wasm32ExportWriter.prototype.toUint8Array = function() {
    var output = new ResizableUint8Array();
    var encoded_field_bytes = encodeUIntString(this._field);
    output.append(VLQEncoder.encodeUInt(encoded_field_bytes.length));
    output.append(encoded_field_bytes);
    output.push(this._kind);
    output.append(VLQEncoder.encodeUInt(this._index));
    return output.toUint8Array();
};

var Wasm32ImportWriter = function(module, field, kind) {
    this._module = module;
    this._field = field;
    this._kind = kind;
};

Wasm32ImportWriter.prototype.setName = function(name) {
    this._functionname = name;
};

Wasm32ImportWriter.prototype.setType = function(type) {
    this._functiontype = type;
};

Wasm32ImportWriter.prototype.toUint8Array = function() {
    var output = new ResizableUint8Array();
    var module_bytes = encodeUIntString(this._module);
    var field_bytes = encodeUIntString(this._field);
    output.push(VLQEncoder.encodeUInt(module_bytes.length));
    output.append(module_bytes);
    output.push(VLQEncoder.encodeUInt(field_bytes.length));
    output.append(field_bytes);
    output.push(this._kind);
    output.append(VLQEncoder.encodeUInt(this._type));
    return output.toUint8Array();
};

var Wasm32MemoryWriter = function(initial_pages, maximum_pages) {
    this._initial_pages = initial_pages;
    if (maximum_pages) this._maximum_pages = maximum_pages;
};

Wasm32MemoryWriter.prototype.toUint8Array = function() {
    var output = new ResizableUint8Array();
    if (this._maximum_pages) {
        output.push(1);
        output.append(VLQEncoder.encodeUInt(this._initial_pages));
        output.append(VLQEncoder.encodeUInt(this._maximum_pages));
    } else {
        output.push(0);
        output.append(VLQEncoder.encodeUInt(this._initial_pages));
    }
    return output.toUint8Array();
};

var Wasm32ModuleWriter = function() {
    this._types = [];
    this._imports = [];
    this._functions = [];
    this._memory = [];
    this._exports = [];
    this._codes = [];
};

Wasm32ModuleWriter.sectionCode = {
    TYPE: 1,
    IMPORT: 2,
    FUNCTION: 3,
    TABLE: 4,
    MEMORY: 5,
    GLOBAL: 6,
    EXPORT: 7,
    START: 8,
    ELEMENT: 9,
    CODE: 10,
    DATA: 11
};

Wasm32ModuleWriter.prototype.setMemory = function(memory) {
    this._memory = [ memory ];
};

Wasm32ModuleWriter.prototype.exportFunction = function(name, field) {
    field = field || name;
    var exportWriter = new Wasm32ExportWriter(field, Wasm32ExternalKind.function);
    exportWriter.setName(name);
    this._exports.push(exportWriter);
};

Wasm32ModuleWriter.prototype.importFunction = function(name, type, module, field) {
    var importWriter = new Wasm32ImportWriter(module, field, Wasm32ExternalKind.function);
    importWriter.setName(name);
    importWriter.setType(type);
    this._imports.push(importWriter);
};

Wasm32ModuleWriter.prototype.addFunction = function(name, type, codeWriter) {
    codeWriter.setName(name);
    codeWriter.setType(type);
    this._codes.push(codeWriter);
};

Wasm32ModuleWriter.prototype.generateModule = function() {
    var funcTypes = [];
    var funcTypesOffset = this._types.length;
    var funcTypesEqComp = function(type_data) {
        return function(el) {
            if (el.length != type_data.length) return false;
            for (var i = 0; i < el.length; ++i) {
                if (el[i] != type_data[i]) return false;
            }
            return true;
        };
    };
    var funcNames = [];
    var funcNamesOffset = this._functions.length;
    this._imports.forEach(function(obj) {
        var name = obj._functionname;
        if (name) {
            if (funcNames.findIndex(function(el) {
                return el.name === name;
            }) === -1) funcNames.push({
                name: name,
                funcType: obj._functiontype
            }); else throw 'Repeated function "' + name + '".';
        }
    });
    this._codes.forEach(function(obj) {
        var name = obj._functionname;
        if (name) {
            if (funcNames.findIndex(function(el) {
                return el.name === name;
            }) === -1) funcNames.push({
                name: name,
                funcType: obj._functiontype
            }); else throw 'Repeated function "' + name + '".';
        }
    });
    funcNames.forEach(function(el) {
        if (funcTypes.findIndex(funcTypesEqComp(el.funcType)) === -1) funcTypes.push(el.funcType);
    });
    var that = this;
    funcTypes.forEach(function(type) {
        that._types.push(type);
    });
    var that = this;
    this._codes.forEach(function(obj) {
        var type = obj._functiontype;
        if (type) {
            var typeIndex = funcTypes.findIndex(funcTypesEqComp(obj._functiontype)) + funcTypesOffset;
            if (typeIndex === -1) throw "Weird assembler bug.";
            var functionWriter = new Wasm32FunctionWriter(typeIndex);
            that._functions.push(functionWriter);
        }
    });
    this._imports.forEach(function(obj) {
        var type = obj._functiontype;
        if (type) {
            var typeIndex = funcTypes.findIndex(funcTypesEqComp(type)) + funcTypesOffset;
            if (typeIndex === -1) throw "Weird assembler bug.";
            obj._type = typeIndex;
        }
    });
    this._codes.forEach(function(obj) {
        var functionLinks = obj._functionlinks;
        functionLinks.sort(function(a, b) {
            return b.location - a.location;
        });
        functionLinks.forEach(function(functionLink) {
            var funcIndex = funcNames.findIndex(function(el) {
                return el.name === functionLink.name;
            }) + funcNamesOffset;
            if (funcIndex === -1) throw 'Undeclared function "' + functionLink.name + '".';
            obj._data.insert_arr(functionLink.location, VLQEncoder.encodeUInt(funcIndex));
        });
    });
    this._exports.forEach(function(obj) {
        var name = obj._functionname;
        if (name) {
            var funcIndex = funcNames.findIndex(function(el) {
                return el.name === name;
            }) + funcNamesOffset;
            if (funcIndex === -1) throw 'Undeclared function "' + functionLink.name + '".';
            obj._index = funcIndex;
        }
    });
    this._exports.forEach(function(obj) {
        if (obj._functionname) obj._functionname = undefined;
    });
    this._imports.forEach(function(obj) {
        if (obj._functionname) {
            obj._functionname = undefined;
            obj._functiontype = undefined;
        }
    });
    this._codes.forEach(function(obj) {
        if (obj._functionname) {
            obj._functionname = undefined;
            obj._functiontype = undefined;
        }
    });
    var output = new ResizableUint8Array();
    var wasm_header = new Uint8Array(8);
    wasm_header[0] = 0;
    wasm_header[1] = 97;
    wasm_header[2] = 115;
    wasm_header[3] = 109;
    wasm_header[4] = 1;
    wasm_header[5] = 0;
    wasm_header[6] = 0;
    wasm_header[7] = 0;
    output.append(wasm_header);
    if (this._types.length > 0) {
        output.push(Wasm32ModuleWriter.sectionCode.TYPE);
        var sizeloc = output.size();
        output.append(VLQEncoder.encodeUInt(this._types.length));
        for (var i = 0; i < this._types.length; ++i) {
            output.append(this._types[i]);
        }
        output.insert_arr(sizeloc, VLQEncoder.encodeUInt(output.size() - sizeloc));
    }
    if (this._imports.length > 0) {
        output.push(Wasm32ModuleWriter.sectionCode.IMPORT);
        var sizeloc = output.size();
        output.append(VLQEncoder.encodeUInt(this._imports.length));
        for (var i = 0; i < this._imports.length; ++i) {
            output.append(this._imports[i].toUint8Array());
        }
        output.insert_arr(sizeloc, VLQEncoder.encodeUInt(output.size() - sizeloc));
    }
    if (this._functions.length > 0) {
        output.push(Wasm32ModuleWriter.sectionCode.FUNCTION);
        var sizeloc = output.size();
        output.append(VLQEncoder.encodeUInt(this._functions.length));
        for (var i = 0; i < this._functions.length; ++i) {
            output.append(this._functions[i].toUint8Array());
        }
        output.insert_arr(sizeloc, VLQEncoder.encodeUInt(output.size() - sizeloc));
    }
    if (this._memory.length > 0) {
        output.push(Wasm32ModuleWriter.sectionCode.MEMORY);
        var sizeloc = output.size();
        output.append(VLQEncoder.encodeUInt(this._memory.length));
        for (var i = 0; i < this._memory.length; ++i) {
            output.append(this._memory[i].toUint8Array());
        }
        output.insert_arr(sizeloc, VLQEncoder.encodeUInt(output.size() - sizeloc));
    }
    if (this._exports.length > 0) {
        output.push(Wasm32ModuleWriter.sectionCode.EXPORT);
        var sizeloc = output.size();
        output.append(VLQEncoder.encodeUInt(this._exports.length));
        for (var i = 0; i < this._exports.length; ++i) {
            output.append(this._exports[i].toUint8Array());
        }
        output.insert_arr(sizeloc, VLQEncoder.encodeUInt(output.size() - sizeloc));
    }
    if (this._codes.length > 0) {
        output.push(Wasm32ModuleWriter.sectionCode.CODE);
        var sizeloc = output.size();
        output.append(VLQEncoder.encodeUInt(this._codes.length));
        for (var i = 0; i < this._codes.length; ++i) {
            output.append(this._codes[i].toUint8Array());
        }
        output.insert_arr(sizeloc, VLQEncoder.encodeUInt(output.size() - sizeloc));
    }
    return output.toUint8Array();
};