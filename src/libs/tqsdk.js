function _sum(serial, n, p) {
    var s = 0;
    for (var i = p - n + 1; i <= p; i++) {
        s += serial[i];
    }
    return s;
}

function SUM(i, serial, n, cache) {
    if (cache === undefined || cache.length == 0 || isNaN(cache[i - 1]))
        return _sum(serial, n, i);
    return cache[i - 1] - serial[i - n] + serial[i];
}

function COUNT(i, serial, n, cache) {
    if (cache === undefined || cache.length == 0 || isNaN(cache[i - 1]))
        return _sum(serial, n, i);
    return cache[i - 1] - serial[i - n] + serial[i];
}

function REF(i, serial, n) {
    return serial[i-n];
}

function MA(i, serial, n, cache) {
    if (cache.length == 0 || isNaN(cache[i - 1]))
        return _sum(serial, n, i) / n;
    return cache[i - 1] - serial[i - n] / n + serial[i] / n;
}

function EMA(i, serial, n, cache) {
    if (cache.length == 0)
        return serial[i];
    return isNaN(cache[i - 1]) ? serial[i] : (2 * serial[i] / (n + 1) + (n - 1) * cache[i - 1] / (n + 1));
}

function DMA(i, serial, a, cache) {
    if (cache.length == 0)
        return serial[i];
    return isNaN(cache[i - 1]) ? serial[i] : (cache[i - 1] * (1-a) + serial[i] * a);
}

function SMA(i, serial, n, m, cache) {
    if (cache.length == 0)
        return serial[i];
    return isNaN(cache[i - 1]) ? serial[i] : (cache[i - 1] * (n - m) / n + serial[i] * m / n);
}

function HIGHEST(p, serial, n) {
    var s;
    for (var i = p - n + 1; i <= p; i++) {
        var v = serial[i];
        if (s === undefined || v > s)
            s = v;
    }
    return s;
}

function LOWEST(p, serial, n) {
    var s;
    for (var i = p - n + 1; i <= p; i++) {
        var v = serial[i];
        if (s === undefined || v < s)
            s = v;
    }
    return s;
}

function STDEV(i, serial, n, cache) {
    let s = cache.s ? cache.s : [];
    let x2 = 0;
    let x = 0;
    if (s.length == 0 || !(i - 1 in s)) {
        for (let k = i - n + 1; k <= i; k++) {
            let d = serial[k];
            x2 += d * d;
            x += d;
        }
    } else {
        x = s[i - 1] - serial[i - n] + serial[i];
        x2 = s[i - 1] - serial[i - n] * serial[i - n] + serial[i] * serial[i];
    }
    let std = Math.sqrt((x2 - x * x / n) / n);
    if (!isNaN(std)) {
        s[i] = [x, x2];
    }
    return std;
}

function IFELSE(c, a, b) {
    return c?a:b;
}

function ABS(v){
    return Math.abs(v);
}

function MAX(v1, v2) {
    return Math.max(v1, v2);
}

function MIN(v1, v2) {
    return Math.min(v1, v2);
}


//utils----------------------------------------------------------------------

/**
 * 返回指定变量的数据类型
 * @param  {Any} data
 * @return {String} Array Object Generator Function String Number Null Undefined Boolean
 */
function type (data){
    return Object.prototype.toString.call(data).slice(8, -1);
}

/**
 * 生成指定长度的随机字符串
 * 默认长度为 8
 */
function RandomStr (len = 8) {
    var charts = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var s = '';
    for (var i = 0; i < len; i++) s += charts[Math.random() * 0x3e | 0];
    return s;
}

/**
 * 生成序列生成器
 * 默认从 0 开始
 */
function* GenerateSequence(start = 0) {
    while (true) {
        yield start.toString(36);
        start++;
    }
}

/**
 * 解析字符串，读取交易所和交易代码
 */
function ParseSymbol(str) {
    var match_arr = str.match(/([^\.]+)\.(.*)/);
    return {
        exchange_id: match_arr ? match_arr[1] : '',// 交易所代码
        instrument_id: match_arr ? match_arr[2] : ''// 合约代码
    }
}

//dm----------------------------------------------------------------------
class DataManager{
    constructor(){
        this.account_id = "";
        this.datas = {};
        this.epoch = 0;
    }

    mergeObject(target, source, deleteNullObj) {
        for (let key in source) {
            let value = source[key];
            switch (typeof value) {
                case 'object':
                    if (value === null) {
                        // 服务器 要求 删除对象
                        if (deleteNullObj) {
                            delete target[key];
                        } else {
                            target[key] = null;
                        }
                    } else if (Array.isArray(value)) {
                        target[key] = target[key] ? target[key] : [];
                        this.mergeObject(target[key], value, deleteNullObj);
                    } else if (key == "data"){
                        //@note: 这里做了一个特例, 使得K线序列数据被保存为一个array, 而非object, 并且记录整个array首个有效记录的id
                        if (!(key in target))
                            target.data = [];
                        if (!target.left_id || Object.keys(value)[0] < target.left_id)
                            target.left_id = Number(Object.keys(value)[0]);
                        this.mergeObject(target[key], value, deleteNullObj);
                    } else {
                        target[key] = target[key] ? target[key] : {};
                        this.mergeObject(target[key], value, deleteNullObj);
                    }
                    break;
                case 'string':
                    if (value === 'NaN') {
                        target[key] = NaN;
                    } else {
                        target[key] = value;
                    }
                    break;
                case 'boolean':
                case 'number':
                    target[key] = value;
                    break;
                case 'undefined':
                    break;
            }
        }
        target["_epoch"] = this.epoch;
    }

