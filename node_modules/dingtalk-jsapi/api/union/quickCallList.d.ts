import { ICommonAPIParams } from '../../constant/types';
/**
 * 拨打单人电话选项 请求参数定义
 * @apiName quickCallList
 */
export interface IUnionQuickCallListParams extends ICommonAPIParams {
    title: string;
    corpId: string;
    content: string;
    staffId?: string;
    typeList: number[];
    phoneNumber?: string;
}
/**
 * 拨打单人电话选项 返回结果定义
 * @apiName quickCallList
 */
export interface IUnionQuickCallListResult {
    callId: string;
    callType: number;
    callTypeList: number[];
}
/**
 * 拨打单人电话选项
 * @apiName quickCallList
 */
export declare function quickCallList$(params: IUnionQuickCallListParams): Promise<IUnionQuickCallListResult>;
export default quickCallList$;
