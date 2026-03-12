import { ICommonAPIParams } from '../../../constant/types';
/**
 * 查询健康权限状态 请求参数定义
 * @apiName biz.sports.getHealthAuthorizationStatus
 */
export interface IBizSportsGetHealthAuthorizationStatusParams extends ICommonAPIParams {
    type: number;
}
/**
 * 查询健康权限状态 返回结果定义
 * @apiName biz.sports.getHealthAuthorizationStatus
 */
export interface IBizSportsGetHealthAuthorizationStatusResult {
    status: number;
}
/**
 * 查询健康权限状态
 * @apiName biz.sports.getHealthAuthorizationStatus
 */
export declare function getHealthAuthorizationStatus$(params: IBizSportsGetHealthAuthorizationStatusParams): Promise<IBizSportsGetHealthAuthorizationStatusResult>;
export default getHealthAuthorizationStatus$;
