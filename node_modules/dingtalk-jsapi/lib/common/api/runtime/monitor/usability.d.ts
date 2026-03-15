export declare const apiName = "runtime.monitor.usability";
/**
 * 可用性上报 请求参数定义
 * @apiName runtime.monitor.usability
 */
export interface IRuntimeMonitorUsabilityParams {
    [key: string]: any;
}
/**
 * 可用性上报 返回结果定义
 * @apiName runtime.monitor.usability
 */
export interface IRuntimeMonitorUsabilityResult {
    [key: string]: any;
}
/**
 * 可用性上报
 * @apiName runtime.monitor.usability
 * @supportVersion  ios: 3.4.8 android: 3.4.8
 */
export declare function usability$(params: IRuntimeMonitorUsabilityParams): Promise<IRuntimeMonitorUsabilityResult>;
export default usability$;
