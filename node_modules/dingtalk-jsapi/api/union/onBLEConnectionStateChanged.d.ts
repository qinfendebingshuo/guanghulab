/**
 * 监听蓝牙连接状态事件 请求参数定义
 */
export declare type IUnionOnBLEConnectionStateChangedParams = (e: IUnionOnBLEConnectionStateChangedResult) => void;
/**
 * 监听蓝牙连接状态事件 返回结果定义
 */
export interface IUnionOnBLEConnectionStateChangedResult {
    deviceId: string;
    connected: boolean;
}
/**
 * 监听蓝牙连接状态事件
 * @apiName onBLEConnectionStateChanged
 */
export declare function onBLEConnectionStateChanged$(params: IUnionOnBLEConnectionStateChangedParams): void;
export default onBLEConnectionStateChanged$;
