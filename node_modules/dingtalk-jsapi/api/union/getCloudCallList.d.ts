import { ICommonAPIParams } from '../../constant/types';
/**
 * 查询话单列表 请求参数定义
 * @apiName getCloudCallList
 */
export interface IUnionGetCloudCallListParams extends ICommonAPIParams {
    index: number;
    corpId: string;
    endTime: string;
    pageSize: number;
    bizNumber?: string;
    direction: number;
    sessionId?: string;
    startTime: string;
    staffIdList?: string[];
}
/**
 * 查询话单列表 返回结果定义
 * @apiName getCloudCallList
 */
export interface IUnionGetCloudCallListResult {
    code: number;
    cause: string;
    total: number;
    hasMore: boolean;
    callList: string[];
    currentIndex: number;
}
/**
 * 查询话单列表
 * @apiName getCloudCallList
 */
export declare function getCloudCallList$(params: IUnionGetCloudCallListParams): Promise<IUnionGetCloudCallListResult>;
export default getCloudCallList$;
