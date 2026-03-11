export declare const apiName = "device.screenshot.stopMonitor";
/**
 * 配置H5端停止监听客户端截屏事件 请求参数定义
 * @apiName device.screenshot.stopMonitor
 */
export interface IDeviceScreenshotStopMonitorParams {
    [key: string]: any;
}
/**
 * 配置H5端停止监听客户端截屏事件 返回结果定义
 * @apiName device.screenshot.stopMonitor
 */
export interface IDeviceScreenshotStopMonitorResult {
    [key: string]: any;
}
/**
 * 配置H5端停止监听客户端截屏事件
 * @apiName device.screenshot.stopMonitor
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function stopMonitor$(params: IDeviceScreenshotStopMonitorParams): Promise<IDeviceScreenshotStopMonitorResult>;
export default stopMonitor$;