    is_changing(obj){
        if (!obj)
            return false;
        return obj["_epoch"] == this.epoch;
    }

    get_tdata_obj(insId, instanceId) {
        var path = insId + '.0';
        G_INSTANCES[instanceId].addRelationship(path);
        try {
            return this.datas.ticks[insId].data;
        } catch (e) {
            return undefined;
        }
    }

    clear_data() {
        this.datas = {};
    }

    get_combine(ins_id) {
        return this.get('combines/USER.' + ins_id, from);
    };

    /**
     * 收到aid=="rtn_data"的数据包时, 由本函数处理
     * @param message_rtn_data
     */
    on_rtn_data(message_rtn_data) {
        //收到行情数据包，更新到数据存储区
        this.epoch += 1;
        for (let i = 0; i < message_rtn_data.data.length; i++) {
            let d = message_rtn_data.data[i];
            if (!this.account_id && d.trade){
                this.account_id = Object.keys(d.trade)[0];
            }
            this.mergeObject(this.datas, d, true);
        }
    }

    set_default(default_value, ...path){
        let node = this.datas;
        for (let i = 0; i < path.length; i++) {
            if (! (path[i] in node))
                if (i+1 == path.length)
                    node[path[i]] = default_value;
                else
                    node[path[i]] = {}
            node = node[path[i]];
        }
        return node;
    }

    get(...path){
        let node = this.datas;
        for (let i = 0; i < path.length; i++) {
            if (! (path[i] in node))
                return undefined;
            node = node[path[i]];
        }
        return node;
    }

    make_array_proxy(data_array, item_func=undefined){
        var handler = {
            get: function (target, property, receiver) {
                if (!isNaN(property)) {
                    let i = Number(property);
                    if (i < 0)
                        i = target.length + i;
                    if (item_func)
                        return item_func(data_array[i]);
                    else
                        return data_array[i];
                } else{
                    return target[property];
                }
            }
        };
        let p = new Proxy(data_array, handler);
        return p;
    }
    /**
     * 获取 k线序列
     */
    get_kline_serial(symbol, dur_nano) {
        let ks = this.set_default({last_id: -1, data:[]}, "klines", symbol, dur_nano);
        if (! ks.d){
            ks.d = this.make_array_proxy(ks.data);
            ks.d.open = this.make_array_proxy(ks.data, k => k.open);
            ks.d.high = this.make_array_proxy(ks.data, k => k.high);
            ks.d.low = this.make_array_proxy(ks.data, k => k.low);
            ks.d.close = this.make_array_proxy(ks.data, k => k.close);
        }
        return ks;
    }
}

//tm----------------------------------------------------------------------
class Task {
    constructor(task_id, func, waitConditions = null) {
        this.id = task_id;
        this.func = func;
        this.paused = false;
        this.waitConditions = waitConditions;
        // this.timeout = 6000000; // 每个任务默认时间
        // this.endTime = 0;
        this.stopped = false;
        this.events = {}
        this.unit_id = null;
        this.unit_mode = true;
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }

    stop() {
        this.stopped = true;
    }
}

class TaskManager{
    constructor(){
        this.aliveTasks = {};
        this.intervalTime = 50; // 任务执行循环间隔
        this.runningTask = null;
        this.events = {};
        this.GenTaskId = GenerateSequence();
        // setInterval(this.ontimer, this.intervalTime);
    }

    getEndTime(t) {
        return (new Date()).getTime() + t;
    }

    checkTask(task) {
        var status = {};
        task.timeout = undefined;
        for (var cond in task.waitConditions) {
            if (cond.toUpperCase() === 'TIMEOUT') {
                task.timeout = task.waitConditions[cond];
                if ((new Date()).getTime() >= task.endTime) status['TIMEOUT'] = true;
                else status['TIMEOUT'] = false;
                continue;
            }

            try {
                status[cond] = task.waitConditions[cond]();
            } catch (err) {
                console.log(err)
                status[cond] = false;
            }
        }
        return status;
    }

    runTask(task) {
        TaskManager.runningTask = task;
        var waitResult = checkTask(task);
        /**
         * ret: { value, done }
         */
        for (var r in waitResult) {
            if (waitResult[r] === true) {
                // waitConditions 中某个条件为真才执行 next
                var ret = task.func.next(waitResult);
                if (ret.done) {
                    task.stopped = true;
                    task.return = ret.value;
                    TaskManager.any_task_stopped = true;
                } else {
                    if (task.timeout) task.endTime = getEndTime(task.timeout);
                    task.waitConditions = ret.value;
                }
                break;
            }
        }
    }

    run(obj) {
        if (obj) {
            if (!(obj.type in TaskManager.events)) TaskManager.events[obj.type] = {};
            if (!(obj.id in TaskManager.events[obj.type])) TaskManager.events[obj.type][obj.id] = obj.data;
        }
        TaskManager.any_task_stopped = false; // 任何一个task 的状态改变，都重新 run
        for (var taskId in aliveTasks) {
            if (aliveTasks[taskId].paused || aliveTasks[taskId].stopped) continue;
            try {
                runTask(aliveTasks[taskId]);
            } catch (err) {
                if (err == 'not logined') Notify.error('未登录，请在软件中登录后重试。');
                else console.log(err)
            }
        }
        if (obj) {
            delete TaskManager.events[obj.type][obj.id];
        }
        if (TaskManager.any_task_stopped) TaskManager.run();
    }

