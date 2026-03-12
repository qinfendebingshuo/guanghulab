export declare const apiName = "internal.bleengine.scanStop";
/**
 * 停止蓝牙引擎扫描智能硬件 请求参数定义
 * @apiName internal.bleengine.scanStop
 */
export interface IInternalBleengineScanStopParams {
    [key: string]: any;
}
/**
 * 停止蓝牙引擎扫描智能硬件 返回结果定义
 * @apiName internal.bleengine.scanStop
 */
export interface IInternalBleengineScanStopResult {
    result: boolean;
}
/**
 * 停止蓝牙引擎扫描智能硬件
 * @apiName internal.bleengine.scanStop
 * @supportVersion ios: 4.6.18
 */
export declare function scanStop$(params: IInternalBleengineScanStopParams): Promise<IInternalBleengineScanStopResult>;
export default scanStop$;
