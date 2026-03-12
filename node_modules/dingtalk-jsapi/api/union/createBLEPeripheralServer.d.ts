import { ICommonAPIParams } from '../../constant/types';
/**
 * 初始化外围设备蓝牙服务 请求参数定义
 * @apiName createBLEPeripheralServer
 */
export interface IUnionCreateBLEPeripheralServerParams extends ICommonAPIParams {
}
/**
 * 初始化外围设备蓝牙服务 返回结果定义
 * @apiName createBLEPeripheralServer
 */
export interface IUnionCreateBLEPeripheralServerResult {
}
/**
 * 初始化外围设备蓝牙服务
 * @apiName createBLEPeripheralServer
 */
export declare function createBLEPeripheralServer$(params: IUnionCreateBLEPeripheralServerParams): Promise<IUnionCreateBLEPeripheralServerResult>;
export default createBLEPeripheralServer$;
