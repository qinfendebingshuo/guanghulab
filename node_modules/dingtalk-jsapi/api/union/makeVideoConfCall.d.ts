import { ICommonAPIParams } from '../../constant/types';
/**
 * 发起视频会议 请求参数定义
 * @apiName makeVideoConfCall
 */
export interface IUnionMakeVideoConfCallParams extends ICommonAPIParams {
    title: string;
    calleeCorpId: string;
    calleeStaffIds: string[];
}
/**
 * 发起视频会议 返回结果定义
 * @apiName makeVideoConfCall
 */
export interface IUnionMakeVideoConfCallResult {
}
/**
 * 发起视频会议
 * @apiName makeVideoConfCall
 */
export declare function makeVideoConfCall$(params: IUnionMakeVideoConfCallParams): Promise<IUnionMakeVideoConfCallResult>;
export default makeVideoConfCall$;
