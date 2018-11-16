class IndicatorRunContext extends IndicatorContext{
    constructor(ind_func, instance_id, symbol, dur_nano, params, ds, tq){
        super(ind_func);
        //技术指标参数, 合约代码/周期也作为参数项放在这里面
        this.TQ = tq;
        this.instance_id = instance_id;
        this.symbol = symbol;
        this.dur_nano = dur_nano;
        this._ds = ds;   //基础序列, 用作输出序列的X轴
        this.DS = ds.proxy;  //提供给用户代码使用的ds proxy
        this.PARAMS = params; //指标参数
        this.outs = {}; //输出序列访问函数
        this.out_define = {}; //输出序列格式声明
        this.out_values = {}; //输出序列值
        this.out_drawings = {};
        this.valid_left = -1; //已经计算过的可靠结果范围(含左右两端点), valid_right永远>=valid_left. 如果整个序列没有计算过任何数据, 则 valid_left=valid_right= -1
        this.valid_right = -1;

        this.enable_trade = false;
        this.trade_symbol = symbol;
        this.unit_id = "TA." + this.instance_id;
        this.volume_limit = 10;

        this.epoch = 0;
        this.view_left = -1;
        this.view_right = -1;
        this.is_error = false;
        this.trade_at_close = false;
        this.trade_oc_cycle = false;

        this.next();
    }

    next(i){
        if(!this.TQ.ta.running_instance) this.TQ.ta.running_instance = this;
        this.instance.next(i);
        if(this.TQ.ta.running_instance === this) this.TQ.ta.running_instance = null;
    }

    PARAM(defaultValue, name){
        // 有可能是 0
        if(this.PARAMS[name] == undefined) {
            this.PARAMS[name] = defaultValue;
        }
        return this.PARAMS[name];
    }

    DRAW(id, params){
        this.out_drawings[id] = params;
    }
    DRAW_LINE(id, x1, y1, x2, y2, color=0xFFFFFF, width=1, style=0){
        this.out_drawings[id] = {type:"LINE", x1, y1, x2, y2, color, width, style};
    };
    DRAW_RAY(id, x1, y1, x2, y2, color=0xFFFFFF, width=1, style=0){
        this.out_drawings[id] = {type:"RAY", x1, y1, x2, y2, color, width, style};
    };
    DRAW_SEG(id, x1, y1, x2, y2, color=0xFFFFFF, width=1, style=0){
        this.out_drawings[id] = {type:"SEG", x1, y1, x2, y2, color, width, style};
    };
    DRAW_BOX(id, x1, y1, x2, y2, color=0xFFFFFF, width=1, style=0){
        this.out_drawings[id] = {type:"BOX", x1, y1, x2, y2, color, width, style};
    };
    DRAW_PANEL(id, x1, y1, x2, y2, color=0xFFFFFF){
        this.out_drawings[id] = {type:"PANEL", x1, y1, x2, y2, color};
    };
    DRAW_ICON(id, x1, y1, icon){
        this.out_drawings[id] = {type:"ICON", x1, y1, icon};
    };
    DRAW_TEXT(id, x1, y1, text="", color=0xFFFFFF){
        if(typeof text != 'string') text = text.toString();
        this.out_drawings[id] = {type:"TEXT", x1, y1, text, color};
    };

    /**
     * 某个范围内有效数据
     * @param left
     * @param right
     * @returns 返回存在数据的最后一个 id, 如果不存在 返回的数字比 left 小
     */
    _exist_data_range(left, right){
        if (left > right)
            return left - 1;
        for(let i = left; i<=right && !this._ds.data[i]; i++){
            right = i-1;
            break;
        }
        return right;
    }

    /**
     * 要求指标实例计算X范围从left到right(包含两端点)的结果值
     * @param left:
     * @param right
     * @return [update_left, update_right]: 本次计算中更新的数据范围, update_right总是>=update_left. 如果本次计算没有任何结果被更新, 返回 [-1, -1]
     */
    calc_range(left, right){
        // 无法计算的情形
        if (this.is_error || !this._ds || this._ds.last_id == -1 || left > this._ds.last_id){
            return [-1, -1];
        }
        let calc_left = -1, calc_right = -1;
        let isDefault = false;

        if (left === undefined || right === undefined) {
            // 1 默认值  => 没有数据就不计算
            isDefault = true;
            left = this.view_left;
            right = this.view_right > this._ds.last_id ? this._ds.last_id : this.view_right;
            if(right < left) return [-1, -1];

            if (this.valid_left > -1 && this.valid_right > -1){
                // if(left < this.valid_left){
                //     if (right >= this.valid_left && right <= this.valid_right){
                //         right = this.valid_left;
                //     }
                // } else
                if(left >= this.valid_left && left <= this.valid_right) {
                    if (right >= this.valid_right){
                        left = this.valid_right;
                    } else {
                        left = right = -1;
                    }
                }
            }
        }
        // 2 用户输入值 => 即使没有数据也要计算填入 NaN, 把用户输入的范围记下来

        let runId = TaManager.Keys.next().value;
        let content = {
            id: runId,
            instanceId: this.instance_id,
            className: this.ind_class_name
        };

        try{
            if(IsWebWorker)
                self.postMessage({ cmd: 'calc_start', content});
            // console.time('run+' + runId)
            for (let i = left; i <= right; i++) {
                if(this._ds.data[i]){
                    this.next(i);
                    if(calc_left < 0) calc_left = i;
                    calc_right = i;
                } else {
                    if (isDefault && calc_left > -1) break;
                    if (!isDefault) this.next(i);
                }
            }
            if (calc_left > -1 && calc_right > -1){
                if(this.valid_left > -1 && this.valid_right > -1 ){
                    let _valid_left = this.valid_left;
                    // if (calc_left < this.valid_left || calc_left > this.valid_right)
                    //     this.valid_left = calc_left;
                    // if (calc_right < _valid_left || calc_right > this.valid_right)
                    //     this.valid_right = calc_right;
                    if (calc_left < this.valid_left || calc_left > this.valid_right){
                        this.valid_left = calc_left;
                        this.valid_right = calc_right;
                    } else if (calc_right > this.valid_right){
                        this.valid_right = calc_right;
                    }
                } else {
                    this.valid_left = calc_left;
                    this.valid_right = calc_right;
                }
            }
            // console.log(runId, this.instance_id, this.symbol, this.ind_class_name, '需要计算范围(', left, right, ')', '本次计算范围(', calc_left, calc_right, ')', '有效数据范围(', this.valid_left, this.valid_right, ')')
            // console.timeEnd('run+' + runId)
            if(IsWebWorker)
                self.postMessage({ cmd: 'calc_end', content});
        } catch (e){
            console.error(e);
            this.is_error = true;
            if(IsWebWorker)
                self.postMessage({ cmd: 'calc_end', content});
            if(IsWebWorker)
                self.postMessage({
                    cmd: 'feedback',
                    content: {
                        error: true,
                        type: 'run',
                        message: e.message,
                        func_name: this.ind_class_name,
                    },
                });
        }
        return [calc_left, calc_right];

    };

    /**
     * 设定是否只在K线完成时刻发出交易信号
     * @param b : b==true,只在一根K线结束的时刻,才会发出交易信号, 一根K线最多只发出一个交易信号; b==false, K线每次变化时都可能发出交易信号, 一根K线可以发出多个交易信号
     *
     * 默认值为 false
     */
    TRADE_AT_CLOSE(b){
        this.trade_at_close = b;
    }
    /**
     * 设定是否强制使用开平循环模式
     * @param b : b==true,在未持仓情况下只会发出开仓信号, 有持仓时只会发出平仓信号. b==false, 有持仓时也可以发出开仓信号
     *
     * 默认值为 false
     */
    TRADE_OC_CYCLE(b){
        this.trade_oc_cycle = b;
    }
    ISLAST(i){
        return this._ds.last_id === i;
    }
    ORDER(current_i, direction, offset, volume, price_type="LIMIT", limit_price = undefined, order_symbol = this.trade_symbol) {
        if (this.is_error || !this._ds || this._ds.last_id === -1)
            return;
        if (!this.out_series_mark) {
            this.out_series_mark = this.OUTS('MARK', 'mk', {});
        }
        this.out_series_mark[current_i] = direction === "BUY" ? ICON_BUY : ICON_SELL;
        if (!this.enable_trade)
            return;

        // 要求在K线完成的时刻满足下单条件才会动作
        if (this.trade_at_close && (current_i <= this.last_i || this._ds.last_id !== current_i + 1))
            return;
        // 要求任意时刻满足下单条件都会动作
        if (!this.trade_at_close && this._ds.last_id !== current_i)
            return;

        this.last_i = current_i;
        //确定下单价格
        if (price_type === 'LIMIT' && !limit_price){
            // 引用了上层的 TQ
            let quote = this.TQ.GET_QUOTE(order_symbol);
            let price_field = direction === "BUY" ? 'ask_price1' : 'bid_price1';
            if (!quote[price_field]) // 取不到对应的价格 包括 NaN 、 undefined
                return;
            limit_price = quote[price_field];
        }

        let position = this.TQ.GET_POSITION(order_symbol);
        let volume_open = 0;
        let volume_close = 0;
        let volume_close_today = 0;
        if (offset === "CLOSE" || offset === "CLOSEOPEN") {
            let long_closeable_volume = position.volume_long - position.order_volume_sell_close - position.order_volume_sell_closetoday;
            let short_closeable_volume = position.volume_short - position.order_volume_buy_close - position.order_volume_buy_closetoday;
            let long_closeable_volume_today = position.volume_long_today - position.order_volume_sell_closetoday;
            let short_closeable_volume_today = position.volume_short_today - position.order_volume_buy_closetoday;
            if (direction === "BUY") {
                volume_close = Math.min(short_closeable_volume, volume);
                volume_close_today = short_closeable_volume_today;
            } else {
                volume_close = Math.min(long_closeable_volume, volume);
                volume_close_today = long_closeable_volume_today;
            }
            if (volume_close > 0){
                // 处理平今平昨
                if(order_symbol.startsWith("SHFE.") || order_symbol.startsWith("INE.")){
                    if(volume_close <= volume_close_today){
                        return this.TQ.INSERT_ORDER({
                            symbol: order_symbol,
                            direction: direction,
                            offset: "CLOSETODAY",
                            volume: volume_close,
                            price_type: price_type,
                            limit_price: limit_price
                        });
                    } else {
                        this.TQ.INSERT_ORDER({
                            symbol: order_symbol,
                            direction: direction,
                            offset: "CLOSETODAY",
                            volume: volume_close_today,
                            price_type: price_type,
                            limit_price: limit_price
                        });
                        return this.TQ.INSERT_ORDER({
                            symbol: order_symbol,
                            direction: direction,
                            offset: "CLOSE",
                            volume: volume_close - volume_close_today,
                            price_type: price_type,
                            limit_price: limit_price
                        });
                    }
                } else {
                    return this.TQ.INSERT_ORDER({
                        symbol: order_symbol,
                        direction: direction,
                        offset: "CLOSE", //order_symbol.startsWith("SHFE.")?"CLOSETODAY":"",
                        volume: volume_close,
                        price_type: price_type,
                        limit_price: limit_price
                    });
                }
            }
        }
        if (offset === "OPEN" || offset === "CLOSEOPEN") {
            let long_position_volume = position.volume_long + position.order_volume_buy_open;
            let short_position_volume = position.volume_short + position.order_volume_sell_open;
            let pos_volume = (direction === "BUY")?long_position_volume:short_position_volume;
            if (pos_volume === 0 || !this.trade_oc_cycle){
                if (this.volume_limit) {
                    if (this.volume_limit > pos_volume)
                        volume_open = Math.min(this.volume_limit - pos_volume, volume);
                    else
                        volume_open = 0;
                } else {
                    volume_open = volume;
                }
            }
            if (volume_open > 0) {
                return this.TQ.INSERT_ORDER({
                    symbol: order_symbol,
                    direction: direction,
                    offset: "OPEN",
                    volume: volume_open,
                    price_type: price_type,
                    limit_price: limit_price
                });
            }
        }
    };
    CANCEL_ALL(){
        return this.TQ.CANCEL_ORDER(this.unit_id);
    };
    LOG(msg, color = '#000000', bkcolor = '#ffffff'){
        let dt = (new Date()).toISOString().slice(0, 23).replace('T', ' ');
        let dt_css = 'background: #ddd; color: #000 ';
        let d_css = 'background: #fff; color: #000 ';
        let css ='background: ' + bkcolor + '; color:' + color;
        console.log(`%c${dt}%c %c${JSON.stringify(msg)}`, dt_css, d_css, css);
    }
    OUTS(style, name, options = {}){
        options.style = style;
        this.out_define[name] = options;
        var out_serial = [];
        this.out_values[name] = out_serial;
        let self = this;
        let length_of_outs = this.OUTS_TYPE[style];
        for(let i=0; i<length_of_outs; i++){
            out_serial[i] = [];
        }
        this.outs[name] = (function(len){
            return function (left, right = null){
                //每个序列的输出函数允许一次性提取一段数据(含left, right两点)
                //如果提供了left/right 两个参数,则返回一个 array
                //如果只提供left, 则返回一个value
                //无法输出结果的情形
                let result = [];
                for (let i = 0; i < len; i++) {
                    result[i] = right === null ? null : [];
                }
                if (self.is_error || !self._ds || self._ds.last_id === -1) {
                    return result;
                }
                //负数支持, 如果left/right为负数, 需要先转换到正数, 这一转换又必须事先有一个合约/周期来标定X轴
                if (left < 0)
                    left = self._ds.last_id + left + 1;
                if (right < 0)
                    right = self._ds.last_id + right + 1;
                //尝试更新计算数据
                let [l, r] = [left, right ? right : left];
                if(self.view_left === -1 && self.valid_right === -1 ){
                    l = self._ds.last_id - 500;
                    r = self._ds.last_id;
                }
                let [calc_left, calc_right] = self.calc_range(l, r);
                //输出数据结果
                for (var i = 0; i < len; i++) {
                    result[i] = right === null ? out_serial[i][left] : out_serial[i].slice(left, right + 1);
                }
                return len === 1 ? result[0] : result;
            }
        }(length_of_outs));
        if(length_of_outs === 1) return out_serial[0];
        return out_serial;
    }
    // 模仿 wh 添加的接口
    MARGIN(order_symbol = this.trade_symbol){
        let quote = this.TQ.GET_QUOTE(order_symbol);
        // quote.margin 每手保证金
        // 返回保证金率 默认 0.08
        let margin_rate = quote.margin / quote.last_price / quote.volume_multiple;
        return margin_rate? margin_rate : 0.08;
    }

    PTICK(order_symbol = this.trade_symbol){
        let quote = this.TQ.GET_QUOTE(order_symbol);
        return quote.price_tick ;
    }

    VM(order_symbol = this.trade_symbol){
        let quote = this.TQ.GET_QUOTE(order_symbol);
        return quote.volume_multiple ;
    }

    FEE(order_symbol = this.trade_symbol){
        let quote = this.TQ.GET_QUOTE(order_symbol);
        // 每手手续费
        return quote.commission ;
    }

    BACK_BUY_INTERVAL(current_i){
        if (this.out_series_mark) {
            let i = 1;
            while (this.out_series_mark[current_i-i] !== ICON_BUY) {
                i++;
                if(i > 100) return undefined;
            }
            return i;
        }
        return undefined;
    }

    BACK_SELL_INTERVAL(current_i){
        if (this.out_series_mark) {
            let i = 1;
            while (this.out_series_mark[current_i-i] !== ICON_SELL) {
                i++;
                if(i > 100) return undefined;
            }
            return i;
        }
        return undefined;
    }

    // 100根k线内，最后一次交易信号是 BUY
    IS_LAST_BUY(current_i){
        if (this.out_series_mark) {
            let i = current_i;
            while (current_i - i < 100) {
                if(this.out_series_mark[i] === ICON_BUY) return true;
                if(this.out_series_mark[i] === ICON_SELL) return false;
                i--;
            }
        }
        return undefined;
    }

    // 100根k线内，最后一次交易信号是 SELL
    IS_LAST_SELL(current_i){
        if (this.out_series_mark) {
            let i = current_i;
            while (current_i - i < 100) {
                if(this.out_series_mark[i] === ICON_SELL) return true;
                if(this.out_series_mark[i] === ICON_BUY) return false;
                i--;
            }
        }
        return undefined;
    }

    // current_i 当前 k 线距离收盘的分钟数
    CLOSE_MINUTE(current_i, order_symbol = this.trade_symbol){
        let quote = this.TQ.GET_QUOTE(order_symbol);
        let day_list = quote.trading_time.day;
        let nowtime = this.DS[current_i].datetime;
        let now = new Date(nowtime/1000000);
        // 收盘时间
        let close = day_list.pop()[1].split(/[:]/);
        let [close_hour, close_minute] = [close[0], close[1]]
        if(close_hour - now.getHours() >= 0){
            // 同一天
            close = new Date(now);
        } else {
            // 前一天
            close = new Date(now.getTime() + 24*60*60*1000);
        }
        close.setHours(close_hour);
        close.setMinutes(close_minute);
        return Math.round((close - now) / 60000);
    }
}
