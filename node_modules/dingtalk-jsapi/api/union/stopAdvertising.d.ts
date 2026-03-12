import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止蓝牙广播 请求参数定义
 * @apiName stopAdvertising
 */
export interface IUnionStopAdvertisingParams extends ICommonAPIParams {
}
/**
 * 停止蓝牙广播 返回结果定义
 * @apiName stopAdvertising
 */
export interface IUnionStopAdvertisingResult {
}
/**
 * 停止蓝牙广播
 * @apiName stopAdvertising
 */
export declare function stopAdvertising$(params: IUnionStopAdvertisingParams): Promise<IUnionStopAdvertisingResult>;
export default stopAdvertising$;
