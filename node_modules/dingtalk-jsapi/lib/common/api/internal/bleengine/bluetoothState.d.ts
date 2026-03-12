export declare const apiName = "internal.bleengine.bluetoothState";
/**
 * 查询操作系统蓝牙状态 请求参数定义
 * @apiName internal.bleengine.bluetoothState
 */
export interface IInternalBleengineBluetoothStateParams {
    [key: string]: any;
}
/**
 * 查询操作系统蓝牙状态 返回结果定义
 * @apiName internal.bleengine.bluetoothState
 */
export interface IInternalBleengineBluetoothStateResult {
    bluetoothState: number;
}
/**
 * 查询操作系统蓝牙状态
 * @apiName internal.bleengine.bluetoothState
 * @supportVersion ios: 4.6.18
 */
export declare function bluetoothState$(params: IInternalBleengineBluetoothStateParams): Promise<IInternalBleengineBluetoothStateResult>;
export default bluetoothState$;
