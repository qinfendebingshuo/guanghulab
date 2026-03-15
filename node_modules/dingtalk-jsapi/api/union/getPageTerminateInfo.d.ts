import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取WebView崩溃信息 请求参数定义
 * @apiName getPageTerminateInfo
 */
export interface IUnionGetPageTerminateInfoParams extends ICommonAPIParams {
}
/**
 * 获取WebView崩溃信息 返回结果定义
 * @apiName getPageTerminateInfo
 */
export interface IUnionGetPageTerminateInfoResult {
    terminateTimes: number;
}
/**
 * 获取WebView崩溃信息
 * @apiName getPageTerminateInfo
 */
export declare function getPageTerminateInfo$(params: IUnionGetPageTerminateInfoParams): Promise<IUnionGetPageTerminateInfoResult>;
export default getPageTerminateInfo$;
