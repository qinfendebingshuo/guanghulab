export declare const apiName = "internal.bleengine.request";
/**
 * 发送JSON转蓝牙RPC请求 请求参数定义
 * @apiName internal.bleengine.request
 */
export interface IInternalBleengineRequestParams {
    /** string型（蓝牙RPC名），必选 */
    method: string;
    /** string型（入参实际的Model类型），可选 */
    model?: string;
    /** string型（入参实际的Model内容，JSON），可选 */
    inModelContent?: string;
    /** 出参实际的Model类型 */
    outModel?: string;
    /** 超时时间  */
    timeout?: number;
}
/**
 * 发送JSON转蓝牙RPC请求 返回结果定义
 * @apiName internal.bleengine.request
 */
export interface IInternalBleengineRequestResult {
    /** 出参实际的Model内容 */
    result: string;
}
/**
 * 发送JSON转蓝牙RPC请求
 * @apiName internal.bleengine.request
 * @supportVersion ios: 4.6.18
 */
export declare function request$(params: IInternalBleengineRequestParams): Promise<IInternalBleengineRequestResult>;
export default request$;
