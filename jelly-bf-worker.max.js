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
    if (value < 0 || value !== Math.floor(value)) debugger;
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
    if (value !== Math.floor(value)) debugger;
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

Wasm32CodeWriter.prototype.setLocalTypes = function(local_types) {
    this._localTypes = local_types ? local_types : [];
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
        if (!(arguments[i] >= 0 && arguments[i] < 256)) debugger;
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
    this.writeRawBytes(Wasm32CodeWriter.instruction.get_local);
    this.writeUint8Array(VLQEncoder.encodeUInt(localidx));
};

Wasm32CodeWriter.prototype.set_local = function(localidx) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.set_local);
    this.writeUint8Array(VLQEncoder.encodeUInt(localidx));
};

Wasm32CodeWriter.prototype.tee_local = function(localidx) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.tee_local);
    this.writeUint8Array(VLQEncoder.encodeUInt(localidx));
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
    this.writeRawBytes(Wasm32CodeWriter.instruction.i32_const);
    this.writeUint8Array(VLQEncoder.encodeInt(val_i32));
};

Wasm32CodeWriter.prototype.i64_const = function(val_i64) {
    this.writeRawBytes(Wasm32CodeWriter.instruction.i64_const);
    this.writeUint8Array(VLQEncoder.encodeInt(val_i64));
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

var JellyBFCompiler = {};

JellyBFCompiler.compile = function(str, options) {
    if (options.wraparound === undefined) options.wraparound = true;
    if (options.infiniteloops === undefined) options.infiniteloops = true;
    if (options.bitwidth === undefined) options.bitwidth = 8;
    if (options.bitwidth !== 8 && options.bitwidth !== 16 && options.bitwidth !== 32) return;
    var codeChunks = [];
    for (var i = 0; i < str.length; ++i) {
        switch (str[i]) {
          case "+":
            var newDelta = new JellyBFRangeDelta();
            newDelta.addDelta(0, 1);
            JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks, newDelta);
            break;

          case "-":
            var newDelta = new JellyBFRangeDelta();
            newDelta.addDelta(0, -1);
            JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks, newDelta);
            break;

          case ">":
            var newDelta = new JellyBFRangeDelta();
            newDelta.addExitDelta(1);
            JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks, newDelta);
            break;

          case "<":
            var newDelta = new JellyBFRangeDelta();
            newDelta.addExitDelta(-1);
            JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks, newDelta);
            break;

          case "[":
            codeChunks.push("[");
            break;

          case "]":
            JellyBF_CloseAndAttemptUnrollLoop(codeChunks, options);
            break;

          case ",":
            codeChunks.push(",");
            break;

          case ".":
            codeChunks.push(".");
            break;
        }
    }
    var resolvedCodeChunks = [];
    var currentState = new JellyBFPossibleState(true);
    for (var i = 0; i < codeChunks.length; ++i) {}
    return JellyBF_WriteCodeChunksToModule(codeChunks);
};

