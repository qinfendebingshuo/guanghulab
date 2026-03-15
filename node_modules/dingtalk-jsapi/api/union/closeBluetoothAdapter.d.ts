import { ICommonAPIParams } from '../../constant/types';
/**
 * 关闭蓝牙适配器 请求参数定义
 * @apiName closeBluetoothAdapter
 */
export interface IUnionCloseBluetoothAdapterParams extends ICommonAPIParams {
}
/**
 * 关闭蓝牙适配器 返回结果定义
 * @apiName closeBluetoothAdapter
 */
export interface IUnionCloseBluetoothAdapterResult {
}
/**
 * 关闭蓝牙适配器
 * @apiName closeBluetoothAdapter
 */
export declare function closeBluetoothAdapter$(params: IUnionCloseBluetoothAdapterParams): Promise<IUnionCloseBluetoothAdapterResult>;
export default closeBluetoothAdapter$;
