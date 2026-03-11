export declare const apiName = "internal.bleengine.scanStart";
/**
 * 启动蓝牙引擎扫描智能硬件 请求参数定义
 * @apiName internal.bleengine.scanStart
 */
export interface IInternalBleengineScanStartParams {
    /** （JSON）, 必选 */
    queryParams: string;
}
/**
 * 启动蓝牙引擎扫描智能硬件 返回结果定义
 * @apiName internal.bleengine.scanStart
 */
export interface IInternalBleengineScanStartResult {
    /** 启动成功：true，启动失败：false */
    result: boolean;
}
/**
 * 启动蓝牙引擎扫描智能硬件
 * @apiName internal.bleengine.scanStart
 * @supportVersion ios: 4.6.18
 */
export declare function scanStart$(params: IInternalBleengineScanStartParams): Promise<IInternalBleengineScanStartResult>;
export default scanStart$;