    ontimer() {
        for (var taskId in aliveTasks) {
            var task = aliveTasks[taskId];
            // 用户显示定义了 timeout 才记录 timeout 字段
            if (task.timeout) {
                if (task.paused) {
                    task.endTime += intervalTime;
                } else {
                    var now = (new Date()).getTime();
                    if (task.endTime <= now) runTask(task);
                }
            }
        }
    }

    add(func) {
        var task_id = GenTaskId.next().value;
        var task = new Task(task_id, func);
        aliveTasks[task_id] = task;
        TaskManager.runningTask = task;
        var ret = task.func.next();
        if (ret.done) {
            task.stopped = true;
            task.return = ret.value;
        } else {
            for (var cond in ret.value) {
                if (cond.toUpperCase() === 'TIMEOUT') {
                    task.timeout = ret.value[cond];
                    task.endTime = getEndTime(task.timeout);
                    break;
                }
            }
            task.waitConditions = ret.value;
        }
        return task;
    }

    remove(task) {
        delete aliveTasks[task.id];
    }

    start_task(func){
        if (typeof func === 'function') {

            var args = [];
            if (arguments.length > 1) {
                var len = 1;
                while (len < arguments.length)
                    args.push(arguments[len++]);
            }
            var f = func.apply(null, args);
            if (f.next && (typeof f.next === 'function')) {
                return TaskManager.add(f);
            } else {
                console.log('task 参数类型错误');
            }
        } else {
            console.log('task 参数类型错误');
        }
    }

    stop_task(task){
        if (task)
            task.stop();
        return null;
    }

    pause_task(task){
        task.pause();
    }

    resume_task(task){
        task.resume();
    }
}

//ta----------------------------------------------------------------------
const COLOR = function (r, g, b) {
    this.color = r | (g << 8) | (b << 16);
};

COLOR.prototype.toJSON = function () {
    return this.color;
};

const RGB = function (r, g, b) {
    return new COLOR(r, g, b);
};

const RED = RGB(0xFF, 0, 0);
const GREEN = RGB(0, 0xFF, 0);
const BLUE = RGB(0, 0, 0xFF);
const CYAN = RGB(0, 0xFF, 0xFF);
const BLACK = RGB(0, 0, 0);
const WHITE = RGB(0xFF, 0xFF, 0xFF);
const GRAY = RGB(0x80, 0x80, 0x80);
const MAGENTA = RGB(0xFF, 0, 0xFF);
const YELLOW = RGB(0xFF, 0xFF, 0);
const LIGHTGRAY = RGB(0xD3, 0xD3, 0xD3);
const LIGHTRED = RGB(0xF0, 0x80, 0x80);
const LIGHTGREEN = RGB(0x90, 0xEE, 0x90);
const LIGHTBLUE = RGB(0x8C, 0xCE, 0xFA);

const ICON_BUY = 1;
const ICON_SELL = 2;



class Indicator
{
    constructor(instance_id, symbol, dur_nano, ds, params){
        //技术指标参数, 合约代码/周期也作为参数项放在这里面
        this.instance_id = instance_id;
        this.symbol = symbol;
        this.dur_nano = dur_nano;
        this._ds = ds;   //基础序列, 用作输出序列的X轴
        this.DS = ds.d;  //提供给用户代码使用的ds proxy
        this.params = params; //指标参数
        this.outs = {}; //输出序列访问函数
        this.out_define = {}; //输出序列格式声明
        this.out_values = {}; //输出序列值
        this.valid_left = -1; //已经计算过的可靠结果范围(含左右两端点), valid_right永远>=valid_left. 如果整个序列没有计算过任何数据, 则 valid_left=valid_right= -1
        this.valid_right = -1;

        this.epoch = 0;
        this.view_left = -1;
        this.view_right = -1;
        this.long_position_volume = 0;
        this.short_position_volume = 0;
        this.is_error = false;
    }

    /**
     * 要求指标实例计算X范围从left到right(包含两端点)的结果值
     * @param left:
     * @param right
     * @return [update_left, update_right]: 本次计算中更新的数据范围, update_right总是>=update_left. 如果本次计算没有任何结果被更新, 返回 [-1, -1]
     */
    calc_range(left=this.view_left, right=this.view_right){
        //无法计算的情形
        if (this.is_error || !this._ds || this._ds.last_id == -1 || left > this._ds.last_id){
            return [-1, -1];
        }
        if(right > this._ds.last_id)
            right = this._ds.last_id;
        //判定是否需要计算及计算范围
        let calc_left = -1;
        let calc_right = -1;
        if (left < this.valid_left || this.valid_left == -1){
            //左端点前移
            calc_left = left;
            calc_right = right;
            if (this._ds.left_id){
                //@todo
            }
            this.valid_left = calc_left;
            this.valid_right = calc_right;
        } else if (right > this.valid_right || left > this.valid_right){
            //向右延伸
            calc_left = this.valid_right + 1;
            calc_right = right;
            this.valid_right = calc_right;
        }
        //重算
        if (calc_right >= calc_left && calc_right != -1){
            for (let i=calc_left; i <= calc_right; i++) {
                this.calc(i);
            }
        }
        return [calc_left, calc_right];
    };

