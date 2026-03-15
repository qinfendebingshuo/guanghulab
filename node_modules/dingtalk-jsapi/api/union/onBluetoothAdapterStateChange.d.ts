/**
 * 监听蓝牙状态变化事件 请求参数定义
 */
export declare type IUnionOnBluetoothAdapterStateChangeParams = (e: IUnionOnBluetoothAdapterStateChangeResult) => void;
/**
 * 监听蓝牙状态变化事件 返回结果定义
 */
export interface IUnionOnBluetoothAdapterStateChangeResult {
    available: boolean;
    discovering: boolean;
}
/**
 * 开启监听蓝牙状态变化事件
 * @apiName onBluetoothAdapterStateChange
 */
export declare function onBluetoothAdapterStateChange$(params: IUnionOnBluetoothAdapterStateChangeParams): void;
export default onBluetoothAdapterStateChange$;
