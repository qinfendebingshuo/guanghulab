/**
 * runtime.h5nuvabridge.exec 请求参数定义
 * @apiName runtime.h5nuvabridge.exec
 */
export interface IRuntimeH5nuvabridgeExecParams {
    _action: string;
    [key: string]: any;
}
/**
 * runtime.h5nuvabridge.exec 返回结果定义
 * @apiName runtime.h5nuvabridge.exec
 */
export interface IRuntimeH5nuvabridgeExecResult {
    [key: string]: any;
}
/**
 * runtime.h5nuvabridge.exec
 * @apiName runtime.h5nuvabridge.exec
 * @supportVersion ios: 7.0.0 android: 7.0.0
 */
export declare function exec$(params: IRuntimeH5nuvabridgeExecParams): Promise<IRuntimeH5nuvabridgeExecResult>;
export default exec$;
