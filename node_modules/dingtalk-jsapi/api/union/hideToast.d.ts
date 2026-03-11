import { ICommonAPIParams } from '../../constant/types';
/**
 * 隐藏弱提示 请求参数定义
 * @apiName hideToast
 */
export interface IUnionHideToastParams extends ICommonAPIParams {
}
/**
 * 隐藏弱提示 返回结果定义
 * @apiName hideToast
 */
export interface IUnionHideToastResult {
}
/**
 * 隐藏弱提示
 * @apiName hideToast
 */
export declare function hideToast$(params: IUnionHideToastParams): Promise<IUnionHideToastResult>;
export default hideToast$;