    OUTS(style, name, options){
        options.style=style;
        this.out_define[name] = options;
        var out_serial = [];
        this.out_values[name] = out_serial;
        let self = this;
        this.outs[name] = function (left, right = null) {
            //每个序列的输出函数允许一次性提取一段数据(含left, right两点)
            //如果提供了left/right 两个参数,则返回一个 array
            //如果只提供left, 则返回一个value
            //无法输出结果的情形
            if (self.is_error || !self._ds || self._ds.last_id == -1){
                if (right == null)
                    return null;
                else
                    return [];
            }
            //负数支持, 如果left/right为负数, 需要先转换到正数, 这一转换又必须事先有一个合约/周期来标定X轴
            if (left < 0)
                left = self._ds.last_id + left + 1;
            if (right < 0)
                right = self._ds.last_id + right + 1;
            //尝试更新计算数据
            let [calc_left, calc_right] = self.calc_range(left, right?right:left);
            //输出数据结果
            if (right == null)
                return out_serial[left];
            else
                return out_serial.slice(left, right);
        };
        return out_serial;
    }
}

class TaManager
{
    constructor(){
        this.class_dict = {};
        this.instance_dict = {};
        this.calc_notify_func = null;
    }
    calculate(instance){
        let runId = Keys.next().value;
        start_msg = {
            cmd: 'calc_start',
            content: {
                id: runId,
                className: instance.ta_class_name,
            },
        };
        if (this.calc_notify_func)
            this.calc_notify_func(start_msg);
        try {
            instance.exec();
            end_msg = {
                cmd: 'calc_end',
                content: {
                    id: runId,
                    className: instance.ta_class_name,
                },
            };
        } catch (e) {
            console.error(e);
            end_msg = {
                cmd: 'feedback',
                content: {
                    error: true,
                    type: 'run',
                    message: e.message,
                    func_name: instance.ta_class_name,
                },
            };
        };
        if (this.calc_notify_func)
            this.calc_notify_func(end_msg);
    }

    register_indicator_class(ind_class){
        this.class_dict[ind_class.name] = ind_class;
    };

    unregister_indicator_class(ind_class) {
        //todo:
    };

    new_indicator_instance(ind_class, symbol, dur_nano, ds, params, instance_id) {
        let ind_instance = new ind_class(instance_id, symbol, dur_nano, ds, params);
        this.instance_dict[instance_id] = ind_instance;
        ind_instance.init();
        return ind_instance;
    };

    delete_indicator_instance(ind_instance, params) {
        delete this.instance_dict[ind_instance.id];
    };

}

//ws----------------------------------------------------------------------
class TqWebsocket{
    constructor(url, callbacks){
        this.url = url;
        this.ws = null;
        this.queue = [];

        // 自动重连开关
        this.reconnect = true;
        this.reconnectTask = null;
        this.reconnectInterval = 3000;
        this.callbacks = callbacks;

        this.STATUS = {
            CONNECTING: 0,
            OPEN: 1,
            CLOSING: 2,
            CLOSED: 3,
        };
    }

    send_json(obj) {
        function jsonToStr(obj) {
            return JSON.stringify(obj);
        }
        if (this.ws.readyState === 1) {
            this.ws.send(jsonToStr(obj));
        } else {
            this.queue.push(jsonToStr(obj));
        }
    };

    isReady() {
        return this.ws.readyState === 1;
    };

    init() {
        function strToJson(message) {
            return eval('(' + message + ')');
        }

        this.ws = new WebSocket(this.url);
        var _this = this;
        this.ws.onmessage = function (message) {
            _this.callbacks.onmessage(strToJson(message.data));
        };

        this.ws.onclose = function (event) {
            // 清空 datamanager
            _this.callbacks.onclose();

            // 清空 queue
            _this.queue = [];

            // 自动重连
            if (_this.reconnect) {
                _this.reconnectTask = setInterval(function () {
                    if (_this.ws.readyState === 3) _this.init();
                }, _this.reconnectInterval);
            }
        };

        this.ws.onerror = function (error) {
            _this.ws.close();
        };

        this.ws.onopen = function () {
            // 请求全部数据同步
            _this.callbacks.onopen();
            if (this.reconnectTask) {
                clearInterval(_this.reconnectTask);
                _this.callbacks.onreconnect();
            }

            if (_this.queue.length > 0) {
                while (_this.queue.length > 0) {
                    if (_this.ws.readyState === 1) _this.ws.send(_this.queue.shift());
                    else break;
                }
            }
        };
    };
}

//sdk----------------------------------------------------------------------

GLOBAL_CONTEXT = {
    current_symbol: "SHFE.cu1801",
    current_dur: "5000000000",
};

class TQSDK {
    constructor(mock_ws) {
        if(mock_ws){
            this.ws = mock_ws;
        } else {
            this.ws = new TqWebsocket('ws://127.0.0.1:7777/', this);
        }
        this.dm = new DataManager();
        this.tm = new TaskManager();
        this.ta = new TaManager();

        this.GET_COMBINE = this.dm.get_combine;

        this.START_TASK = this.tm.start_task;
        this.PAUSE_TASK = this.tm.pause_task;
        this.RESUME_TASK = this.tm.resume_task;
        this.STOP_TASK = this.tm.stop_task;

        this.ws.init();
    }

