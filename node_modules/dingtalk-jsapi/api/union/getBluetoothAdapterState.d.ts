import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取本机蓝牙模块状态 请求参数定义
 * @apiName getBluetoothAdapterState
 */
export interface IUnionGetBluetoothAdapterStateParams extends ICommonAPIParams {
}
/**
 * 获取本机蓝牙模块状态 返回结果定义
 * @apiName getBluetoothAdapterState
 */
export interface IUnionGetBluetoothAdapterStateResult {
    available: boolean;
    discovering: boolean;
}
/**
 * 获取本机蓝牙模块状态
 * @apiName getBluetoothAdapterState
 */
export declare function getBluetoothAdapterState$(params: IUnionGetBluetoothAdapterStateParams): Promise<IUnionGetBluetoothAdapterStateResult>;
export default getBluetoothAdapterState$;
