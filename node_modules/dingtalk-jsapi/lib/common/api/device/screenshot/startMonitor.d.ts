export declare const apiName = "device.screenshot.startMonitor";
/**
 * 配置H5端开始监听客户端截屏事件。 多次调用时，客户端以最后一次调用数据为准 请求参数定义
 * @apiName device.screenshot.startMonitor
 */
export interface IDeviceScreenshotStartMonitorParams {
    [key: string]: any;
}
/**
 * 配置H5端开始监听客户端截屏事件。 多次调用时，客户端以最后一次调用数据为准 返回结果定义
 * @apiName device.screenshot.startMonitor
 */
export interface IDeviceScreenshotStartMonitorResult {
    [key: string]: any;
}
/**
 * 配置H5端开始监听客户端截屏事件。 多次调用时，客户端以最后一次调用数据为准
 * @apiName device.screenshot.startMonitor
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function startMonitor$(params: IDeviceScreenshotStartMonitorParams): Promise<IDeviceScreenshotStartMonitorResult>;
export default startMonitor$;
