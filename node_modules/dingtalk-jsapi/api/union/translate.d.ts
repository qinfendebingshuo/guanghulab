import { ICommonAPIParams } from '../../constant/types';
/**
 * 文案翻译（流式返回） 请求参数定义
 * @apiName translate
 */
export interface IUnionTranslateParams extends ICommonAPIParams {
    token: string;
    sourceTexts: {
        id: string;
        text: string;
        format?: string;
    }[];
    targetLanguage: string;
}
/**
 * 文案翻译（流式返回） 返回结果定义
 * @apiName translate
 */
export interface IUnionTranslateResult {
    translatedTexts: {
        id: string;
        text: string;
    }[];
}
/**
 * 文案翻译（流式返回）
 * @apiName translate
 */
export declare function translate$(params: IUnionTranslateParams): Promise<IUnionTranslateResult>;
export default translate$;
