export declare const apiName = "runtime.monitor.enableUsability";
/**
 * 开启可用性监控 请求参数定义
 * @apiName runtime.monitor.enableUsability
 */
export interface IRuntimeMonitorEnableUsabilityParams {
    [key: string]: any;
}
/**
 * 开启可用性监控 返回结果定义
 * @apiName runtime.monitor.enableUsability
 */
export interface IRuntimeMonitorEnableUsabilityResult {
    [key: string]: any;
}
/**
 * 开启可用性监控
 * @apiName runtime.monitor.enableUsability
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function enableUsability$(params: IRuntimeMonitorEnableUsabilityParams): Promise<IRuntimeMonitorEnableUsabilityResult>;
export default enableUsability$;