    onmessage(message) {
        switch(message.aid){
            case "rtn_data":
                this.on_rtn_data(message);
            case "update_indicator_instance":
                this.on_update_indicator_instance(message);
            default:
                return;
        }
    }
    onopen() {
        this.dm.clear_data();
    }
    onreconnect() {
        this.dm.clear_data();
    }
    onclose() {
    }
    /**
     * 收到aid=="rtn_data"的数据包时, 由本函数处理
     * @param message_rtn_data
     */
    on_rtn_data(message_rtn_data){
        //收到行情数据包，更新到数据存储区
        this.dm.on_rtn_data(message_rtn_data);
        // 重新计算所有技术指标 instance
        for (let id in this.ta.instance_dict) {
            let instance = this.ta.instance_dict[id];
            if (this.dm.is_changing(instance._ds)){
                let [calc_left, calc_right] = instance.calc_range();
                this.send_indicator_data(instance, calc_left, calc_right);
            }
        }

        // this.tm.run();
    }
    on_update_indicator_instance(pack){
        //重置指标参数
        let instance_id = pack.instance_id;
        let instance = null;
        let params = {};
        for (let name in pack.params){
            params[name] = pack.params[name].value;
        }
        let ds = this.dm.get_kline_serial(pack.ins_id, pack.dur_nano);
        let c = this.ta.class_dict[pack.ta_class_name];
        if (!c)
            return;

        if (instance_id in this.ta.instance_dict){
            let instance = this.ta.instance_dict[instance_id];
        }
        if (!this.ta.instance_dict[instance_id]) {
            instance = this.ta.new_indicator_instance(c, pack.ins_id, pack.dur_nano, ds, params, pack.instance_id);
        }else{
            instance = this.ta.instance_dict[pack.instance_id];
            if (ds != instance.ds || params != instance.params){
                this.ta.delete_indicator_instance(instance);
                instance = this.ta.new_indicator_instance(c, pack.ins_id, pack.dur_nano, ds, params, pack.instance_id);
            }
        }
        instance.epoch = pack.epoch;
        instance.view_left = pack.view_left;
        instance.view_right = pack.view_right;
        let [calc_left, calc_right] = instance.calc_range(pack.view_left, pack.view_right);
        this.send_indicator_data(instance, calc_left, calc_right);
    }
    send_indicator_data(instance, calc_left, calc_right){
        //计算指标值
        let datas = {};
        if(calc_left > -1){
            for (let sn in instance.out_values){
                let s = instance.out_values[sn];
                datas[sn] = [s.slice(calc_left, calc_right + 1)];
            }
        }
        let set_data = {
            "aid": "set_indicator_data",                    //必填, 标示此数据包为技术指标结果数据
            "instance_id": instance.instance_id,                     //必填, 指标实例ID，应当与 update_indicator_instance 中的值一致
            "epoch": instance.epoch,                                  //必填, 指标实例版本号，应当与 update_indicator_instance 中的值一致
            "range_left": calc_left,                             //必填, 表示此数据包中第一个数据对应图表X轴上的位置序号
            "range_right": calc_right,                            //必填, 表示此数据包中最后一个数据对应图表X轴上的位置序号
            "serials": instance.out_define,
            "datas": datas,
        };
        this.ws.send_json(set_data);
    }

    GET_ACCOUNT() {
        return this.dm.get('trade', this.dm.account_id, 'accounts', 'CNY');
    };

    GET_POSITION(symbol) {
        return this.dm.get('trade', this.dm.account_id, 'positions', symbol);
    };

    GET_POSITION_DICT(symbol) {
        return this.dm.get('trade', this.dm.account_id, 'positions');
    }

    GET_QUOTE(symbol){
        // 订阅行情
        var ins_list = this.dm.datas.ins_list;
        if (ins_list && !ins_list.includes(symbol)) {
            var s = ins_list + "," + symbol;
            this.ws.send_json({
                aid: "subscribe_quote",
                ins_list: s,
            });
        }
        return this.dm.get('quotes', symbol);
    }
    GET_KLINE({ kline_id = RandomStr(), symbol=GLOBAL_CONTEXT.symbol, duration=GLOBAL_CONTEXT.duration, width = 100 }={}) {
        if (!symbol || !duration)
            return undefined;
        let dur_nano = duration * 1000000000;
        this.ws.send_json({
            "aid": "set_chart",
            "chart_id": kline_id,
            "ins_list": symbol,
            "duration": dur_nano,
            "view_width": width, // 默认为 100
        });
        let ks = this.dm.get_kline_serial(symbol, dur_nano);
        //这里返回的是实际数据的proxy
        return ks.d;
    }

    /**
     * 提取符合单号符合条件的所有存活委托单
     * @param order_id_prefix: 单号前缀, 单号以此字符串开头的委托单都会在结果集中
     * @returns {*}
     */
    GET_ORDER_DICT(order_id_prefix) {
        let results = {};
        let all_orders = this.dm.set_default({}, 'trade', this.dm.account_id, 'orders');
        for (var ex_or_id in all_orders) {
            var ord = all_orders[ex_or_id];
            if (ord.status == 'ALIVE')
                results[ex_or_id] = ord;
        }
        return results;
    };

    INSERT_ORDER({symbol, direction, offset, volume=1, price_type="LIMIT", limit_price, prefix=""}) {
        if (!this.dm.account_id) {
            Notify.error('未登录，请在软件中登录后重试。');
            return null;
        }
        let {exchange_id, instrument_id} = ParseSymbol(symbol);
        let order_id = prefix + RandomStr(8);
        let send_obj = {
            "aid": "insert_order",
            "order_id": order_id,
            "exchange_id": exchange_id,
            "instrument_id": instrument_id,
            "direction": direction,
            "offset": offset,
            "volume": volume,
            "price_type": "LIMIT",
            "limit_price": limit_price
        };
        this.ws.send_json(send_obj);
        let order = this.dm.set_default({
            order_id: order_id,
            status: "ALIVE",
            volume_orign: volume,
            volume_left: volume,
            exchange_id: exchange_id,
            instrument_id: instrument_id,
            limit_price: limit_price,
            price_type: "LIMIT",
        }, "trade", this.dm.account_id, "orders", order_id);
        return order;
    };

