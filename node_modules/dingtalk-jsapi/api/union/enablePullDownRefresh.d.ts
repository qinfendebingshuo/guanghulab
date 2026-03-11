import { ICommonAPIParams } from '../../constant/types';
/**
 * 启用下拉刷新 请求参数定义
 * @apiName enablePullDownRefresh
 */
export interface IUnionEnablePullDownRefreshParams extends ICommonAPIParams {
}
/**
 * 启用下拉刷新 返回结果定义
 * @apiName enablePullDownRefresh
 */
export interface IUnionEnablePullDownRefreshResult {
}
/**
 * 启用下拉刷新
 * @apiName enablePullDownRefresh
 */
export declare function enablePullDownRefresh$(params: IUnionEnablePullDownRefreshParams): Promise<IUnionEnablePullDownRefreshResult>;
export default enablePullDownRefresh$;
