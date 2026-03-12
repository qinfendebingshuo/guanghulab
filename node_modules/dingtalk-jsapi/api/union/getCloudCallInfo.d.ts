import { ICommonAPIParams } from '../../constant/types';
/**
 * 查询企业是否已开办公电话 请求参数定义
 * @apiName getCloudCallInfo
 */
export interface IUnionGetCloudCallInfoParams extends ICommonAPIParams {
    corpId: string;
}
/**
 * 查询企业是否已开办公电话 返回结果定义
 * @apiName getCloudCallInfo
 */
export interface IUnionGetCloudCallInfoResult {
    code: number;
    cause: string;
    hasOpen: boolean;
    bizNumberList: string[];
}
/**
 * 查询企业是否已开办公电话
 * @apiName getCloudCallInfo
 */
export declare function getCloudCallInfo$(params: IUnionGetCloudCallInfoParams): Promise<IUnionGetCloudCallInfoResult>;
export default getCloudCallInfo$;