    CANCEL_ORDER(order) {
        let orders = {};
        if (typeof order == 'object') {
            orders[order.order_id] = order;
        }else {
            orders = this.GET_ORDER_DICT(order);
        }
        for (let order_id in orders) {
            this.ws.send_json({
                "aid": "cancel_order",
                "order_id": order_id,
            });
        }
    }

    REGISTER_INDICATOR_CLASS(ind_class){
        this.ta.register_indicator_class(ind_class);
        let classDefine = ind_class.define();
        classDefine.aid = 'register_indicator_class';
        classDefine.name = ind_class.name;
        this.ws.send_json(classDefine);
    }
    UNREGISTER_INDICATOR_CLASS(ind_class){
        this.ta.unregister_indicator_class();
    }
    NEW_INDICATOR_INSTANCE(ind_class, symbol, dur_sec, params, instance_id=RandomStr()) {
        let dur_nano = dur_sec * 1000000000;
        let ds = this.dm.get_kline_serial(symbol, dur_nano);
        return this.ta.new_indicator_instance(ind_class, symbol, dur_sec, ds, params, instance_id);
    }
    DELETE_INDICATOR_INSTANCE(ind_instance){
        return this.ta.delete_indicator_instance(ind_instance);
    }
}


// if (typeof exports !== 'undefined') {
//     module.exports = {TQSDK, Indicator};
//     // exports.DataManager = DataManager;
// } else {
//     var TQ = new TQSDK();
// }

var assert = require('assert');

class MockWebsocket{
    constructor(url, callbacks){
        this.send_objs = [];
    }
    send_json(obj) {
        this.send_objs.push(obj);
    };
    isReady() {
        return true;
    };
    init() {
    };
}

var TQ = new TQSDK(new MockWebsocket());

