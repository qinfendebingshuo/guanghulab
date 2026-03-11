/**
 * 监听蓝牙连接状态事件 请求参数定义
 */
export declare type IUnionOffBLEConnectionStateChangedParams = (e: IUnionOffBLEConnectionStateChangedResult) => void;
/**
 * 监听蓝牙连接状态事件 返回结果定义
 */
export interface IUnionOffBLEConnectionStateChangedResult {
    deviceId: string;
    connected: boolean;
}
/**
 * 移除监听连接状态变化事件
 * @apiName offBLEConnectionStateChanged
 */
export declare function offBLEConnectionStateChanged$(params: IUnionOffBLEConnectionStateChangedParams): void;
export default offBLEConnectionStateChanged$;
