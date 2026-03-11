/**
 * 监听蓝牙状态变化事件 请求参数定义
 */
export declare type IUnionOffBluetoothAdapterStateChangeParams = (e: IUnionOffBluetoothAdapterStateChangeResult) => void;
/**
 * 监听蓝牙状态变化事件 返回结果定义
 */
export interface IUnionOffBluetoothAdapterStateChangeResult {
    available: boolean;
    discovering: boolean;
}
/**
 * 移除监听蓝牙状态变化事件
 * @apiName offBluetoothAdapterStateChange
 */
export declare function offBluetoothAdapterStateChange$(params: IUnionOffBluetoothAdapterStateChangeParams): void;
export default offBluetoothAdapterStateChange$;
