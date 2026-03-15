export declare const apiName = "internal.ATMBle.punchModePickResult";
/**
 * 打卡方式选择器选择结果，只对一方，通过该接口与对外开放接口进行通信 请求参数定义
 * @apiName internal.ATMBle.punchModePickResult
 */
export interface IInternalATMBlePunchModePickResultParams {
    /** 调用biz.ATMBle.punchModePicker时生成的callbackId，用于传递结果 */
    callbackId: string;
    /** 选择结果，json对象，格式如下： modes:List<Object> 打卡方式 json序列化后的格式： [{type: 'location', enable: true, list: []}] 意义待补充 */
    pickResult: any;
}
/**
 * 打卡方式选择器选择结果，只对一方，通过该接口与对外开放接口进行通信 返回结果定义
 * @apiName internal.ATMBle.punchModePickResult
 */
export interface IInternalATMBlePunchModePickResultResult {
}
/**
 * 打卡方式选择器选择结果，只对一方，通过该接口与对外开放接口进行通信
 * @apiName internal.ATMBle.punchModePickResult
 * @supportVersion ios: 5.0.7 android: 5.0.7
 * @author Android：序望，iOS：度尽
 */
export declare function punchModePickResult$(params: IInternalATMBlePunchModePickResultParams): Promise<IInternalATMBlePunchModePickResultResult>;
export default punchModePickResult$;
