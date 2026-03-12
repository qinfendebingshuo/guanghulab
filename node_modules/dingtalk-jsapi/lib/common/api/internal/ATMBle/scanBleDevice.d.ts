export declare const apiName = "internal.ATMBle.scanBleDevice";
/**
 * 查询附近的智能硬件设备列表 请求参数定义
 * @apiName internal.ATMBle.scanBleDevice
 */
export interface IInternalATMBleScanBleDeviceParams {
}
/**
 * 查询附近的智能硬件设备列表 返回结果定义
 * @apiName internal.ATMBle.scanBleDevice
 */
export interface IInternalATMBleScanBleDeviceResult {
    /** 设备列表数据 */
    deviceList: Array<{
        /** 设备绑定的企业 */
        corpId: string;
        /** 设备Uid */
        deviceUid: number;
        /** 设备名 */
        deviceName: string;
        /** 设备id */
        devId: number;
        /** 手机与设备的距离，单位cm */
        distance: number;
        /** 信号强度 */
        rssi: number;
        /** 设备蓝牙功率 */
        txPower: number;
        /** 设备绑定状态 0:未绑定 1:已绑定 */
        status: number;
        /** 设备服务商Id */
        serId: number;
        /** 设备类型 */
        devTypeCode: number;
    }>;
}
/**
 * 查询附近的智能硬件设备列表
 * @apiName internal.ATMBle.scanBleDevice
 * @supportVersion ios: 4.7.6 android: 4.7.6
 */
export declare function scanBleDevice$(params: IInternalATMBleScanBleDeviceParams): Promise<IInternalATMBleScanBleDeviceResult>;
export default scanBleDevice$;