var JellyBF_WriteCodeChunksToModule = function(codeChunks) {
    var moduleWriter = new Wasm32ModuleWriter();
    var memoryWriter = new Wasm32MemoryWriter(16, 16);
    moduleWriter.setMemory(memoryWriter);
    var codeWriter = new Wasm32CodeWriter([ Wasm32VarType.i32 ]);
    codeWriter.i32_const(524288);
    codeWriter.set_local(0);
    var maxlocals = 1;
    for (var i = 0; i < codeChunks.length; ++i) {
        if (codeChunks[i] instanceof JellyBFRangeDelta) {
            var jellyBFrangedelta = codeChunks[i];
            if (jellyBFrangedelta._data.length > 0) {
                var stateRefsLocalOffset = 1;
                var stateRefs = [];
                jellyBFrangedelta._data.forEach(function(entry) {
                    if (entry._combination.isZero()) debugger;
                    entry._combination._terms.forEach(function(term) {
                        term._parts.forEach(function(part) {
                            if (part instanceof JellyBFLinearStateRef) {
                                var stateRefIndex = stateRefs.findIndex(function(arg) {
                                    return arg >= part._index;
                                });
                                if (stateRefIndex === -1) stateRefs.push(part._index); else if (stateRefs[stateRefIndex] !== part._index) stateRefs.splice(stateRefIndex, 0, part._index);
                            } else debugger;
                        });
                    });
                });
                var offset = Math.min(jellyBFrangedelta._data[0]._index, jellyBFrangedelta._exitindex);
                if (stateRefs.length > 0) offset = Math.min(offset, stateRefs[0]);
                if (offset !== 0) {
                    codeWriter.get_local(0);
                    codeWriter.i32_const(offset);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
                stateRefs.forEach(function(ref, localidx) {
                    var effectiveLocalIdx = stateRefsLocalOffset + localidx;
                    var effectiveOffset = ref - offset;
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(effectiveOffset);
                    codeWriter.set_local(effectiveLocalIdx);
                });
                jellyBFrangedelta._data.forEach(function(entry) {
                    if (entry._combination.isZero()) debugger;
                    var effectiveOffset = entry._index - offset;
                    codeWriter.get_local(0);
                    codeWriter.get_local(0);
                    codeWriter.i32_load8_u(effectiveOffset);
                    entry._combination._terms.forEach(function(term, termindex) {
                        if (term._coefficient === 0) debugger;
                        if (term._parts.length === 1 && term._coefficient === 1) {
                            var part = term._parts[0];
                            if (part instanceof JellyBFLinearStateRef) {
                                var stateRefIndex = stateRefs.findIndex(function(arg) {
                                    return arg >= part._index;
                                });
                                var effectiveLocalIdx = stateRefsLocalOffset + stateRefIndex;
                                codeWriter.get_local(effectiveLocalIdx);
                            } else debugger;
                        } else {
                            codeWriter.i32_const(term._coefficient);
                            term._parts.forEach(function(part) {
                                if (part instanceof JellyBFLinearStateRef) {
                                    var stateRefIndex = stateRefs.findIndex(function(arg) {
                                        return arg >= part._index;
                                    });
                                    var effectiveLocalIdx = stateRefsLocalOffset + stateRefIndex;
                                    codeWriter.get_local(effectiveLocalIdx);
                                    codeWriter.i32_mul();
                                } else debugger;
                            });
                        }
                        codeWriter.i32_add();
                    });
                    codeWriter.i32_store8(effectiveOffset);
                });
                if (jellyBFrangedelta._exitindex - offset !== 0) {
                    codeWriter.get_local(0);
                    codeWriter.i32_const(jellyBFrangedelta._exitindex - offset);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
                maxlocals = Math.max(maxlocals, stateRefsLocalOffset + stateRefs.length);
            } else {
                if (jellyBFrangedelta._exitindex !== 0) {
                    codeWriter.get_local(0);
                    codeWriter.i32_const(codeChunks[i]._exitindex);
                    codeWriter.i32_add();
                    codeWriter.set_local(0);
                }
            }
        } else {
            switch (codeChunks[i]) {
              case "[":
                codeWriter.get_local(0);
                codeWriter.i32_load8_u(0);
                codeWriter.if(Wasm32VarType.none);
                codeWriter.loop(Wasm32VarType.none);
                break;

              case "]":
                codeWriter.get_local(0);
                codeWriter.i32_load8_u(0);
                codeWriter.br_if(0);
                codeWriter.end();
                codeWriter.end();
                break;

              case ",":
                codeWriter.get_local(0);
                codeWriter.call("input");
                codeWriter.i32_store8(0);
                break;

              case ".":
                codeWriter.get_local(0);
                codeWriter.i32_load8_u(0);
                codeWriter.call("output");
                break;
            }
        }
    }
    codeWriter.end();
    var localTypesParam = [];
    for (var i = 0; i < maxlocals; ++i) {
        localTypesParam.push(Wasm32VarType.i32);
    }
    codeWriter.setLocalTypes(localTypesParam);
    var type = new Wasm32TypeWriter([], []).toUint8Array();
    moduleWriter.addFunction("main", type, codeWriter);
    moduleWriter.exportFunction("main", "main");
    moduleWriter.importFunction("input", new Wasm32TypeWriter([], [ Wasm32VarType.i32 ]).toUint8Array(), "interaction", "input");
    moduleWriter.importFunction("output", new Wasm32TypeWriter([ Wasm32VarType.i32 ], []).toUint8Array(), "interaction", "output");
    var byteCode = moduleWriter.generateModule();
    return byteCode;
};

var JellyBFEntry = function(index, delta) {
    this._index = index;
    this._delta = delta;
};

var JellyBFDelta = function() {
    this._data = [];
    this._exitindex = 0;
};

JellyBFDelta.prototype.applyDelta = function(index, delta) {
    var dataIndex = this._data.findIndex(function(el) {
        return el._index >= index;
    });
    if (dataIndex === -1) {
        if (delta !== 0) this._data.push(new JellyBFEntry(index, delta));
    } else if (this._data[dataIndex]._index === index) {
        this._data[dataIndex]._delta += delta;
        if (this._data[dataIndex]._delta === 0) this._data.splice(dataIndex, 1);
    } else {
        if (delta !== 0) this._data.splice(dataIndex, 0, new JellyBFEntry(index, delta));
    }
};

JellyBFDelta.prototype.applyExitDelta = function(delta) {
    this._exitindex += delta;
};

JellyBFDelta.prototype.coalesceWith = function(jellyBFdelta) {
    var that = this;
    jellyBFdelta._data.forEach(function(entry) {
        that.applyDelta(that._exitindex + entry._index, entry._delta);
    });
    this._exitindex += jellyBFdelta._exitindex;
};

var find_gcd = function(a, b) {
    if (a < b) {
        var tmp = a;
        a = b;
        b = tmp;
    }
    if (b === 0) return a;
    return find_gcd(b, a % b);
};

var RationalNumber = function(num, den) {
    this._sgn = num < 0;
    this._num = Math.abs(num);
    this._den = den;
};

RationalNumber.prototype.reduce = function() {
    var gcd = find_gcd(this._num, this._den);
    this._num /= gcd;
    this._den /= gcd;
};

RationalNumber.prototype.multiplyWith = function(val) {
    if (val instanceof RationalNumber) {
        this._sgn = this._sgn !== val._sgn;
        this._num *= val._num;
        this._den *= val._den;
        this.reduce();
    } else {
        this._sgn = this.sgn !== val < 0;
        this.num *= Math.abs(val);
        this.reduce();
    }
};

var JellyBFLinearStateRef = function(index) {
    this._index = index;
};

JellyBFLinearStateRef.sortOrder = 1;

JellyBFLinearStateRef.Comparer = function(a, b) {
    return a._index - b._index;
};

JellyBFLinearStateRef.prototype.addShift = function(index_shift, input_shift) {
    this._index += index_shift;
};

JellyBFLinearStateRef.prototype.clone = function() {
    return new JellyBFLinearStateRef(this._index);
};

var JellyBFLinearInputRef = function(index) {
    this._index = index;
};

JellyBFLinearInputRef.sortOrder = 2;

JellyBFLinearInputRef.Comparer = function(a, b) {
    return a._index - b._index;
};

JellyBFLinearInputRef.prototype.addShift = function(index_shift, input_shift) {
    this._index += input_shift;
};

JellyBFLinearInputRef.prototype.clone = function() {
    return new JellyBFLinearInputRef(this._index);
};

var JellyBFLinearTermParts = {};

JellyBFLinearTermParts.Comparer = function(a, b) {
    var aconstructor = a.constructor;
    var bconstructor = b.constructor;
    if (aconstructor !== bconstructor) {
        return aconstructor.sortOrder - bconstructor.sortOrder;
    }
    return aconstructor.Comparer(a, b);
};

JellyBFLinearTermParts.FinderLow = function(a) {
    return function(arg) {
        return JellyBFLinearTermParts.Comparer(arg, a) >= 0;
    };
};

var JellyBFLinearTerm = function(coefficient) {
    this._parts = [];
    this._coefficient = coefficient;
};

JellyBFLinearTerm.makeConstant = function(value) {
    var ret = new JellyBFLinearTerm();
    ret._coefficient = value;
    return ret;
};

JellyBFLinearTerm.makeFromPart = function(part) {
    var ret = new JellyBFLinearTerm(1);
    ret._parts = [ part ];
    return ret;
};

JellyBFLinearTerm.Comparer = function(a, b) {
    var maxlen = Math.max(a._parts.length, b._parts.length);
    for (var i = 0; i < maxlen; ++i) {
        if (a._parts.length <= i) return -1;
        if (b._parts.length <= i) return 1;
        var ret = JellyBFLinearTermParts.Comparer(a._parts[i], b._parts[i]);
        if (ret !== 0) return ret;
    }
    return 0;
};

JellyBFLinearTerm.FinderLow = function(a) {
    return function(arg) {
        return JellyBFLinearTerm.Comparer(arg, a) >= 0;
    };
};

JellyBFLinearTerm.IsEqual = function(a, b) {
    if (a._parts.length !== b._parts.length) return false;
    var len = a._parts.length;
    for (var i = 0; i < len; ++i) {
        var ret = JellyBFLinearTermParts.Comparer(a._parts[i], b._parts[i]);
        if (ret !== 0) return false;
    }
    return true;
};

JellyBFLinearTerm.prototype.addWith = function(linearterm) {
    this._coefficient += linearterm._coefficient;
};

JellyBFLinearTerm.prototype.multiplyWith = function(linearterm) {
    if (linearterm.isZero()) debugger;
    var this_parts = this._parts;
    linearterm._parts.forEach(function(part) {
        var index = this_parts.findIndex(JellyBFLinearTermParts.FinderLow(part));
        if (index === -1) {
            this_parts.push(part);
        } else {
            this_parts.splice(index, 0, part);
        }
    });
    this._coefficient *= linearterm._coefficient;
};

JellyBFLinearTerm.prototype.isZero = function() {
    return this._coefficient === 0;
};

JellyBFLinearTerm.prototype.clone = function() {
    var ret = new JellyBFLinearTerm(this._coefficient);
    this._parts.forEach(function(part) {
        ret._parts.push(part.clone());
    });
    return ret;
};

var JellyBFLinear = function() {
    this._terms = [];
};

JellyBFLinear.prototype.addTerm = function(linearterm) {
    if (linearterm.isZero()) debugger;
    var dataIndex = this._terms.findIndex(JellyBFLinearTerm.FinderLow(linearterm));
    if (dataIndex === -1) {
        this._terms.push(linearterm);
    } else if (JellyBFLinearTerm.IsEqual(this._terms[dataIndex], linearterm)) {
        this._terms[dataIndex].addWith(linearterm);
        if (this._terms[dataIndex].isZero()) this._terms.splice(dataIndex, 1);
    } else {
        this._terms.splice(dataIndex, 0, linearterm);
    }
};

JellyBFLinear.prototype.multiplyTerm = function(linearterm) {
    if (linearterm.isZero()) debugger;
    this._terms.forEach(function(term) {
        term.multiplyWith(linearterm.clone());
    });
};

JellyBFLinear.prototype.multiplyLinear = function(linearcombination) {
    var old_terms = this._terms;
    var new_terms = [];
    linearcombination._terms.forEach(function(ins_term) {
        old_terms.forEach(function(old_term) {
            var cl = old_term.clone();
            cl.multiplyWith(ins_term.clone());
            new_terms.push(cl);
        });
    });
    new_terms.sort(JellyBFLinearTerm.Comparer);
    this._terms = new_terms;
};

JellyBFLinear.prototype.isZero = function() {
    return this._terms.length === 0;
};

JellyBFLinear.prototype.clone = function() {
    var ret = new JellyBFLinear();
    this._terms.forEach(function(term) {
        ret._terms.push(term.clone());
    });
    return ret;
};

JellyBFLinear.prototype.coalesceWith = function(jellyBFlinear) {
    var that = this;
    jellyBFlinear._terms.forEach(function(term) {
        that.addTerm(term);
    });
};

JellyBFLinear.prototype.expandState = function(jellyBFrangedelta) {
    if (!(jellyBFrangedelta instanceof JellyBFRangeDelta)) debugger;
    var new_terms = [];
    this._terms.forEach(function(term) {
        var part_indices_for_expansion = [];
        var new_term = new JellyBFLinearTerm(term._coefficient);
        term._parts.forEach(function(part) {
            if (part instanceof JellyBFLinearStateRef) {
                part_indices_for_expansion.push(part._index);
            } else if (part instanceof JellyBFLinearOutputRef) {
                new_term.push(part);
            } else debugger;
        });
        var lincombin = new JellyBFLinear();
        lincombin.addTerm(JellyBFLinearTerm.makeConstant(1));
        part_indices_for_expansion.forEach(function(index) {
            var applyIndex = jellyBFrangedelta._data.findIndex(JellyBFRangeEntry.FinderEqualIndex(index));
            var applyCombination = new JellyBFLinear();
            applyCombination.addTerm(JellyBFLinearTerm.makeFromPart(new JellyBFLinearStateRef(index)));
            if (applyIndex !== -1) {
                applyCombination.coalesceWith(jellyBFrangedelta._data[applyIndex]._combination.clone());
            }
            lincombin.multiplyLinear(applyCombination);
        });
        lincombin.multiplyTerm(new_term);
        lincombin._terms.forEach(function(term) {
            new_terms.push(term);
        });
    });
    this._terms = [];
    var that = this;
    new_terms.forEach(function(term) {
        that.addTerm(term);
    });
};

JellyBFLinear.IsExactSame = function(a, b) {
    if (a._terms.length !== b._terms.length) return false;
    var maxlen = a._terms.length;
    for (var i = 0; i < maxlen; ++i) {
        if (!JellyBFLinearTerm.IsEqual(a._terms[i], b._terms[i])) return false;
        if (a._terms[i]._coefficient !== b._terms[i]._coefficient) return false;
    }
    return true;
};

var JellyBFRangeEntry = function(index) {
    this._index = index;
    this._combination = new JellyBFLinear();
};

JellyBFRangeEntry.Comparer = function(a, b) {
    return a._index - b._index;
};

JellyBFRangeEntry.FinderLow = function(a) {
    return function(arg) {
        return arg._index >= a._index;
    };
};

JellyBFRangeEntry.FinderLowIndex = function(index) {
    return function(arg) {
        return arg._index >= index;
    };
};

JellyBFRangeEntry.FinderEqual = function(a) {
    return function(arg) {
        return arg._index === a._index;
    };
};

JellyBFRangeEntry.FinderEqualIndex = function(index) {
    return function(arg) {
        return arg._index === index;
    };
};

JellyBFRangeEntry.IsEqual = function(a, b) {
    return a._index === b._index;
};

JellyBFRangeEntry.IsEqualIndex = function(a, index) {
    return a._index === index;
};

JellyBFRangeEntry.prototype.addTerm = function(linearterm) {
    this._combination.addTerm(linearterm);
};

JellyBFRangeEntry.prototype.multiplyTerm = function(linearterm) {
    this._combination.multiplyTerm(linearterm);
};

JellyBFRangeEntry.prototype.isZero = function() {
    return this._combination.isZero();
};

JellyBFRangeEntry.prototype.coalesceWith = function(jellyBFrangeentry) {
    this._combination.coalesceWith(jellyBFrangeentry._combination);
};

JellyBFRangeEntry.makeFromTerm = function(index, term) {
    if (!(term instanceof JellyBFLinearTerm)) debugger;
    var ret = new JellyBFRangeEntry(index);
    ret.addTerm(term);
    return ret;
};

var JellyBFRangeDelta = function() {
    this._data = [];
    this._outputs = [];
    this._exitindex = 0;
    this._inputcount = 0;
};

JellyBFRangeDelta.prototype.addEntry = function(jellyBFrangeentry) {
    var dataIndex = this._data.findIndex(JellyBFRangeEntry.FinderLow(jellyBFrangeentry));
    if (dataIndex === -1) {
        this._data.push(jellyBFrangeentry);
    } else if (JellyBFRangeEntry.IsEqual(this._data[dataIndex], jellyBFrangeentry)) {
        this._data[dataIndex].coalesceWith(jellyBFrangeentry);
        if (this._data[dataIndex].isZero()) this._data.splice(dataIndex, 1);
    } else {
        this._data.splice(dataIndex, 0, jellyBFrangeentry);
    }
};

JellyBFRangeDelta.prototype.addDelta = function(index, delta) {
    var dataIndex = this._data.findIndex(JellyBFRangeEntry.FinderLowIndex(index));
    if (dataIndex === -1) {
        if (delta !== 0) this._data.push(JellyBFRangeEntry.makeFromTerm(index, JellyBFLinearTerm.makeConstant(delta)));
    } else if (JellyBFRangeEntry.IsEqualIndex(this._data[dataIndex], index)) {
        this._data[dataIndex].addTerm(JellyBFLinearTerm.makeConstant(delta));
        if (this._data[dataIndex].isZero()) this._data.splice(dataIndex, 1);
    } else {
        if (delta !== 0) this._data.splice(dataIndex, 0, JellyBFRangeEntry.makeFromTerm(index, JellyBFLinearTerm.makeConstant(delta)));
    }
};

JellyBFRangeDelta.prototype.addExitDelta = function(delta) {
    this._exitindex += delta;
};

JellyBFRangeDelta.prototype.coalesceWith = function(jellyBFrangedelta) {
    var that = this;
    var exitindex_offset = this._exitindex;
    var inputindex_offset = this._inputcount;
    jellyBFrangedelta._data.forEach(function(rangeentry) {
        rangeentry._index += exitindex_offset;
        rangeentry._combination._terms.forEach(function(linearterm) {
            linearterm._parts.forEach(function(linearpart) {
                linearpart.addShift(exitindex_offset, inputindex_offset);
            });
        });
    });
    jellyBFrangedelta._outputs.forEach(function(linearcombination) {
        linearcombination._terms.forEach(function(linearterm) {
            linearterm._parts.forEach(function(linearpart) {
                linearpart.addShift(exitindex_offset, inputindex_offset);
            });
        });
    });
    var entries_to_add = [];
    jellyBFrangedelta._data.forEach(function(entry) {
        entry._combination.expandState(that);
        entries_to_add.push(entry);
    });
    jellyBFrangedelta._outputs.forEach(function(linearcombination) {
        linearcombination.expandState(that);
        that._outputs.push(linearcombination);
    });
    entries_to_add.forEach(function(entry) {
        that.addEntry(entry);
    });
    for (var i = this._data.length - 1; i >= 0; --i) {
        if (this._data[i].isZero()) this._data.splice(i, 1);
    }
    this._exitindex += jellyBFrangedelta._exitindex;
    this._inputcount += jellyBFrangedelta._inputcount;
};

JellyBFRangeDelta.prototype.wrapWithLoop = function(options) {
    if (this._exitindex === 0) {
        var dataIndex = this._data.findIndex(JellyBFRangeEntry.FinderEqualIndex(0));
        if (dataIndex === -1) {
            return false;
        } else if (JellyBFLinear.IsExactSame(this._data[dataIndex]._combination, JellyBFRangeEntry.makeFromTerm(0, JellyBFLinearTerm.makeConstant(-1))._combination)) {
            var is_all_constant = true;
            this._data.forEach(function(jellybfentry) {
                jellybfentry._combination._terms.forEach(function(term) {
                    if (term._parts.length !== 0) is_all_constant = false;
                });
            });
            if (!is_all_constant) return false;
            this._data.forEach(function(jellybfentry) {
                var newTerm = new JellyBFLinearTerm(1);
                newTerm._parts.push(new JellyBFLinearStateRef(0));
                jellybfentry.multiplyTerm(newTerm);
            });
            return true;
        }
        return false;
    }
    return false;
};

JellyBFRangeDelta.prototype.writeCode = function(codeWriter) {};

var JellyBFPossibleStateEntry = function(index, value) {
    this._index = index;
    this._value = value;
};

JellyBFPossibleStateEntry.FinderLowIndex = function(index) {
    return function(arg) {
        return arg._index >= index;
    };
};

var JellyBFPossibleState = function(emptyIsZero) {
    if (emptyIsZero !== true && emptyIsZero !== false) debugger;
    this.emptyIsZero = emptyIsZero;
    this._data = [];
};

JellyBFPossibleState.prototype.getState = function(index) {
    var dataIndex = this._data.findIndex(JellyBFPossibleStateEntry.FinderLowIndex(index));
    if (dataIndex === -1) {
        if (this.emptyIsZero) {
            return 0;
        } else {
            return undefined;
        }
    }
    return this._data[dataIndex]._value;
};

JellyBFPossibleState.prototype.setState = function(index, value) {
    var dataIndex = this._data.findIndex(JellyBFPossibleStateEntry.FinderLowIndex(index));
    if (dataIndex === -1) {
        if (this.emptyIsZero && value !== 0 || !this.emptyIsZero && value !== undefined) {
            this._data.splice(dataIndex, 0, new JellyBFPossibleStateEntry(index, value));
        }
    } else {
        if (this.emptyIsZero && value === 0 || !this.emptyIsZero && value === undefined) {
            this._data.splice(dataIndex, 1);
        } else {
            this._data[dataIndex]._value = value;
        }
    }
};

var JellyBF_InsertAndAttemptCoalesceDeltas = function(codeChunks, newDelta) {
    if (codeChunks.length > 0 && codeChunks[codeChunks.length - 1] instanceof JellyBFRangeDelta) {
        codeChunks[codeChunks.length - 1].coalesceWith(newDelta);
    } else {
        codeChunks.push(newDelta);
    }
};

var JellyBF_CloseAndAttemptUnrollLoop = function(codeChunks, options) {
    if (codeChunks.length > 0 && codeChunks[codeChunks.length - 1] === "[") {
        if (options.infiniteloops) {
            codeChunks.push("]");
        } else {
            codeChunks.pop();
        }
    } else if (codeChunks.length > 1 && codeChunks[codeChunks.length - 1] instanceof JellyBFRangeDelta && codeChunks[codeChunks.length - 2] === "[") {
        var chunk = codeChunks.pop();
        if (chunk.wrapWithLoop(options)) {
            codeChunks.pop();
            JellyBF_InsertAndAttemptCoalesceDeltas(codeChunks, chunk);
        } else {
            codeChunks.push(chunk);
            codeChunks.push("]");
        }
    } else {
        codeChunks.push("]");
    }
};

JellyBFInterpreter = function(codeString, get_input, put_output, breakpointuint8array, globalpauseuint8array, memoryuint8array) {
    this.code = codeString;
    this.get_input = get_input;
    this.put_output = put_output;
    this.breakpointuint8array = breakpointuint8array;
    this.globalpauseuint8array = globalpauseuint8array;
    this.memory_cells = 3e4;
    this.memory = memoryuint8array || new Uint8Array(this.memory_cells);
    this.memory_ptr = 0;
    this.next_instruction_index = [];
    this.loop_pair = [];
    var loop_stack = [];
    var last_instruction_index = Number.MIN_SAFE_INTEGER;
    this.entry_point = Number.MIN_SAFE_INTEGER;
    for (var i = 0; i < this.code.length; ++i) {
        if (this.code[i] === "[") {
            loop_stack.push(i);
        } else if (this.code[i] === "]") {
            if (loop_stack.length === 0) throw JellyBFInterpreter.CompileError.LOOPS_IMBALANCED;
            var openingindex = loop_stack.pop();
            this.loop_pair[openingindex] = i;
            this.loop_pair[i] = openingindex;
        }
        if ("<>+-[],.".indexOf(this.code[i]) !== -1) {
            if (last_instruction_index !== Number.MIN_SAFE_INTEGER) this.next_instruction_index[last_instruction_index] = i; else this.entry_point = i;
            last_instruction_index = i;
        }
    }
    if (loop_stack.length !== 0) throw JellyBFInterpreter.CompileError.LOOPS_IMBALANCED;
    this.next_instruction_index[last_instruction_index] = Number.MAX_SAFE_INTEGER;
    var pseudo_entry_index = this.code.length;
    this.code += "`";
    this.next_instruction_index[pseudo_entry_index] = this.entry_point;
    this.instruction_ptr = pseudo_entry_index;
};

JellyBFInterpreter.CompileError = {
    LOOPS_IMBALANCED: 1
};

JellyBFInterpreter.RuntimeError = {
    INVALID_MEMORY_ACCESS: 1,
    INTEGER_OVERFLOW: 2
};

JellyBFInterpreter.RunResult = {
    PROGRAM_TERMINATED: 1,
    PAUSED_AT_BREAKPOINT: 2,
    PAUSED_WITHOUT_BREAKPOINT: 3
};

JellyBFInterpreter.prototype.run = function() {
    while (this.instruction_ptr !== Number.MAX_SAFE_INTEGER) {
        if (this.code[this.instruction_ptr] === "<") {
            if (this.memory_ptr === 0) throw JellyBFInterpreter.RuntimeError.INVALID_MEMORY_ACCESS;
            --this.memory_ptr;
        } else if (this.code[this.instruction_ptr] === ">") {
            if (this.memory_ptr + 1 === this.memory_cells) throw JellyBFInterpreter.RuntimeError.INVALID_MEMORY_ACCESS;
            ++this.memory_ptr;
        } else if (this.code[this.instruction_ptr] === "+") {
            Atomics.add(this.memory, this.memory_ptr, 1);
        } else if (this.code[this.instruction_ptr] === "-") {
            Atomics.sub(this.memory, this.memory_ptr, 1);
        } else if (this.code[this.instruction_ptr] === "[") {
            if (Atomics.load(this.memory, this.memory_ptr) === 0) {
                this.instruction_ptr = this.loop_pair[this.instruction_ptr];
            }
        } else if (this.code[this.instruction_ptr] === "]") {
            if (Atomics.load(this.memory, this.memory_ptr) !== 0) {
                this.instruction_ptr = this.loop_pair[this.instruction_ptr];
            }
        } else if (this.code[this.instruction_ptr] === ",") {
            Atomics.store(this.memory, this.memory_ptr, this.get_input());
        } else if (this.code[this.instruction_ptr] === ".") {
            this.put_output(Atomics.load(this.memory, this.memory_ptr));
        } else if (this.code[this.instruction_ptr] === "`") {} else {
            throw "Internal error!";
        }
        this.instruction_ptr = this.next_instruction_index[this.instruction_ptr];
        if (this.instruction_ptr !== Number.MAX_SAFE_INTEGER && Atomics.load(this.breakpointuint8array, this.instruction_ptr) !== 0) return {
            type: JellyBFInterpreter.RunResult.PAUSED_AT_BREAKPOINT,
            index: this.instruction_ptr,
            memory_ptr: this.memory_ptr
        };
        if (this.instruction_ptr !== Number.MAX_SAFE_INTEGER && Atomics.load(this.globalpauseuint8array, 0) !== 0) return {
            type: JellyBFInterpreter.RunResult.PAUSED_WITHOUT_BREAKPOINT,
            index: this.instruction_ptr,
            memory_ptr: this.memory_ptr
        };
    }
    return {
        type: JellyBFInterpreter.RunResult.PROGRAM_TERMINATED
    };
};

var JellyBFSync = {
    compile: function(str, options) {
        return new WebAssembly.Module(JellyBFCompiler.compile(str, options));
    },
    execute: function(module, inputuint8array, options) {
        options.eof_value = options.eof_value || 0;
        var inputindex = 0;
        var outputdata = new ResizableUint8Array();
        var get_input = function() {
            if (inputindex < inputuint8array.length) {
                return inputuint8array[inputindex++];
            } else {
                return options.eof_value;
            }
        };
        var put_output = function(byte) {
            outputdata.push(byte);
        };
        var instance = new WebAssembly.Instance(module, {
            interaction: {
                input: get_input,
                output: put_output
            }
        });
        instance.exports.main();
        return outputdata.toUint8Array();
    },
    executeInteractive: function(module, inputuint8array, outputuint8array, inputwaitint32array, outputwaitint32array, options, updatedOutputCallback, requestInputCallback) {
        var WaitArrayId = {
            READ_HEAD: 0,
            WRITE_HEAD: 1,
            TERMINATED_FLAG: 2
        };
        options.bufferlength = options.bufferlength || 1024;
        options.eof_value = options.eof_value || 0;
        var input_read_head = 0, input_write_head = 0, input_terminated = false;
        var get_input = function() {
            if (input_read_head === input_write_head) {
                requestInputCallback(input_read_head);
                console.log(Atomics.wait(inputwaitint32array, WaitArrayId.WRITE_HEAD, input_write_head));
                input_write_head = Atomics.load(inputwaitint32array, WaitArrayId.WRITE_HEAD);
                if (!input_terminated) {
                    input_terminated = Atomics.load(inputwaitint32array, WaitArrayId.TERMINATED_FLAG) !== 0;
                }
            }
            if (!input_terminated || input_read_head + 1 < input_write_head) {
                var val = Atomics.load(inputuint8array, input_read_head++ % options.bufferlength);
                Atomics.store(inputwaitint32array, WaitArrayId.READ_HEAD, input_read_head);
                return val;
            } else {
                return options.eof_value;
            }
        };
        var output_read_head = 0, output_write_head = 0, output_terminated = false;
        var put_output = function(byte) {
            if (output_read_head + options.bufferlength === output_write_head) {
                Atomics.wait(outputwaitint32array, WaitArrayId.READ_HEAD, output_read_head);
                output_read_head = Atomics.load(outputwaitint32array, WaitArrayId.READ_HEAD);
            }
            Atomics.store(outputuint8array, output_write_head++ % options.bufferlength, byte);
            Atomics.store(outputwaitint32array, WaitArrayId.WRITE_HEAD, output_write_head);
            updatedOutputCallback();
        };
        var terminate_output = function() {
            if (output_read_head + options.bufferlength === output_write_head) {
                Atomics.wait(outputwaitint32array, WaitArrayId.READ_HEAD, output_read_head);
                output_read_head = Atomics.load(outputwaitint32array, WaitArrayId.READ_HEAD);
            }
            Atomics.store(outputwaitint32array, WaitArrayId.TERMINATED_FLAG, 1);
            Atomics.store(outputwaitint32array, WaitArrayId.WRITE_HEAD, output_write_head + 1);
            updatedOutputCallback();
        };
        var instance = new WebAssembly.Instance(module, {
            interaction: {
                input: get_input,
                output: put_output
            }
        });
        instance.exports.main();
        terminate_output();
        return true;
    },
    interpretInteractive: function(str, inputuint8array, outputuint8array, inputwaitint32array, outputwaitint32array, breakpointuint8array, globalpauseuint8array, memoryuint8array, options, updatedOutputCallback, requestInputCallback) {
        var WaitArrayId = {
            READ_HEAD: 0,
            WRITE_HEAD: 1,
            TERMINATED_FLAG: 2
        };
        options.bufferlength = options.bufferlength || 1024;
        options.eof_value = options.eof_value || 0;
        var input_read_head = 0, input_write_head = 0, input_terminated = false;
        var get_input = function() {
            if (input_read_head === input_write_head) {
                requestInputCallback(input_read_head);
                console.log(Atomics.wait(inputwaitint32array, WaitArrayId.WRITE_HEAD, input_write_head));
                input_write_head = Atomics.load(inputwaitint32array, WaitArrayId.WRITE_HEAD);
                if (!input_terminated) {
                    input_terminated = Atomics.load(inputwaitint32array, WaitArrayId.TERMINATED_FLAG) !== 0;
                }
            }
            if (!input_terminated || input_read_head + 1 < input_write_head) {
                var val = Atomics.load(inputuint8array, input_read_head++ % options.bufferlength);
                Atomics.store(inputwaitint32array, WaitArrayId.READ_HEAD, input_read_head);
                return val;
            } else {
                return options.eof_value;
            }
        };
        var output_read_head = 0, output_write_head = 0, output_terminated = false;
        var put_output = function(byte) {
            if (output_read_head + options.bufferlength === output_write_head) {
                Atomics.wait(outputwaitint32array, WaitArrayId.READ_HEAD, output_read_head);
                output_read_head = Atomics.load(outputwaitint32array, WaitArrayId.READ_HEAD);
            }
            Atomics.store(outputuint8array, output_write_head++ % options.bufferlength, byte);
            Atomics.store(outputwaitint32array, WaitArrayId.WRITE_HEAD, output_write_head);
            updatedOutputCallback();
        };
        var terminate_output = function() {
            if (output_read_head + options.bufferlength === output_write_head) {
                Atomics.wait(outputwaitint32array, WaitArrayId.READ_HEAD, output_read_head);
                output_read_head = Atomics.load(outputwaitint32array, WaitArrayId.READ_HEAD);
            }
            Atomics.store(outputwaitint32array, WaitArrayId.TERMINATED_FLAG, 1);
            Atomics.store(outputwaitint32array, WaitArrayId.WRITE_HEAD, output_write_head + 1);
            updatedOutputCallback();
        };
        var instance = new JellyBFInterpreter(str, get_input, put_output, breakpointuint8array, globalpauseuint8array, memoryuint8array);
        return {
            run: function() {
                var res = instance.run();
                if (res === JellyBFInterpreter.RunResult.PROGRAM_TERMINATED) terminate_output();
                return res;
            }
        };
    }
};

(function() {
    var module = undefined;
    var interpretstate = undefined;
    self.addEventListener("message", function(e) {
        var message = e.data;
        switch (message.type) {
          case "compile":
            var sourcecode = message.sourcecode;
            var options = message.options;
            try {
                module = JellyBFSync.compile(sourcecode, options);
                self.postMessage({
                    type: "compiled"
                });
            } catch (e) {
                console.log(e);
                self.postMessage({
                    type: "compileerror"
                });
            }
            break;

          case "execute-interactive":
            var inputbuffer = message.inputbuffer;
            var outputbuffer = message.outputbuffer;
            var inputwaitbuffer = message.inputwaitbuffer;
            var outputwaitbuffer = message.outputwaitbuffer;
            var options = message.options;
            try {
                JellyBFSync.executeInteractive(module, new Uint8Array(inputbuffer), new Uint8Array(outputbuffer), new Int32Array(inputwaitbuffer), new Int32Array(outputwaitbuffer), options, function() {
                    self.postMessage({
                        type: "output-updated"
                    });
                }, function(readhead) {
                    self.postMessage({
                        type: "input-requested",
                        readhead: readhead
                    });
                });
                self.postMessage({
                    type: "executed"
                });
            } catch (e) {
                console.log(e);
                self.postMessage({
                    type: "executeerror"
                });
            }
            break;

          case "execute":
            var inputuint8array = message.inputuint8array;
            var options = message.options;
            try {
                var outputuint8array = JellyBFSync.execute(module, inputuint8array, options);
                self.postMessage({
                    type: "executed",
                    outputuint8array: outputuint8array
                }, [ outputuint8array.buffer ]);
            } catch (e) {
                console.log(e);
                self.postMessage({
                    type: "executeerror"
                });
            }
            break;

          case "interpret-interactive":
            var sourcecode = message.sourcecode;
            var inputbuffer = message.inputbuffer;
            var outputbuffer = message.outputbuffer;
            var inputwaitbuffer = message.inputwaitbuffer;
            var outputwaitbuffer = message.outputwaitbuffer;
            var options = message.options;
            var breakpointbuffer = message.breakpointbuffer;
            var globalpausebuffer = message.globalpausebuffer;
            var memorybuffer = message.memorybuffer;
            try {
                interpretstate = JellyBFSync.interpretInteractive(sourcecode, new Uint8Array(inputbuffer), new Uint8Array(outputbuffer), new Int32Array(inputwaitbuffer), new Int32Array(outputwaitbuffer), new Uint8Array(breakpointbuffer), new Uint8Array(globalpausebuffer), memorybuffer ? new Uint8Array(memorybuffer) : undefined, options, function() {
                    self.postMessage({
                        type: "output-updated"
                    });
                }, function(readhead) {
                    self.postMessage({
                        type: "input-requested",
                        readhead: readhead
                    });
                });
                self.postMessage({
                    type: "parsecomplete"
                });
            } catch (e) {
                console.log(e);
                self.postMessage({
                    type: "parseerror",
                    kind: e
                });
            }
            break;

          case "interpret-continue":
            var ret;
            try {
                ret = interpretstate.run();
            } catch (e) {
                console.log(e);
                self.postMessage({
                    type: "runtimeerror",
                    kind: e
                });
                break;
            }
            if (ret.type === JellyBFInterpreter.RunResult.PROGRAM_TERMINATED) {
                self.postMessage({
                    type: "interpreted"
                });
                interpretstate = undefined;
            } else if (ret.type === JellyBFInterpreter.RunResult.PAUSED_AT_BREAKPOINT) {
                self.postMessage({
                    type: "interpret-breakpoint",
                    index: ret.index,
                    memory_ptr: ret.memory_ptr
                });
            } else if (ret.type === JellyBFInterpreter.RunResult.PAUSED_WITHOUT_BREAKPOINT) {
                self.postMessage({
                    type: "interpret-paused",
                    index: ret.index,
                    memory_ptr: ret.memory_ptr
                });
            } else {
                self.postMessage({
                    type: "interpreterror"
                });
            }
            break;
        }
    });
    self.postMessage({
        type: "ready"
    });
})();