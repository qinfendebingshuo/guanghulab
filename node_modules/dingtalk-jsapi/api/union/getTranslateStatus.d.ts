import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取翻译状态 请求参数定义
 * @apiName getTranslateStatus
 */
export interface IUnionGetTranslateStatusParams extends ICommonAPIParams {
}
/**
 * 获取翻译状态 返回结果定义
 * @apiName getTranslateStatus
 */
export interface IUnionGetTranslateStatusResult {
    token: string;
    pageId: string;
    status: string;
    bizName: string;
    targetLanguage: string;
}
/**
 * 获取翻译状态
 * @apiName getTranslateStatus
 */
export declare function getTranslateStatus$(params: IUnionGetTranslateStatusParams): Promise<IUnionGetTranslateStatusResult>;
export default getTranslateStatus$;
