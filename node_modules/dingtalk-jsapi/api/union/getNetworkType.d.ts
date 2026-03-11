import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取当前网络状态 请求参数定义
 * @apiName getNetworkType
 */
export interface IUnionGetNetworkTypeParams extends ICommonAPIParams {
}
/**
 * 获取当前网络状态 返回结果定义
 * @apiName getNetworkType
 */
export interface IUnionGetNetworkTypeResult {
    networkType: string;
    networkAvailable: boolean;
}
/**
 * 获取当前网络状态
 * @apiName getNetworkType
 */
export declare function getNetworkType$(params: IUnionGetNetworkTypeParams): Promise<IUnionGetNetworkTypeResult>;
export default getNetworkType$;
