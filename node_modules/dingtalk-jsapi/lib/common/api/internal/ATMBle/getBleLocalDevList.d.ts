export declare const apiName = "internal.ATMBle.getBleLocalDevList";
/**
 * 获取本地已注册的蓝牙打卡设备列表 请求参数定义
 * @apiName internal.ATMBle.getBleLocalDevList
 */
export interface IInternalATMBleGetBleLocalDevListParams {
}
/**
 * 获取本地已注册的蓝牙打卡设备列表 返回结果定义
 * @apiName internal.ATMBle.getBleLocalDevList
 */
export interface IInternalATMBleGetBleLocalDevListResult {
    /** 已注册的蓝牙设备列表 */
    localDeviceList: Array<{
        /** 设备ID */
        devId: number;
        /** 设备IID */
        deviceUid: number;
        corpId?: string;
    }>;
    /** 蓝牙状态 */
    bleState: string;
}
/**
 * 获取本地已注册的蓝牙打卡设备列表
 * @apiName internal.ATMBle.getBleLocalDevList
 * @supportVersion ios: 4.7.18 android: 4.7.18
 * @author Android:珑一; iOS:路客
 */
export declare function getBleLocalDevList$(params: IInternalATMBleGetBleLocalDevListParams): Promise<IInternalATMBleGetBleLocalDevListResult>;
export default getBleLocalDevList$;
