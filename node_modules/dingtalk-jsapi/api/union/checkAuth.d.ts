import { ICommonAPIParams } from '../../constant/types';
/**
 * 检查手机权限授权状态 请求参数定义
 * @apiName checkAuth
 */
export interface IUnionCheckAuthParams extends ICommonAPIParams {
    authType: string;
}
/**
 * 检查手机权限授权状态 返回结果定义
 * @apiName checkAuth
 */
export interface IUnionCheckAuthResult {
    granted: boolean;
}
/**
 * 检查手机权限授权状态
 * @apiName checkAuth
 */
export declare function checkAuth$(params: IUnionCheckAuthParams): Promise<IUnionCheckAuthResult>;
export default checkAuth$;
