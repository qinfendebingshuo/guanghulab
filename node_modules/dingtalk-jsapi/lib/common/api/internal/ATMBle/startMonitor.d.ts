export declare const apiName = "internal.ATMBle.startMonitor";
/**
 * 考勤蓝牙开始监控 请求参数定义
 * @apiName internal.ATMBle.startMonitor
 */
export interface IInternalATMBleStartMonitorParams {
    [key: string]: any;
}
/**
 * 考勤蓝牙开始监控 返回结果定义
 * @apiName internal.ATMBle.startMonitor
 */
export interface IInternalATMBleStartMonitorResult {
    [key: string]: any;
}
/**
 * 考勤蓝牙开始监控
 * @apiName internal.ATMBle.startMonitor
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function startMonitor$(params: IInternalATMBleStartMonitorParams): Promise<IInternalATMBleStartMonitorResult>;
export default startMonitor$;
