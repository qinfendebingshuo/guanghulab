export declare const apiName = "internal.ATMBle.stopMonitor";
/**
 * 蓝牙停止监控 请求参数定义
 * @apiName internal.ATMBle.stopMonitor
 */
export interface IInternalATMBleStopMonitorParams {
    [key: string]: any;
}
/**
 * 蓝牙停止监控 返回结果定义
 * @apiName internal.ATMBle.stopMonitor
 */
export interface IInternalATMBleStopMonitorResult {
    [key: string]: any;
}
/**
 * 蓝牙停止监控
 * @apiName internal.ATMBle.stopMonitor
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function stopMonitor$(params: IInternalATMBleStopMonitorParams): Promise<IInternalATMBleStopMonitorResult>;
export default stopMonitor$;
