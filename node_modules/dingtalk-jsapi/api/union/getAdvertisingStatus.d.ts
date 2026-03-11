import { ICommonAPIParams } from '../../constant/types';
/**
 * 查询是否正在蓝牙广播 请求参数定义
 * @apiName getAdvertisingStatus
 */
export interface IUnionGetAdvertisingStatusParams extends ICommonAPIParams {
}
/**
 * 查询是否正在蓝牙广播 返回结果定义
 * @apiName getAdvertisingStatus
 */
export interface IUnionGetAdvertisingStatusResult {
}
/**
 * 查询是否正在蓝牙广播
 * @apiName getAdvertisingStatus
 */
export declare function getAdvertisingStatus$(params: IUnionGetAdvertisingStatusParams): Promise<IUnionGetAdvertisingStatusResult>;
export default getAdvertisingStatus$;
