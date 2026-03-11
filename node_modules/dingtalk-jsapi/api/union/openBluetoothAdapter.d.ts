import { ICommonAPIParams } from '../../constant/types';
/**
 * 初始化蓝牙接口 请求参数定义
 * @apiName openBluetoothAdapter
 */
export interface IUnionOpenBluetoothAdapterParams extends ICommonAPIParams {
    autoClose: boolean;
}
/**
 * 初始化蓝牙接口 返回结果定义
 * @apiName openBluetoothAdapter
 */
export interface IUnionOpenBluetoothAdapterResult {
}
/**
 * 初始化蓝牙接口
 * @apiName openBluetoothAdapter
 */
export declare function openBluetoothAdapter$(params: IUnionOpenBluetoothAdapterParams): Promise<IUnionOpenBluetoothAdapterResult>;
export default openBluetoothAdapter$;
