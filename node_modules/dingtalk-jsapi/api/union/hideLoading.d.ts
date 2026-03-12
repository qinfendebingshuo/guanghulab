import { ICommonAPIParams } from '../../constant/types';
/**
 * 隐藏加载提示 请求参数定义
 * @apiName hideLoading
 */
export interface IUnionHideLoadingParams extends ICommonAPIParams {
}
/**
 * 隐藏加载提示 返回结果定义
 * @apiName hideLoading
 */
export interface IUnionHideLoadingResult {
}
/**
 * 隐藏加载提示
 * @apiName hideLoading
 */
export declare function hideLoading$(params: IUnionHideLoadingParams): Promise<IUnionHideLoadingResult>;
export default hideLoading$;
