import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取wifi状态 请求参数定义
 * @apiName getWifiStatus
 */
export interface IUnionGetWifiStatusParams extends ICommonAPIParams {
}
/**
 * 获取wifi状态 返回结果定义
 * @apiName getWifiStatus
 */
export interface IUnionGetWifiStatusResult {
    status: number;
}
/**
 * 获取wifi状态
 * @apiName getWifiStatus
 */
export declare function getWifiStatus$(params: IUnionGetWifiStatusParams): Promise<IUnionGetWifiStatusResult>;
export default getWifiStatus$;
