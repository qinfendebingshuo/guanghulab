export declare const apiName = "internal.bleengine.connectDevice";
/**
 * 蓝牙直接连接设备 请求参数定义
 * @apiName internal.bleengine.connectDevice
 */
export interface IInternalBleengineConnectDeviceParams {
    [key: string]: any;
}
/**
 * 蓝牙直接连接设备 返回结果定义
 * @apiName internal.bleengine.connectDevice
 */
export interface IInternalBleengineConnectDeviceResult {
    result: boolean;
}
/**
 * 蓝牙直接连接设备
 * @apiName internal.bleengine.connectDevice
 * @supportVersion ios: 4.6.18
 */
export declare function connectDevice$(params: IInternalBleengineConnectDeviceParams): Promise<IInternalBleengineConnectDeviceResult>;
export default connectDevice$;
