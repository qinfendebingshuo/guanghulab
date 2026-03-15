import { ICommonAPIParams } from '../../constant/types';
/**
 * 会议三方应用获取用户信息的token 请求参数定义
 * @apiName getThirdAppUserCustomData
 */
export interface IUnionGetThirdAppUserCustomDataParams extends ICommonAPIParams {
    thirdAppId: string;
    coolAppCode: string;
}
/**
 * 会议三方应用获取用户信息的token 返回结果定义
 * @apiName getThirdAppUserCustomData
 */
export interface IUnionGetThirdAppUserCustomDataResult {
    userCustomData: string;
}
/**
 * 会议三方应用获取用户信息的token
 * @apiName getThirdAppUserCustomData
 */
export declare function getThirdAppUserCustomData$(params: IUnionGetThirdAppUserCustomDataParams): Promise<IUnionGetThirdAppUserCustomDataResult>;
export default getThirdAppUserCustomData$;
