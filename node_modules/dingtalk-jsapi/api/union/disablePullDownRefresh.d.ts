import { ICommonAPIParams } from '../../constant/types';
/**
 * 禁用下拉刷新 请求参数定义
 * @apiName disablePullDownRefresh
 */
export interface IUnionDisablePullDownRefreshParams extends ICommonAPIParams {
}
/**
 * 禁用下拉刷新 返回结果定义
 * @apiName disablePullDownRefresh
 */
export interface IUnionDisablePullDownRefreshResult {
}
/**
 * 禁用下拉刷新
 * @apiName disablePullDownRefresh
 */
export declare function disablePullDownRefresh$(params: IUnionDisablePullDownRefreshParams): Promise<IUnionDisablePullDownRefreshResult>;
export default disablePullDownRefresh$;
