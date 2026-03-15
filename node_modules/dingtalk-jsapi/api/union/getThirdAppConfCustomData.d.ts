import { ICommonAPIParams } from '../../constant/types';
/**
 * 会议三方应用获取会议信息 请求参数定义
 * @apiName getThirdAppConfCustomData
 */
export interface IUnionGetThirdAppConfCustomDataParams extends ICommonAPIParams {
    thirdAppId: string;
    coolAppCode: string;
}
/**
 * 会议三方应用获取会议信息 返回结果定义
 * @apiName getThirdAppConfCustomData
 */
export interface IUnionGetThirdAppConfCustomDataResult {
    confCustomData: string;
}
/**
 * 会议三方应用获取会议信息
 * @apiName getThirdAppConfCustomData
 */
export declare function getThirdAppConfCustomData$(params: IUnionGetThirdAppConfCustomDataParams): Promise<IUnionGetThirdAppConfCustomDataResult>;
export default getThirdAppConfCustomData$;
