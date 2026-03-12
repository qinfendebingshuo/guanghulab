import { ICommonAPIParams } from '../../../constant/types';
/**
 * 检查手机权限授权状态 请求参数定义
 * @apiName biz.util.checkAuth
 */
export interface IBizUtilCheckAuthParams extends ICommonAPIParams {
    authType: string;
}
/**
 * 检查手机权限授权状态 返回结果定义
 * @apiName biz.util.checkAuth
 */
export interface IBizUtilCheckAuthResult {
    granted: boolean;
}
/**
 * 检查手机权限授权状态
 * @apiName biz.util.checkAuth
 */
export declare function checkAuth$(params: IBizUtilCheckAuthParams): Promise<IBizUtilCheckAuthResult>;
export default checkAuth$;