function init_test_data(){
    TQ.dm.on_rtn_data({
        "aid": "rtn_data",                                        //数据推送
        "data": [                                                 //diff数据数组, 一次推送中可能含有多个数据包
            {
                "quotes": {                                           //实时行情数据
                    "SHFE.cu1612": {
                        "instrument_id": "cu1612",                        //合约代码
                        "datetime": "2016-12-30 13:21:32.500000",         //时间
                        "ask_price1": 36590.0,                            //卖价
                        "ask_volume1": 121,                               //卖量
                        "bid_price1": 36580.0,                            //买价
                        "bid_volume1": 3,                                 //买量
                        "last_price": 36580.0,                            //最新价
                        "highest": 36580.0,                               //最高价
                        "lowest": 36580.0,                                //最低价
                        "amount": 213445312.5,                            //成交额
                        "volume": 23344,                                  //成交量
                        "open_interest": 23344,                           //持仓量
                        "pre_open_interest": 23344,                       //昨持
                        "pre_close": 36170.0,                             //昨收
                        "open": 36270.0,                                  //今开
                        "close": 36270.0,                                 //收盘
                        "lower_limit": 34160.0,                           //跌停
                        "upper_limit": 38530.0,                           //涨停
                        "average": 36270.1,                               //均价
                        "pre_settlement": 36270.0,                        //昨结
                        "settlement": 36270.0,                            //结算价
                    },
                },
                "klines": {                                           //K线数据
                    "SHFE.cu1601": {                                         //合约代码
                        180000000000: {                                   //K线周期, 单位为纳秒, 180000000000纳秒 = 3分钟
                            "last_id": 3435,                                //整个序列最后一个记录的序号
                            "data": {
                                3434: {
                                    "datetime": 192837100000000,                //UnixNano 北京时间，如果是日线，则是交易日的 UnixNano
                                    "open": 3434,                            //开
                                    "high": 3434,                            //高
                                    "low": 3434,                             //低
                                    "close": 3434,                           //收
                                    "volume": 3434,                                //成交量
                                    "open_oi": 3434,                            //起始持仓量
                                    "close_oi": 3434,                           //结束持仓量
                                },
                                3435: {
                                    "datetime": 192837400000000,                //UnixNano 北京时间，如果是日线，则是交易日的 UnixNano
                                    "open": 3435,                            //开
                                    "high": 3435,                            //高
                                    "low": 3435,                             //低
                                    "close": 3435,                           //收
                                    "volume": 3435,                                //成交量
                                    "open_oi": 3435,                            //起始持仓量
                                    "close_oi": 3435,                           //结束持仓量
                                },
                            },
                            "binding": {
                                "cu1709": {
                                    3384: 2900,                                 //本合约K线所对应的另一个合约的K线号
                                    3385: 2950,
                                }
                            }
                        },
                    },
                },
                "ticks": {
                    "cu1601": {
                        "last_id": 3550,                                  //整个序列最后一个元素的编号
                        "data": {
                            3384: {
                                "datetime": 1928374000000000,                 //UnixNano 北京时间
                                "trading_day": 1928374000000000,              //交易日的UnixNano 北京时间
                                "last_price": 3432.33,                        //最新价
                                "highest": 3452.33,                           //最高价
                                "lowest": 3402.33,                            //最低价
                                "bid_price1": 3432.2,                         //买一价
                                "ask_price1": 3432.4,                         //卖一价
                                "bid_volume1": 1,                             //买一量
                                "ask_volume1": 2,                             //卖一量
                                "volume": 200,                                //成交量
                                "open_interest": 1621,                        //持仓量
                            },
                        }
                    },
                },
                "notify": {                                           //通知信息
                    "2010": {
                        "type": "MESSAGE",                                //MESSAGE TEXT
                        "code": 1000,
                        "content": "abcd",
                    }
                },
                "trade": {                                            //交易相关数据
                    "user1": {                                          //登录用户名
                        "user_id": "user1",                               //登录用户名
                        "accounts": {                                     //账户资金信息
                            "CNY": {                                        //account_key, 通常为币种代码
                                //核心字段
                                "account_id": "423423",                       //账号
                                "currency": "CNY",                            //币种
                                "balance": 9963216.550000003,                 //账户权益
                                "available": 9480176.150000002,               //可用资金
                                                                              //参考字段
                                "pre_balance": 12345,                         //上一交易日结算时的账户权益
                                "deposit": 42344,                             //本交易日内的入金金额
                                "withdraw": 42344,                            //本交易日内的出金金额
                                "commission": 123,                            //本交易日内交纳的手续费
                                "preminum": 123,                              //本交易日内交纳的权利金
                                "static_balance": 124895,                     //静态权益
                                "position_profit": 12345,                     //持仓盈亏
                                "float_profit": 8910.231,                     //浮动盈亏
                                "risk_ratio": 0.048482375,                    //风险度
                                "margin": 11232.23,                           //占用资金
                                "frozen_margin": 12345,                       //冻结保证金
                                "frozen_commission": 123,                     //冻结手续费
                                "frozen_premium": 123,                        //冻结权利金
                                "close_profit": 12345,                        //本交易日内平仓盈亏
                                "position_profit": 12345,                     //当前持仓盈亏
                            }
                        },
                        "positions": {                                    //持仓
                            "SHFE.cu1801": {                                //合约代码
                                "exchange_id": "SHFE",                        //交易所
                                "instrument_id": "cu1801",                    //交易所内的合约代码
                                "volume_long": 5,                             //多头持仓手数
                                "volume_short": 5,                            //空头持仓手数
                                "hedge_flag": "SPEC",                         //套保标记
                                "open_price_long": 3203.5,                    //多头开仓均价
                                "open_price_short": 3100.5,                   //空头开仓均价
                                "open_cost_long": 3203.5,                     //多头开仓市值
                                "open_cost_short": 3100.5,                    //空头开仓市值
                                "margin": 32324.4,                            //占用保证金
                                "float_profit_long": 32324.4,                 //多头浮动盈亏
                                "float_profit_short": 32324.4,                //空头浮动盈亏
                                "volume_long_today": 5,                       //多头今仓手数
                                "volume_long_his": 5,                         //多头老仓手数
                                "volume_long_frozen": 5,                      //多头持仓冻结
                                "volume_long_frozen_today": 5,                //多头今仓冻结
                                "volume_short_today": 5,                      //空头今仓手数
                                "volume_short_his": 5,                        //空头老仓手数
                                "volume_short_frozen": 5,                     //空头持仓冻结
                                "volume_short_frozen_today": 5,               //空头今仓冻结
                            }
                        },
                        "orders": {                                       //委托单
                            "abc|123": {                                    //order_key, 用于唯一标识一个委托单
                                "order_id": "123",                            //委托单ID, 对于一个用户的所有委托单，这个ID都是不重复的
                                "exchange_id": "SHFE",                        //交易所
                                "instrument_id": "cu1801",                    //合约代码
                                "direction": "BUY",                           //下单方向
                                "offset": "OPEN",                             //开平标志
                                "volume_orign": 6,                            //总报单手数
                                "volume_left": 3,                             //未成交手数
                                "price_type": "LIMIT",                        //价格类型
                                "limit_price": 45000,                         //委托价格, 仅当 price_type = LIMIT 时有效
                                "status": "ALIVE",                            //委托单状态, ALIVE=有效, FINISHED=已完
                                "insert_date_time": 1928374000000000,         //下单时间
                                "exchange_order_id": "434214",                //交易所单号
                            }
                        },
                        "trades": {                                       //成交记录
                            "abc|123|1": {                                  //trade_key, 用于唯一标识一个成交项
                                "order_id": "123",
                                "exchange_id": "SHFE",                        //交易所
                                "instrument_id": "cu1801",                    //交易所内的合约代码
                                "exchange_trade_id": "1243",                  //交易所成交号
                                "direction": "BUY",                           //成交方向
                                "offset": "OPEN",                             //开平标志
                                "volume": 6,                                  //成交手数
                                "price": 1234.5,                              //成交价格
                                "trade_date_time": 1928374000000000           //成交时间
                            }
                        },
                    },
                }
            }
        ]
    });
}

describe('dm', function () {
    init_test_data();
    it('GetQuote with symbol', function () {
        var q = TQ.GET_QUOTE("SHFE.cu1612");
        assert.equal(q.last_price, 36580.0);
    });
    it('GET_KLINE with all params', function () {
        var q = TQ.GET_KLINE({
            symbol: "SHFE.cu1601",
            duration: 180,
        });
        assert.equal(q[-1].close, 3435);
        assert.equal(q.close[-1], 3435);
        let ds = q.close.slice(-2);
        assert.equal(ds.length, 2);
        assert.equal(ds[0], 3434);
        assert.equal(ds[1], 3435);
    });
});


class ma extends Indicator
{
    static define() {
        return {
            type: "SUB",
            cname: "MA",
            state: "KLINE",
            params: [
                {name: "N", default: 3},
            ],
        };
    }
    init(){
        this.m = this.OUTS("LINE", "m", {color: RED});
    }
    calc(i) {
        this.m[i] = MA(i, this.DS.close, this.params.N, this.m);
    }
}


