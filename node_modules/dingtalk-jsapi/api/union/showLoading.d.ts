import { ICommonAPIParams } from '../../constant/types';
/**
 * 显示加载提示 请求参数定义
 * @apiName showLoading
 */
export interface IUnionShowLoadingParams extends ICommonAPIParams {
    content: string;
}
/**
 * 显示加载提示 返回结果定义
 * @apiName showLoading
 */
export interface IUnionShowLoadingResult {
}
/**
 * 显示加载提示
 * @apiName showLoading
 */
export declare function showLoading$(params: IUnionShowLoadingParams): Promise<IUnionShowLoadingResult>;
export default showLoading$;
