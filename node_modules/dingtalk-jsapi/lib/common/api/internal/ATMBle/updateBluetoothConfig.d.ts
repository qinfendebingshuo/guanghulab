export declare const apiName = "internal.ATMBle.updateBluetoothConfig";
/**
 * 蓝牙打卡各项配置变更同步jsapi 请求参数定义
 * @apiName internal.ATMBle.updateBluetoothConfig
 */
export interface IInternalATMBleUpdateBluetoothConfigParams {
    corpId: string;
    /**
     * 变更类型：
     * deviceBind, deviceUnbind, deviceBluetoothValue, deviceBluetoothCheckWithFace,
     * userBluetoothValue, userBluetoothCheckWay
     */
    updateType: string;
    /**
     * 变更数据json格式，对应updateType:
     * 变更数据json格式，对应updateType:
     * deviceBind：无
     * deviceUnbind：无
     * deviceBluetoothValue:
     * {
     *  "deviceUid":39843143,
     *  "bluetoothValue":true/false
     * }
     * deviceBluetoothCheckWithFace:
     * {
     * "deviceUid":39843143,
     * "checkWithFace":true/false
     * }
     * userBluetoothValue:
     * {
     * "bluetoothValue":true/false
     * }
     * userBluetoothCheckWay:
     * {
     * "bluetoothWay":"auto"/"manual"
     * }
     */
    data: string;
}
/**
 * 蓝牙打卡各项配置变更同步jsapi 返回结果定义
 * @apiName internal.ATMBle.updateBluetoothConfig
 */
export interface IInternalATMBleUpdateBluetoothConfigResult {
    [key: string]: any;
}
/**
 * 蓝牙打卡各项配置变更同步jsapi
 * @apiName internal.ATMBle.updateBluetoothConfig
 * @supportVersion android: 4.7.16
 * @author Android：序望，iOS：路客
 */
export declare function updateBluetoothConfig$(params: IInternalATMBleUpdateBluetoothConfigParams): Promise<IInternalATMBleUpdateBluetoothConfigResult>;
export default updateBluetoothConfig$;
