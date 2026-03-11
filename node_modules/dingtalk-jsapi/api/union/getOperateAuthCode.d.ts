import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取微应用反馈式操作的临时授权码 请求参数定义
 * @apiName getOperateAuthCode
 */
export interface IUnionGetOperateAuthCodeParams extends ICommonAPIParams {
    corpId: string;
    agentId: string;
}
/**
 * 获取微应用反馈式操作的临时授权码 返回结果定义
 * @apiName getOperateAuthCode
 */
export interface IUnionGetOperateAuthCodeResult {
    code: string;
}
/**
 * 获取微应用反馈式操作的临时授权码
 * @apiName getOperateAuthCode
 */
export declare function getOperateAuthCode$(params: IUnionGetOperateAuthCodeParams): Promise<IUnionGetOperateAuthCodeResult>;
export default getOperateAuthCode$;