function batch_input_datas(left_id, right_id, last_id){
    data = {};
    for(let i = left_id; i<= right_id; i++){
        data[i] = {
            "datetime": i,
            "open": i,
            "high": i,
            "low": i,
            "close": i,
            "volume": i,
            "open_oi": i,
            "close_oi": i,
        }
    }
    TQ.on_rtn_data({
        "aid": "rtn_data",
        "data": [
            {
                "klines": {
                    "CFFEX.IF1801": {
                        5000000000: {
                            "last_id": last_id,
                            "data": data,
                        },
                    },
                },
            }
        ]
    });
}

describe('ta', function () {
    init_test_data();
    batch_input_datas(1000, 10000, 10000);
    TQ.ta.register_indicator_class(ma);
    it('指标简单计算', function () {
        let symbol = "CFFEX.IF1801";
        let dur_sec = 5;
        let ind1 = TQ.NEW_INDICATOR_INSTANCE(ma, symbol, dur_sec, {
            "N": 1,
        });
        assert.equal(ind1.outs.m(-1), 10000);
        let ind2 = TQ.NEW_INDICATOR_INSTANCE(ma, symbol, dur_sec, {
            "N": 10,
        });
        assert.equal(ind2.outs.m(-1), 9995.5);
    });
});

describe('技术指标与图表结合使用', function () {
    init_test_data();
    TQ.ta.register_indicator_class(ma);
    it('常规流程', function () {
        //初始化数据到(1000, 3000)
        batch_input_datas(1000, 3000, 3000);
        //请求创建指标实例
        let r = {
            "aid": "update_indicator_instance",
            "ta_class_name": "ma",
            "instance_id": "abc324238",
            "epoch": 1,
            "ins_id": "CFFEX.IF1801",
            "dur_nano": 5000000000,
            "view_left": 2800,
            "view_right": 4000,
            "params": {
                "N": {"value": 10},
            }
        };
        TQ.on_update_indicator_instance(r);
        //预期将向主程序发送一个 set_indicator_data 包, 检查这个包的内容
        assert.equal(TQ.ws.send_objs.length, 1);
        let send_obj = TQ.ws.send_objs[0];
        assert.equal(send_obj.aid, "set_indicator_data");
        assert.equal(send_obj.instance_id, "abc324238");
        assert.equal(send_obj.epoch, 1);
        assert.equal(send_obj.range_left, 2800);
        assert.equal(send_obj.range_right, 3000);
        assert.equal(send_obj.datas.m[0].length, 201);
        assert(!isNaN(send_obj.datas.m[0][0]));
        assert.equal(send_obj.datas.m[0][10], 2805.5);
        assert.equal(send_obj.datas.m[0][200], 2995.5);
        TQ.ws.send_objs = [];
        //更新一波行情数据
        //预期会向主程序发送 set_indicator_data 包, 增补前次未发送的数据
        batch_input_datas(3001, 3001, 3001);
        assert.equal(TQ.ws.send_objs.length, 1);
        let send_obj_2 = TQ.ws.send_objs[0];
        assert.equal(send_obj_2.range_left, 3001);
        assert.equal(send_obj_2.range_right, 3001);
        assert.equal(send_obj_2.datas.m[0][0], 2996.5);
        TQ.ws.send_objs = [];
        //更新指标参数(只调整 view_left和 view_right)
        //预期会向主程序发送 set_indicator_data 包, 增补前次未发送的数据
        let r2 = {
            "aid": "update_indicator_instance",
            "ta_class_name": "ma",
            "instance_id": "abc324238",
            "epoch": 1,
            "ins_id": "CFFEX.IF1801",
            "dur_nano": 5000000000,
            "view_left": 2600,
            "view_right": 4000,
            "params": {
                "N": {"value": 10},
            }
        };
        TQ.on_update_indicator_instance(r2);
        assert.equal(TQ.ws.send_objs.length, 1);
        let send_obj_3 = TQ.ws.send_objs[0];
        assert.equal(send_obj_3.range_left, 2600);
        assert.equal(send_obj_3.range_right, 3001);
        assert.equal(send_obj_3.datas.m[0][0], 2595.5);
        TQ.ws.send_objs = [];
        //更新指标参数(更换合约/周期)
        //预期会向主程序发送 set_indicator_data 包, 所有数据会重算
    });
});

describe('下单', function () {
    init_test_data();
    it('单个函数', function () {
        //下单
        let order = TQ.INSERT_ORDER({
            symbol: "SHFE.cu1601",
            direction: "BUY",
            offset: "OPEN",
            volume: 2,
            limit_price: 2000,
            prefix: "abc",
        });
        //预期将向主程序发送一个 insert_order 包, 检查这个包的内容
        assert.equal(TQ.ws.send_objs.length, 1);
        let send_obj = TQ.ws.send_objs[0];
        assert.equal(send_obj.aid, "insert_order");
    });
});


describe('撤单', function () {
    init_test_data();
    it('撤单个单', function () {
        //下单
        let order = TQ.INSERT_ORDER({
            symbol: "SHFE.cu1601",
            direction: "BUY",
            offset: "OPEN",
            volume: 2,
            limit_price: 2000,
            prefix: "abc",
        });
        TQ.CANCEL_ORDER(order);
        //预期将向主程序发送一个 cancel_order 包, 检查这个包的内容
    });
    it('批量撤单', function () {
        //下单
        let order = TQ.INSERT_ORDER({
            symbol: "SHFE.cu1601",
            direction: "BUY",
            offset: "OPEN",
            volume: 2,
            limit_price: 2000,
            prefix: "abc",
        });
        TQ.CANCEL_ORDER("abc");
    });
});
