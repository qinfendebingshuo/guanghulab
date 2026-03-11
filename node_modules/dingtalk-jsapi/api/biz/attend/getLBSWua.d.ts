import { ICommonAPIParams } from '../../../constant/types';
/**
 * 获取防作弊参数 请求参数定义
 * @apiName biz.attend.getLBSWua
 */
export interface IBizAttendGetLBSWuaParams extends ICommonAPIParams {
}
/**
 * 获取防作弊参数 返回结果定义
 * @apiName biz.attend.getLBSWua
 */
export interface IBizAttendGetLBSWuaResult {
    ddSec: string;
    ddSig: string;
    lbsWua: string;
}
/**
 * 获取防作弊参数
 * @apiName biz.attend.getLBSWua
 */
export declare function getLBSWua$(params: IBizAttendGetLBSWuaParams): Promise<IBizAttendGetLBSWuaResult>;
export default getLBSWua$;
