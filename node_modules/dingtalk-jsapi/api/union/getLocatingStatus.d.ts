import { ICommonAPIParams } from '../../constant/types';
/**
 * 批量连续定位状态 请求参数定义
 * @apiName getLocatingStatus
 */
export interface IUnionGetLocatingStatusParams extends ICommonAPIParams {
    sceneId: string[];
}
/**
 * 批量连续定位状态 返回结果定义
 * @apiName getLocatingStatus
 */
export interface IUnionGetLocatingStatusResult {
    res: string[];
}
/**
 * 批量连续定位状态
 * @apiName getLocatingStatus
 */
export declare function getLocatingStatus$(params: IUnionGetLocatingStatusParams): Promise<IUnionGetLocatingStatusResult>;
export default getLocatingStatus$;
