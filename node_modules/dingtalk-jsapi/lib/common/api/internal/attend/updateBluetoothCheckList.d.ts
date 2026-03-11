export declare const apiName = "internal.attend.updateBluetoothCheckList";
/**
 * 通知客户端拉取蓝牙考勤设备列表并缓存到本地 请求参数定义
 * @apiName internal.attend.updateBluetoothCheckList
 */
export interface IInternalAttendUpdateBluetoothCheckListParams {
}
/**
 * 通知客户端拉取蓝牙考勤设备列表并缓存到本地 返回结果定义
 * @apiName internal.attend.updateBluetoothCheckList
 */
export interface IInternalAttendUpdateBluetoothCheckListResult {
}
/**
 * 通知客户端拉取蓝牙考勤设备列表并缓存到本地
 * @apiName internal.attend.updateBluetoothCheckList
 * @supportVersion android: 4.7.15 ios: 4.7.16
 * @author Android:珑一 ios: 度尽
 */
export declare function updateBluetoothCheckList$(params: IInternalAttendUpdateBluetoothCheckListParams): Promise<IInternalAttendUpdateBluetoothCheckListResult>;
export default updateBluetoothCheckList$;
