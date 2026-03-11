import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止下拉刷新 请求参数定义
 * @apiName stopPullDownRefresh
 */
export interface IUnionStopPullDownRefreshParams extends ICommonAPIParams {
}
/**
 * 停止下拉刷新 返回结果定义
 * @apiName stopPullDownRefresh
 */
export interface IUnionStopPullDownRefreshResult {
}
/**
 * 停止下拉刷新
 * @apiName stopPullDownRefresh
 */
export declare function stopPullDownRefresh$(params: IUnionStopPullDownRefreshParams): Promise<IUnionStopPullDownRefreshResult>;
export default stopPullDownRefresh$;
